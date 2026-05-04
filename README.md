# Finly

Aplicação full-stack de finanças pessoais com frontend React/Vite e backend Express/PostgreSQL.

## MVP em produção

Requisitos:

- Node.js 22+
- PostgreSQL acessível no `DATABASE_URL`

Subida local:

```bash
npm install
npm run db:migrate
npm run server:dev
```

Em outro terminal:

```bash
npm run dev
```

Build de produção:

```bash
npm run build
npm run server:start
```

## Docker

Build:

```bash
docker build -t finly:latest .
```

Run:

```bash
docker run --rm -p 3001:3001 --env-file .env finly:latest
```

O container sobe com:

- `NODE_ENV=production`
- usuário não-root
- `HEALTHCHECK` em `GET /api/health`
- runtime sem `devDependencies`

## Qualidade

```bash
npm run format
npm run lint
npm run test
npm run build
```

## Endpoints operacionais

- `GET /api/health`: liveness leve, sem validar banco
- `GET /api/ready`: readiness com validação de banco

## Variáveis críticas

- `DATABASE_URL`
- `APP_ORIGIN`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

IA fica desligada por padrão. Para habilitar:

- `CHAT_AI_ENABLED=true`
- `IMPORT_AI_ENABLED=true`

## Documentação

- [Deploy](docs/deploy.md)
- [Variáveis de ambiente](docs/env.md)
- [Segurança operacional](docs/security.md)
- [Banco e migrations](docs/database.md)
