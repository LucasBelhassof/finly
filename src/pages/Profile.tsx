import {
  BellRing,
  Crown,
  Lightbulb,
  LogOut,
  Mail,
  Rocket,
  Settings,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { useDashboard } from "@/hooks/use-dashboard";
import { appRoutes } from "@/lib/routes";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import type { AuthOnboardingProgress, OnboardingStepId } from "@/modules/auth/types/auth-types";

type ProfilePreferences = {
  notificationsEnabled: boolean;
  weeklyDigestEnabled: boolean;
  productTipsEnabled: boolean;
};

const PROFILE_PREFERENCES_STORAGE_KEY = "finance.profile.preferences";
const ONBOARDING_STEP_IDS: OnboardingStepId[] = ["profile", "account", "due_dates", "dashboard"];
const DEFAULT_PREFERENCES: ProfilePreferences = {
  notificationsEnabled: true,
  weeklyDigestEnabled: false,
  productTipsEnabled: true,
};

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function formatMonthReference(value?: string | null) {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(parsedDate);
}

function normalizeProgress(progress?: AuthOnboardingProgress | null): AuthOnboardingProgress {
  const completedSteps = ONBOARDING_STEP_IDS.filter((stepId) => progress?.completedSteps?.includes(stepId));
  const skippedSteps = ONBOARDING_STEP_IDS.filter((stepId) => progress?.skippedSteps?.includes(stepId) && !completedSteps.includes(stepId));

  return {
    currentStep: Math.max(0, Math.min(ONBOARDING_STEP_IDS.length - 1, progress?.currentStep ?? 0)),
    completedSteps,
    skippedSteps,
    dismissed: Boolean(progress?.dismissed),
  };
}

function getStatusMeta(status?: "active" | "inactive" | "suspended") {
  switch (status) {
    case "inactive":
      return { label: "Inativo", className: "border-border/60 bg-secondary/50 text-foreground" };
    case "suspended":
      return { label: "Suspenso", className: "border-destructive/20 bg-destructive/10 text-destructive" };
    default:
      return { label: "Ativo", className: "border-income/20 bg-income/10 text-income" };
  }
}

function getRoleLabel(role?: "user" | "admin") {
  return role === "admin" ? "Administrador" : "Usuario";
}

function getPlanMeta(isPremium?: boolean, premiumSince?: string | null) {
  if (isPremium) {
    return {
      label: "Premium",
      description: premiumSince ? `Ativo desde ${formatDateLabel(premiumSince)}` : "Recursos premium habilitados.",
      className: "border-primary/20 bg-primary/10 text-primary",
    };
  }

  return {
    label: "Free",
    description: "Plano padrao da conta.",
    className: "border-border/60 bg-secondary/50 text-foreground",
  };
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate(), 12, 0, 0, 0);
}

function getSubscriptionSummary(isPremium?: boolean, premiumSince?: string | null) {
  if (!isPremium || !premiumSince) {
    return {
      dueDayLabel: "--",
      dueDescription: "Disponivel apenas para contas premium.",
      referenceMonthLabel: "--",
      paymentDescription: "Sem historico de assinatura disponivel para esta conta.",
      renewalDescription: "Periodicidade e proxima cobranca dependem do backend de assinatura.",
    };
  }

  const activationDate = new Date(premiumSince);

  if (Number.isNaN(activationDate.getTime())) {
    return {
      dueDayLabel: "--",
      dueDescription: "Nao foi possivel interpretar a data da assinatura premium.",
      referenceMonthLabel: "--",
      paymentDescription: "Ultimo pagamento indisponivel.",
      renewalDescription: "Periodicidade e proxima cobranca dependem do backend de assinatura.",
    };
  }

  const today = new Date();
  const dueDay = activationDate.getDate();
  const currentCycleStart =
    today.getDate() >= dueDay
      ? new Date(today.getFullYear(), today.getMonth(), dueDay, 12, 0, 0, 0)
      : new Date(today.getFullYear(), today.getMonth() - 1, dueDay, 12, 0, 0, 0);
  const nextRenewal = addMonths(currentCycleStart, 1);

  return {
    dueDayLabel: String(dueDay).padStart(2, "0"),
    dueDescription: "Dia estimado a partir da data de ativacao premium.",
    referenceMonthLabel: formatMonthReference(currentCycleStart.toISOString()),
    paymentDescription: `Ultimo registro premium em ${formatDateLabel(premiumSince)}.`,
    renewalDescription: `Sem marcador de plano anual no backend. Renovacao estimada para ${formatDateLabel(nextRenewal.toISOString())}.`,
  };
}

