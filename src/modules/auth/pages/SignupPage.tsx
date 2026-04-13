import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { appRoutes } from "@/lib/routes";
import { AuthScreen } from "@/modules/auth/components/AuthScreen";
import { PasswordField } from "@/modules/auth/components/PasswordField";
import { useSignup } from "@/modules/auth/hooks/use-signup";
import { signupFormSchema, type SignupFormValues } from "@/modules/auth/schemas/auth-schemas";

export default function SignupPage() {
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      rememberMe: false,
    },
  });
  const signupMutation = useSignup();

  return (
    <AuthScreen
      eyebrow="Finance Auth"
      title="Crie sua conta em segundos."
      description="Acesso imediato a dashboard, contas e automacoes com sessao protegida."
    >
      <Card className="overflow-hidden rounded-[2rem] border-border/60 bg-card/94 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-3 pb-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
            F
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl">Criar conta</CardTitle>
            <CardDescription className="text-sm leading-6">
              Preencha seus dados para comecar. Sua sessao sera criada automaticamente.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {signupMutation.isError ? (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertDescription>{signupMutation.error.message}</AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit(async (values) => {
                await signupMutation.mutateAsync(values);
              })}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        autoComplete="name"
                        placeholder="Seu nome"
                        className="h-12 rounded-xl border-border/70 bg-background/80"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        autoComplete="email"
                        placeholder="voce@empresa.com"
                        className="h-12 rounded-xl border-border/70 bg-background/80"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <PasswordField {...field} autoComplete="new-password" placeholder="Minimo 8 caracteres" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar senha</FormLabel>
                    <FormControl>
                      <PasswordField {...field} autoComplete="new-password" placeholder="Repita sua senha" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-2xl border border-border/60 bg-secondary/30 px-4 py-3">
                    <div className="space-y-1">
                      <FormLabel className="text-sm font-medium text-foreground">Lembrar de mim</FormLabel>
                      <p className="text-sm text-muted-foreground">Mantem a sessao ativa por mais tempo sem salvar sua senha.</p>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button className="h-12 w-full rounded-xl text-sm font-semibold" disabled={signupMutation.isPending} type="submit">
                {signupMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : null}
                Criar conta
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Ja tem uma conta?{" "}
                <Link className="font-medium text-primary hover:text-primary/80" to={appRoutes.login}>
                  Entrar
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AuthScreen>
  );
}
