# SDD: Gestao de Compras Parceladas

## Endpoint

- `GET /api/installments/overview`
- Query params:
  - `cardId`
  - `categoryId`
  - `status`
  - `installmentAmountMin`
  - `installmentAmountMax`
  - `purchaseStart`
  - `purchaseEnd`
  - `sortBy`
  - `sortOrder`

## Regras de calculo

- Entram apenas registros de `installment_purchases` ligados a `credit_card`.
- `installment_count >= 2` e compras a vista ficam fora do overview.
- `total_amount = round2(amount_per_installment * installment_count)`.
- `current_installment` usa a primeira parcela no mes atual ou futuro; quando nao existir, assume `installment_count`.
- `remaining_installments = max(parcelas no mes atual ou futuro, 0)`.
- `remaining_balance = round2(installment_amount * remaining_installments)`.
- `monthly_commitment` considera apenas itens com `status != paid`.
- `status`:
  - `paid` quando `remaining_installments = 0`
  - `overdue` quando ainda existe saldo e `next_due_date < hoje`
  - `active` nos demais casos
- `next_due_date` usa `statement_due_day` do cartao quando disponivel; sem isso, faz fallback para `occurred_on`.

## Casos de borda

- Parcelamentos quitados continuam filtraveis por `paid`, mas nao entram nos agregados ativos.
- Estornos sem vinculo com `installment_purchases` nao compensam o overview no v1.
- Arredondamentos monetarios usam `round2`, com tolerancia de `R$ 0,01` nos testes.
- Nenhum item pode retornar `remaining_installments < 0` ou `remaining_balance < 0`.

## Criterios de aceite

- `/installments` navegavel pelo menu lateral.
- Cards, graficos e tabela respondem ao mesmo conjunto de filtros.
- Exportacao CSV respeita a listagem filtrada.
- Nenhum item retornado possui `installment_count < 2`.
- Parcelamentos `paid` nao contaminam `monthly_commitment`.
