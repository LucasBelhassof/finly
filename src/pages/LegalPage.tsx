import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { appRoutes } from "@/lib/routes";

type LegalType = "terms" | "privacy" | "cancellation";

type LegalSection = {
  heading: string;
  body: string;
};

type LegalDoc = {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
};

const DOCS: Record<LegalType, LegalDoc> = {
  terms: {
    title: "Termos de Uso",
    updatedAt: "10 de maio de 2026",
    sections: [
      {
        heading: "1. Aceitação dos Termos",
        body: "Ao acessar ou utilizar o Kiply, você concorda com os presentes Termos de Uso. Caso não concorde com qualquer disposição, interrompa o uso imediatamente.",
      },
      {
        heading: "2. Descrição do Serviço",
        body: "O Kiply é uma plataforma de gestão financeira pessoal que oferece funcionalidades de controle de transações, categorias, contas bancárias, parcelamentos, insights e chat com inteligência artificial (recursos premium).",
      },
      {
        heading: "3. Cadastro e Conta",
        body: "Você é responsável por manter a confidencialidade de suas credenciais de acesso. Informações fornecidas no cadastro devem ser verídicas e atualizadas. O Kiply reserva-se o direito de suspender contas que violem estes termos.",
      },
      {
        heading: "4. Planos e Funcionalidades",
        body: "O Kiply oferece dois planos: Plano Free (dashboard, transações, categorias e contas) e Plano Premium (inclui todas as funcionalidades free, além de chat com IA, insights, planejamentos e importação inteligente). As condições de assinatura e cobrança do plano premium serão detalhadas quando o sistema de pagamento for integrado.",
      },
      {
        heading: "5. Uso Aceitável",
        body: "É proibido utilizar a plataforma para atividades ilegais ou fraudulentas, tentativas de acesso não autorizado a sistemas, ou compartilhamento de credenciais com terceiros.",
      },
      {
        heading: "6. Propriedade Intelectual",
        body: "Todo o conteúdo, código e design da plataforma são propriedade do Kiply ou de seus licenciadores. É vedada a reprodução sem autorização expressa.",
      },
      {
        heading: "7. Limitação de Responsabilidade",
        body: "O Kiply não se responsabiliza por decisões financeiras tomadas com base nas informações exibidas na plataforma. Os dados são apresentados para fins informativos e de organização pessoal.",
      },
      {
        heading: "8. Alterações nos Termos",
        body: "O Kiply pode atualizar estes Termos a qualquer momento. O uso continuado da plataforma após as alterações implica aceitação dos novos termos.",
      },
    ],
  },
  privacy: {
    title: "Política de Privacidade",
    updatedAt: "10 de maio de 2026",
    sections: [
      {
        heading: "1. Introdução",
        body: "Esta Política de Privacidade descreve como o Kiply coleta, armazena, usa e protege os dados pessoais dos usuários, em conformidade com a Lei Geral de Proteção de Dados (LGPD) — Lei nº 13.709/2018.",
      },
      {
        heading: "2. Dados Coletados",
        body: "O Kiply pode coletar: dados de cadastro (nome, e-mail e senha criptografada); dados financeiros inseridos pelo usuário (transações, categorias, contas e parcelamentos); dados de uso (sessão, eventos de autenticação e preferências); e dados de endereço opcionalmente fornecidos no perfil.",
      },
      {
        heading: "3. Finalidade do Tratamento",
        body: "Os dados coletados são utilizados para prestação e melhoria dos serviços, autenticação e segurança da conta, geração de insights por inteligência artificial (plano premium) e comunicações relacionadas à conta.",
      },
      {
        heading: "4. Compartilhamento de Dados",
        body: "O Kiply não vende dados pessoais a terceiros. Os dados podem ser compartilhados apenas com prestadores de serviços essenciais para o funcionamento da plataforma ou com autoridades competentes quando exigido por lei.",
      },
      {
        heading: "5. Armazenamento e Segurança",
        body: "Os dados são armazenados em servidores seguros. Adotamos medidas técnicas e organizacionais para proteger as informações contra acesso não autorizado, perda ou divulgação indevida.",
      },
      {
        heading: "6. Direitos do Titular (LGPD)",
        body: "Nos termos da LGPD (Lei nº 13.709/2018), você tem direito a confirmar a existência de tratamento, acessar, corrigir ou eliminar seus dados, revogar o consentimento quando aplicável e solicitar portabilidade. Entre em contato com o suporte para exercer esses direitos.",
      },
      {
        heading: "7. Cookies e Sessão",
        body: "O Kiply utiliza cookies de sessão para autenticação segura. Não utilizamos cookies de rastreamento para publicidade.",
      },
      {
        heading: "8. Retenção de Dados",
        body: "Os dados são retidos enquanto a conta estiver ativa. Após a exclusão, os dados serão removidos conforme os prazos legais aplicáveis.",
      },
    ],
  },
  cancellation: {
    title: "Política de Cancelamento",
    updatedAt: "10 de maio de 2026",
    sections: [
      {
        heading: "1. Plano Free",
        body: "O Kiply oferece um plano gratuito sem custo ou compromisso. Não há assinatura a cancelar no plano free. Você pode encerrar sua conta a qualquer momento pelo suporte.",
      },
      {
        heading: "2. Estado atual do Plano Premium",
        body: "O cancelamento de assinatura pelo próprio aplicativo ainda não está disponível. O sistema de cobrança online do Kiply está em desenvolvimento e será integrado em versão futura. Enquanto o sistema de pagamento não for integrado, o plano premium é gerenciado manualmente pela equipe do Kiply. Para solicitar cancelamento ou alteração de plano, entre em contato com o suporte.",
      },
      {
        heading: "3. Política futura (após integração de cobrança)",
        body: "Quando o sistema de assinatura online for disponibilizado: o cancelamento manterá o acesso premium até o fim do período pago; não haverá reembolso proporcional do período restante, salvo disposição legal em contrário; o cancelamento poderá ser realizado pelo painel de conta do usuário; e o prazo de arrependimento seguirá o Código de Defesa do Consumidor (7 dias corridos para compras online).",
      },
      {
        heading: "4. Exclusão de Conta",
        body: "A exclusão de conta implica a remoção permanente dos dados do usuário, conforme a Política de Privacidade. Caso exista assinatura premium ativa no momento da exclusão, entre em contato com o suporte antes de prosseguir.",
      },
    ],
  },
};

