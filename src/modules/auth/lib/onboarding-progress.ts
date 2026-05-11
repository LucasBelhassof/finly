import type {
  ActionOnboardingStepId,
  AuthActionOnboardingProgress,
  AuthOnboardingProgress,
} from "@/modules/auth/types/auth-types";

const ACTION_ONBOARDING_STEPS: ActionOnboardingStepId[] = ["dashboard", "premium"];

function normalizeActionOnboardingStep(step: unknown): ActionOnboardingStepId | null {
  switch (step) {
    case "dashboard":
    case "premium":
      return step;
    default:
      return null;
  }
}

export function normalizeActionOnboardingProgress(
  actionChecklist?: Partial<AuthActionOnboardingProgress> | null,
): AuthActionOnboardingProgress {
  const completedStepsRaw = Array.isArray(actionChecklist?.completedSteps) ? actionChecklist.completedSteps : [];
  const normalizedCompletedSteps = completedStepsRaw
    .map((step) => normalizeActionOnboardingStep(step))
    .filter((step): step is ActionOnboardingStepId => step !== null);

  return {
    completedSteps: ACTION_ONBOARDING_STEPS.filter((step) => normalizedCompletedSteps.includes(step)),
  };
}

export function hasCompletedActionOnboardingStep(
  onboardingProgress: Partial<AuthOnboardingProgress> | null | undefined,
  stepId: ActionOnboardingStepId,
) {
  return normalizeActionOnboardingProgress(onboardingProgress?.actionChecklist).completedSteps.includes(stepId);
}
