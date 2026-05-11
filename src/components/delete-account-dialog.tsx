import { FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useDeleteAccount } from "@/hooks/use-user-data";

type DeleteAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteAccount = useDeleteAccount();

  useEffect(() => {
    if (open) {
      setPassword("");
      setFieldError(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);

    if (!password.trim()) {
      setFieldError("Informe sua senha atual para confirmar a exclusão.");
      return;
    }

    deleteAccount.mutate(
      { currentPassword: password },
      {
        onError: (error) => {
          if (error instanceof ApiError && error.status === 403) {
            setFieldError("Senha incorreta. Tente novamente.");
          } else if (error instanceof Error) {
            setFieldError(error.message || "Erro ao excluir conta. Tente novamente.");
          } else {
            setFieldError("Erro ao excluir conta. Tente novamente.");
          }
        },
      },
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    if (deleteAccount.isPending) {
      return;
    }

    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Excluir conta permanentemente</DialogTitle>
          <DialogDescription>
            Esta ação é <strong>irreversível</strong>. Todos os seus dados — transações, categorias, metas, histórico de
            chat e configurações — serão excluídos permanentemente e não poderão ser recuperados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-account-password">Confirme sua senha atual</Label>
            <Input
              id="delete-account-password"
              ref={inputRef}
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              disabled={deleteAccount.isPending}
              autoComplete="current-password"
            />
            {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={deleteAccount.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={deleteAccount.isPending || !password.trim()}>
              {deleteAccount.isPending ? "Excluindo..." : "Excluir minha conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
