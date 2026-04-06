import { Lightbulb, TrendingDown, AlertTriangle, Target, Sparkles } from "lucide-react";

const insights = [
  {
    icon: AlertTriangle,
    iconColor: "text-warning",
    bgColor: "bg-warning/10",
    title: "Gasto acima do orçamento",
    desc: "Seus gastos com restaurantes ultrapassaram o limite mensal de R$ 500 em 23%.",
    tag: "Atenção",
    tagColor: "bg-warning/15 text-warning",
  },
  {
    icon: TrendingDown,
    iconColor: "text-income",
    bgColor: "bg-income/10",
    title: "Economia identificada",
    desc: "Você pode economizar R$ 180/mês cancelando 2 assinaturas pouco utilizadas.",
    tag: "Oportunidade",
    tagColor: "bg-income/15 text-income",
  },
  {
    icon: Target,
    iconColor: "text-info",
    bgColor: "bg-info/10",
    title: "Meta de reserva",
    desc: "Com o ritmo atual, você atinge sua reserva de emergência em 4 meses.",
    tag: "Meta",
    tagColor: "bg-info/15 text-info",
  },
  {
    icon: Sparkles,
    iconColor: "text-primary",
    bgColor: "bg-primary/10",
    title: "Padrão detectado",
    desc: "Seus gastos com Uber aumentam 40% às sextas. Considere alternativas.",
    tag: "Padrão",
    tagColor: "bg-primary/15 text-primary",
  },
];

const AiInsights = () => {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Lightbulb size={14} className="text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">Insights da IA</h3>
      </div>

      <div className="space-y-3">
        {insights.map((item, i) => (
          <div
            key={i}
            className="p-3.5 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-colors border border-border/30"
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg ${item.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                <item.icon size={15} className={item.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${item.tagColor}`}>
                    {item.tag}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AiInsights;