const OTHER_LINKS: Record<LegalType, { label: string; route: string }[]> = {
  terms: [
    { label: "Política de Privacidade", route: appRoutes.legalPrivacy },
    { label: "Política de Cancelamento", route: appRoutes.legalCancellation },
  ],
  privacy: [
    { label: "Termos de Uso", route: appRoutes.legalTerms },
    { label: "Política de Cancelamento", route: appRoutes.legalCancellation },
  ],
  cancellation: [
    { label: "Termos de Uso", route: appRoutes.legalTerms },
    { label: "Política de Privacidade", route: appRoutes.legalPrivacy },
  ],
};

interface LegalPageProps {
  type: LegalType;
}

export default function LegalPage({ type }: LegalPageProps) {
  const navigate = useNavigate();
  const doc = DOCS[type];
  const otherLinks = OTHER_LINKS[type];

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" className="mb-6 -ml-2 text-muted-foreground" onClick={() => navigate(-1)}>
          ← Voltar
        </Button>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 mb-8">
          Este documento é provisório e pode ser atualizado conforme a plataforma evolui.
        </div>

        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {doc.updatedAt}</p>

        <hr className="my-6 border-border/50" />

        <div className="space-y-6">
          {doc.sections.map((section) => (
            <div key={section.heading}>
              <h2 className="mb-2 text-base font-semibold text-foreground">{section.heading}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </div>
          ))}
        </div>

        <hr className="my-8 border-border/50" />

        <div>
          <p className="mb-3 text-sm font-medium text-muted-foreground">Outros documentos legais</p>
          <div className="flex flex-wrap gap-3">
            {otherLinks.map((link) => (
              <Button
                key={link.route}
                variant="outline"
                size="sm"
                className="rounded-lg border-border/60 text-sm"
                onClick={() => navigate(link.route)}
              >
                {link.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
