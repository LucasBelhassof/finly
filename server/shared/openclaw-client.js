import { randomUUID } from "node:crypto";

const DEFAULT_OPENCLAW_TIMEOUT_MS = 15000;
const DEFAULT_OPENCLAW_RECONNECT_ATTEMPTS = 1;
const OPENCLAW_ROLE = "operator";
const OPENCLAW_SCOPES = ["operator.read", "operator.write"];

export class OpenClawSocketError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "OpenClawSocketError";
    this.code = code;
    this.details = details;
  }
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getOpenClawConfig() {
  const baseUrl = String(process.env.OPENCLAW_BASE_URL ?? "").trim();
  const apiKey = String(process.env.OPENCLAW_GATEWAY_TOKEN ?? process.env.OPENCLAW_API_KEY ?? "").trim();
  const model = String(process.env.OPENCLAW_MODEL ?? process.env.IMPORT_AI_MODEL ?? "").trim();

  if (!baseUrl) {
    throw new OpenClawSocketError("missing_base_url", "OPENCLAW_BASE_URL is required when IMPORT_AI_PROVIDER includes openclaw.");
  }

  if (!apiKey) {
    throw new OpenClawSocketError("missing_api_key", "OPENCLAW_GATEWAY_TOKEN or OPENCLAW_API_KEY is required when IMPORT_AI_PROVIDER includes openclaw.");
  }

  return {
    apiKey,
    baseUrl,
    model,
    reconnectAttempts: DEFAULT_OPENCLAW_RECONNECT_ATTEMPTS,
    timeoutMs: parsePositiveInteger(
      String(process.env.OPENCLAW_TIMEOUT_MS ?? process.env.IMPORT_AI_TIMEOUT_MS ?? ""),
      DEFAULT_OPENCLAW_TIMEOUT_MS,
    ),
  };
}

function normalizeMessageData(data) {
  if (typeof data === "string") {
    return Promise.resolve(data);
  }

  if (data instanceof ArrayBuffer) {
    return Promise.resolve(Buffer.from(data).toString("utf8"));
  }

  if (ArrayBuffer.isView(data)) {
    return Promise.resolve(Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8"));
  }

  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return data.text();
  }

  return Promise.resolve(String(data ?? ""));
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function extractText(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => extractText(item))
      .filter(Boolean)
      .join("");

    return joined.trim() ? joined.trim() : null;
  }

  if (value && typeof value === "object") {
    const content = value.content;

    if (Array.isArray(content)) {
      const textContent = content
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          if (item.type === "text" && typeof item.text === "string") {
            return item.text;
          }

          return extractText(item);
        })
        .filter(Boolean)
        .join("\n");

      if (textContent.trim()) {
        return textContent.trim();
      }
    }

    for (const key of ["text", "message", "content", "output", "response", "delta"]) {
      const extracted = extractText(value[key]);

      if (extracted) {
        return extracted;
      }
    }
  }

  return null;
}

function buildRequestFrame(id, method, params) {
  return JSON.stringify({
    type: "req",
    id,
    method,
    params,
  });
}

function buildConnectParams(config) {
  return {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: "node-host",
      version: "1.0.0",
      platform: "node",
      mode: "backend",
      instanceId: "finance-import",
    },
    role: OPENCLAW_ROLE,
    scopes: OPENCLAW_SCOPES,
    caps: ["tool-events"],
    auth: {
      token: config.apiKey,
    },
    userAgent: "finance-backend",
    locale: "pt-BR",
  };
}

function buildChatSendParams(config, message, sessionKey, runId) {
  return {
    sessionKey,
    message,
    deliver: false,
    idempotencyKey: runId,
    model: config.model || undefined,
  };
}

function normalizeGatewayError(payload, fallbackMethod = "unknown") {
  const errorRecord = payload.error && typeof payload.error === "object" ? payload.error : null;
  const details = errorRecord && errorRecord.details && typeof errorRecord.details === "object" ? errorRecord.details : null;
  const message =
    (errorRecord && typeof errorRecord.message === "string" ? errorRecord.message : null) ??
    "OpenClaw gateway request failed.";

  if (details?.code === "AUTH_TOKEN_MISMATCH") {
    return new OpenClawSocketError("invalid_gateway_token", "OPENCLAW_GATEWAY_TOKEN/OPENCLAW_API_KEY is invalid for the configured OpenClaw gateway.", {
      details,
      method: details?.method ?? fallbackMethod,
    });
  }

  return new OpenClawSocketError("gateway_request_failed", message, {
    details,
    method: details?.method ?? fallbackMethod,
  });
}

function isNonRetryableOpenClawError(error) {
  return error.code === "invalid_gateway_token" || error.code === "missing_api_key" || error.code === "missing_base_url";
}

function parseChatEvent(payload) {
  const state = typeof payload.state === "string" ? payload.state : "";

  if (state === "error") {
    return {
      errorMessage: typeof payload.errorMessage === "string" ? payload.errorMessage : "OpenClaw chat failed.",
      finalText: null,
      streamText: null,
    };
  }

  if (state === "delta") {
    return {
      errorMessage: null,
      finalText: null,
      streamText: extractText(payload.message),
    };
  }

  if (state === "final" || state === "aborted") {
    return {
      errorMessage: null,
      finalText: extractText(payload.message),
      streamText: null,
    };
  }

  return {
    errorMessage: null,
    finalText: null,
    streamText: null,
  };
}

