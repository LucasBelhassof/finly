import { Send, Bot, User } from "lucide-react";
import { useState } from "react";

const initialMessages = [
  {
    role: "assistant" as const,
    content: "Olá João! 👋 Analisei suas finanças deste mês. Você gastou 12% a mais em alimentação comparado ao mês passado. Quer que eu sugira formas de economizar?",
  },
  {
    role: "user" as const,
    content: "Sim, por favor! Quero reduzir meus gastos com delivery.",
  },
  {
    role: "assistant" as const,
    content: "Ótimo! Aqui vão 3 dicas:\n\n1. **Cozinhe em lotes** no domingo — economize ~R$ 400/mês\n2. **Use cupons** nos apps de delivery para pedidos essenciais\n3. **Defina um limite semanal** de R$ 80 para delivery\n\nIsso pode gerar uma economia de até R$ 600/mês! 💰",
  },
];

const AiChat = () => {
  const [input, setInput] = useState("");

  return (
    <div className="glass-card flex flex-col h-full animate-fade-in">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot size={14} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Assistente FinAI</h3>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-income pulse-glow" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {initialMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === "assistant" ? "bg-primary/10" : "bg-secondary"
            }`}>
              {msg.role === "assistant" ? (
                <Bot size={13} className="text-primary" />
              ) : (
                <User size={13} className="text-muted-foreground" />
              )}
            </div>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "assistant"
                  ? "bg-secondary text-secondary-foreground rounded-tl-sm"
                  : "bg-primary text-primary-foreground rounded-tr-sm"
              }`}
            >
              {msg.content.split("\n").map((line, j) => (
                <p key={j} className={j > 0 ? "mt-1" : ""}>
                  {line.split(/(\*\*.*?\*\*)/).map((part, k) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <strong key={k}>{part.slice(2, -2)}</strong>
                    ) : (
                      part
                    )
                  )}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border/50">
        <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre suas finanças..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0">
            <Send size={14} className="text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiChat;
