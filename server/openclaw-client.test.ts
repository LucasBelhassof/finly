import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenClawClientError, requestOpenClawChatCompletion } from "./openclaw-client.js";

describe("openclaw-client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("builds an OpenAI-compatible request against the configured local endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await requestOpenClawChatCompletion(
      {
        messages: [{ role: "user", content: "teste" }],
        temperature: 0.2,
      },
      {
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "openclaw-test",
        timeoutMs: 1200,
        apiKey: "secret",
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret",
        },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: "openclaw-test",
      messages: [{ role: "user", content: "teste" }],
      temperature: 0.2,
    });
  });

  it("normalizes wss base URLs to https before sending HTTP requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await requestOpenClawChatCompletion(
      {
        messages: [{ role: "user", content: "teste" }],
      },
      {
        baseUrl: "wss://gateway.example.test",
        model: "openclaw-test",
        timeoutMs: 1200,
      },
    );

    expect(fetchMock.mock.calls[0][0]).toBe("https://gateway.example.test/chat/completions");
  });

  it("respects the configured timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_, init) =>
        new Promise((_, reject) => {
          init.signal.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
      ),
    );

    const expectation = expect(
      requestOpenClawChatCompletion(
        {
          messages: [{ role: "user", content: "teste" }],
        },
        {
          baseUrl: "http://127.0.0.1:11434/v1",
          model: "openclaw-test",
          timeoutMs: 50,
        },
      ),
    ).rejects.toMatchObject<Partial<OpenClawClientError>>({
      code: "timeout",
    });

    await vi.advanceTimersByTimeAsync(60);
    await expectation;
  });

  it("fails with a controlled error when the provider returns invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "{invalid",
      }),
    );

    await expect(
      requestOpenClawChatCompletion(
        {
          messages: [{ role: "user", content: "teste" }],
        },
        {
          baseUrl: "http://127.0.0.1:11434/v1",
          model: "openclaw-test",
          timeoutMs: 50,
        },
      ),
    ).rejects.toMatchObject<Partial<OpenClawClientError>>({
      code: "invalid_json",
    });
  });
});
