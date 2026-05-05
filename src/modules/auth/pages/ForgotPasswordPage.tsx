import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { appRoutes } from "@/lib/routes";
import { AuthScreen } from "@/modules/auth/components/AuthScreen";
import { forgotPasswordFormSchema, type ForgotPasswordFormValues } from "@/modules/auth/schemas/auth-schemas";
import { forgotPassword } from "@/modules/auth/services/auth-service";

function buildLocalResetPath(debugResetUrl: string) {
  const url = new URL(debugResetUrl, window.location.origin);
  return `${url.pathname}${url.search}`;
}

export default function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      email: "",
    },
  });
  const forgotPasswordMutation = useMutation({
    mutationFn: forgotPassword,
  });

  return (
    <AuthScreen
      eyebrow="Recuperacao"
      title="Recupere o acesso sem atrito."
      description="Geramos um link temporario, com uso unico e expiracao curta, sem revelar se a conta existe."
      showShowcase={false}
    >
      <Card className="rounded-[2rem] border-border/60 bg-card/94 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">Esqueci minha senha</CardTitle>
          <CardDescription className="text-sm leading-6">
            Informe o e-mail da conta. A resposta continua neutra mesmo quando o endereço não existe.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {forgotPasswordMutation.isSuccess ? (
            <Alert className="rounded-2xl border-primary/20 bg-primary/5 text-foreground">
              <AlertDescription className="space-y-3">
                <p>{forgotPasswordMutation.data.message}</p>
                {forgotPasswordMutation.data.debugResetUrl ? (
                  <Link
                    className="inline-flex text-sm font-medium text-primary hover:text-primary/80"
                    to={buildLocalResetPath(forgotPasswordMutation.data.debugResetUrl)}
                  >
                    Abrir link de reset de desenvolvimento
                  </Link>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {forgotPasswordMutation.isError ? (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertDescription>{forgotPasswordMutation.error.message}</AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit(async (values) => {
                await forgotPasswordMutation.mutateAsync(values);
              })}
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="email"
                        placeholder="voce@empresa.com"
                        className="h-12 rounded-xl border-border/70 bg-background/80"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                className="h-12 w-full rounded-xl text-sm font-semibold"
                disabled={forgotPasswordMutation.isPending}
                type="submit"
              >
                {forgotPasswordMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : null}
                Gerar link de reset
              </Button>
            </form>
          </Form>

          <Link className="inline-flex text-sm font-medium text-primary hover:text-primary/80" to={appRoutes.login}>
            Voltar para login
          </Link>
        </CardContent>
      </Card>
    </AuthScreen>
  );
}
