# Deploy do MVP

## Fluxo recomendado

1. Defina as variáveis obrigatórias do ambiente.
2. Execute `npm run build`.
3. Execute `npm run db:migrate`.
4. Suba o backend com `npm run server:start` ou via container Docker.
5. Valide `GET /api/health` e `GET /api/ready`.

## Infraestrutura do MVP

- Redis não é necessário para o fluxo de preview de importação atual.
- O backend usa Postgres para persistir previews temporários compartilhados entre instâncias.
- Garanta apenas que `npm run db:migrate` seja executado antes de subir múltiplos containers.

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

## Banco

- Faça um backup do Postgres antes de executar `npm run db:migrate` em produção.
- Use o runbook em `docs/operations/backup-restore.md` para o fluxo de backup e restore.
- Use `docs/operations/release-checklist.md` como checklist final antes e depois do deploy.

## Rollback básico

1. Volte para a imagem/tag anterior.
2. Não remova migrations já aplicadas.
3. Se houver falha operacional após migration, trate como forward-fix com nova migration.
