import { Building2, CreditCard, Landmark, Plus, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { appRoutes } from "@/lib/routes";
import type { BankItem } from "@/types/api";

interface BankConnectionProps {
  banks?: BankItem[];
  isLoading?: boolean;
  isError?: boolean;
}

function BankConnectionSkeleton() {
  return (
    <div className="glass-card animate-fade-in p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Landmark size={14} className="text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Contas</h3>
        </div>
        <Skeleton className="h-4 w-16" />
      </div>

      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-lg bg-secondary/40 p-2.5">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountTypeIcon({ accountType }: { accountType: BankItem["accountType"] }) {
  if (accountType === "credit_card") {
    return <CreditCard size={14} className="text-foreground" />;
  }

  if (accountType === "cash") {
    return <Wallet size={14} className="text-foreground" />;
  }

  return <Building2 size={14} className="text-foreground" />;
}

function AccountTypeLabel({ accountType }: { accountType: BankItem["accountType"] }) {
  if (accountType === "credit_card") {
    return <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">Cartao</span>;
  }

  if (accountType === "cash") {
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-500">Caixa</span>;
  }

  return <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">Conta</span>;
}

export default function BankConnection({ banks = [], isLoading, isError }: BankConnectionProps) {
  if (isLoading) {
    return <BankConnectionSkeleton />;
  }

  return (
    <div className="glass-card animate-fade-in p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Landmark size={14} className="text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Contas</h3>
        </div>
        <Link to={appRoutes.accounts} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
          <Plus size={12} />
          Adicionar
        </Link>
      </div>

      {!banks.length ? (
        <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
          {isError
            ? "Nao foi possivel carregar as contas."
            : "Nenhuma conta vinculada ainda. Adicione sua primeira conta para acompanhar o saldo e os lancamentos."}
        </div>
      ) : (
        <div className="space-y-2.5">
          {banks.map((bank) => (
            <div key={bank.id} className="flex flex-col gap-3 rounded-lg bg-secondary/40 p-2.5 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3 sm:flex-1 sm:items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bank.color}`}>
                  <AccountTypeIcon accountType={bank.accountType} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{bank.name}</p>
                  <AccountTypeLabel accountType={bank.accountType} />
                  </div>
                  <p className="text-xs text-muted-foreground">{bank.formattedBalance}</p>
                </div>
              </div>
              <Link to={appRoutes.accounts} className="w-full text-right text-xs text-primary hover:underline sm:w-auto">
                Gerenciar
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
