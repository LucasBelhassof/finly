import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("chat-service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("persists the user and assistant pair when OpenClaw responds", async () => {
    const saveReplyPair = vi.fn().mockResolvedValue({
      userMessage: { id: 1, role: "user", content: "Como economizar?" },
      assistantMessage: { id: 2, role: "assistant", content: "Revise gastos fixos." },
    });

    vi.doMock("./shared/openclaw-client.js", () => ({
      OpenClawSocketError: class OpenClawSocketError extends Error {},
      sendMessage: vi.fn().mockResolvedValue("Revise gastos fixos."),
    }));

    const { createChatReplyWithOpenClaw } = await import("./chat-service.js");

    const result = await createChatReplyWithOpenClaw({
      userId: 10,
      message: "Como economizar?",
      loadContext: vi.fn().mockResolvedValue({
        summaryCards: [{ label: "Saldo Total", formattedValue: "R$ 1.000,00", value: 1000 }],
        spendingByCategory: [],
        deliverySpend: 0,
      }),
      saveReplyPair,
    });

    expect(saveReplyPair).toHaveBeenCalledWith({
      userId: 10,
      userContent: "Como economizar?",
      assistantContent: "Revise gastos fixos.",
    });
    expect(result.assistantMessage.content).toBe("Revise gastos fixos.");
  });

  it("returns a controlled error and does not persist when OpenClaw fails", async () => {
    const saveReplyPair = vi.fn();

    vi.doMock("./shared/openclaw-client.js", () => {
      class OpenClawSocketError extends Error {
        details?: Record<string, unknown>;

        constructor(message: string, details?: Record<string, unknown>) {
          super(message);
          this.name = "OpenClawSocketError";
          this.details = details;
        }
      }

      return {
        OpenClawSocketError,
        sendMessage: vi.fn().mockRejectedValue(
          new OpenClawSocketError("OpenClaw timed out before returning a response.", {
            url: "wss://openclaw.test/ws",
          }),
        ),
      };
    });

    const { createChatReplyWithOpenClaw } = await import("./chat-service.js");

    await expect(
      createChatReplyWithOpenClaw({
        userId: 10,
        message: "Como economizar?",
        loadContext: vi.fn().mockResolvedValue({
          summaryCards: [],
          spendingByCategory: [],
          deliverySpend: 0,
        }),
        saveReplyPair,
      }),
    ).rejects.toMatchObject({
      status: 502,
      code: "ai_provider_unavailable",
      details: {
        url: "wss://openclaw.test/ws",
      },
    });

    expect(saveReplyPair).not.toHaveBeenCalled();
  });
});
