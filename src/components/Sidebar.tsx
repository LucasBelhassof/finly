import { LayoutDashboard, CreditCard, MessageSquare, Lightbulb, Building2, Settings, LogOut } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: CreditCard, label: "Transações", path: "/transacoes" },
  { icon: MessageSquare, label: "Chat IA", path: "/chat" },
  { icon: Lightbulb, label: "Insights", path: "/insights" },
  { icon: Building2, label: "Contas", path: "/contas" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

interface SidebarProps {
  activeItem?: string;
}

const Sidebar = ({ activeItem }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (item: typeof navItems[0]) => {
    if (activeItem) return item.label === activeItem;
    return location.pathname === item.path;
  };

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col p-4 shrink-0">
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">F</span>
        </div>
        <span className="text-foreground font-semibold text-lg">FinAI</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive(item)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="border-t border-sidebar-border pt-4 mt-4">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-xs text-secondary-foreground font-medium">JD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">João D.</p>
            <p className="text-xs text-muted-foreground truncate">joao@email.com</p>
          </div>
        </div>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
