# Segurança operacional

## Auth e sessão

- access token via `Authorization: Bearer`
- refresh token em cookie HttpOnly
- `inactive` e `suspended` são bloqueados em login, refresh e rotas protegidas
- rotas administrativas continuam protegidas no backend
- recursos premium são protegidos no backend com `402 premium_required`; o frontend apenas exibe overlay/CTA

## CORS

- o backend usa `APP_ORIGIN` como origem permitida
- não há CORS wildcard em produção
- `credentials: true` permanece ativo para cookies de refresh

## Health e readiness

- `GET /api/health` é liveness leve
- `GET /api/ready` valida conectividade com o banco

## Rate limit

- auth já possui rate limit dedicado
- importação possui rate limit dedicado
- chat/IA possui rate limit dedicado

## Logs

- runtime usa logger simples com `requestId`
- `x-request-id` recebido do proxy é reaproveitado; se ausente, o backend gera um id
- logs não devem expor senha, token, cookie, segredo, extrato bruto nem payload financeiro completo

## Limitações conhecidas

- preview de importação usa store temporário em Postgres com validação por `user_id`
- o arquivo bruto e segredos do upload não são persistidos na sessão de preview
- previews expiram e são marcados como consumidos após commit bem-sucedido
- usuários Free ainda podem abrir páginas premium, mas não executam ações nem recebem payloads premium completos nas superfícies protegidas
