import { Building2, CheckCircle2, Link2, Plus } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { BankItem } from "@/types/api";

interface BankConnectionProps {
  banks?: BankItem[];
  isLoading?: boolean;
  isError?: boolean;
}

function BankConnectionSkeleton() {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Link2 size={14} className="text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Open Finance</h3>
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

export default function BankConnection({ banks = [], isLoading, isError }: BankConnectionProps) {
  if (isLoading) {
    return <BankConnectionSkeleton />;
  }

  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Link2 size={14} className="text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Open Finance</h3>
        </div>
        <button type="button" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
          <Plus size={12} />
          Conectar
        </button>
      </div>

      {!banks.length ? (
        <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
          {isError ? "Nao foi possivel carregar as conexoes bancarias." : "Nenhum banco conectado ate o momento."}
        </div>
      ) : (
        <div className="space-y-2.5">
          {banks.map((bank) => (
            <div key={bank.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 p-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bank.color}`}>
                <Building2 size={14} className="text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{bank.name}</p>
                <p className="text-xs text-muted-foreground">
                  {bank.connected ? bank.formattedBalance : "Saldo indisponivel"}
                </p>
              </div>
              {bank.connected ? (
                <div className="flex items-center gap-1">
                  <CheckCircle2 size={14} className="text-income" />
                  <span className="text-xs text-income">Conectado</span>
                </div>
              ) : (
                <button type="button" className="text-xs text-primary hover:underline">
                  Conectar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
