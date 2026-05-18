import { MoreHorizontal } from "lucide-react";
import { useLocation } from "react-router-dom";

import { NavLink } from "@/components/NavLink";
import { isMoreSectionActive, isNavItemActive, mobilePrimaryNavItems } from "@/components/navigation/app-navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function mobileNavItemClassName(isActive: boolean) {
  return cn(
    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
    isActive
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
  );
}

export default function MobileBottomNav() {
  const location = useLocation();
  const { toggleSidebar } = useSidebar();
  const isMoreActive = isMoreSectionActive(location.pathname);

  return (
    <nav
      aria-label="Navegação principal mobile"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <div className="grid w-full max-w-sm grid-cols-5 gap-2 rounded-[1.75rem] border border-border/60 bg-background/95 p-2 shadow-[0_20px_45px_rgba(15,23,42,0.18)] backdrop-blur supports-[backdrop-filter]:bg-background/90">
        {mobilePrimaryNavItems.map((item) => {
          const isActive = isNavItemActive(location.pathname, item);

          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              aria-current={isActive ? "page" : undefined}
              data-active={isActive}
              className={mobileNavItemClassName(isActive)}
            >
              <item.icon size={18} className="shrink-0" />
              <span className="leading-none">{item.label}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          aria-label="Abrir mais opções"
          aria-current={isMoreActive ? "page" : undefined}
          data-active={isMoreActive}
          className={mobileNavItemClassName(isMoreActive)}
          onClick={toggleSidebar}
        >
          <MoreHorizontal size={18} className="shrink-0" />
          <span className="leading-none">Mais</span>
        </button>
      </div>
    </nav>
  );
}
