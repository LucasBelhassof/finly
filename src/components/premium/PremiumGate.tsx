import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";

type PremiumGateProps = {
  children: ReactNode;
  featureLabel: string;
  description?: string;
  mode?: "overlay" | "inline";
  className?: string;
};

export function PremiumGate({ children, featureLabel, description, mode = "overlay", className }: PremiumGateProps) {
  const { user } = useAuthContext();

  if (user?.isPremium) {
    return <>{children}</>;
  }

  if (mode === "inline") {
    return (
      <div className={cn("rounded-2xl border border-border/60 bg-secondary/25 p-4", className)}>
        <p className="text-sm font-semibold text-foreground">Disponível apenas na versão Premium</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {description ?? `Faça upgrade para desbloquear ${featureLabel.toLowerCase()}.`}
        </p>
        <Button type="button" variant="secondary" className="mt-3" disabled>
          Conhecer Premium
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div aria-hidden="true" className="pointer-events-none select-none blur-sm" data-testid="premium-gate-blurred">
        {children}
      </div>
      <div
        className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-background/70 p-6 text-center backdrop-blur-[1px]"
        data-testid="premium-gate-overlay"
      >
        <div className="max-w-sm">
          <p className="text-base font-semibold text-foreground">Disponível apenas na versão Premium</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {description ?? `Faça upgrade para desbloquear ${featureLabel.toLowerCase()}.`}
          </p>
          <Button type="button" variant="secondary" className="mt-4" disabled>
            Conhecer Premium
          </Button>
        </div>
      </div>
    </div>
  );
}
