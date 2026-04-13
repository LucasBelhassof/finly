import type { ReactNode } from "react";

type AuthScreenProps = {
  aside?: ReactNode;
  children: ReactNode;
  description: string;
  eyebrow: string;
  showShowcase?: boolean;
  title: string;
};

export function AuthScreen({ aside, children, description, eyebrow, showShowcase = true, title }: AuthScreenProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.16),_transparent_48%),linear-gradient(180deg,_hsl(var(--background)),_hsl(210_22%_96%))] px-4 py-8 sm:px-6 lg:px-8">
      <div className={`mx-auto grid min-h-[calc(100vh-4rem)] items-center gap-6 ${showShowcase ? "max-w-6xl lg:grid-cols-[1.15fr_0.85fr]" : "max-w-2xl"}`}>
        {showShowcase ? (
          <section className="relative hidden min-h-[620px] overflow-hidden rounded-[2rem] border border-border/60 bg-[linear-gradient(160deg,_hsl(var(--primary))_0%,_hsl(214_84%_44%)_46%,_hsl(212_46%_16%)_100%)] p-10 text-primary-foreground shadow-2xl lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.24),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.18),transparent_18%),radial-gradient(circle_at_60%_80%,rgba(255,255,255,0.12),transparent_20%)]" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="space-y-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14 text-xl font-semibold shadow-lg shadow-black/10">
                  F
                </div>
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.28em] text-primary-foreground/70">{eyebrow}</p>
                  <h2 className="max-w-md text-4xl font-semibold leading-tight">{title}</h2>
                  <p className="max-w-md text-base leading-7 text-primary-foreground/76">{description}</p>
                </div>
              </div>

              <div className="grid gap-4 rounded-[1.75rem] border border-white/14 bg-white/10 p-6 backdrop-blur">
                {aside ?? (
                  <>
                    <div className="grid gap-1">
                      <p className="text-sm font-medium text-primary-foreground">Sessao protegida de ponta a ponta</p>
                      <p className="text-sm leading-6 text-primary-foreground/70">
                        Access token curto em memoria, refresh rotativo em cookie HttpOnly e reset de senha seguro.
                      </p>
                    </div>
                    <div className="grid gap-3 text-sm text-primary-foreground/78">
                      <div className="rounded-2xl border border-white/12 bg-black/10 px-4 py-3">Rotacao automatica de refresh token.</div>
                      <div className="rounded-2xl border border-white/12 bg-black/10 px-4 py-3">Protecao total das rotas internas.</div>
                      <div className="rounded-2xl border border-white/12 bg-black/10 px-4 py-3">Fluxo de reset pronto para producao.</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className={`mx-auto w-full ${showShowcase ? "max-w-xl" : "max-w-lg"}`}>{children}</section>
      </div>
    </div>
  );
}
