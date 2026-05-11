import { ArrowRight, CheckCircle2, Crown, CreditCard, FileUp, LayoutDashboard, Rocket, Tags } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useBanks } from "@/hooks/use-banks";
import { useDashboard } from "@/hooks/use-dashboard";
import { useCategories, useTransactions } from "@/hooks/use-transactions";
import { appRoutes } from "@/lib/routes";
import { hasCompletedActionOnboardingStep } from "@/modules/auth/lib/onboarding-progress";
import { hasUsefulOnboardingAccount, isUsefulOnboardingAccountType } from "@/modules/auth/lib/setup-completion";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import { useProductTour } from "@/modules/product-tour/use-product-tour";

type OnboardingChecklistItem = {
  id: string;
  title: string;
  description: string;
  helper: string;
  actionLabel: string;
  secondaryActionLabel?: string;
  complete: boolean;
  icon: typeof CreditCard;
  onAction: () => void;
  onSecondaryAction?: () => void;
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const { restartTour } = useProductTour();
  const { data: banks = [], isLoading: isBanksLoading } = useBanks();
  const { data: transactions = [], isLoading: isTransactionsLoading } = useTransactions();
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories();
  const { data: dashboardData, isLoading: isDashboardLoading } = useDashboard();

  const hasConfiguredAccounts = useMemo(() => hasUsefulOnboardingAccount(banks), [banks]);
  const hasTransactions = transactions.length > 0;
  const hasCategoriesToReview = categories.length > 0 && hasTransactions;
  const hasVisitedDashboard = hasCompletedActionOnboardingStep(user?.onboardingProgress, "dashboard");
  const hasVisitedPremium = hasCompletedActionOnboardingStep(user?.onboardingProgress, "premium");
  const hasUsefulDashboardData = useMemo(() => {
    const dashboardBanks = dashboardData?.banks ?? [];
    const hasDashboardAccounts = dashboardBanks.some((bank) => isUsefulOnboardingAccountType(bank.accountType));
    const hasDashboardTransactions = (dashboardData?.recentTransactions?.length ?? 0) > 0;
    const hasSpendingData = (dashboardData?.spendingByCategory?.length ?? 0) > 0;

    return hasDashboardAccounts && (hasDashboardTransactions || hasSpendingData || hasTransactions);
  }, [
    dashboardData?.banks,
    dashboardData?.recentTransactions?.length,
    dashboardData?.spendingByCategory?.length,
    hasTransactions,
  ]);
  const hasSeenPremiumValue = Boolean(user?.isPremium || hasVisitedPremium);
  const isLoading = isBanksLoading || isTransactionsLoading || isCategoriesLoading || isDashboardLoading;

  const checklistItems = useMemo<OnboardingChecklistItem[]>(
    () => [
      {
        id: "accounts",
        title: "Criar conta ou cartão",
        description: "Cadastre a primeira conta bancária ou um cartão para montar sua estrutura financeira.",
        helper: hasConfiguredAccounts
          ? "Você já tem uma estrutura inicial pronta para continuar."
          : "Comece pela origem do dinheiro e pelos cartões que entram no seu dia a dia.",
        actionLabel: hasConfiguredAccounts ? "Revisar contas" : "Criar conta ou cartão",
        complete: hasConfiguredAccounts,
        icon: CreditCard,
        onAction: () => navigate(appRoutes.accounts),
      },
      {
        id: "transactions",
        title: "Importar extrato ou fatura",
        description: "Traga movimentações reais por importação ou registre a primeira transação manualmente.",
        helper: hasTransactions
          ? "Já existem lançamentos suficientes para alimentar as próximas etapas."
          : "Sem transações, o dashboard e as categorias continuam sem contexto real.",
        actionLabel: "Importar extrato",
        secondaryActionLabel: "Criar transação",
        complete: hasTransactions,
        icon: FileUp,
        onAction: () => navigate(appRoutes.transactions),
        onSecondaryAction: () => navigate(appRoutes.transactions),
      },
      {
        id: "categories",
        title: "Revisar categorias",
        description: "Confira se as categorias fazem sentido para os seus lançamentos antes de seguir.",
        helper: hasCategoriesToReview
          ? "As categorias já podem ser revisadas direto na gestão de transações."
          : "As categorias padrão já existem, mas esta revisão fica útil depois que houver lançamentos reais.",
        actionLabel: "Revisar categorias",
        complete: hasCategoriesToReview,
        icon: Tags,
        onAction: () => navigate(appRoutes.transactions),
      },
      {
        id: "dashboard",
        title: "Ver dashboard",
        description: "Abra o dashboard quando já houver estrutura e dados suficientes para uma leitura útil.",
        helper: hasUsefulDashboardData
          ? "Seu dashboard já tem base para mostrar saldo, movimentações e distribuição."
          : "O dashboard fica realmente útil depois da conta inicial e dos primeiros lançamentos.",
        actionLabel: "Ver dashboard",
        complete: hasUsefulDashboardData || hasVisitedDashboard,
        icon: LayoutDashboard,
        onAction: () => navigate(appRoutes.dashboard),
      },
      {
        id: "premium",
        title: "Conhecer Premium",
        description: "Entenda o que o plano Premium destrava sem alterar o comportamento atual de cobrança.",
        helper: hasSeenPremiumValue
          ? "Sua conta já está marcada como Premium."
          : "Veja quando faz sentido liberar IA, insights e planejamentos na sua rotina.",
        actionLabel: hasSeenPremiumValue ? "Ver plano atual" : "Conhecer Premium",
        complete: hasSeenPremiumValue,
        icon: Crown,
        onAction: () => navigate(appRoutes.pricing),
      },
    ],
    [
      hasCategoriesToReview,
      hasConfiguredAccounts,
      hasVisitedDashboard,
      hasSeenPremiumValue,
      hasTransactions,
      hasUsefulDashboardData,
      navigate,
    ],
  );

  const completedItems = checklistItems.filter((item) => item.complete).length;
  const progressValue = Math.round((completedItems / checklistItems.length) * 100);
  const nextPendingItem = checklistItems.find((item) => !item.complete) ?? checklistItems[checklistItems.length - 1];

  return (
    <AppShell
      title="Primeiros passos"
      description="Siga esta sequência para sair do zero e chegar ao primeiro dashboard útil."
    >
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_320px]">
        <div className="space-y-6">
          <div className="glass-card rounded-2xl border border-border/40 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <Badge className="border-primary/20 bg-primary/10 text-primary">Onboarding acionável</Badge>
                <h2 className="mt-3 text-2xl font-semibold text-foreground">
                  Monte sua base antes de explorar o resto
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Esta etapa não substitui o tour do produto. Ela organiza as ações mínimas para você cadastrar a
                  estrutura inicial, trazer dados reais e chegar ao dashboard com contexto.
                </p>
              </div>

              <div className="rounded-2xl border border-border/40 bg-secondary/20 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progresso</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {completedItems}/{checklistItems.length}
                </p>
              </div>
            </div>

            <Progress value={progressValue} className="mt-6 h-2.5 bg-secondary/70" />
            <p className="mt-3 text-sm text-muted-foreground">
              {isLoading
                ? "Carregando o estado atual da sua conta."
                : nextPendingItem.complete
                  ? "Checklist concluída. Agora faz sentido explorar o restante do produto."
                  : `Próxima ação recomendada: ${nextPendingItem.title}.`}
            </p>
          </div>

          <div className="space-y-4">
            {checklistItems.map((item, index) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.id}
                  className="glass-card rounded-2xl border border-border/40 p-5 transition-colors sm:p-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                          item.complete ? "bg-income/15 text-income" : "bg-primary/10 text-primary"
                        }`}
                      >
                        <Icon size={20} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Etapa {index + 1}
                          </span>
                          <Badge
                            className={
                              item.complete
                                ? "border-income/20 bg-income/10 text-income"
                                : "border-border/60 bg-secondary/50 text-foreground"
                            }
                          >
                            {item.complete ? "Concluído" : "Pendente"}
                          </Badge>
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-foreground">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                        <p className="mt-3 text-sm text-muted-foreground">{item.helper}</p>
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
                      <Button onClick={item.onAction} className="w-full justify-between">
                        {item.actionLabel}
                        <ArrowRight size={16} />
                      </Button>
                      {item.onSecondaryAction && item.secondaryActionLabel ? (
                        <Button variant="outline" onClick={item.onSecondaryAction} className="w-full">
                          {item.secondaryActionLabel}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="glass-card rounded-2xl border border-border/40 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary/50 text-foreground">
                <Rocket size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Tour do produto</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  O tour continua disponível para explicar cada tela. Use-o como apoio depois de avançar na checklist.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="mt-5 w-full"
              onClick={() => {
                void restartTour();
              }}
            >
              <Rocket size={16} />
              Fazer tour do produto
            </Button>
          </div>

          <div className="glass-card rounded-2xl border border-border/40 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Meta desta etapa</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Feche com pelo menos uma conta útil e alguns lançamentos reais. A partir daí, dashboard, categorias e
                  Premium passam a fazer sentido com menos atrito.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
