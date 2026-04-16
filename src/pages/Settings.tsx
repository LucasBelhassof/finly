import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  CheckCircle2,
  Loader2,
  LogOut,
  Mail,
  MapPinned,
  Save,
  ServerCog,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import AppShell from "@/components/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { dashboardQueryKey, useDashboard } from "@/hooks/use-dashboard";
import { useHealth } from "@/hooks/use-health";
import { appRoutes } from "@/lib/routes";
import { PasswordField } from "@/modules/auth/components/PasswordField";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import {
  settingsAccountFormSchema,
  settingsContactFormSchema,
  settingsPasswordFormSchema,
  type SettingsAccountFormValues,
  type SettingsContactFormValues,
  type SettingsPasswordFormValues,
} from "@/modules/auth/schemas/auth-schemas";
import { changePassword, updateAccount, updateContact } from "@/modules/auth/services/auth-service";

type FeedbackState = {
  type: "success" | "error";
  title: string;
  message: string;
} | null;

type SettingsPreferences = {
  notificationsEnabled: boolean;
  weeklyDigestEnabled: boolean;
  dueDateRemindersEnabled: boolean;
  compactValuesEnabled: boolean;
  showSystemSection: boolean;
};

const SETTINGS_PREFERENCES_STORAGE_KEY = "finance.settings.preferences";
const DEFAULT_PREFERENCES: SettingsPreferences = {
  notificationsEnabled: true,
  weeklyDigestEnabled: false,
  dueDateRemindersEnabled: true,
  compactValuesEnabled: false,
  showSystemSection: true,
};

const apiUrl = import.meta.env.VITE_API_URL?.trim() || window.location.origin;

function formatServerTime(value?: string) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function normalizeOptionalText(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits ? digits : null;
}

function formatPhone(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);

  if (!digits) {
    return "";
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function normalizePostalCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits ? digits : null;
}

