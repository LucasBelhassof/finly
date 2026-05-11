import { Check, Crown, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { appRoutes } from "@/lib/routes";
import { useActionOnboardingProgress } from "@/modules/auth/hooks/use-action-onboarding-progress";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";

type Feature = {
  label: string;
  free: boolean;
  premium: boolean;
};

const FEATURES: Feature[] = [
  { label: "Dashboard financeiro", free: true, premium: true },
  { label: "Gestão de transações", free: true, premium: true },
  { label: "Categorias e contas", free: true, premium: true },
  { label: "Chat com IA", free: false, premium: true },
  { label: "Insights gerados por IA", free: false, premium: true },
  { label: "Planejamentos financeiros", free: false, premium: true },
  { label: "Importação inteligente", free: false, premium: true },
];

export default function PricingPage() {
  const { user } = useAuthSession();
  const { completeActionStep } = useActionOnboardingProgress();
  const navigate = useNavigate();

  const isAuthenticated = Boolean(user);
  const isPremium = Boolean(user?.isPremium);

  useEffect(() => {
    if (!user) {
      return;
    }

    void completeActionStep("premium");
  }, [completeActionStep, user]);

  function handlePremiumCta() {
    if (!isAuthenticated) {
      navigate(appRoutes.signup);
      return;
    }
    if (isPremium) {
      return;
    }
    toast("Assinatura online em breve.");
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Escolha o plano ideal para você</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Comece gratuitamente e faça upgrade quando quiser desbloquear recursos de IA.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Free Plan */}
          <Card className="flex flex-col rounded-2xl border border-border/60">
            <CardHeader className="pb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Plano</p>
              <h2 className="text-2xl font-bold text-foreground">Free</h2>
              <p className="text-3xl font-bold text-foreground">Grátis</p>
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-3">
                {FEATURES.map((feature) => (
                  <li key={feature.label} className="flex items-center gap-3 text-sm">
                    {feature.free ? (
                      <Check size={16} className="shrink-0 text-income" />
                    ) : (
                      <X size={16} className="shrink-0 text-muted-foreground/40" />
                    )}
                    <span className={feature.free ? "text-foreground" : "text-muted-foreground/60"}>
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                variant="outline"
                className="w-full rounded-xl border-border/60"
                disabled={isAuthenticated}
                onClick={() => !isAuthenticated && navigate(appRoutes.signup)}
              >
                {isAuthenticated ? "Plano atual" : "Começar grátis"}
              </Button>
            </CardFooter>
          </Card>

          {/* Premium Plan */}
          <Card className="flex flex-col rounded-2xl border border-primary/30 bg-primary/5">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Premium</p>
                <Badge className="border-primary/20 bg-primary/10 text-primary text-[10px]">
                  <Crown size={10} className="mr-1" />
                  Recomendado
                </Badge>
              </div>
              <h2 className="text-2xl font-bold text-foreground">Premium</h2>
              <div>
                {/* TODO: replace with real price from billing provider */}
                <span className="text-3xl font-bold text-foreground">R$ 29,90</span>
                <span className="ml-1 text-sm text-muted-foreground">/mês</span>
              </div>
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-3">
                {FEATURES.map((feature) => (
                  <li key={feature.label} className="flex items-center gap-3 text-sm">
                    <Check size={16} className="shrink-0 text-primary" />
                    <span className="text-foreground">{feature.label}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button className="w-full rounded-xl" disabled={isPremium} onClick={handlePremiumCta}>
                <Sparkles size={16} />
                {isPremium ? "Premium ativo" : isAuthenticated ? "Assinar Premium" : "Começar grátis"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Dúvidas?{" "}
          <a href={appRoutes.legalTerms} className="underline underline-offset-2">
            Veja os Termos de Uso
          </a>{" "}
          e a{" "}
          <a href={appRoutes.legalCancellation} className="underline underline-offset-2">
            Política de Cancelamento
          </a>
          .
        </p>
      </div>
    </div>
  );
}