function getOnboardingMeta(progress: AuthOnboardingProgress, hasCompletedOnboarding?: boolean) {
  if (hasCompletedOnboarding) {
    return {
      label: "Concluido",
      description: "Todas as etapas principais foram finalizadas.",
      className: "border-income/20 bg-income/10 text-income",
    };
  }

  if (progress.dismissed) {
    return {
      label: "Pausado",
      description: "Fluxo dispensado temporariamente. Voce pode retomar quando quiser.",
      className: "border-warning/20 bg-warning/10 text-warning",
    };
  }

  return {
    label: "Em andamento",
    description: "Ainda existem etapas pendentes para concluir o onboarding.",
    className: "border-primary/20 bg-primary/10 text-primary",
  };
}

function getInitialPreferences() {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const rawValue = window.localStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY);

    if (!rawValue) {
      return DEFAULT_PREFERENCES;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<ProfilePreferences>;

    return {
      notificationsEnabled: parsedValue.notificationsEnabled ?? DEFAULT_PREFERENCES.notificationsEnabled,
      weeklyDigestEnabled: parsedValue.weeklyDigestEnabled ?? DEFAULT_PREFERENCES.weeklyDigestEnabled,
      productTipsEnabled: parsedValue.productTipsEnabled ?? DEFAULT_PREFERENCES.productTipsEnabled,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { data } = useDashboard();
  const { user } = useAuthSession();
  const logoutMutation = useLogout();
  const [preferences, setPreferences] = useState<ProfilePreferences>(() => getInitialPreferences());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(PROFILE_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const onboardingProgress = useMemo(() => normalizeProgress(user?.onboardingProgress), [user?.onboardingProgress]);
  const userName = user?.name ?? data?.user.name ?? "Usuario";
  const userEmail = user?.email ?? data?.user.email ?? "usuario@email.com";
  const userId = user?.id ? String(user.id) : data?.user.id ? String(data.user.id) : "--";
  const statusMeta = getStatusMeta(user?.status);
  const planMeta = getPlanMeta(user?.isPremium, user?.premiumSince);
  const onboardingMeta = getOnboardingMeta(onboardingProgress, user?.hasCompletedOnboarding);
  const onboardingStepsDone = onboardingProgress.completedSteps.length + onboardingProgress.skippedSteps.length;
  const onboardingProgressValue = user?.hasCompletedOnboarding
    ? 100
    : Math.round((onboardingStepsDone / ONBOARDING_STEP_IDS.length) * 100);
  const insightsCount = data?.insights.length ?? 0;
  const isPremiumUser = Boolean(user?.isPremium);
  const subscriptionSummary = getSubscriptionSummary(user?.isPremium, user?.premiumSince);

  const handlePreferenceToggle = (key: keyof ProfilePreferences, checked: boolean) => {
    setPreferences((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      toast.error("Nao foi possivel encerrar a sessao.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  return (
    <AppShell title="Perfil" description="Dados da conta, seguranca e preferencias pessoais">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-6">
          <section className="glass-card rounded-2xl border border-border/40 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <UserCircle2 size={32} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-2xl font-semibold text-foreground">{userName}</h2>
                  <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                  <Badge className={planMeta.className}>{planMeta.label}</Badge>
                </div>
                <p className="mt-1 break-words text-sm text-muted-foreground">{userEmail}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">ID do usuario: {userId}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
                <p className="text-sm text-muted-foreground">Nome completo</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{userName}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="mt-2 break-words text-lg font-semibold text-foreground">{userEmail}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
                <p className="text-sm text-muted-foreground">Email verificado</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{user?.emailVerified ? "Verificado" : "Pendente"}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
                <p className="text-sm text-muted-foreground">Assinatura</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{planMeta.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{planMeta.description}</p>
              </div>
            </div>
          </section>

          <section className="glass-card rounded-2xl border border-border/40 p-4 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Conta</h3>
                <p className="mt-1 text-sm text-muted-foreground">Onboarding, plano atual e sinais operacionais da conta.</p>
              </div>
              <Badge className={onboardingMeta.className}>{onboardingMeta.label}</Badge>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Primeiros passos</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{onboardingMeta.label}</p>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{onboardingProgressValue}%</span>
                </div>
                <Progress value={onboardingProgressValue} className="mt-4 h-2.5 bg-secondary/70" />
                <p className="mt-3 text-sm text-muted-foreground">{onboardingMeta.description}</p>
                {!user?.hasCompletedOnboarding ? (
                  <Button
                    variant="outline"
                    className="mt-4 rounded-xl border-border/60 bg-secondary/20"
                    onClick={() => navigate(appRoutes.onboarding)}
                  >
                    <Rocket size={16} />
                    Retomar onboarding
                  </Button>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
                  <p className="text-sm text-muted-foreground">Plano atual</p>
                  <div className="mt-2 flex items-center gap-2">
                    {isPremiumUser ? <Crown size={16} className="text-primary" /> : null}
                    <p className="text-lg font-semibold text-foreground">{planMeta.label}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{planMeta.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative overflow-hidden rounded-xl border border-border/40 bg-secondary/20 p-4">
                    <div className={!isPremiumUser ? "pointer-events-none select-none blur-sm" : undefined}>
                      <p className="text-sm text-muted-foreground">Vencimento do plano</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">Dia {subscriptionSummary.dueDayLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{subscriptionSummary.dueDescription}</p>
                    </div>
                    {!isPremiumUser ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-card/35 px-3 text-center text-xs font-medium text-muted-foreground backdrop-blur-[2px]">
                        Disponivel apenas no premium
                      </div>
                    ) : null}
                  </div>

                  <div className="relative overflow-hidden rounded-xl border border-border/40 bg-secondary/20 p-4">
                    <div className={!isPremiumUser ? "pointer-events-none select-none blur-sm" : undefined}>
                      <p className="text-sm text-muted-foreground">Insights</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{insightsCount}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isPremiumUser ? "Insights disponiveis para a conta atual." : "Recurso liberado apenas para assinantes premium."}
                      </p>
                    </div>
                    {!isPremiumUser ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-card/35 px-3 text-center text-xs font-medium text-muted-foreground backdrop-blur-[2px]">
                        Liberado no premium
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-border/40 bg-secondary/20 p-4">
                  <div className={!isPremiumUser ? "pointer-events-none select-none blur-sm" : undefined}>
                    <p className="text-sm text-muted-foreground">Mes de referencia</p>
                    <p className="mt-2 text-lg font-semibold capitalize text-foreground">{subscriptionSummary.referenceMonthLabel}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{subscriptionSummary.paymentDescription}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{subscriptionSummary.renewalDescription}</p>
                  </div>
                  {!isPremiumUser ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-card/35 px-3 text-center text-xs font-medium text-muted-foreground backdrop-blur-[2px]">
                      Historico de assinatura indisponivel no plano free
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="glass-card rounded-2xl border border-border/40 p-4 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Preferências</h3>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
                <div>
                  <p className="font-medium text-foreground">Lembretes e notificações</p>
                </div>
                <Switch
                  checked={preferences.notificationsEnabled}
                  onCheckedChange={(checked) => handlePreferenceToggle("notificationsEnabled", checked)}
                  aria-label="Ativar lembretes e notificações"
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
                <div>
                  <p className="font-medium text-foreground">Resumo semanal</p>
                </div>
                <Switch
                  checked={preferences.weeklyDigestEnabled}
                  onCheckedChange={(checked) => handlePreferenceToggle("weeklyDigestEnabled", checked)}
                  aria-label="Ativar resumo semanal"
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
                <div>
                  <p className="font-medium text-foreground">Dicas e novidades do produto</p>
                </div>
                <Switch
                  checked={preferences.productTipsEnabled}
                  onCheckedChange={(checked) => handlePreferenceToggle("productTipsEnabled", checked)}
                  aria-label="Ativar dicas e novidades"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">


          <section className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">Atalhos</h3>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {!user?.hasCompletedOnboarding ? (
                <Button
                  variant="outline"
                  className="justify-start rounded-xl border-border/60 bg-secondary/20"
                  onClick={() => navigate(appRoutes.onboarding)}
                >
                  <Lightbulb size={16} />
                  Primeiros passos
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="justify-start rounded-xl border-border/60 bg-secondary/20"
                onClick={() => navigate(appRoutes.notifications)}
              >
                <BellRing size={16} />
                Notificacoes
              </Button>
              <Button
                variant="outline"
                className="justify-start rounded-xl border-border/60 bg-secondary/20"
                onClick={() => navigate(appRoutes.expenseManagementMetrics)}
              >
                <Rocket size={16} />
                Metricas
              </Button>
              <Button
                variant="outline"
                className="justify-start rounded-xl border-border/60 bg-secondary/20"
                onClick={() => navigate(appRoutes.accounts)}
              >
                <UserCircle2 size={16} />
                Contas
              </Button>
              <Button
                variant="outline"
                className="justify-start rounded-xl border-border/60 bg-secondary/20 sm:col-span-2"
                onClick={() => navigate(appRoutes.settings)}
              >
                <Settings size={16} />
                Abrir configuracoes tecnicas
              </Button>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
