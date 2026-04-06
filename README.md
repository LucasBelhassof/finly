# Finance

Projeto originalmente criado como um frontend Vite/React com dados mockados.
Para rodar localmente com backend funcional, foi adicionada uma API Node + Express conectada ao Postgres da `.env`.

## O que existe agora

- Frontend Vite/React mantido sem alteracoes visuais.
- Backend local em `server/` com leitura de `DATABASE_URL`.
- Criacao automatica de schema e seed idempotente no Postgres.
- Endpoints REST para dashboard, transacoes, bancos, insights e chat.

## Requisitos

- Node.js 22+
- Postgres acessivel no `DATABASE_URL`

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Inicialize o banco com schema e seed:

```bash
npm run db:init
```

3. Suba o backend em um terminal:

```bash
npm run server:dev
```

4. Suba o frontend em outro terminal:

```bash
npm run dev
```

Backend local: `http://localhost:3001`
Frontend local: `http://localhost:8080`

## Endpoints principais

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/transactions`
- `GET /api/spending`
- `GET /api/insights`
- `GET /api/banks`
- `GET /api/chat/messages`
- `POST /api/chat/messages`

## Observacao

O frontend ainda usa dados hardcoded. O backend ja esta funcional e pronto para ser integrado sem precisar redesenhar a interface.
