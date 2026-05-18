import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AiChat from "@/components/AiChat";
import { PremiumGate } from "@/components/premium/PremiumGate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useChatConversations, useCreateChatConversation } from "@/hooks/use-chat";
import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";

const NEW_CHAT_VALUE = "__new__";
const INLINE_SELECT_TRIGGER_CLASSNAME = "h-10 rounded-md border-border/60 bg-background";

function getChatPath(chatId: string) {
  return `${appRoutes.chat}/${chatId}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function DashboardChatCard() {
  const { user } = useAuthContext();
  const isPremiumUser = Boolean(user?.isPremium);
  const navigate = useNavigate();
  const { data: chats = [] } = useChatConversations({ enabled: isPremiumUser });
  const createChat = useCreateChatConversation();
  const [selectedChatId, setSelectedChatId] = useState(NEW_CHAT_VALUE);
  const [activeChatId, setActiveChatId] = useState<string | undefined>();
  const [pendingInitialMessage, setPendingInitialMessage] = useState<string | null>(null);

  useEffect(() => {
    if (selectedChatId === NEW_CHAT_VALUE) {
      setActiveChatId(undefined);
      setPendingInitialMessage(null);
      return;
    }

    if (!chats.some((chat) => chat.id === selectedChatId)) {
      if (activeChatId === selectedChatId) {
        return;
      }

      setSelectedChatId(NEW_CHAT_VALUE);
      return;
    }

    if (selectedChatId !== activeChatId) {
      setPendingInitialMessage(null);
    }

    setActiveChatId(selectedChatId);
  }, [activeChatId, chats, selectedChatId]);

  const openNewChat = async (initialMessage?: string) => {
    try {
      const chat = await createChat.mutateAsync();
      setSelectedChatId(chat.id);
      setActiveChatId(chat.id);
      setPendingInitialMessage(initialMessage ?? null);
      return true;
    } catch (error) {
      toast.error("Não foi possível iniciar um novo chat.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
      return false;
    }
  };

  const handleStartConversation = async (message: string) => {
    if (selectedChatId === NEW_CHAT_VALUE) {
      return openNewChat(message);
    }

    setActiveChatId(selectedChatId);
    return true;
  };

  const handleOpenFullChat = () => {
    navigate(activeChatId ? getChatPath(activeChatId) : appRoutes.chat);
  };

  if (!isPremiumUser) {
    return (
      <PremiumGate
        featureLabel="Chat financeiro com IA"
        description="Faça upgrade para conversar com Kip com contexto do seu histórico e conversas salvas."
      >
        <AiChat />
      </PremiumGate>
    );
  }

  return (
    <AiChat
      chatId={activeChatId}
      creatingConversation={createChat.isPending}
      initialMessage={pendingInitialMessage}
      onInitialMessageHandled={() => setPendingInitialMessage(null)}
      onStartConversation={handleStartConversation}
      onOpenFullChat={handleOpenFullChat}
      headerActions={
        <div className="w-full sm:w-auto">
          <Select value={selectedChatId} onValueChange={setSelectedChatId}>
            <SelectTrigger
              aria-label="Escolher conversa do chat financeiro"
              className={`w-full min-w-[12rem] ${INLINE_SELECT_TRIGGER_CLASSNAME}`}
            >
              <SelectValue placeholder="Novo chat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW_CHAT_VALUE}>Novo chat</SelectItem>
              {chats.map((chat) => (
                <SelectItem key={chat.id} value={chat.id}>
                  {chat.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    />
  );
}
