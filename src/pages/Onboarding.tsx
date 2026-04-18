import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { appRoutes } from "@/lib/routes";
import { useProductTour } from "@/modules/product-tour/use-product-tour";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { restartTour } = useProductTour();

  useEffect(() => {
    void restartTour().finally(() => {
      navigate(appRoutes.dashboard, { replace: true });
    });
  }, [navigate, restartTour]);

  return null;
}
