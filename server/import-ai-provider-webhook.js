function getWebhookProviderConfig() {
  return {
    url: process.env.IMPORT_AI_WEBHOOK_URL?.trim(),
    timeoutMs: Number.parseInt(process.env.IMPORT_AI_TIMEOUT_MS ?? "8000", 10),
  };
}

export async function requestWebhookImportAiSuggestions(payload) {
  const config = getWebhookProviderConfig();

  if (!config.url) {
    throw new Error("IMPORT_AI_WEBHOOK_URL is required when IMPORT_AI_MODE=webhook.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(config.timeoutMs) ? config.timeoutMs : 8000);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(body?.message ?? "O webhook de IA falhou.");
    }

    return Array.isArray(body?.items) ? body.items : [];
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("A sugestao por IA expirou antes da resposta.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
