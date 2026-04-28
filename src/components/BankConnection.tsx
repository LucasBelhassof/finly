import { Building2, CreditCard, Landmark, Plus, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import CreditLimitBar from "@/components/accounts/CreditLimitBar";
import { Skeleton } from "@/components/ui/skeleton";
import { getInstitutionInitials } from "@/lib/account-colors";
import { resolveCategoryColorValue } from "@/lib/category-colors";
import { appRoutes } from "@/lib/routes";
import type { BankItem } from "@/types/api";

interface BankConnectionProps {
  banks?: BankItem[];
  isLoading?: boolean;
  isError?: boolean;
}

function BankConnectionCardSkeleton({ title }: { title: string }) {
  return (
    <div className="glass-card animate-fade-in p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Landmark size={14} className="text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <Skeleton className="h-4 w-16" />
      </div>

      <div className="space-y-2.5">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-lg bg-secondary/40 p-2.5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
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
    return <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">Cartão</span>;
  }

  if (accountType === "cash") {
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-500">Caixa</span>;
  }

  return <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">Conta</span>;
}

function AccountAvatar({ bank }: { bank: BankItem }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
      style={{ backgroundColor: resolveCategoryColorValue(bank.color) }}
    >
      {bank.institutionName ? (
        <span className="text-[10px] font-bold leading-none text-white">
          {getInstitutionInitials(bank.institutionName)}
        </span>
      ) : (
        <AccountTypeIcon accountType={bank.accountType} />
      )}
    </div>
  );
}

export default function BankConnection({ banks = [], isLoading, isError }: BankConnectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <BankConnectionCardSkeleton title="Contas" />
        <BankConnectionCardSkeleton title="Cartões" />
      </div>
    );
  }

  const bankAccounts = banks.filter((bank) => bank.accountType === "bank_account");
  const creditCards = banks.filter((bank) => bank.accountType === "credit_card");

  return (
    <div className="space-y-4">
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

        {!bankAccounts.length ? (
          <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
            {isError
              ? "Não foi possível carregar as contas bancárias."
              : "Nenhuma conta bancária vinculada ainda. Adicione sua primeira conta para acompanhar o saldo."}
          </div>
        ) : (
          <div className="space-y-2.5">
            {bankAccounts.map((bank) => (
              <div key={bank.id} className="flex flex-col gap-3 rounded-lg bg-secondary/40 p-2.5 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3 sm:flex-1 sm:items-center">
                  <AccountAvatar bank={bank} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{bank.institutionName ?? bank.name}</p>
                      <AccountTypeLabel accountType={bank.accountType} />
                    </div>
                    {bank.institutionName && bank.institutionName !== bank.name ? (
                      <p className="text-xs text-muted-foreground">{bank.name}</p>
                    ) : null}
                    <p className="text-xs font-medium text-foreground">{bank.formattedBalance}</p>
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

      <div className="glass-card animate-fade-in p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10">
              <CreditCard size={14} className="text-warning" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Cartões</h3>
          </div>
          <Link to={appRoutes.accounts} className="text-xs text-primary hover:underline">
            Ver contas
          </Link>
        </div>

        {!creditCards.length ? (
          <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
            {isError
              ? "Não foi possível carregar os cartões."
              : "Nenhum cartão vinculado ainda. Cadastre um cartão para acompanhar limite e uso."}
          </div>
        ) : (
          <div className="space-y-3">
            {creditCards.map((card) => (
              <div key={card.id} className="rounded-lg bg-secondary/40 p-3">
                <div className="flex items-start gap-3">
                  <AccountAvatar bank={card} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{card.name}</p>
                      <AccountTypeLabel accountType={card.accountType} />
                    </div>
                    {card.parentAccountName ? (
                      <p className="text-xs text-muted-foreground">Vinculado a {card.parentAccountName}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Fecha dia {card.statementCloseDay ?? "--"} - vence dia {card.statementDueDay ?? "--"}
                    </p>
                    {card.creditLimit && card.creditLimit > 0 ? (
                      <CreditLimitBar
                        currentBalance={card.currentBalance}
                        creditLimit={card.creditLimit}
                        formattedCreditLimit={card.formattedCreditLimit}
                        barContainerClassName="w-full"
                      />
                    ) : card.formattedCreditLimit ? (
                      <p className="mt-2 text-xs text-muted-foreground">Limite total {card.formattedCreditLimit}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
