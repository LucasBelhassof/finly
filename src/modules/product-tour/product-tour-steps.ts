import { appRoutes } from "@/lib/routes";
import type { ProductTourStep } from "@/modules/product-tour/product-tour-types";

export const PRODUCT_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "dashboard_overview",
    route: appRoutes.dashboard,
    target: "dashboard-summary",
    title: "Resumo financeiro",
    description: "Aqui voce acompanha saldo, entradas e saidas rapidamente logo ao abrir o dashboard.",
    placement: "bottom",
    autoScroll: true,
  },
  {
    id: "recent_transactions",
    route: appRoutes.dashboard,
    target: "dashboard-transactions",
    title: "Transacoes recentes",
    description: "Esta lista mostra as ultimas movimentacoes para voce validar rapidamente o que acabou de acontecer.",
    placement: "right",
    autoScroll: true,
  },
  {
    id: "insights",
    route: appRoutes.dashboard,
    target: "dashboard-insights",
    title: "Insights",
    description: "Os insights ajudam a encontrar padroes e oportunidades de ajuste sem voce procurar manualmente.",
    placement: "right",
    autoScroll: true,
  },
  {
    id: "accounts_nav",
    route: appRoutes.dashboard,
    target: "nav-accounts",
    title: "Contas",
    description: "Use este atalho para cadastrar e revisar contas, cartoes e saldos conectados ao produto.",
    placement: "right",
    autoScroll: true,
  },
  {
    id: "expense_management_nav",
    route: appRoutes.dashboard,
    target: "nav-expense-management",
    title: "Gestao de gastos",
    description: "Aqui ficam transacoes, receitas recorrentes, habitacao, parcelamentos e metricas detalhadas.",
    placement: "right",
    autoScroll: true,
  },
  {
    id: "notifications",
    route: appRoutes.dashboard,
    target: "header-notifications",
    title: "Notificacoes",
    description: "Quando houver alertas ou lembretes importantes, eles aparecem aqui no topo da aplicacao.",
    placement: "left",
    autoScroll: false,
  },
];
