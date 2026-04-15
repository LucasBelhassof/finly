import AppShell from "@/components/AppShell";
import AiChat from "@/components/AiChat";
import { DEFAULT_CHAT_LIMIT, useChatMessages } from "@/hooks/use-chat";

export default function ChatPage() {
  const { data: messages = [] } = useChatMessages(DEFAULT_CHAT_LIMIT);

  const userMessages = messages.filter((message) => message.role === "user").length;
  const assistantMessages = messages.filter((message) => message.role === "assistant").length;

  return (
    <AppShell title="Chat IA" description="Converse com o assistente sobre gastos, contas e metas">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[calc(100vh-12.5rem)] min-h-[28rem] sm:h-[calc(100vh-11.5rem)]">
          <AiChat initialMessages={messages} />
        </div>

        <div className="space-y-6">
          <div className="glass-card p-4 sm:p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Resumo da conversa</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Mensagens</span>
                <span className="font-medium text-foreground">{messages.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Usuario</span>
                <span className="font-medium text-foreground">{userMessages}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Assistente</span>
                <span className="font-medium text-foreground">{assistantMessages}</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 sm:p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Sugestoes de perguntas</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="rounded-lg bg-secondary/40 px-3 py-2">Como economizar mais este mes?</p>
              <p className="rounded-lg bg-secondary/40 px-3 py-2">Quais categorias mais pesam no meu saldo?</p>
              <p className="rounded-lg bg-secondary/40 px-3 py-2">Onde estou gastando mais com delivery?</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
