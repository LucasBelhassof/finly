import { useState } from "react";

import { cn } from "@/lib/utils";

type KipAvatarProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASSNAME = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
} as const;

export function KipAvatar({ size = "md", className }: KipAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);

  if (hasImageError) {
    return (
      <span
        role="img"
        aria-label="Kip"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/10 shadow-[0_0_18px_rgba(0,255,174,0.2)]",
          SIZE_CLASSNAME[size],
          className,
        )}
      >
        <span className="h-2/5 w-2/5 rounded-full bg-primary/70" />
      </span>
    );
  }

  return (
    <img
      src="/brand/kiply-fox.png"
      alt="Kip"
      className={cn("shrink-0 rounded-full object-contain", SIZE_CLASSNAME[size], className)}
      onError={() => setHasImageError(true)}
    />
  );
}
