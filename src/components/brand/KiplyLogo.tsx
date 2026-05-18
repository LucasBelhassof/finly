import { useState } from "react";

import { cn } from "@/lib/utils";

type KiplyLogoProps = {
  variant?: "full" | "icon";
  className?: string;
};

const LOGO_BY_VARIANT = {
  full: "/brand/kiply-logo-full.png",
  icon: "/brand/kiply-fox.png",
} as const;

export function KiplyLogo({ variant = "full", className }: KiplyLogoProps) {
  const [hasImageError, setHasImageError] = useState(false);

  if (hasImageError) {
    return (
      <span
        role="img"
        aria-label="Kiply"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg border border-primary/35 bg-primary/10 text-primary shadow-[0_0_18px_rgba(0,255,174,0.18)]",
          variant === "full" ? "h-10 min-w-24 px-3 text-sm font-semibold" : "h-8 w-8",
          className,
        )}
      >
        {variant === "full" ? "Kiply" : null}
      </span>
    );
  }

  return (
    <img
      src={LOGO_BY_VARIANT[variant]}
      alt="Kiply"
      className={cn("shrink-0 object-contain", variant === "full" ? "h-10 w-auto" : "h-8 w-8", className)}
      onError={() => setHasImageError(true)}
    />
  );
}
