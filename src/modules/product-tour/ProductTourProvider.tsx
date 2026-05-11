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
import { normalizeActionOnboardingProgress } from "@/modules/auth/lib/onboarding-progress";
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
    case "dashboard_summary":
    case "dashboard_transactions":
    case "dashboard_insights":
    case "dashboard_accounts":
    case "accounts_summary":
    case "accounts_structure":
    case "accounts_support":
    case "transactions_filters":
    case "transactions_summary":
    case "transactions_table":
    case "transactions_categories":
    case "recurring_income_filters":
    case "recurring_income_summary":
    case "recurring_income_chart":
    case "recurring_income_table":
    case "installments_summary":
    case "installments_filters":
    case "installments_insights":
    case "installments_table":
    case "housing_filters":
    case "housing_summary":
    case "housing_trend":
    case "housing_table":
    case "expense_metrics_filters":
    case "expense_metrics_summary":
    case "expense_metrics_trend":
    case "expense_metrics_ranking":
    case "insights_summary":
    case "insights_recommendations":
    case "insights_spending":
    case "notifications_filters":
    case "notifications_inbox":
    case "notifications_details":
    case "notifications_form":
    case "chat_conversation":
    case "chat_suggestions":
    case "profile_identity":
    case "profile_account":
    case "profile_shortcuts":
    case "settings_account":
    case "settings_security":
    case "settings_contact":
    case "settings_preferences":
      return step;
    case "profile":
    case "welcome":
      return "dashboard_summary";
    case "account":
      return "accounts_summary";
    case "first_transaction":
      return "transactions_filters";
    case "due_dates":
      return "housing_filters";
    case "insights":
      return "dashboard_insights";
    case "accounts_nav":
      return "accounts_summary";
    case "expense_management_nav":
      return "transactions_filters";
    case "notifications":
      return "notifications_filters";
    case "dashboard":
    case "result":
      return "dashboard_summary";
    case "dashboard_overview":
      return "dashboard_summary";
    case "recent_transactions":
      return "dashboard_transactions";
    case "accounts_page":
      return "accounts_summary";
    case "transactions_page":
      return "transactions_filters";
    case "recurring_income_page":
      return "recurring_income_filters";
    case "installments_page":
      return "installments_summary";
    case "housing_page":
      return "housing_filters";
    case "expense_metrics_page":
      return "expense_metrics_filters";
    case "insights_page":
      return "insights_summary";
    case "notifications_page":
      return "notifications_filters";
    case "chat_page":
      return "chat_conversation";
    case "profile_page":
      return "profile_identity";
    case "settings_page":
      return "settings_account";
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
    actionChecklist: normalizeActionOnboardingProgress(progress?.actionChecklist),
  };
}

function isStepPending(progress: AuthOnboardingProgress, stepId: OnboardingStepId) {
  return !progress.completedSteps.includes(stepId) && !progress.skippedSteps.includes(stepId);
}

function routeMatches(stepRoute: string, currentPathname: string) {
  return currentPathname === stepRoute || currentPathname.startsWith(`${stepRoute}/`);
}

function findFirstPendingStepIndex(progress: AuthOnboardingProgress) {
  const nextIndex = PRODUCT_TOUR_STEPS.findIndex((step) => isStepPending(progress, step.id));

  return nextIndex === -1 ? PRODUCT_TOUR_STEPS.length - 1 : nextIndex;
}

function findPendingStepIndexForRoute(progress: AuthOnboardingProgress, route: string) {
  return PRODUCT_TOUR_STEPS.findIndex((step) => routeMatches(step.route, route) && isStepPending(progress, step.id));
}

function getStepsForRoute(route: string) {
  return PRODUCT_TOUR_STEPS.filter((step) => routeMatches(step.route, route));
}

function getStepIdsForRoute(route: string) {
  return getStepsForRoute(route).map((step) => step.id);
}

function findFirstStepIndexForRoute(route: string) {
  return PRODUCT_TOUR_STEPS.findIndex((step) => routeMatches(step.route, route));
}

