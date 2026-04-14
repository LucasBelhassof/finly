import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { FinlyLoader } from "@/components/FinlyLoader";
import { appRoutes } from "@/lib/routes";

export default function LoadingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(appRoutes.dashboard, { replace: true });
    }, 2800);
    return () => clearTimeout(timer);
  }, [navigate]);

  return <FinlyLoader />;
}
