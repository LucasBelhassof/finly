# Finance

Projeto full-stack com frontend Vite/React e backend Express/Postgres.
Os dados do dashboard e do chat agora saem do banco, e o bootstrap do banco foi movido para migrations SQL versionadas.

## O que existe agora

- Frontend Vite/React mantido sem alteracoes visuais.
- Backend local em `server/` com leitura de `DATABASE_URL`.
- Migrations SQL em `server/migrations/` para schema e carga inicial.
- Endpoints REST para dashboard, transacoes, bancos, insights e chat.

## Requisitos

- Node.js 22+
- Postgres acessivel no `DATABASE_URL`

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Aplique as migrations:

```bash
npm run db:migrate
```

Se quiser recriar o schema `public` do banco e reaplicar tudo do zero:

```bash
npm run db:fresh
```

3. Suba o backend em um terminal:

```bash
npm run server:dev
```

4. Suba o frontend em outro terminal:

```bash
npm run dev
```

## Endpoints principais

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/transactions`
- `GET /api/spending`
- `GET /api/insights`
- `GET /api/banks`
- `GET /api/chat/messages`
- `POST /api/chat/messages`