function findPreviousStepIndexForRoute(currentIndex: number, route: string) {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (PRODUCT_TOUR_STEPS[index] && routeMatches(PRODUCT_TOUR_STEPS[index].route, route)) {
      return index;
    }
  }

  return -1;
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
  const targetRetryCountRef = useRef(0);

  const progress = useMemo(() => normalizeProgress(user?.onboardingProgress), [user?.onboardingProgress]);
  const activeStepIndex = Math.max(0, Math.min(PRODUCT_TOUR_STEPS.length - 1, progress.currentStep));
  const activeStep = PRODUCT_TOUR_STEPS[activeStepIndex] ?? PRODUCT_TOUR_STEPS[0];
  const pendingRouteStepIndex = useMemo(
    () => findPendingStepIndexForRoute(progress, location.pathname),
    [location.pathname, progress],
  );
  const previousRouteStepIndex = useMemo(
    () => findPreviousStepIndexForRoute(activeStepIndex, location.pathname),
    [activeStepIndex, location.pathname],
  );
  const routeSteps = useMemo(() => getStepsForRoute(location.pathname), [location.pathname]);
  const routeStepIds = useMemo(() => routeSteps.map((step) => step.id), [routeSteps]);
  const activeRouteStepIndex = useMemo(
    () => routeStepIds.findIndex((stepId) => stepId === activeStep.id),
    [activeStep.id, routeStepIds],
  );
  const shouldAutoStart =
    isAuthenticated &&
    user?.hasCompletedOnboarding !== true &&
    progress.dismissed !== true &&
    pendingRouteStepIndex !== -1;

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
    setCurrentRect(null);
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
    setCurrentRect(null);
    const routeStepIndex = findPendingStepIndexForRoute(progress, location.pathname);
    const firstRouteStepIndex = findFirstStepIndexForRoute(location.pathname);
    const nextIndex =
      routeStepIndex !== -1
        ? routeStepIndex
        : firstRouteStepIndex !== -1
          ? firstRouteStepIndex
          : findFirstPendingStepIndex(progress);
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
    setCurrentRect(null);
    const routeStepIds = getStepIdsForRoute(location.pathname);
    const firstRouteStepIndex = findFirstStepIndexForRoute(location.pathname);

    await persistProgress(
      (current) => ({
        ...current,
        currentStep: firstRouteStepIndex !== -1 ? firstRouteStepIndex : current.currentStep,
        completedSteps: current.completedSteps.filter((step) => !routeStepIds.includes(step)),
        skippedSteps: current.skippedSteps.filter((step) => !routeStepIds.includes(step)),
        dismissed: false,
      }),
      { openAfterPersist: true },
    );
  }, [location.pathname, persistProgress]);

  const goToNextStep = useCallback(async () => {
    setCurrentRect(null);
    await persistProgress(
      (current) => {
        const nextProgress = normalizeProgress({
          ...current,
          completedSteps: [...current.completedSteps, activeStep.id],
          skippedSteps: current.skippedSteps.filter((step) => step !== activeStep.id),
          dismissed: false,
        });
        const nextRouteStepIndex = findPendingStepIndexForRoute(nextProgress, location.pathname);
        const fallbackIndex = findFirstPendingStepIndex(nextProgress);

        return {
          ...nextProgress,
          currentStep: nextRouteStepIndex !== -1 ? nextRouteStepIndex : fallbackIndex,
        };
      },
      {
        openAfterPersist: false,
      },
    );
  }, [activeStep.id, location.pathname, persistProgress]);

  const goToPreviousStep = useCallback(async () => {
    if (previousRouteStepIndex === -1) {
      return;
    }

    setCurrentRect(null);
    await persistProgress(
      (current) => ({
        ...current,
        dismissed: false,
        currentStep: previousRouteStepIndex,
      }),
      { openAfterPersist: true },
    );
  }, [persistProgress, previousRouteStepIndex]);

  const skipMissingTargetStep = useCallback(async () => {
    if (missingTargetStepIdsRef.current.has(activeStep.id)) {
      return;
    }

    missingTargetStepIdsRef.current.add(activeStep.id);

    await persistProgress(
      (current) => {
        const nextProgress = normalizeProgress({
          ...current,
          skippedSteps: [...current.skippedSteps, activeStep.id],
          completedSteps: current.completedSteps.filter((step) => step !== activeStep.id),
          dismissed: false,
        });
        const nextRouteStepIndex = findPendingStepIndexForRoute(nextProgress, location.pathname);
        const fallbackIndex = findFirstPendingStepIndex(nextProgress);

        return {
          ...nextProgress,
          currentStep: nextRouteStepIndex !== -1 ? nextRouteStepIndex : fallbackIndex,
        };
      },
      { openAfterPersist: false },
    );
  }, [activeStep.id, location.pathname, persistProgress]);

  useEffect(() => {
    if (isOpen && !routeMatches(activeStep.route, location.pathname)) {
      setIsOpen(false);
      return;
    }

    if (!shouldAutoStart || isOpen || isPersisting) {
      return;
    }

    if (pendingRouteStepIndex === progress.currentStep) {
      setIsOpen(true);
      return;
    }

    void persistProgress(
      (current) => ({
        ...current,
        dismissed: false,
        currentStep: pendingRouteStepIndex,
      }),
      { openAfterPersist: true },
    );
  }, [
    activeStep.route,
    isOpen,
    isPersisting,
    location.pathname,
    pendingRouteStepIndex,
    persistProgress,
    progress.currentStep,
    shouldAutoStart,
  ]);

  useEffect(() => {
    if (!isOpen || !routeMatches(activeStep.route, location.pathname)) {
      setCurrentRect(null);
      targetRetryCountRef.current = 0;
      return;
    }

    let frameId = 0;
    let timeoutId = 0;

    const syncTarget = () => {
      setCurrentRect(null);
      const element = getStepElement(activeStep);

      if (!element) {
        if (targetRetryCountRef.current >= 6) {
          timeoutId = window.setTimeout(() => {
            void skipMissingTargetStep();
          }, 250);
          return;
        }

        targetRetryCountRef.current += 1;
        timeoutId = window.setTimeout(syncTarget, 250);
        return;
      }

      targetRetryCountRef.current = 0;

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
      targetRetryCountRef.current = 0;
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
          canGoBack={previousRouteStepIndex !== -1}
          currentStepIndex={activeRouteStepIndex === -1 ? 0 : activeRouteStepIndex}
          isLastStep={
            findPendingStepIndexForRoute(
              normalizeProgress({
                ...progress,
                completedSteps: [...progress.completedSteps, activeStep.id],
                skippedSteps: progress.skippedSteps.filter((step) => step !== activeStep.id),
              }),
              location.pathname,
            ) === -1
          }
          onBack={() => void goToPreviousStep()}
          onClose={() => void closeTour()}
          onNext={() => void goToNextStep()}
          rect={currentRect}
          step={activeStep}
          totalSteps={routeSteps.length || 1}
        />
      ) : null}
    </ProductTourContext.Provider>
  );
}
