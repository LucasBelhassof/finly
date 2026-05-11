# Segurança operacional

## HTTP security headers

- o backend usa `helmet` no `server/app.ts` para aplicar um baseline seguro de headers HTTP em respostas da API e do app servido
- o hardening atual valida apenas um conjunto representativo de headers estáveis, como `x-content-type-options`, `x-frame-options`, `referrer-policy` e `cross-origin-opener-policy`
- `Content-Security-Policy` estrita continua adiada nesta fase; a configuração atual mantém `contentSecurityPolicy: false` até que o bundle Vite/React e assets de produção sejam auditados sem risco de quebra
- `Cross-Origin-Resource-Policy` não recebeu override adicional nesta fase porque o objetivo foi preservar a compatibilidade atual de assets estáticos

## Auth e sessão

- access token via `Authorization: Bearer`
- refresh token em cookie HttpOnly
- `inactive` e `suspended` são bloqueados em login, refresh e rotas protegidas
- rotas administrativas continuam protegidas no backend
- recursos premium são protegidos no backend com `402 premium_required`; o frontend apenas exibe overlay/CTA
- a adoção de Helmet não alterou comportamento de cookies, sessão, refresh token, login ou autorização

## CORS

- o backend usa `APP_ORIGIN` como origem permitida
- não há CORS wildcard em produção
- `credentials: true` permanece ativo para cookies de refresh
- o hardening de headers não alterou o controle de origem; CORS continua centralizado por `APP_ORIGIN`

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

## Validação

- `npm run test` cobre `/api/health` e `/api/ready` com asserts para os principais security headers e para a compatibilidade de CORS no origin configurado
- `npm run build` confirma que o baseline atual não quebrou o app Vite/React nem o build do backend

## Limitações conhecidas

- preview de importação usa store temporário em Postgres com validação por `user_id`
- o arquivo bruto e segredos do upload não são persistidos na sessão de preview
- previews expiram e são marcados como consumidos após commit bem-sucedido
- usuários Free ainda podem abrir páginas premium, mas não executam ações nem recebem payloads premium completos nas superfícies protegidas
