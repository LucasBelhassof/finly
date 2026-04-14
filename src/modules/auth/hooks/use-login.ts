import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";
import { login } from "@/modules/auth/services/auth-service";
import type { LoginInput } from "@/modules/auth/types/auth-types";

export function useLogin() {
  const navigate = useNavigate();
  const { applySession } = useAuthContext();

  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (payload) => {
      applySession(payload);
      navigate(appRoutes.loading, { replace: true });
    },
  });
}
