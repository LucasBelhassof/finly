# Deploy do MVP

## Fluxo recomendado

1. Defina as variáveis obrigatórias do ambiente.
2. Execute `npm run build`.
3. Execute `npm run db:migrate`.
4. Suba o backend com `npm run server:start` ou via container Docker.
5. Valide `GET /api/health` e `GET /api/ready`.

## Docker

Build:

```bash
docker build -t finly:latest .
```

Run:

```bash
docker run --rm -p 3001:3001 --env-file .env finly:latest
```

Características do container:

- imagem multi-stage
- `NODE_ENV=production`
- processo como usuário `node`
- `HEALTHCHECK` nativo
- runtime com dependências de produção apenas

## Start command

- Local compilado: `npm run server:start`
- Container: `node dist-server/server.js`

## Checklist de smoke test

- `GET /api/health` responde `200`
- `GET /api/ready` responde `200` com banco acessível
- login e refresh funcionam
- criação de conta/categoria/transação funciona
- usuário comum continua bloqueado em `/api/admin`

## Rollback básico

1. Volte para a imagem/tag anterior.
2. Não remova migrations já aplicadas.
3. Se houver falha operacional após migration, trate como forward-fix com nova migration.
