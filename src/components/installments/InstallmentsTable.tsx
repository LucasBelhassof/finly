import type { InstallmentOverviewItem } from "@/types/api";

import { formatCurrency, formatDate, getStatusClasses, getStatusLabel } from "./formatters";

interface InstallmentsTableProps {
  items: InstallmentOverviewItem[];
}

export default function InstallmentsTable({ items }: InstallmentsTableProps) {
  return (
    <div className="glass-card rounded-2xl border border-border/40 p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Compras parceladas</h2>
          <p className="text-sm text-muted-foreground">Listagem detalhada conforme os filtros atuais.</p>
        </div>
        <span className="text-sm text-muted-foreground">{items.length} itens</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Compra</th>
              <th className="px-3 py-2">Cartao</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Valor total</th>
              <th className="px-3 py-2">Parcela atual</th>
              <th className="px-3 py-2">Valor da parcela</th>
              <th className="px-3 py-2">Saldo restante</th>
              <th className="px-3 py-2">Proximo vencimento</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.installmentPurchaseId} className="bg-secondary/20 text-sm text-foreground">
                <td className="rounded-l-xl px-3 py-3 align-top">
                  <div className="font-medium">{item.description}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Compra em {formatDate(item.purchaseDate)}</div>
                </td>
                <td className="px-3 py-3 align-top">{item.cardName}</td>
                <td className="px-3 py-3 align-top">{item.category}</td>
                <td className="px-3 py-3 align-top">{formatCurrency(item.totalAmount)}</td>
                <td className="px-3 py-3 align-top">
                  {item.currentInstallment}/{item.installmentCount}
                </td>
                <td className="px-3 py-3 align-top">{formatCurrency(item.installmentAmount)}</td>
                <td className="px-3 py-3 align-top">{formatCurrency(item.remainingBalance)}</td>
                <td className="px-3 py-3 align-top">{formatDate(item.nextDueDate)}</td>
                <td className="rounded-r-xl px-3 py-3 align-top">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(item.status)}`}>
                    {getStatusLabel(item.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
