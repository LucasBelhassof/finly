import { assertOpenClawConfig } from "./openclaw-config.js";

export class OpenClawClientError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "OpenClawClientError";
    this.code = code;
    this.status = options.status ?? 502;
    this.cause = options.cause;
    this.details = options.details;
  }
}

function buildEndpointUrl(baseUrl) {
  return `${baseUrl}/chat/completions`;
}

function buildHeaders(apiKey) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

export async function requestOpenClawChatCompletion(payload, overrides = {}) {
  const config = assertOpenClawConfig(overrides);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(buildEndpointUrl(config.baseUrl), {
      method: "POST",
      headers: buildHeaders(config.apiKey),
      body: JSON.stringify({
        model: config.model,
        ...payload,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    let body = {};

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new OpenClawClientError("invalid_json", "O OpenClaw retornou um corpo JSON invalido.", {
          details: {
            endpoint: buildEndpointUrl(config.baseUrl),
          },
        });
      }
    }

    if (!response.ok) {
      throw new OpenClawClientError(
        "http_error",
        body?.error?.message ?? body?.message ?? "O OpenClaw falhou ao processar a solicitacao.",
        {
          status: response.status >= 400 && response.status < 500 ? response.status : 502,
          details: {
            endpoint: buildEndpointUrl(config.baseUrl),
            responseStatus: response.status,
            responseBody: typeof text === "string" ? text.slice(0, 300) : "",
          },
        },
      );
    }

    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new OpenClawClientError("timeout", "O OpenClaw nao respondeu dentro do tempo limite.", {
        cause: error,
        details: {
          endpoint: buildEndpointUrl(config.baseUrl),
          timeoutMs: config.timeoutMs,
        },
      });
    }

    if (error instanceof OpenClawClientError) {
      throw error;
    }

    throw new OpenClawClientError("network_error", "Falha ao conectar com o OpenClaw.", {
      cause: error,
      details: {
        endpoint: buildEndpointUrl(config.baseUrl),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function extractOpenAiCompatibleContent(responseBody, providerLabel = "OpenClaw") {
  const refusal = responseBody?.choices?.[0]?.message?.refusal;

  if (refusal) {
    throw new OpenClawClientError("refusal", `${providerLabel} recusou a solicitacao.`);
  }

  const content = responseBody?.choices?.[0]?.message?.content;

  if (typeof content === "string" && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  throw new OpenClawClientError("empty_response", `${providerLabel} nao retornou conteudo valido.`);
}
