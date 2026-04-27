const LEGACY_COLOR_TOKENS = {
  "bg-primary": { css: "hsl(var(--primary))", hex: "#3b82f6" },
  "text-primary": { css: "hsl(var(--primary))", hex: "#3b82f6" },
  "bg-income": { css: "hsl(var(--income))", hex: "#22c55e" },
  "text-income": { css: "hsl(var(--income))", hex: "#22c55e" },
  "bg-expense": { css: "hsl(var(--expense))", hex: "#ef4444" },
  "text-expense": { css: "hsl(var(--expense))", hex: "#ef4444" },
  "bg-info": { css: "hsl(var(--info))", hex: "#06b6d4" },
  "text-info": { css: "hsl(var(--info))", hex: "#06b6d4" },
  "bg-warning": { css: "hsl(var(--warning))", hex: "#f59e0b" },
  "text-warning": { css: "hsl(var(--warning))", hex: "#f59e0b" },
  "bg-muted-foreground": { css: "hsl(var(--muted-foreground))", hex: "#64748b" },
  "text-muted-foreground": { css: "hsl(var(--muted-foreground))", hex: "#64748b" },
  "bg-orange-500": { css: "#f97316", hex: "#f97316" },
  "text-orange-500": { css: "#f97316", hex: "#f97316" },
  "bg-blue-500": { css: "#3b82f6", hex: "#3b82f6" },
  "text-blue-500": { css: "#3b82f6", hex: "#3b82f6" },
  "bg-purple-500": { css: "#a855f7", hex: "#a855f7" },
  "text-purple-500": { css: "#a855f7", hex: "#a855f7" },
  "bg-red-500": { css: "#ef4444", hex: "#ef4444" },
  "text-red-500": { css: "#ef4444", hex: "#ef4444" },
  "bg-amber-500": { css: "#f59e0b", hex: "#f59e0b" },
  "text-amber-500": { css: "#f59e0b", hex: "#f59e0b" },
} as const;

const DEFAULT_CATEGORY_COLOR = "#22c55e";

function normalizeHexColor(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmedValue)) {
    return null;
  }

  if (trimmedValue.length === 4) {
    return `#${trimmedValue[1]}${trimmedValue[1]}${trimmedValue[2]}${trimmedValue[2]}${trimmedValue[3]}${trimmedValue[3]}`.toLowerCase();
  }

  return trimmedValue.toLowerCase();
}

function toRgba(hexColor: string, alpha: number) {
  const normalizedColor = normalizeHexColor(hexColor);

  if (!normalizedColor) {
    return hexColor;
  }

  const red = Number.parseInt(normalizedColor.slice(1, 3), 16);
  const green = Number.parseInt(normalizedColor.slice(3, 5), 16);
  const blue = Number.parseInt(normalizedColor.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getLegacyColorToken(value?: string | null) {
  if (!value) {
    return null;
  }

  return LEGACY_COLOR_TOKENS[value as keyof typeof LEGACY_COLOR_TOKENS] ?? null;
}

function getRelativeLuminance(hexColor: string) {
  const normalizedColor = normalizeHexColor(hexColor);

  if (!normalizedColor) {
    return 0;
  }

  const channels = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(normalizedColor.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function getCategoryColorInputValue(value?: string | null, fallback = DEFAULT_CATEGORY_COLOR) {
  const normalizedHexColor = normalizeHexColor(value);

  if (normalizedHexColor) {
    return normalizedHexColor;
  }

  const legacyColor = getLegacyColorToken(value);
  return legacyColor?.hex ?? fallback;
}

export function resolveCategoryColorValue(value?: string | null, fallback = "hsl(var(--muted-foreground))") {
  const normalizedHexColor = normalizeHexColor(value);

  if (normalizedHexColor) {
    return normalizedHexColor;
  }

  const legacyColor = getLegacyColorToken(value);
  return legacyColor?.css ?? fallback;
}

export function resolveCategoryColorPresentation(value?: string | null) {
  const normalizedHexColor = normalizeHexColor(value);

  if (normalizedHexColor) {
    const lightText = getRelativeLuminance(normalizedHexColor) < 0.42;

    return {
      solid: normalizedHexColor,
      soft: toRgba(normalizedHexColor, 0.14),
      text: normalizedHexColor,
      contrastText: lightText ? "#ffffff" : "#111827",
      border: toRgba(normalizedHexColor, 0.34),
      isCustom: true,
    };
  }

  const legacyColor = getLegacyColorToken(value);

  if (legacyColor) {
    const hasHslVariable = legacyColor.css.startsWith("hsl(var(");
    const softColor = hasHslVariable
      ? legacyColor.css.replace("hsl(var(", "hsl(var(").replace("))", ") / 0.14)")
      : toRgba(legacyColor.hex, 0.14);

    return {
      solid: legacyColor.css,
      soft: softColor,
      text: legacyColor.css,
      contrastText: "#ffffff",
      border: hasHslVariable ? legacyColor.css.replace("))", ") / 0.34)") : toRgba(legacyColor.hex, 0.34),
      isCustom: false,
    };
  }

  return resolveCategoryColorPresentation(DEFAULT_CATEGORY_COLOR);
}

export { DEFAULT_CATEGORY_COLOR };
