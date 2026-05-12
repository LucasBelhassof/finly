# Documentação do Projeto

Esta pasta consolida a documentação técnica da aplicação com base no código atual do repositório. O objetivo é servir como material de handoff para outro desenvolvedor entender a arquitetura, rodar o projeto, identificar regras de negócio e evoluir o sistema com segurança.

## Índice

1. [Stack e setup](./01-stack-e-setup.md)
2. [Autenticação e login](./02-autenticacao-e-login.md)
3. [Usuários e permissões](./03-usuarios-e-permissoes.md)
4. [Transações e financeiro](./04-transacoes-e-financeiro.md)
5. [Categorias e classificação](./05-categorias-e-classificacao.md)
6. [Contas e cartões](./06-contas-e-cartoes.md)
7. [Habitação e despesas fixas](./07-habitacao-e-despesas-fixas.md)
8. [Insights de IA](./08-insights-de-ia.md)
9. [Notificações](./09-notificacoes.md)
10. [Dashboard](./10-dashboard.md)
11. [Importação e IA](./11-importacao-e-ia.md)
12. [API endpoints](./12-api-endpoints.md)
13. [Arquitetura do frontend](./13-frontend-arquitetura.md)
14. [Boas práticas e padrões](./14-boas-praticas-e-padroes.md)
15. [Casos de uso](./15-casos-de-uso.md)

## Runbooks operacionais

- [Deploy](./deploy.md)
- [Ambiente](./env.md)
- [Observability](./observability.md)
- [Backup and restore](./operations/backup-restore.md)
- [Production release checklist](./operations/release-checklist.md)

## Fontes consideradas

- Backend Express em `server/app.ts`
- Regras de domínio em `server/database.js`
- Módulos dedicados em `server/modules/*`
- Migrations em `server/migrations/*`
- Frontend React em `src/*`
- Contratos tipados em `src/types/api.ts`
- Camada HTTP do frontend em `src/lib/api.ts`

## Escopo

Esta documentação descreve a implementação existente. Quando houver comportamento legado ainda presente em arquivos antigos como `server/index.js`, o foco deste material é o fluxo ativo usado por `server/server.ts` e `server/app.ts`.

O conjunto atual já cobre também as áreas mais recentes adicionadas à aplicação, como planejamentos com IA, caixinhas/investimentos, perfil/configurações, onboarding/product tour e a esteira de CI com GitHub Actions.
