# 01. Stack e setup

## Visão geral

O projeto é um sistema full-stack de finanças pessoais com frontend React e backend Express, ambos em TypeScript no fluxo principal. O backend persiste dados em PostgreSQL e usa migrations SQL versionadas. A aplicação cobre transações, categorias, contas bancárias, cartões, parcelamentos, despesas de habitação, insights, notificações, importação com suporte a IA e autenticação completa.

## Tecnologias utilizadas

### Frontend

- React 18
- Vite 5
- TypeScript
- React Router DOM
- TanStack React Query
- Tailwind CSS
- shadcn/ui
- Radix UI
- Lucide React
- Recharts
- React Hook Form

### Backend

- Node.js
- Express 5
- TypeScript no entrypoint atual (`server/server.ts`, `server/app.ts`)
- `pg` para acesso ao PostgreSQL
- `zod` para validação de entrada
- `cookie-parser`
- `cors`
- `express-rate-limit`

### Banco e segurança

- PostgreSQL
- Migrations SQL em `server/migrations`
- `argon2` para hash de senha
- `jose` para JWT

### Importação e IA

- Pipeline de importação em `server/transaction-import.js`
- Suporte opcional a OpenAI ou Gemini para sugestão de categorias
- Integração via provider direto ou webhook

## Por que essa stack

- React + Vite reduz tempo de feedback no frontend e simplifica build.
- React Query foi adotado para centralizar cache, invalidação e sincronização de dados do servidor.
- Express mantém a API enxuta e direta, adequada para uma base com regras de negócio concentradas em funções de serviço.
- PostgreSQL é coerente com o domínio financeiro por permitir consultas agregadas, constraints e integridade referencial.
- Migrations SQL explícitas facilitam auditoria de schema em vez de depender de abstrações mais opacas.

## Estrutura do projeto

```text
/
├─ docs/
├─ public/
├─ server/
│  ├─ migrations/
│  ├─ modules/
│  │  ├─ auth/
│  │  ├─ admin/
│  │  └─ notifications/
│  ├─ shared/
│  ├─ app.ts
│  ├─ server.ts
│  ├─ database.js
│  ├─ transaction-import.js
│  ├─ import-ai-service.js
│  ├─ installments-overview.js
│  └─ dashboard-summary.js
├─ src/
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/
│  ├─ modules/
│  │  └─ auth/
│  ├─ pages/
│  ├─ types/
│  ├─ App.tsx
│  └─ main.tsx
├─ package.json
├─ vite.config.ts
└─ .env.example
```

## Organização de pastas

### `server/`

- `app.ts`: composição do app Express, middleware global e rotas.
- `server.ts`: bootstrap do servidor, inicialização de banco e shutdown controlado.
- `database.js`: maior parte das regras de domínio financeiro, queries e agregações.
- `modules/auth`: autenticação, JWT, refresh token, auditoria e perfil.
- `modules/notifications`: notificações de usuário e admin.
- `modules/admin`: endpoints administrativos e controle de acesso admin.
- `shared/env.ts`: leitura e validação das variáveis de ambiente.
- `shared/db.ts`: pool compartilhado do PostgreSQL para módulos TypeScript.
- `migrations/`: evolução versionada do schema.

### `src/`

- `App.tsx`: definição de rotas, guards e carregamento lazy.
- `lib/api.ts`: camada HTTP do frontend, mapeamento e refresh automático.
- `lib/routes.ts`: rotas nomeadas da SPA.
- `hooks/`: hooks por recurso usando React Query.
- `modules/auth/`: autenticação do frontend separada do restante da app.
- `pages/`: páginas principais da aplicação.
- `components/`: UI reutilizável e componentes de feature.
- `types/api.ts`: contratos de payload e tipos normalizados consumidos pela UI.

## Como rodar o projeto

### Pré-requisitos

- Node.js compatível com as dependências atuais
- PostgreSQL disponível
- Banco configurado em `DATABASE_URL`

### Instalação

```bash
npm install
```

### Configuração de ambiente

Copie `.env.example` para `.env` e ajuste os valores locais.

### Desenvolvimento

Frontend:

```bash
npm run dev
```

Backend:

```bash
npm run server:dev
```

O frontend usa `VITE_API_URL` para apontar para o backend, e o backend aceita a origem configurada em `APP_ORIGIN`.

### Build

```bash
npm run build
```

Esse comando executa:

1. build do frontend com Vite
2. build do backend com `tsc -p server/tsconfig.json`
3. cópia de assets do servidor por `server/scripts/copy-server-assets.mjs`

### Start do backend compilado

```bash
npm run server:start
```

## Variáveis de ambiente

### Core

- `DATABASE_URL`: conexão com PostgreSQL. Obrigatória.
- `PORT`: porta do backend. Default `3001`.
- `APP_ORIGIN`: origem do frontend aceita pelo CORS. Default `http://localhost:5173`.
- `VITE_API_URL`: base URL consumida pelo frontend.

### Autenticação

- `JWT_ACCESS_SECRET`: segredo do access token.
- `JWT_REFRESH_SECRET`: mantido no ambiente e validado, embora o refresh token atual seja persistido por hash em banco e rotacionado por sessão.
- `AUTH_REFRESH_COOKIE_NAME`: nome do cookie HttpOnly do refresh token. Default `finance_rt`.
- `PASSWORD_RESET_BASE_URL`: base usada para montar a URL de reset de senha.

### Importação com IA

- `IMPORT_AI_ENABLED`
- `IMPORT_AI_MODE`
- `IMPORT_AI_PROVIDER`: default atual `openclaw` em modo `direct`.
- `IMPORT_AI_MODEL`
- `IMPORT_AI_TIMEOUT_MS`
- `IMPORT_AI_AUTO_APPLY_THRESHOLD`
- `IMPORT_AI_MAX_ROWS_PER_REQUEST`
- `OPENCLAW_BASE_URL`
- `OPENCLAW_MODEL`
- `OPENCLAW_TIMEOUT_MS`
- `OPENCLAW_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `IMPORT_AI_WEBHOOK_URL`

## Comandos principais

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
npm run dev
npm run server:dev
```

### Build

```bash
npm run build
npm run build:server
```

### Migrations / banco

```bash
npm run db:init
npm run db:migrate
npm run db:seed
npm run db:fresh
```

### Autenticação

```bash
npm run auth:bootstrap
```

### Testes

```bash
npm test
npm run test:watch
```

## Observações operacionais

- O app backend real é criado em `server/app.ts` e iniciado por `server/server.ts`.
- Existe um arquivo legado `server/index.js`, mas o fluxo atual do projeto usa o entrypoint TypeScript.
- O backend serve o build estático do frontend quando `dist/` existe.
