import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { appRoutes } from "@/lib/routes";

const LOGIN_REDIRECT_DELAY_MS = 10000;

export default function AccountDeletedPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      navigate(appRoutes.login, { replace: true });
    }, LOGIN_REDIRECT_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">Cancelamento concluído</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta foi cancelada com sucesso e os dados vinculados foram removidos.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Você será redirecionado para a tela de login em instantes.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Se quiser voltar a usar o Finly no futuro, será necessário criar uma nova conta.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button className="rounded-xl" onClick={() => navigate(appRoutes.login, { replace: true })}>
              <LogIn className="mr-2 h-4 w-4" />
              Ir para login
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
