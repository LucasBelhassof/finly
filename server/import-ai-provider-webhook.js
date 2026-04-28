function getWebhookProviderConfig() {
  return {
    url: process.env.IMPORT_AI_WEBHOOK_URL?.trim(),
    timeoutMs: Number.parseInt(process.env.IMPORT_AI_TIMEOUT_MS ?? "8000", 10),
  };
}

export async function requestWebhookImportAiSuggestions(payload) {
  const response = await requestWebhookImportAiSuggestionsWithTelemetry(payload);
  return response.items;
}

export async function requestWebhookImportAiSuggestionsWithTelemetry(payload) {
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

    return {
      items: Array.isArray(body?.items) ? body.items : [],
      provider: typeof body?.provider === "string" ? body.provider : null,
      model: typeof body?.model === "string" ? body.model : null,
      usage:
        body?.usage && typeof body.usage === "object"
          ? {
              inputTokens: Number.isFinite(Number(body.usage.inputTokens)) ? Math.max(0, Math.round(Number(body.usage.inputTokens))) : null,
              outputTokens: Number.isFinite(Number(body.usage.outputTokens)) ? Math.max(0, Math.round(Number(body.usage.outputTokens))) : null,
              totalTokens: Number.isFinite(Number(body.usage.totalTokens)) ? Math.max(0, Math.round(Number(body.usage.totalTokens))) : null,
              requestCount: Number.isFinite(Number(body.usage.requestCount)) ? Math.max(0, Math.round(Number(body.usage.requestCount))) : null,
            }
          : null,
      estimatedCostUsd:
        Number.isFinite(Number(body?.estimatedCostUsd)) ? Number(Number(body.estimatedCostUsd).toFixed(8)) : null,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("A sugestao por IA expirou antes da resposta.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
