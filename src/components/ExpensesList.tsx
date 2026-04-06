import { ShoppingCart, Coffee, Car, Zap, Home, Utensils, Smartphone, Heart } from "lucide-react";

const categories = [
  { icon: ShoppingCart, label: "Supermercado", color: "text-primary" },
  { icon: Coffee, label: "Café & Lanches", color: "text-warning" },
  { icon: Car, label: "Transporte", color: "text-info" },
  { icon: Zap, label: "Energia", color: "text-warning" },
  { icon: Home, label: "Moradia", color: "text-primary" },
  { icon: Utensils, label: "Restaurantes", color: "text-expense" },
  { icon: Smartphone, label: "Assinaturas", color: "text-info" },
  { icon: Heart, label: "Saúde", color: "text-income" },
];

const transactions = [
  { category: 0, desc: "Pão de Açúcar", amount: -342.50, date: "Hoje" },
  { category: 5, desc: "iFood", amount: -67.90, date: "Hoje" },
  { category: 1, desc: "Starbucks", amount: -28.00, date: "Ontem" },
  { category: 2, desc: "Uber", amount: -23.50, date: "Ontem" },
  { category: 6, desc: "Netflix", amount: -55.90, date: "03 Abr" },
  { category: 3, desc: "Conta de Luz", amount: -189.00, date: "02 Abr" },
  { category: 7, desc: "Farmácia", amount: -45.80, date: "01 Abr" },
  { category: 4, desc: "Aluguel", amount: -2200.00, date: "01 Abr" },
];

const ExpensesList = () => {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Últimas Transações</h3>
        <button className="text-xs text-primary hover:underline">Ver todas</button>
      </div>

      <div className="space-y-1">
        {transactions.map((tx, i) => {
          const cat = categories[tx.category];
          const Icon = cat.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Icon size={16} className={cat.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{tx.desc}</p>
                <p className="text-xs text-muted-foreground">{cat.label}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${tx.amount < 0 ? "text-expense" : "text-income"}`}>
                  {tx.amount < 0 ? "- " : "+ "}R$ {Math.abs(tx.amount).toFixed(2).replace(".", ",")}
                </p>
                <p className="text-xs text-muted-foreground">{tx.date}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExpensesList;
