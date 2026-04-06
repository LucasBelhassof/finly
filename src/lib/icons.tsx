import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Building2,
  Car,
  CircleHelp,
  Coffee,
  Heart,
  Home,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  AlertTriangle,
  Building2,
  Car,
  Coffee,
  Heart,
  Home,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
};

export function resolveLucideIcon(iconName?: string | null): LucideIcon {
  if (!iconName) {
    return CircleHelp;
  }

  return iconMap[iconName] ?? CircleHelp;
}

export function resolveInsightIcon(tone?: string | null): LucideIcon {
  switch (tone) {
    case "warning":
      return AlertTriangle;
    case "success":
      return TrendingDown;
    case "info":
      return Target;
    default:
      return Sparkles;
  }
}
