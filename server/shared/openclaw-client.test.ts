import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event?: unknown) => void | Promise<void>;

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;

  sent: string[] = [];

  private listeners = new Map<string, Set<Listener>>();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);

    queueMicrotask(() => {
      this.emit("open");
    });
  }

  addEventListener(type: string, listener: Listener) {
    const current = this.listeners.get(type) ?? new Set<Listener>();
    current.add(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.emit("close", { code: 1000, reason: "" });
  }

  emit(type: string, event?: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      void listener(event);
    }
  }
}

describe("shared/openclaw-client", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("authenticates, sends the prompt and resolves the final response text", async () => {
    process.env.OPENCLAW_BASE_URL = "wss://openclaw.test/ws";
    process.env.OPENCLAW_API_KEY = "test-key";
    process.env.OPENCLAW_MODEL = "openclaw-model";

    const { sendMessage } = await import("./openclaw-client.js");

    const promise = sendMessage("classifique");
    await Promise.resolve();

    const socket = MockWebSocket.instances[0];
    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      type: "req",
      method: "connect",
      params: {
        auth: { token: "test-key" },
        role: "operator",
      },
    });

    const connectFrame = JSON.parse(socket.sent[0]);
    socket.emit("message", {
      data: JSON.stringify({
        type: "res",
        id: connectFrame.id,
        ok: true,
        payload: {
          hello: true,
        },
      }),
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(socket.sent).toHaveLength(2);
    expect(JSON.parse(socket.sent[1])).toMatchObject({
      type: "req",
      method: "chat.send",
      params: {
        message: "classifique",
        deliver: false,
        model: "openclaw-model",
      },
    });

    socket.emit("message", {
      data: JSON.stringify({
        type: "event",
        state: "final",
        message: {
          role: "assistant",
          content: [{ type: "text", text: '{"items":[]}' }],
        },
      }),
    });

    await expect(promise).resolves.toBe('{"items":[]}');
  });

  it("fails clearly when required configuration is missing", async () => {
    delete process.env.OPENCLAW_BASE_URL;
    process.env.OPENCLAW_API_KEY = "test-key";

    const { sendMessage } = await import("./openclaw-client.js");

    await expect(sendMessage("classifique")).rejects.toMatchObject({
      code: "missing_base_url",
    });
  });

  it("prefers OPENCLAW_GATEWAY_TOKEN over OPENCLAW_API_KEY", async () => {
    process.env.OPENCLAW_BASE_URL = "wss://openclaw.test/ws";
    process.env.OPENCLAW_API_KEY = "old-token";
    process.env.OPENCLAW_GATEWAY_TOKEN = "gateway-token";

    const { sendMessage } = await import("./openclaw-client.js");

    const promise = sendMessage("classifique");
    await Promise.resolve();

    const socket = MockWebSocket.instances[0];
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      params: {
        auth: { token: "gateway-token" },
      },
    });

    const connectFrame = JSON.parse(socket.sent[0]);
    socket.emit("message", {
      data: JSON.stringify({
        type: "res",
        id: connectFrame.id,
        ok: false,
        error: {
          message: "unauthorized",
          details: { code: "AUTH_TOKEN_MISMATCH" },
        },
      }),
    });

    await expect(promise).rejects.toMatchObject({
      code: "invalid_gateway_token",
    });
  });

  it("does not retry when the gateway token is invalid", async () => {
    process.env.OPENCLAW_BASE_URL = "wss://openclaw.test/ws";
    process.env.OPENCLAW_API_KEY = "wrong-token";

    const { sendMessage } = await import("./openclaw-client.js");

    const promise = sendMessage("classifique");
    await Promise.resolve();

    const socket = MockWebSocket.instances[0];
    const connectFrame = JSON.parse(socket.sent[0]);
    socket.emit("message", {
      data: JSON.stringify({
        type: "res",
        id: connectFrame.id,
        ok: false,
        error: {
          message: "unauthorized: gateway token mismatch (provide gateway auth token)",
          details: {
            code: "AUTH_TOKEN_MISMATCH",
          },
        },
      }),
    });

    await expect(promise).rejects.toMatchObject({
      code: "invalid_gateway_token",
      message: "OPENCLAW_GATEWAY_TOKEN/OPENCLAW_API_KEY is invalid for the configured OpenClaw gateway.",
    });
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
