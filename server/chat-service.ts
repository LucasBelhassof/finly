import { OpenClawSocketError, sendMessage as sendOpenClawMessage } from "./shared/openclaw-client.js";
import { HttpError } from "./shared/errors.js";

function buildChatSystemPrompt() {
  return [
    "Voce e um assistente financeiro do aplicativo Finly.",
    "Responda em portugues do Brasil, com objetividade e foco pratico.",
    "Use apenas o contexto financeiro fornecido.",
    "Nao invente transacoes, categorias ou saldos nao presentes no contexto.",
    "Se o contexto nao bastar, diga isso claramente e sugira o proximo passo util.",
  ].join(" ");
}

export function buildFinancialChatContextSnapshot(context: {
  summaryCards?: Array<{ label?: string; value?: unknown; formattedValue?: string }>;
  spendingByCategory?: Array<{ label?: string; total?: unknown; formattedTotal?: string; percentage?: unknown }>;
  deliverySpend?: unknown;
}) {
  return JSON.stringify({
    summaryCards: Array.isArray(context?.summaryCards)
      ? context.summaryCards.map((card) => ({
          label: card.label,
          value: card.value,
          formattedValue: card.formattedValue,
        }))
      : [],
    spendingByCategory: Array.isArray(context?.spendingByCategory)
      ? context.spendingByCategory.slice(0, 5).map((item) => ({
          label: item.label,
          total: item.total,
          formattedTotal: item.formattedTotal,
          percentage: item.percentage,
        }))
      : [],
    deliverySpend: context?.deliverySpend ?? 0,
  });
}

export async function generateAssistantReply(
  message: string,
  context: {
    summaryCards?: Array<{ label?: string; value?: unknown; formattedValue?: string }>;
    spendingByCategory?: Array<{ label?: string; total?: unknown; formattedTotal?: string; percentage?: unknown }>;
    deliverySpend?: unknown;
  },
) {
  const prompt = [
    buildChatSystemPrompt(),
    "",
    "Pergunta do usuario:",
    message,
    "",
    "Contexto financeiro resumido em JSON:",
    buildFinancialChatContextSnapshot(context),
  ].join("\n");

  return (await sendOpenClawMessage(prompt)).trim();
}

export async function createChatReplyWithOpenClaw({
  userId,
  message,
  loadContext,
  saveReplyPair,
}: {
  userId: number;
  message: string;
  loadContext: (userId: number) => Promise<{
    summaryCards?: Array<{ label?: string; value?: unknown; formattedValue?: string }>;
    spendingByCategory?: Array<{ label?: string; total?: unknown; formattedTotal?: string; percentage?: unknown }>;
    deliverySpend?: unknown;
  }>;
  saveReplyPair: (input: { userId: number; userContent: string; assistantContent: string }) => Promise<unknown>;
}) {
  const trimmedMessage = String(message ?? "").trim();

  if (!trimmedMessage) {
    throw new HttpError(400, "bad_request", "message is required");
  }

  try {
    const context = await loadContext(userId);
    const assistantContent = await generateAssistantReply(trimmedMessage, context);

    if (!assistantContent) {
      throw new OpenClawSocketError("empty_response", "O OpenClaw nao retornou conteudo valido.");
    }

    return saveReplyPair({
      userId,
      userContent: trimmedMessage,
      assistantContent,
    });
  } catch (error) {
    if (error instanceof OpenClawSocketError) {
      throw new HttpError(
        502,
        "ai_provider_unavailable",
        `Nao foi possivel gerar a resposta da IA no momento. ${error.message}`,
        error.details,
      );
    }

    throw error;
  }
}
