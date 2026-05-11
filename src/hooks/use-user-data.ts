import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { ApiError, apiBaseUrl } from "@/lib/api";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";
import { useNavigate } from "react-router-dom";
import { appRoutes } from "@/lib/routes";

async function downloadBlobWithAuth(
  path: string,
  filename: string,
  getAccessToken: () => string | null,
  refreshAccessToken: () => Promise<string | null>,
  onAuthFailure: () => void | Promise<void>,
): Promise<void> {
  let token = getAccessToken();

  let response = await fetch(`${apiBaseUrl}${path}`, {
    method: "GET",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      token = refreshed;
      response = await fetch(`${apiBaseUrl}${path}`, {
        method: "GET",
        credentials: "include",
        headers: { Authorization: `Bearer ${refreshed}` },
      });
    } else {
      await onAuthFailure();
      return;
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = "Não foi possível concluir o download.";

    try {
      const body = JSON.parse(text) as Record<string, unknown>;
      if (typeof body.message === "string" && body.message.trim()) {
        message = body.message;
      }
    } catch {
      // ignore parse errors
    }

    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function useExportTransactionsCsv() {
  const { getAccessToken, refreshAccessToken, onAuthFailure } = useAuthCallbacks();

  return useMutation({
    mutationFn: () =>
      downloadBlobWithAuth(
        "/api/user-data/export/csv",
        `transactions-${getTodayIso()}.csv`,
        getAccessToken,
        refreshAccessToken,
        onAuthFailure,
      ),
  });
}

export function useExportAccountJson() {
  const { getAccessToken, refreshAccessToken, onAuthFailure } = useAuthCallbacks();

  return useMutation({
    mutationFn: () =>
      downloadBlobWithAuth(
        "/api/user-data/export/json",
        `account-data-${getTodayIso()}.json`,
        getAccessToken,
        refreshAccessToken,
        onAuthFailure,
      ),
  });
}

export interface DeleteAccountInput {
  currentPassword: string;
}

export function useDeleteAccount() {
  const { getAccessToken } = useAuthCallbacks();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: DeleteAccountInput) => {
      const token = getAccessToken();

      const response = await fetch(`${apiBaseUrl}/api/user-data/account`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        let message = "Não foi possível excluir a conta.";
        let code: string | undefined;

        try {
          const body = JSON.parse(text) as Record<string, unknown>;
          if (typeof body.message === "string" && body.message.trim()) {
            message = body.message;
          }
          if (typeof body.error === "string") {
            code = body.error;
          }
        } catch {
          // ignore parse errors
        }

        throw new ApiError(message, response.status, code);
      }
    },
    onSuccess: () => {
      navigate(appRoutes.login);
    },
  });
}

function useAuthCallbacks() {
  const { accessToken, refreshAccessToken, clearSession } = useAuthContext();

  const getAccessToken = useCallback(() => accessToken ?? null, [accessToken]);

  const doRefresh = useCallback(async () => {
    try {
      return await refreshAccessToken();
    } catch {
      return null;
    }
  }, [refreshAccessToken]);

  const onAuthFailure = useCallback(async () => {
    clearSession();
  }, [clearSession]);

  return { getAccessToken, refreshAccessToken: doRefresh, onAuthFailure };
}
