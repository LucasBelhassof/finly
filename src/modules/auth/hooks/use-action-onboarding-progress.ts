import { useCallback } from "react";

import { normalizeActionOnboardingProgress } from "@/modules/auth/lib/onboarding-progress";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import * as authService from "@/modules/auth/services/auth-service";
import type { ActionOnboardingStepId, AuthOnboardingProgress } from "@/modules/auth/types/auth-types";

function normalizeOnboardingProgress(progress?: Partial<AuthOnboardingProgress> | null): AuthOnboardingProgress {
  return {
    currentStep: progress?.currentStep ?? 0,
    completedSteps: progress?.completedSteps ?? [],
    skippedSteps: progress?.skippedSteps ?? [],
    dismissed: Boolean(progress?.dismissed),
    actionChecklist: normalizeActionOnboardingProgress(progress?.actionChecklist),
  };
}

export function useActionOnboardingProgress() {
  const { user, setUserState } = useAuthSession();

  const completeActionStep = useCallback(
    async (stepId: ActionOnboardingStepId) => {
      if (!user) {
        return null;
      }

      const currentProgress = normalizeOnboardingProgress(user.onboardingProgress);

      if (currentProgress.actionChecklist.completedSteps.includes(stepId)) {
        return user;
      }

      const response = await authService.updateOnboardingProgress({
        ...currentProgress,
        actionChecklist: {
          completedSteps: [...currentProgress.actionChecklist.completedSteps, stepId],
        },
      });

      setUserState(response.user);
      return response.user;
    },
    [setUserState, user],
  );

  return {
    completeActionStep,
  };
}