function formatPostalCode(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function getInitialPreferences() {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const rawValue = window.localStorage.getItem(SETTINGS_PREFERENCES_STORAGE_KEY);

    if (!rawValue) {
      return DEFAULT_PREFERENCES;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<SettingsPreferences>;

    return {
      notificationsEnabled: parsedValue.notificationsEnabled ?? DEFAULT_PREFERENCES.notificationsEnabled,
      weeklyDigestEnabled: parsedValue.weeklyDigestEnabled ?? DEFAULT_PREFERENCES.weeklyDigestEnabled,
      dueDateRemindersEnabled: parsedValue.dueDateRemindersEnabled ?? DEFAULT_PREFERENCES.dueDateRemindersEnabled,
      compactValuesEnabled: parsedValue.compactValuesEnabled ?? DEFAULT_PREFERENCES.compactValuesEnabled,
      showSystemSection: parsedValue.showSystemSection ?? DEFAULT_PREFERENCES.showSystemSection,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card rounded-2xl border border-border/40 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">{icon}</div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function FeedbackAlert({ feedback }: { feedback: FeedbackState }) {
  if (!feedback) {
    return null;
  }

  return (
    <Alert
      variant={feedback.type === "error" ? "destructive" : "default"}
      className={feedback.type === "success" ? "border-income/30 bg-income/10 text-foreground [&>svg]:text-income" : undefined}
    >
      {feedback.type === "success" ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
      <AlertTitle>{feedback.title}</AlertTitle>
      <AlertDescription>{feedback.message}</AlertDescription>
    </Alert>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: dashboardData } = useDashboard();
  const { data: healthData, isLoading: isHealthLoading, isError: isHealthError } = useHealth();
  const { user, isBootstrapping, setUserState } = useAuthSession();
  const logoutMutation = useLogout();
  const [accountFeedback, setAccountFeedback] = useState<FeedbackState>(null);
  const [contactFeedback, setContactFeedback] = useState<FeedbackState>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<FeedbackState>(null);
  const [preferencesFeedback, setPreferencesFeedback] = useState<FeedbackState>(null);
  const [preferences, setPreferences] = useState<SettingsPreferences>(() => getInitialPreferences());
  const [savedPreferences, setSavedPreferences] = useState<SettingsPreferences>(() => getInitialPreferences());

  const accountForm = useForm<SettingsAccountFormValues>({
    resolver: zodResolver(settingsAccountFormSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      confirmEmail: user?.email ?? "",
    },
  });

  const contactForm = useForm<SettingsContactFormValues>({
    resolver: zodResolver(settingsContactFormSchema),
    defaultValues: {
      phone: formatPhone(user?.phone),
      addressStreet: user?.addressStreet ?? "",
      addressNumber: user?.addressNumber ?? "",
      addressComplement: user?.addressComplement ?? "",
      addressNeighborhood: user?.addressNeighborhood ?? "",
      addressCity: user?.addressCity ?? "",
      addressState: user?.addressState ?? "",
      addressPostalCode: formatPostalCode(user?.addressPostalCode),
      addressCountry: user?.addressCountry ?? "Brasil",
    },
  });

  const passwordForm = useForm<SettingsPasswordFormValues>({
    resolver: zodResolver(settingsPasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    accountForm.reset({
      name: user?.name ?? "",
      email: user?.email ?? "",
      confirmEmail: user?.email ?? "",
    });

    contactForm.reset({
      phone: formatPhone(user?.phone),
      addressStreet: user?.addressStreet ?? "",
      addressNumber: user?.addressNumber ?? "",
      addressComplement: user?.addressComplement ?? "",
      addressNeighborhood: user?.addressNeighborhood ?? "",
      addressCity: user?.addressCity ?? "",
      addressState: user?.addressState ?? "",
      addressPostalCode: formatPostalCode(user?.addressPostalCode),
      addressCountry: user?.addressCountry ?? "Brasil",
    });
  }, [accountForm, contactForm, user]);

  const accountMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: ({ user: updatedUser }) => {
      setUserState(updatedUser);
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      setAccountFeedback({
        type: "success",
        title: "Conta atualizada",
        message:
          updatedUser.emailVerified === false
            ? "Se o e-mail mudou, o status de verificacao foi reiniciado."
            : "Seus dados principais foram salvos com sucesso.",
      });
    },
    onError: (error) => {
      setAccountFeedback({
        type: "error",
        title: "Nao foi possivel atualizar a conta",
        message: getErrorMessage(error, "Revise os dados e tente novamente."),
      });
    },
  });

  const contactMutation = useMutation({
    mutationFn: updateContact,
    onSuccess: ({ user: updatedUser }) => {
      setUserState(updatedUser);
      setContactFeedback({
        type: "success",
        title: "Perfil e contato atualizados",
        message: "Telefone e endereco foram salvos na sua conta.",
      });
    },
    onError: (error) => {
      setContactFeedback({
        type: "error",
        title: "Nao foi possivel salvar o perfil",
        message: getErrorMessage(error, "Revise os campos e tente novamente."),
      });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: async ({ message }) => {
      setPasswordFeedback({
        type: "success",
        title: "Senha atualizada",
        message,
      });
      passwordForm.reset();
      await logoutMutation.mutateAsync();
    },
    onError: (error) => {
      setPasswordFeedback({
        type: "error",
        title: "Nao foi possivel trocar a senha",
        message: getErrorMessage(error, "Confirme a senha atual e tente novamente."),
      });
    },
  });

  const currentEmail = user?.email ?? dashboardData?.user.email ?? "--";
  const currentName = user?.name ?? dashboardData?.user.name ?? "Usuario";
  const verificationBadgeClass = user?.emailVerified
    ? "border-income/20 bg-income/10 text-income"
    : "border-warning/20 bg-warning/10 text-warning";
  const preferencesDirty = useMemo(
    () => JSON.stringify(preferences) !== JSON.stringify(savedPreferences),
    [preferences, savedPreferences],
  );

  const handleAccountSubmit = accountForm.handleSubmit(async (values) => {
    setAccountFeedback(null);
    await accountMutation.mutateAsync(values);
  });

  const handleContactSubmit = contactForm.handleSubmit(async (values) => {
    setContactFeedback(null);
    await contactMutation.mutateAsync({
      phone: normalizePhone(values.phone ?? ""),
      addressStreet: normalizeOptionalText(values.addressStreet ?? ""),
      addressNumber: normalizeOptionalText(values.addressNumber ?? ""),
      addressComplement: normalizeOptionalText(values.addressComplement ?? ""),
      addressNeighborhood: normalizeOptionalText(values.addressNeighborhood ?? ""),
      addressCity: normalizeOptionalText(values.addressCity ?? ""),
      addressState: normalizeOptionalText(values.addressState ?? "")?.toUpperCase() ?? null,
      addressPostalCode: normalizePostalCode(values.addressPostalCode ?? ""),
      addressCountry: normalizeOptionalText(values.addressCountry ?? ""),
    });
  });

  const handlePasswordSubmit = passwordForm.handleSubmit(async (values) => {
    setPasswordFeedback(null);
    await passwordMutation.mutateAsync(values);
  });

  const handlePreferenceToggle = (key: keyof SettingsPreferences, checked: boolean) => {
    setPreferencesFeedback(null);
    setPreferences((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const handleSavePreferences = () => {
    setPreferencesFeedback(null);

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SETTINGS_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
      }

      setSavedPreferences(preferences);
      setPreferencesFeedback({
        type: "success",
        title: "Preferencias salvas neste dispositivo",
        message: "Essas opcoes ainda nao possuem backend de persistencia e valem apenas neste navegador.",
      });
    } catch {
      setPreferencesFeedback({
        type: "error",
        title: "Nao foi possivel salvar as preferencias",
        message: "O navegador bloqueou o armazenamento local neste dispositivo.",
      });
    }
  };

  const handleLogout = async () => {
    setPasswordFeedback(null);

    try {
      await logoutMutation.mutateAsync();
    } catch {
      setPasswordFeedback({
        type: "error",
        title: "Nao foi possivel encerrar a sessao",
        message: "Tente novamente em instantes.",
      });
    }
  };

  if (isBootstrapping && !user) {
    return (
      <AppShell title="Configuracoes" description="Carregando preferencias, dados da conta e status do sistema">
        <div className="glass-card flex min-h-[240px] items-center justify-center rounded-2xl border border-border/40">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            Carregando configuracoes da conta...
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Configuracoes" description="Conta, seguranca, perfil, preferencias e informacoes tecnicas do app">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_380px]">
        <div className="space-y-6">
          <SettingsSection
            icon={<UserRoundCog size={20} />}
            title="Conta"
            description="Edite seus dados principais e gerencie a alteracao do e-mail da conta."
          >
            <div className="grid gap-4 rounded-xl border border-border/40 bg-secondary/20 p-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Nome atual</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{currentName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">E-mail atual</p>
                <p className="mt-1 break-all text-lg font-semibold text-foreground">{currentEmail}</p>
              </div>
            </div>

            <div className="mt-4">
              <FeedbackAlert feedback={accountFeedback} />
            </div>

            <Form {...accountForm}>
              <form className="mt-4 space-y-5" onSubmit={handleAccountSubmit}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={accountForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Seu nome completo" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
                    <p className="text-sm text-muted-foreground">Status do e-mail</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className={verificationBadgeClass}>{user?.emailVerified ? "Verificado" : "Pendente"}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Se voce alterar o e-mail, a verificacao atual e reiniciada.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={accountForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Novo e-mail</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" inputMode="email" autoComplete="email" placeholder="voce@empresa.com" />
                        </FormControl>
                        <FormDescription>Use o e-mail que voce quer manter como principal na conta.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={accountForm.control}
                    name="confirmEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar novo e-mail</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" inputMode="email" autoComplete="email" placeholder="Repita o novo e-mail" />
                        </FormControl>
                        <FormDescription>Os dois campos precisam ser identicos para liberar a alteracao.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={accountMutation.isPending}>
                    {accountMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Salvar conta
                  </Button>
                </div>
              </form>
            </Form>
          </SettingsSection>

          <SettingsSection
            icon={<ShieldCheck size={20} />}
            title="Seguranca"
            description="Troque sua senha com validacoes reais, acompanhe a verificacao do e-mail e encerre a sessao quando precisar."
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_280px]">
              <div>
                <FeedbackAlert feedback={passwordFeedback} />

                <Form {...passwordForm}>
                  <form className="mt-4 space-y-5" onSubmit={handlePasswordSubmit}>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha atual</FormLabel>
                            <FormControl>
                              <PasswordField {...field} autoComplete="current-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
                        <p className="text-sm text-muted-foreground">Verificacao de e-mail</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge className={verificationBadgeClass}>{user?.emailVerified ? "Verificado" : "Pendente"}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          O backend atual nao possui reenvio de verificacao direto por esta tela.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nova senha</FormLabel>
                            <FormControl>
                              <PasswordField {...field} autoComplete="new-password" />
                            </FormControl>
                            <FormDescription>Use pelo menos 8 caracteres e evite repetir a senha atual.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar nova senha</FormLabel>
                            <FormControl>
                              <PasswordField {...field} autoComplete="new-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex flex-wrap justify-end gap-3">
                      <Button type="button" variant="outline" className="rounded-xl border-border/60 bg-secondary/20" onClick={handleLogout}>
                        <LogOut size={16} />
                        Logout
                      </Button>
                      <Button type="submit" disabled={passwordMutation.isPending || logoutMutation.isPending}>
                        {passwordMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                        Trocar senha
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>

              <div className="space-y-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Boas praticas</p>
                  <p className="mt-2 text-sm text-foreground">
                    Ao trocar a senha, o backend encerra as sessoes antigas e exige novo login.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fluxo alternativo</p>
                  <p className="mt-2 text-sm text-foreground">
                    Se voce perder acesso a senha atual, use a recuperacao em {appRoutes.forgotPassword}.
                  </p>
                </div>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<MapPinned size={20} />}
            title="Perfil e contato"
            description="Telefone, celular e endereco para manter seu cadastro completo e pronto para futuras integracoes."
          >
            <div className="mt-1">
              <FeedbackAlert feedback={contactFeedback} />
            </div>

            <Form {...contactForm}>
              <form className="mt-4 space-y-5" onSubmit={handleContactSubmit}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <FormField
                    control={contactForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone / celular</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            inputMode="tel"
                            placeholder="(11) 99999-9999"
                            onChange={(event) => {
                              field.onChange(formatPhone(event.target.value));
                            }}
                          />
                        </FormControl>
                        <FormDescription>O numero e normalizado ao salvar e armazenado sem caracteres extras.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-xl border border-dashed border-border/50 bg-secondary/20 p-4">
                    <p className="text-sm text-muted-foreground">Verificacao de telefone</p>
                    <p className="mt-2 text-sm text-foreground">
                      A interface esta pronta para um fluxo por codigo, mas o backend ainda nao expoe essa verificacao.
                    </p>
                    <Button type="button" variant="outline" disabled className="mt-4 rounded-xl border-border/60 bg-secondary/20">
                      <Mail size={16} />
                      Verificar telefone em breve
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <FormField
                    control={contactForm.control}
                    name="addressStreet"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-2">
                        <FormLabel>Rua</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Rua, avenida ou logradouro" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={contactForm.control}
                    name="addressNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numero</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="123" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={contactForm.control}
                    name="addressComplement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Apto, bloco, referencia" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={contactForm.control}
                    name="addressNeighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Bairro" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                  <FormField
                    control={contactForm.control}
                    name="addressCity"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-2">
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Cidade" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={contactForm.control}
                    name="addressState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            maxLength={2}
                            placeholder="SP"
                            onChange={(event) => {
                              field.onChange(event.target.value.toUpperCase());
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={contactForm.control}
                    name="addressPostalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            inputMode="numeric"
                            placeholder="00000-000"
                            onChange={(event) => {
                              field.onChange(formatPostalCode(event.target.value));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={contactForm.control}
                    name="addressCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pais</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Brasil" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={contactMutation.isPending}>
                    {contactMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Salvar perfil e contato
                  </Button>
                </div>
              </form>
            </Form>
          </SettingsSection>

          <SettingsSection
            icon={<BellRing size={20} />}
            title="Preferencias"
            description="Ajustes gerais do app e notificacoes. Por enquanto, essas opcoes ficam salvas apenas neste dispositivo."
          >
            <FeedbackAlert feedback={preferencesFeedback} />

            <div className="mt-4 grid gap-4">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
                <div>
                  <p className="font-medium text-foreground">Notificacoes gerais</p>
                  <p className="mt-1 text-sm text-muted-foreground">Permite avisos relevantes sobre conta, produto e automacoes futuras.</p>
                </div>
                <Switch
                  checked={preferences.notificationsEnabled}
                  onCheckedChange={(checked) => handlePreferenceToggle("notificationsEnabled", checked)}
                  aria-label="Ativar notificacoes gerais"
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
                <div>
                  <p className="font-medium text-foreground">Resumo semanal</p>
                  <p className="mt-1 text-sm text-muted-foreground">Prepara a interface para um resumo de movimentacoes e alertas semanais.</p>
                </div>
                <Switch
                  checked={preferences.weeklyDigestEnabled}
                  onCheckedChange={(checked) => handlePreferenceToggle("weeklyDigestEnabled", checked)}
                  aria-label="Ativar resumo semanal"
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
                <div>
                  <p className="font-medium text-foreground">Lembretes de vencimento</p>
                  <p className="mt-1 text-sm text-muted-foreground">Deixa a conta preparada para futuros lembretes de fatura e vencimentos.</p>
                </div>
                <Switch
                  checked={preferences.dueDateRemindersEnabled}
                  onCheckedChange={(checked) => handlePreferenceToggle("dueDateRemindersEnabled", checked)}
                  aria-label="Ativar lembretes de vencimento"
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
                <div>
                  <p className="font-medium text-foreground">Valores compactos</p>
                  <p className="mt-1 text-sm text-muted-foreground">Reserva uma preferencia de exibicao para valores resumidos na interface.</p>
                </div>
                <Switch
                  checked={preferences.compactValuesEnabled}
                  onCheckedChange={(checked) => handlePreferenceToggle("compactValuesEnabled", checked)}
                  aria-label="Ativar valores compactos"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <Button type="button" onClick={handleSavePreferences} disabled={!preferencesDirty}>
                <Save size={16} />
                Salvar preferencias
              </Button>
            </div>
          </SettingsSection>
        </div>
      </div>
    </AppShell>
  );
}
