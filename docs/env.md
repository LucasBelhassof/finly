# Variáveis de ambiente

## Obrigatórias em produção

- `DATABASE_URL`: conexão PostgreSQL usada pelo backend.
- `APP_ORIGIN`: origem exata do frontend autorizada no CORS e cookies.
- `JWT_ACCESS_SECRET`: segredo do access token.
- `JWT_REFRESH_SECRET`: segredo do refresh token.

## Runtime

- `NODE_ENV`: use `production` no deploy.
- `PORT`: porta HTTP do backend.
- `VITE_API_URL`: URL pública do backend para o frontend.
- `PASSWORD_RESET_BASE_URL`: URL base do reset de senha.
- `AUTH_REFRESH_COOKIE_NAME`: nome do cookie HttpOnly de refresh.

## IA

Defaults seguros:

- `CHAT_AI_ENABLED=false`
- `IMPORT_AI_ENABLED=false`

Observações:

- chat só liga quando `CHAT_AI_ENABLED=true`
- import AI só liga quando `IMPORT_AI_ENABLED=true`
- a presença de API key sozinha não habilita IA

## Chaves opcionais de provider

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `IMPORT_AI_WEBHOOK_URL`

## Exemplo mínimo de produção

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://user:password@db:5432/finly
APP_ORIGIN=https://app.seudominio.com
JWT_ACCESS_SECRET=troque-por-um-segredo-longo
JWT_REFRESH_SECRET=troque-por-outro-segredo-longo
CHAT_AI_ENABLED=false
IMPORT_AI_ENABLED=false
```
