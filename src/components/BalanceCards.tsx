import { TrendingUp, TrendingDown, Wallet, ArrowUpRight } from "lucide-react";

const cards = [
  {
    label: "Saldo Total",
    value: "R$ 12.450,00",
    change: "+2,4%",
    positive: true,
    icon: Wallet,
  },
  {
    label: "Receitas",
    value: "R$ 8.200,00",
    change: "+5,1%",
    positive: true,
    icon: TrendingUp,
  },
  {
    label: "Despesas",
    value: "R$ 4.830,00",
    change: "-3,2%",
    positive: false,
    icon: TrendingDown,
  },
];

const BalanceCards = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="glass-card p-5 animate-fade-in group hover:glow-border transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">{card.label}</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              card.positive ? "bg-income/10" : "bg-expense/10"
            }`}>
              <card.icon size={16} className={card.positive ? "text-income" : "text-expense"} />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">{card.value}</p>
          <div className="flex items-center gap-1">
            <ArrowUpRight size={14} className={card.positive ? "text-income" : "text-expense rotate-90"} />
            <span className={`text-xs font-medium ${card.positive ? "text-income" : "text-expense"}`}>
              {card.change}
            </span>
            <span className="text-xs text-muted-foreground ml-1">vs mês anterior</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BalanceCards;
