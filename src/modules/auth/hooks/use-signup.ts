import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";
import { signup } from "@/modules/auth/services/auth-service";
import type { SignupInput } from "@/modules/auth/types/auth-types";

export function useSignup() {
  const navigate = useNavigate();
  const { applySession } = useAuthContext();

  return useMutation({
    mutationFn: (input: SignupInput) => signup(input),
    onSuccess: (payload) => {
      applySession(payload);
      navigate(appRoutes.dashboard, { replace: true });
    },
  });
}
