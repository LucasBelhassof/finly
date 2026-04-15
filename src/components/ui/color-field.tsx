import { getCategoryColorInputValue } from "@/lib/category-colors";
import { cn } from "@/lib/utils";

type ColorFieldProps = {
  value?: string | null;
  onChange: (nextColor: string) => void;
  label?: string;
  inputAriaLabel: string;
  presets?: readonly string[];
  fallback?: string;
};

const DEFAULT_PRESETS = ["#3b82f6", "#22c55e", "#ef4444", "#06b6d4", "#f59e0b", "#f97316", "#a855f7"] as const;

export function ColorField({
  value,
  onChange,
  label = "Cor",
  inputAriaLabel,
  presets = DEFAULT_PRESETS,
  fallback,
}: ColorFieldProps) {
  const resolvedColor = getCategoryColorInputValue(value, fallback);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/35 px-3 py-2">
          <span
            className="h-8 w-8 rounded-full border border-white/20"
            style={{ backgroundColor: resolvedColor }}
          />
          <input
            aria-label={inputAriaLabel}
            type="color"
            value={resolvedColor}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-16 cursor-pointer rounded-md border-0 bg-transparent p-0"
          />
        </label>
        <span className="text-xs text-muted-foreground">{resolvedColor}</span>
      </div>

      <div className="flex flex-wrap gap-3">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition-transform hover:scale-105",
              resolvedColor === preset ? "scale-105 border-white ring-2 ring-white/30" : "border-transparent",
            )}
            style={{ backgroundColor: preset }}
            aria-label={`Selecionar cor ${preset}`}
          />
        ))}
      </div>
    </div>
  );
}