function createSessionKey() {
  return `finance:${randomUUID()}`;
}

async function connectAndSend(config, message, attempt) {
  console.log(`[import-ai] OpenClaw connecting via WebSocket (attempt ${attempt + 1}).`);

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(config.baseUrl);
    const pending = new Map();
    const sessionKey = createSessionKey();
    const runId = randomUUID();
    let settled = false;
    let streamedText = "";

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      socket.close();
      reject(
        new OpenClawSocketError("timeout", "OpenClaw timed out before returning a response.", {
          attempt: attempt + 1,
          timeoutMs: config.timeoutMs,
          url: config.baseUrl,
        }),
      );
    }, config.timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("error", handleError);
      socket.removeEventListener("close", handleClose);
    };

    const fail = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };

    const succeed = (text) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      console.log("[import-ai] OpenClaw response received.");
      resolve(text);
    };

    const sendRequest = (method, params) => {
      const id = randomUUID();

      const promise = new Promise((requestResolve, requestReject) => {
        pending.set(id, {
          method,
          reject: requestReject,
          resolve: requestResolve,
        });
      });

      socket.send(buildRequestFrame(id, method, params));
      return promise;
    };

    const handleOpen = () => {
      console.log("[import-ai] OpenClaw WebSocket connected.");

      void sendRequest("connect", buildConnectParams(config))
        .then(() => {
          console.log("[import-ai] OpenClaw gateway connect acknowledged.");
          return sendRequest("chat.send", buildChatSendParams(config, message, sessionKey, runId));
        })
        .then(() => {
          console.log("[import-ai] OpenClaw chat.send sent.");
        })
        .catch((error) => {
          fail(
            error instanceof OpenClawSocketError
              ? error
              : new OpenClawSocketError("gateway_request_failed", error instanceof Error ? error.message : String(error), {
                  url: config.baseUrl,
                }),
          );
        });
    };

    const handleMessage = async (event) => {
      try {
        const raw = await normalizeMessageData(event.data);
        const parsed = safeJsonParse(raw);

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return;
        }

        if (parsed.type === "res" && typeof parsed.id === "string") {
          const request = pending.get(parsed.id);

          if (!request) {
            return;
          }

          pending.delete(parsed.id);

          if (parsed.ok === true) {
            request.resolve(parsed.payload);
          } else {
            request.reject(normalizeGatewayError(parsed, request.method));
          }

          return;
        }

        if (parsed.type === "event") {
          const chatEvent = parseChatEvent(parsed);

          if (chatEvent.errorMessage) {
            fail(
              new OpenClawSocketError("provider_error", chatEvent.errorMessage, {
                sessionKey,
                url: config.baseUrl,
              }),
            );
            return;
          }

          if (chatEvent.streamText) {
            streamedText = chatEvent.streamText;
          }

          if (chatEvent.finalText !== null) {
            const finalText = chatEvent.finalText.trim() || streamedText.trim();

            if (!finalText) {
              fail(
                new OpenClawSocketError("empty_response", "OpenClaw returned an empty response.", {
                  sessionKey,
                  url: config.baseUrl,
                }),
              );
              return;
            }

            succeed(finalText);
            socket.close();
          }
        }
      } catch (error) {
        fail(
          error instanceof OpenClawSocketError
            ? error
            : new OpenClawSocketError("message_parse_error", "Failed to parse OpenClaw WebSocket response.", {
                cause: error instanceof Error ? error.message : String(error),
                url: config.baseUrl,
              }),
        );
      }
    };

    const handleError = () => {
      fail(
        new OpenClawSocketError("socket_error", "OpenClaw WebSocket connection failed.", {
          url: config.baseUrl,
        }),
      );
    };

    const handleClose = (event) => {
      if (settled) {
        return;
      }

      fail(
        new OpenClawSocketError("socket_closed", event.reason || `WebSocket closed with code ${event.code}.`, {
          code: event.code,
          reason: event.reason,
          url: config.baseUrl,
        }),
      );
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("error", handleError);
    socket.addEventListener("close", handleClose);
  });
}

export async function sendMessage(message) {
  const config = getOpenClawConfig();
  let lastError = null;

  for (let attempt = 0; attempt <= config.reconnectAttempts; attempt += 1) {
    try {
      return await connectAndSend(config, message, attempt);
    } catch (error) {
      const normalizedError =
        error instanceof OpenClawSocketError
          ? error
          : new OpenClawSocketError("unknown_error", "Unexpected OpenClaw WebSocket failure.", {
              cause: error instanceof Error ? error.message : String(error),
            });

      console.error("[import-ai] OpenClaw WebSocket error:", normalizedError.message, normalizedError.details ?? {});
      lastError = normalizedError;

      if (attempt >= config.reconnectAttempts || isNonRetryableOpenClawError(normalizedError)) {
        break;
      }
    }
  }

  throw lastError ?? new OpenClawSocketError("unknown_error", "OpenClaw request failed.");
}
