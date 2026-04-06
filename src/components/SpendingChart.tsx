const data = [
  { label: "Moradia", pct: 45, color: "bg-primary" },
  { label: "Alimentação", pct: 22, color: "bg-warning" },
  { label: "Transporte", pct: 12, color: "bg-info" },
  { label: "Saúde", pct: 8, color: "bg-income" },
  { label: "Lazer", pct: 8, color: "bg-expense" },
  { label: "Outros", pct: 5, color: "bg-muted-foreground" },
];

const SpendingChart = () => {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="font-semibold text-foreground mb-4">Gastos por Categoria</h3>

      {/* Bar representation */}
      <div className="flex h-3 rounded-full overflow-hidden mb-5 gap-0.5">
        {data.map((d) => (
          <div
            key={d.label}
            className={`${d.color} rounded-full transition-all`}
            style={{ width: `${d.pct}%` }}
          />
        ))}
      </div>

      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${d.color} shrink-0`} />
            <span className="text-sm text-foreground flex-1">{d.label}</span>
            <span className="text-sm font-medium text-muted-foreground">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpendingChart;
