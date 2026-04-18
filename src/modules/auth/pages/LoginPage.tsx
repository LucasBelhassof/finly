import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";

import { FinlyLoader } from "@/components/FinlyLoader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { appRoutes } from "@/lib/routes";
import { AuthScreen } from "@/modules/auth/components/AuthScreen";
import { PasswordField } from "@/modules/auth/components/PasswordField";
import { useLogin } from "@/modules/auth/hooks/use-login";
import { loginFormSchema, type LoginFormValues } from "@/modules/auth/schemas/auth-schemas";

export default function LoginPage() {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });
  const loginMutation = useLogin();

  return (
    <div className="relative">
      {loginMutation.isPending ? <FinlyLoader /> : null}

      <AuthScreen
        eyebrow="Finly Auth"
        title="Entre na sua area segura."
        description="Acesse dashboard, contas e automacoes com sessao protegida e refresh transparente."
        showShowcase={false}
      >
        <Card className="w-full overflow-hidden rounded-[1.9rem] border border-white/8 bg-[#16212b]/96 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <CardHeader className="space-y-5 pb-4">
            <div className="space-y-2">
              <CardTitle className="text-[2rem] font-semibold tracking-[-0.03em] text-white">Login</CardTitle>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {loginMutation.isError ? (
              <Alert variant="destructive" className="rounded-2xl border-destructive/30 bg-destructive/10">
                <AlertDescription>{loginMutation.error.message}</AlertDescription>
              </Alert>
            ) : null}

            <Form {...form}>
              <form
                className="space-y-5"
                onSubmit={form.handleSubmit(async (values) => {
                  await loginMutation.mutateAsync(values);
                })}
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-2.5">
                      <FormLabel className="text-[1.05rem] font-semibold text-slate-100">E-mail</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          autoComplete="email"
                          placeholder="voce@empresa.com"
                          className="h-12 rounded-2xl border-white/8 bg-[#101924] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-0"
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
                    <FormItem className="space-y-2.5">
                      <FormLabel className="text-[1.05rem] font-semibold text-slate-100">Senha</FormLabel>
                      <FormControl>
                        <PasswordField
                          {...field}
                          autoComplete="current-password"
                          placeholder="Sua senha"
                          className="focus-visible:ring-1 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-4">
                        <FormLabel className="text-[1.05rem] font-semibold text-slate-100">Lembrar de mim</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-4 text-sm justify-end">
                  <Link className="font-medium text-emerald-400 hover:text-emerald-300" to={appRoutes.forgotPassword}>
                    Esqueci minha senha
                  </Link>
                </div>

                <Button
                  className="h-12 w-full rounded-2xl bg-emerald-500 text-base font-semibold text-slate-950 shadow-[0_10px_24px_rgba(16,185,129,0.35)] transition-colors hover:bg-emerald-400"
                  disabled={loginMutation.isPending}
                  type="submit"
                >
                  {loginMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : null}
                  Entrar
                </Button>

                <p className="text-center text-sm text-slate-500">
                  Nao tem uma conta?{" "}
                  <Link className="font-semibold text-emerald-400 hover:text-emerald-300" to={appRoutes.signup}>
                    Criar conta
                  </Link>
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </AuthScreen>
    </div>
  );
}
