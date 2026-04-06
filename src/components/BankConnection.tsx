import { Building2, Link2, CheckCircle2, Plus } from "lucide-react";

const banks = [
  { name: "Nubank", connected: true, color: "bg-purple-500" },
  { name: "Itaú", connected: true, color: "bg-orange-500" },
  { name: "Bradesco", connected: false, color: "bg-red-500" },
];

const BankConnection = () => {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Link2 size={14} className="text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">Open Finance</h3>
        </div>
        <button className="flex items-center gap-1.5 text-xs text-primary hover:underline">
          <Plus size={12} />
          Conectar
        </button>
      </div>

      <div className="space-y-2.5">
        {banks.map((bank) => (
          <div
            key={bank.name}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/40"
          >
            <div className={`w-8 h-8 rounded-lg ${bank.color} flex items-center justify-center`}>
              <Building2 size={14} className="text-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground flex-1">{bank.name}</span>
            {bank.connected ? (
              <div className="flex items-center gap-1">
                <CheckCircle2 size={14} className="text-income" />
                <span className="text-xs text-income">Conectado</span>
              </div>
            ) : (
              <button className="text-xs text-primary hover:underline">Conectar</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BankConnection;
