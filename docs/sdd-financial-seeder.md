# SDD: Financial Seeder

## Data model

- `bank_connections`
  - 1 conta `cash` obrigatoria.
  - 2 contas `bank_account`.
  - 2 contas `credit_card`, cada uma ligada a uma `bank_account`.
- `transactions`
  - `amount > 0` => receita.
  - `amount < 0` => despesa.
  - Receita usa apenas `cash` ou `bank_account`.
  - Despesa usa apenas `bank_account` ou `credit_card`.
- `installment_purchases`
  - existe apenas para despesas em `credit_card`.
  - `installment_count >= 2`.
  - cada parcela gera uma linha em `transactions`.

## Rules matrix

| Tipo | Origem permitida | Origem proibida | Parcelamento |
| --- | --- | --- | --- |
| Receita | `cash`, `bank_account` | `credit_card` | nunca |
| Despesa | `bank_account`, `credit_card` | `cash` | apenas em `credit_card` |
| Despesa em conta | `bank_account` | `cash`, `credit_card` parcelado | nao |
| Despesa em cartao | `credit_card` | `cash` | a vista ou `2..12` |

## Random distribution

- Receitas: 30% `cash`, 70% `bank_account`.
- Despesas: 45% `bank_account`, 55% `credit_card`.
- Despesas em cartao: 60% a vista, 40% parceladas.
- Parcelas: distribuicao uniforme em `2..12`.
- Volume por seed:
  - receitas: `12..20`
  - despesas: `40..80`

## Invariants

- nenhuma receita pode usar `credit_card`;
- nenhuma despesa pode usar `cash`;
- nenhuma despesa pode ficar sem `bank_connection_id`;
- nenhum cartao pode existir sem `parent_bank_connection_id` valido do tipo `bank_account`;
- nenhuma transacao parcelada pode existir fora de `credit_card`;
- toda transacao parcelada precisa de `installment_number`;
- toda compra parcelada precisa de `installment_count >= 2`;
- nenhuma FK pode apontar para registro inexistente.

## Verification queries

```sql
SELECT COUNT(*) AS invalid_income_on_card
FROM transactions t
JOIN categories c ON c.id = t.category_id
JOIN bank_connections b ON b.id = t.bank_connection_id
WHERE c.transaction_type = 'income'
  AND b.account_type = 'credit_card';
```

```sql
SELECT COUNT(*) AS invalid_expense_without_valid_origin
FROM transactions t
JOIN categories c ON c.id = t.category_id
LEFT JOIN bank_connections b ON b.id = t.bank_connection_id
WHERE c.transaction_type = 'expense'
  AND (
    b.id IS NULL
    OR b.account_type NOT IN ('bank_account', 'credit_card')
  );
```

```sql
SELECT COUNT(*) AS invalid_non_card_installments
FROM transactions t
LEFT JOIN installment_purchases ip ON ip.id = t.installment_purchase_id
LEFT JOIN bank_connections b ON b.id = t.bank_connection_id
WHERE t.installment_purchase_id IS NOT NULL
  AND (
    ip.id IS NULL
    OR b.id IS NULL
    OR b.account_type <> 'credit_card'
    OR t.installment_number IS NULL
    OR ip.installment_count < 2
  );
```

```sql
SELECT COUNT(*) AS invalid_cards_without_parent_account
FROM bank_connections card
LEFT JOIN bank_connections parent ON parent.id = card.parent_bank_connection_id
WHERE card.account_type = 'credit_card'
  AND (
    parent.id IS NULL
    OR parent.account_type <> 'bank_account'
  );
```
