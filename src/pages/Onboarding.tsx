import { Landmark, LayoutDashboard, Lightbulb, MessageSquare, PiggyBank, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useBanks, useCreateBankConnection } from "@/hooks/use-banks";
import { ACCOUNT_COLOR_PRESETS, getSuggestedAccountColor } from "@/lib/account-colors";
import { appRoutes } from "@/lib/routes";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import type { CreateBankConnectionInput } from "@/types/api";

type StarterAccountType = "bank_account" | "cash";

type StarterForm = {
  name: string;
  accountType: StarterAccountType;
  currentBalance: string;
  color: string;
};

const guideCards = [
  {
    title: "Dashboard",
    description: "Acompanhe saldo, receitas, despesas e os ultimos movimentos em um resumo unico.",
    icon: LayoutDashboard,
    to: appRoutes.dashboard,
  },
  {
    title: "Transacoes",
    description: "Registre entradas, saidas e acompanhe tudo por conta, categoria e periodo.",
    icon: PiggyBank,
    to: appRoutes.transactions,
  },
  {
    title: "Chat e Insights",
    description: "Use o chat para explorar seus dados e veja sinais de economia ou atencao.",
    icon: Lightbulb,
    to: appRoutes.insights,
  },
];

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buildDefaultForm(accountType: StarterAccountType = "bank_account"): StarterForm {
  return {
    name: "",
    accountType,
    currentBalance: "0,00",
    color: getSuggestedAccountColor("", accountType),
  };
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const { data: banks = [] } = useBanks(Boolean(user));
  const createBankConnection = useCreateBankConnection();
  const [form, setForm] = useState<StarterForm>(buildDefaultForm());
  const [hasCreatedAccountInFlow, setHasCreatedAccountInFlow] = useState(false);
  const [hasManualColorSelection, setHasManualColorSelection] = useState(false);

  useEffect(() => {
    if (user?.hasCompletedOnboarding) {
      navigate(appRoutes.dashboard, { replace: true });
    }
  }, [navigate, user?.hasCompletedOnboarding]);

  const hasAnyAccount = banks.length > 0 || hasCreatedAccountInFlow;

  const handleCreateAccount = async () => {
    const currentBalance = parseCurrencyInput(form.currentBalance);

    if (!form.name.trim() || !Number.isFinite(currentBalance)) {
      toast.error("Informe um nome e um saldo inicial validos.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      accountType: form.accountType,
      currentBalance,
      color: form.color,
      connected: true,
    } satisfies CreateBankConnectionInput;

    try {
      await createBankConnection.mutateAsync(payload);
      setHasCreatedAccountInFlow(true);
      toast.success("Conta inicial criada. Agora voce ja pode comecar a usar o sistema.");
    } catch (error) {
      toast.error("Nao foi possivel criar sua conta inicial.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_32%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--background)))] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-3xl border border-border/50 bg-card/80 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Primeiros passos</p>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {user?.name ? `${user.name}, vamos montar sua base financeira` : "Vamos montar sua base financeira"}
              </h1>
              <p className="text-base text-muted-foreground sm:text-lg">
                Antes de entrar no app, cadastre sua primeira conta. Pode ser dinheiro em caixa ou uma conta bancaria.
                Com isso o sistema consegue organizar saldo, transacoes e relatorios desde o primeiro uso.
              </p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground lg:max-w-sm">
              <p className="font-medium text-foreground">Fluxo de ativacao</p>
              <p className="mt-2">1. Crie sua primeira conta.</p>
              <p>2. Entenda onde registrar transacoes, acompanhar saldo e conversar com a IA.</p>
              <p>3. Entre no dashboard para comecar.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <section className="rounded-3xl border border-border/50 bg-card/80 p-6 shadow-sm backdrop-blur sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {form.accountType === "cash" ? <Wallet size={20} /> : <Landmark size={20} />}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Crie sua primeira conta</h2>
                <p className="text-sm text-muted-foreground">Escolha o tipo, nome e saldo inicial.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <Select
                value={form.accountType}
                onValueChange={(value: StarterAccountType) =>
                  setForm((current) => ({
                    ...current,
                    accountType: value,
                    color: value === "cash" || !hasManualColorSelection ? getSuggestedAccountColor(current.name, value) : current.color,
                  }))
                }
              >
                <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/30">
                  <SelectValue placeholder="Tipo da conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_account">Conta bancaria</SelectItem>
                  <SelectItem value="cash">Caixa / Dinheiro</SelectItem>
                </SelectContent>
              </Select>

              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    color: hasManualColorSelection ? current.color : getSuggestedAccountColor(event.target.value, current.accountType),
                  }))
                }
                placeholder={form.accountType === "cash" ? "Ex.: Carteira, Caixa da casa" : "Ex.: Itau, Nubank, Santander"}
                className="h-11 rounded-xl border-border/60 bg-secondary/30"
              />

              <Input
                value={form.currentBalance}
                onChange={(event) => setForm((current) => ({ ...current, currentBalance: event.target.value }))}
                placeholder="Saldo inicial"
                inputMode="decimal"
                className="h-11 rounded-xl border-border/60 bg-secondary/30"
              />

              <ColorField
                label="Cor da conta"
                value={form.color}
                onChange={(nextColor) => {
                  setHasManualColorSelection(true);
                  setForm((current) => ({ ...current, color: nextColor }));
                }}
                presets={ACCOUNT_COLOR_PRESETS}
                inputAriaLabel="Selecionar cor da conta inicial"
                fallback={getSuggestedAccountColor(form.name, form.accountType)}
              />

              <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">
                {form.accountType === "cash"
                  ? "Use caixa para valores em dinheiro fisico ou uma reserva fora do banco."
                  : "Use conta bancaria para saldo de conta corrente, poupanca ou conta digital."}
              </div>

              <Button className="w-full sm:w-auto" onClick={() => void handleCreateAccount()} disabled={createBankConnection.isPending}>
                {createBankConnection.isPending ? "Criando conta..." : "Criar conta inicial"}
              </Button>
            </div>
          </section>

          <aside className="rounded-3xl border border-border/50 bg-card/80 p-6 shadow-sm backdrop-blur sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-info/10 text-info">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Como usar o Finly</h2>
                <p className="text-sm text-muted-foreground">O que fazer logo depois de entrar.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {guideCards.map((card) => (
                <div key={card.title} className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary">
                      <card.icon size={18} />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{card.title}</p>
                      <p className="text-sm text-muted-foreground">{card.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="font-medium text-foreground">Depois da conta criada</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Registre suas primeiras transacoes, revise a estrutura em Contas e acompanhe o comportamento no Dashboard.
              </p>

              <div className="mt-4 flex flex-col gap-3">
                <Button onClick={() => navigate(appRoutes.dashboard)} disabled={!hasAnyAccount}>
                  Entrar no dashboard
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {hasAnyAccount ? (
                    <Button asChild variant="outline" className="flex-1">
                      <Link to={appRoutes.transactions}>Ir para transacoes</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" className="flex-1" disabled>
                      Ir para transacoes
                    </Button>
                  )}
                  {hasAnyAccount ? (
                    <Button asChild variant="outline" className="flex-1">
                      <Link to={appRoutes.accounts}>Ver contas</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" className="flex-1" disabled>
                      Ver contas
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
