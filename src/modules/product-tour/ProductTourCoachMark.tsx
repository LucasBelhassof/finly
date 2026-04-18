import { CheckCircle2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import type { ProductTourPlacement, ProductTourStep } from "@/modules/product-tour/product-tour-types";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type ProductTourCoachMarkProps = {
  currentStepIndex: number;
  isLastStep: boolean;
  onBack: () => void;
  onClose: () => void;
  onNext: () => void;
  rect: Rect;
  step: ProductTourStep;
  totalSteps: number;
};

function getCardPosition(rect: Rect, placement: ProductTourPlacement) {
  const spacing = 20;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxWidth = Math.min(360, viewportWidth - 32);
  let top = rect.top + rect.height + spacing;
  let left = rect.left;

  switch (placement) {
    case "top":
      top = rect.top - 220;
      left = rect.left;
      break;
    case "left":
      top = rect.top + rect.height / 2 - 100;
      left = rect.left - maxWidth - spacing;
      break;
    case "right":
      top = rect.top + rect.height / 2 - 100;
      left = rect.left + rect.width + spacing;
      break;
    case "bottom":
    default:
      top = rect.top + rect.height + spacing;
      left = rect.left;
      break;
  }

  return {
    top: Math.max(16, Math.min(top, viewportHeight - 220)),
    left: Math.max(16, Math.min(left, viewportWidth - maxWidth - 16)),
    width: maxWidth,
  };
}

export function ProductTourCoachMark({
  currentStepIndex,
  isLastStep,
  onBack,
  onClose,
  onNext,
  rect,
  step,
  totalSteps,
}: ProductTourCoachMarkProps) {
  if (typeof document === "undefined") {
    return null;
  }

  const cardPosition = getCardPosition(rect, step.placement);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-background/78" />

      <div
        className="absolute rounded-3xl border-2 border-primary shadow-[0_0_0_9999px_rgba(15,23,42,0.72)] transition-all duration-200"
        style={{
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          boxShadow:
            "0 0 0 9999px rgba(15, 23, 42, 0.72), 0 0 0 6px rgba(59, 130, 246, 0.18), 0 18px 60px rgba(15, 23, 42, 0.45)",
        }}
      />

      <div
        className="absolute rounded-3xl border border-primary/30 bg-primary/10"
        style={{
          top: rect.top - 14,
          left: rect.left - 14,
          width: rect.width + 28,
          height: rect.height + 28,
        }}
      />

      <section
        className="pointer-events-auto absolute rounded-3xl border border-primary/20 bg-card p-5 text-card-foreground shadow-2xl ring-1 ring-primary/10"
        style={{
          top: cardPosition.top,
          left: cardPosition.left,
          width: cardPosition.width,
        }}
        role="dialog"
        aria-label={step.title}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Tour do produto
            </p>
            <h2 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Pular tour"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.description}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            Passo {currentStepIndex + 1} de {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack} disabled={currentStepIndex === 0}>
              <ChevronLeft size={16} />
              Voltar
            </Button>
            <Button size="sm" onClick={onNext}>
              {isLastStep ? <CheckCircle2 size={16} /> : <ChevronRight size={16} />}
              {isLastStep ? "Concluir tour" : "Proximo"}
            </Button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
