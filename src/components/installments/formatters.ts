import type { InstallmentStatus } from "@/types/api";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(value: string | null) {
  if (!value) {
    return "--";
  }

  return value.split("-").reverse().join("/");
}

export function formatMonthKey(value: string | null) {
  if (!value) {
    return "--";
  }

  const [year, month] = value.split("-");
  const date = new Date(Date.UTC(Number(year), Math.max(Number(month) - 1, 0), 1, 12));

  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "");
}

export function getStatusLabel(status: InstallmentStatus) {
  if (status === "paid") {
    return "Quitado";
  }

  if (status === "overdue") {
    return "Em atraso";
  }

  return "Ativo";
}

export function getStatusClasses(status: InstallmentStatus) {
  if (status === "paid") {
    return "bg-income/10 text-income";
  }

  if (status === "overdue") {
    return "bg-expense/10 text-expense";
  }

  return "bg-info/10 text-info";
}
