import type { OnboardingStepId } from "@/modules/auth/types/auth-types";

export type ProductTourStepId = OnboardingStepId;

export type ProductTourPlacement = "top" | "bottom" | "left" | "right";

export interface ProductTourStep {
  id: ProductTourStepId;
  route: string;
  target: string;
  title: string;
  description: string;
  placement: ProductTourPlacement;
  autoScroll?: boolean;
}
