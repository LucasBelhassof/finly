# CODEX.md

Guia operacional para agentes de IA neste repositório (`/workspace/finance`).

## 1) Objetivo do projeto

Projeto **full-stack** de finanças pessoais com:

- Frontend: **Vite + React + TypeScript** (`src/`)
- Backend: **Node/Express** (`server/`)
- Banco: **PostgreSQL** com migrations SQL versionadas (`server/migrations/`)

Referência rápida de contexto em `README.md`.

---

## 2) Princípios de trabalho para agente

1. **Spec-first (SDD)**
   - Antes de alterar lógica relevante, descreva rapidamente:
     - objetivo,
     - regras de negócio,
     - critérios de aceite,
     - riscos.

2. **Mudanças pequenas e rastreáveis**
   - Prefira PRs pequenos.
   - Evite refactors amplos sem necessidade funcional.

3. **Precisão financeira > estética**
   - Em cálculos monetários e parcelamentos, priorize consistência e auditabilidade.

4. **Não quebrar contratos existentes**
   - Preserve contratos de API sempre que possível.
   - Se precisar alterar contrato, versione endpoint/tipagem e documente.

5. **Sem duplicar regra de negócio**
   - Centralize cálculos e validações em helpers/services reutilizáveis.

---

## 3) Estrutura do repositório (resumo)

- `src/`: app React (páginas, componentes, hooks, tipos)
- `server/`: app Express e serviços
- `server/migrations/`: schema e seed SQL
- `README.md`: setup e principais endpoints

---

## 4) Comandos padrão

> Execute na raiz do projeto.

### Instalar dependências

```bash
npm install
```

### Banco

```bash
npm run db:migrate
npm run db:fresh
```

### Desenvolvimento

```bash
npm run server:dev
npm run dev
```

### Testes

```bash
npm test
```

Se necessário, rode testes específicos com `vitest`/arquivos-alvo para validar apenas o escopo alterado.

---

## 5) Padrões de implementação

### Backend

- Validar entradas de query/body antes de processar.
- Evitar SQL acoplado em controllers; preferir camada de serviço.
- Para agregações financeiras, garantir:
  - arredondamento previsível,
  - filtros consistentes,
  - integridade referencial.

### Frontend

- Tipar payloads de API em `src/types/` ou locais apropriados.
- Reusar componentes/hook já existentes antes de criar novos.
- Tratar estados de `loading`, `empty`, `error` em telas de dados.

---

## 6) Regras para seeders (resumo de negócio)

- Receita pode cair em **caixa** ou **conta bancária**.
- Despesa deve estar vinculada a **banco/conta** e/ou **cartão**.
- Parcelamento somente para despesas de **cartão**.
- Garantir consistência entre `installment_count`, parcela atual e saldo restante.

---

## 7) Fluxo recomendado de entrega

1. Ler arquivos do escopo afetado.
2. Escrever mini-spec (objetivo + regras + aceite).
3. Implementar menor mudança possível.
4. Executar testes/checks pertinentes.
5. Reportar:
   - arquivos alterados,
   - comandos executados,
   - evidências de validação,
   - limitações conhecidas.

---

## 8) Checklist de PR

- [ ] Regras de negócio preservadas.
- [ ] Sem quebra de contrato não documentada.
- [ ] Tipagem atualizada.
- [ ] Testes do escopo executados.
- [ ] Mensagem final com comandos e resultado.

---

## 9) Quando houver dúvida

- Preferir solução simples.
- Registrar suposições explicitamente.
- Se houver conflito entre fontes, seguir:
  1. instruções do usuário,
  2. documentação do repositório,
  3. padrões existentes no código.