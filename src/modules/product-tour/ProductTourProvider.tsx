import {
  createContext,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import * as authService from "@/modules/auth/services/auth-service";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import type { AuthOnboardingProgress, OnboardingStepId } from "@/modules/auth/types/auth-types";
import { ProductTourCoachMark } from "@/modules/product-tour/ProductTourCoachMark";
import { PRODUCT_TOUR_STEPS } from "@/modules/product-tour/product-tour-steps";
import type { ProductTourStep } from "@/modules/product-tour/product-tour-types";

type ProductTourContextValue = {
  closeTour: () => Promise<void>;
  isOpen: boolean;
  restartTour: () => Promise<void>;
  startTour: () => Promise<void>;
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export const ProductTourContext = createContext<ProductTourContextValue | null>(null);

function normalizeLegacyStep(step: unknown): OnboardingStepId | null {
  switch (step) {
    case "dashboard_overview":
    case "recent_transactions":
    case "insights":
    case "accounts_nav":
    case "expense_management_nav":
    case "notifications":
      return step;
    case "profile":
    case "welcome":
      return "dashboard_overview";
    case "account":
    case "first_transaction":
      return "recent_transactions";
    case "due_dates":
      return "expense_management_nav";
    case "dashboard":
    case "result":
      return "notifications";
    default:
      return null;
  }
}

function uniqueSteps(steps: unknown[]) {
  const normalized = steps
    .map((step) => normalizeLegacyStep(step))
    .filter((step): step is OnboardingStepId => step !== null);

  return PRODUCT_TOUR_STEPS.map((step) => step.id).filter((stepId) => normalized.includes(stepId));
}

function normalizeProgress(progress?: Partial<AuthOnboardingProgress> | null): AuthOnboardingProgress {
  return {
    currentStep: Math.max(0, Math.min(PRODUCT_TOUR_STEPS.length - 1, progress?.currentStep ?? 0)),
    completedSteps: uniqueSteps(progress?.completedSteps ?? []),
    skippedSteps: uniqueSteps(progress?.skippedSteps ?? []),
    dismissed: Boolean(progress?.dismissed),
  };
}

function findNextOpenStepIndex(progress: AuthOnboardingProgress) {
  const nextIndex = PRODUCT_TOUR_STEPS.findIndex(
    (step) => !progress.completedSteps.includes(step.id) && !progress.skippedSteps.includes(step.id),
  );

  return nextIndex === -1 ? PRODUCT_TOUR_STEPS.length - 1 : nextIndex;
}

function getStepElement(step: ProductTourStep) {
  return document.querySelector<HTMLElement>(`[data-tour-id="${step.target}"]`);
}

function measureElement(element: HTMLElement): SpotlightRect {
  const rect = element.getBoundingClientRect();

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function ProductTourProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, setUserState } = useAuthSession();
  const [isOpen, setIsOpen] = useState(false);
  const [currentRect, setCurrentRect] = useState<SpotlightRect | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const missingTargetStepIdsRef = useRef<Set<OnboardingStepId>>(new Set());

  const progress = useMemo(() => normalizeProgress(user?.onboardingProgress), [user?.onboardingProgress]);
  const activeStepIndex = Math.max(0, Math.min(PRODUCT_TOUR_STEPS.length - 1, progress.currentStep));
  const activeStep = PRODUCT_TOUR_STEPS[activeStepIndex] ?? PRODUCT_TOUR_STEPS[0];
  const shouldAutoStart =
    isAuthenticated &&
    user?.hasCompletedOnboarding !== true &&
    progress.dismissed !== true &&
    location.pathname === activeStep.route;

  const persistProgress = useCallback(
    async (
      transform: (current: AuthOnboardingProgress) => AuthOnboardingProgress,
      options?: {
        openAfterPersist?: boolean;
      },
    ) => {
      setIsPersisting(true);

      try {
        const next = transform(normalizeProgress(user?.onboardingProgress));
        const sanitized = normalizeProgress({
          ...next,
          completedSteps: uniqueSteps(next.completedSteps),
          skippedSteps: uniqueSteps(next.skippedSteps.filter((step) => !next.completedSteps.includes(step))),
        });

        const response = await authService.updateProductTourProgress({
          ...sanitized,
          currentStep: Math.max(0, Math.min(PRODUCT_TOUR_STEPS.length - 1, sanitized.currentStep)),
        });

        setUserState(response.user);

        startTransition(() => {
          setIsOpen(options?.openAfterPersist ?? false);
        });

        return response.user;
      } finally {
        setIsPersisting(false);
      }
    },
    [setUserState, user?.onboardingProgress],
  );

  const closeTour = useCallback(async () => {
    await persistProgress(
      (current) => ({
        ...current,
        dismissed: true,
        currentStep: activeStepIndex,
      }),
      { openAfterPersist: false },
    );
  }, [activeStepIndex, persistProgress]);

  const startTour = useCallback(async () => {
    const nextIndex = findNextOpenStepIndex(progress);
    const nextStep = PRODUCT_TOUR_STEPS[nextIndex] ?? PRODUCT_TOUR_STEPS[0];

    if (location.pathname !== nextStep.route) {
      navigate(nextStep.route, { replace: false });
    }

    await persistProgress(
      (current) => ({
        ...current,
        dismissed: false,
        currentStep: nextIndex,
      }),
      { openAfterPersist: true },
    );
  }, [location.pathname, navigate, persistProgress, progress]);

  const restartTour = useCallback(async () => {
    missingTargetStepIdsRef.current.clear();

    if (location.pathname !== PRODUCT_TOUR_STEPS[0].route) {
      navigate(PRODUCT_TOUR_STEPS[0].route, { replace: false });
    }

    await persistProgress(
      () => ({
        currentStep: 0,
        completedSteps: [],
        skippedSteps: [],
        dismissed: false,
      }),
      { openAfterPersist: true },
    );
  }, [location.pathname, navigate, persistProgress]);

  const goToNextStep = useCallback(async () => {
    const isLastStep = activeStepIndex >= PRODUCT_TOUR_STEPS.length - 1;

    await persistProgress(
      (current) => ({
        ...current,
        completedSteps: [...current.completedSteps, activeStep.id],
        skippedSteps: current.skippedSteps.filter((step) => step !== activeStep.id),
        dismissed: false,
        currentStep: isLastStep ? activeStepIndex : activeStepIndex + 1,
      }),
      { openAfterPersist: !isLastStep },
    );
  }, [activeStep.id, activeStepIndex, persistProgress]);

  const goToPreviousStep = useCallback(async () => {
    if (activeStepIndex === 0) {
      return;
    }

    await persistProgress(
      (current) => ({
        ...current,
        dismissed: false,
        currentStep: activeStepIndex - 1,
      }),
      { openAfterPersist: true },
    );
  }, [activeStepIndex, persistProgress]);

  const skipMissingTargetStep = useCallback(async () => {
    if (missingTargetStepIdsRef.current.has(activeStep.id)) {
      return;
    }

    missingTargetStepIdsRef.current.add(activeStep.id);

    await persistProgress(
      (current) => ({
        ...current,
        skippedSteps: [...current.skippedSteps, activeStep.id],
        completedSteps: current.completedSteps.filter((step) => step !== activeStep.id),
        dismissed: false,
        currentStep: Math.min(PRODUCT_TOUR_STEPS.length - 1, activeStepIndex + 1),
      }),
      { openAfterPersist: activeStepIndex < PRODUCT_TOUR_STEPS.length - 1 },
    );
  }, [activeStep.id, activeStepIndex, persistProgress]);

  useEffect(() => {
    if (shouldAutoStart && !isOpen && !isPersisting) {
      setIsOpen(true);
    }
  }, [isOpen, isPersisting, shouldAutoStart]);

  useEffect(() => {
    if (!isOpen || location.pathname !== activeStep.route) {
      setCurrentRect(null);
      return;
    }

    let frameId = 0;
    let timeoutId = 0;

    const syncTarget = () => {
      const element = getStepElement(activeStep);

      if (!element) {
        timeoutId = window.setTimeout(() => {
          void skipMissingTargetStep();
        }, 250);
        return;
      }

      if (activeStep.autoScroll) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }

      frameId = window.requestAnimationFrame(() => {
        setCurrentRect(measureElement(element));
      });
    };

    syncTarget();
    window.addEventListener("resize", syncTarget);
    window.addEventListener("scroll", syncTarget, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", syncTarget);
      window.removeEventListener("scroll", syncTarget, true);
    };
  }, [activeStep, isOpen, location.pathname, skipMissingTargetStep]);

  const value = useMemo<ProductTourContextValue>(
    () => ({
      closeTour,
      isOpen,
      restartTour,
      startTour,
    }),
    [closeTour, isOpen, restartTour, startTour],
  );

  return (
    <ProductTourContext.Provider value={value}>
      {children}
      {isOpen && currentRect ? (
        <ProductTourCoachMark
          currentStepIndex={activeStepIndex}
          isLastStep={activeStepIndex === PRODUCT_TOUR_STEPS.length - 1}
          onBack={() => void goToPreviousStep()}
          onClose={() => void closeTour()}
          onNext={() => void goToNextStep()}
          rect={currentRect}
          step={activeStep}
          totalSteps={PRODUCT_TOUR_STEPS.length}
        />
      ) : null}
    </ProductTourContext.Provider>
  );
}
