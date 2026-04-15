# AGENTS.md

## 1. Objetivo do projeto

Este repositório é um sistema full-stack de finanças pessoais.

Arquitetura atual:
- Frontend: React + Vite + TypeScript
- UI: shadcn/ui + Tailwind
- Estado de servidor: TanStack React Query
- Backend: Express + TypeScript
- Banco: PostgreSQL
- Schema e evolução: migrations SQL versionadas em `server/migrations/`

O sistema já possui:
- dashboard financeiro
- gestão de transações
- categorias
- contas bancárias/cartões
- parcelamentos
- despesas de habitação/financiamentos
- insights
- chat
- importação de transações com suporte a IA
- autenticação completa com sessão e refresh token

A aplicação já está funcional. O trabalho do agente deve ser incremental, preservando a base existente.

---

## 2. Diretriz principal

Antes de alterar qualquer lógica relevante:
1. ler os arquivos do escopo;
2. resumir rapidamente objetivo, regra de negócio, riscos e aceite;
3. fazer a menor mudança possível para entregar o requisito;
4. validar com testes ou checks compatíveis com o escopo;
5. reportar arquivos alterados, comandos executados e limitações.

Não reescreva partes estáveis só para “melhorar arquitetura”.

---

## 3. O que já existe e deve ser respeitado

### 3.1 Frontend
A aplicação usa:
- roteamento em `src/App.tsx`
- rotas nomeadas em `src/lib/routes.ts`
- hooks por feature em `src/hooks/*`
- módulo de autenticação separado em `src/modules/auth/*`
- páginas principais em `src/pages/*`

Páginas existentes relevantes:
- dashboard (`/`)
- transações
- parcelamentos
- habitação
- métricas
- chat
- insights
- contas
- perfil
- configurações

Não duplique páginas, providers, rotas nem shell da aplicação se for possível estender o que já existe.

### 3.2 Backend
A API já expõe:
- `/api/auth/*`
- `/api/dashboard`
- `/api/transactions`
- `/api/spending`
- `/api/insights`
- `/api/banks`
- `/api/housing`
- `/api/chat/messages`
- endpoints auxiliares ligados a categories, import e installments

A auth já está montada como módulo dedicado em:
- `server/modules/auth/routes.ts`
- `server/modules/auth/service.ts`
- `server/modules/auth/repository.ts`

As demais rotas autenticadas usam o `request.auth.userId`.

Não recrie uma camada paralela de autenticação.

### 3.3 Banco
O banco começou com dados financeiros e depois ganhou autenticação.
Isso significa que:
- o modelo `users` já existia antes da auth
- credenciais foram adicionadas depois
- existem flows para bootstrap/attach de credenciais em usuários existentes

Qualquer mudança em auth ou usuários deve considerar compatibilidade com esse histórico.

---

## 4. Regras obrigatórias para qualquer implementação

### 4.1 Não quebrar contratos
- Preserve contratos existentes sempre que possível.
- Se um contrato precisar mudar, documente e minimize o impacto.
- Não altere payloads existentes sem necessidade real.

### 4.2 Mudanças pequenas e rastreáveis
- Prefira alterações localizadas.
- Evite refactors amplos sem requisito funcional claro.
- Não mova arquivos em massa sem necessidade.

### 4.3 Regra de negócio centralizada
- Não duplique cálculo financeiro em vários lugares.
- Regras de domínio devem ficar concentradas em helpers/services apropriados.
- O frontend deve consumir dados já prontos sempre que possível.

### 4.4 Precisão financeira primeiro
- Valores monetários precisam de consistência.
- Evite lógica ambígua para parcelas, totais, saldos e agregações.
- Seja conservador ao alterar qualquer cálculo.

### 4.5 Segurança primeiro
- Qualquer autorização crítica deve ser validada no backend.
- O frontend pode esconder UI, mas não substitui proteção server-side.
- Nunca confie só na interface para bloquear acesso.

---

## 5. Convenções de frontend

### 5.1 Rotas
- Use `src/lib/routes.ts` para adicionar ou alterar caminhos.
- Não espalhe strings de rota hardcoded sem necessidade.
- Ao criar rota protegida, integre com o fluxo existente de `ProtectedRoute`.

### 5.2 Data fetching
- Use React Query para chamadas de API.
- Prefira criar hooks dedicados por recurso.
- Defina query keys estáveis e explícitas.
- Em mutations, invalide apenas caches afetados.
- Evite `fetch` solto em componentes quando já há padrão via `src/lib/api.ts`.

### 5.3 Camada de API
- Centralize chamadas HTTP em `src/lib/api.ts` ou em service do módulo quando fizer mais sentido.
- Reaproveite a infraestrutura já existente de:
  - access token bearer
  - refresh automático
  - `credentials: "include"`
  - tratamento de 401

### 5.4 UI
- Preserve o visual atual.
- Não faça redesign sem pedido explícito.
- Reaproveite componentes existentes antes de criar novos.
- Sempre trate estados:
  - loading
  - empty
  - error
  - success

### 5.5 Tipagem
- Tipar payloads de request/response.
- Se a resposta for global da API, prefira `src/types/*`.
- Se for algo bem localizado, aceite tipagem perto do módulo.
- Não use `any` sem motivo muito forte.

---

## 6. Convenções de backend

### 6.1 Organização
- Validação de entrada antes de processar.
- Evite SQL bruto dentro de rotas/controller quando houver alternativa por service/repository.
- Regras de negócio ficam em service.
- Acesso a dados fica em repository/query layer quando a feature justificar.

### 6.2 Auth e contexto do usuário
- O padrão atual usa `request.auth.userId`.
- Em endpoints autenticados, respeite o scoping por usuário.
- Não exponha dados de um usuário para outro sem requisito explícito e proteção adequada.

### 6.3 Erros
- Use o padrão de erros já existente.
- Respostas de erro devem ser consistentes com o restante da API.
- Não lance erros genéricos sem mensagem/código útil quando isso quebrar o fluxo de UX.

### 6.4 Banco e queries
- Prefira queries previsíveis e simples.
- Ao adicionar agregações, cuide de índices e custo.
- Evite N+1 desnecessário.
- Se surgir relatório pesado, considere estratégia incremental ou visão materializada, mas só quando necessário.

### 6.5 Migrations
- Toda mudança de schema deve entrar em migration nova.
- Nunca edite migrations antigas já existentes.
- Migrations devem ser idempotentes quando possível.
- Nomeie migrations de forma sequencial e descritiva.

---

## 7. Auth: regras específicas do projeto

A autenticação já existe e deve ser estendida, não reescrita.

### 7.1 O que existe hoje
- login
- signup
- refresh
- logout
- forgot password
- reset password
- `GET /api/auth/me`
- access token
- refresh token em cookie HttpOnly
- rate limiting nas rotas sensíveis
- auditoria de eventos de auth
- tabela de sessões
- tabela de tokens de reset
- bootstrap de credenciais para usuários existentes

### 7.2 O que NÃO fazer
- não recriar auth do zero
- não trocar o fluxo de refresh por storage em localStorage
- não remover o guard global já existente
- não criar segundo provider de autenticação paralelo
- não duplicar lógica de sessão no frontend e no backend

### 7.3 O que fazer ao evoluir auth
- reaproveitar `server/modules/auth/*`
- reaproveitar `AuthProvider`, `ProtectedRoute` e `PublicOnlyRoute`
- estender `AuthUser` e `/api/auth/me` se precisar de novos metadados
- manter compatibilidade com sessões e auditoria já existentes

---

## 8. Domínio financeiro: regras que o agente deve respeitar

### 8.1 Modelo atual
O sistema gira em torno de dados por usuário:
- users
- bank_connections
- transactions
- categories
- monthly_summaries
- insights
- chat_messages
- housing
- estruturas ligadas a parcelamentos/importações/auth

### 8.2 Regras importantes
- Receita pode cair em caixa ou conta bancária.
- Despesa deve respeitar vínculo correto com conta/cartão.
- Parcelamento existe no domínio e exige consistência.
- Totais financeiros precisam manter coerência com filtros e períodos.
- Não simplifique regras de parcela ou saldo sem confirmar no código afetado.

### 8.3 Quando mexer em cálculos
- documente a regra antes
- valide casos de borda
- preserve comportamento existente quando não houver bug comprovado
- adicione teste se o cálculo mudou

---

## 9. Importação e IA

O projeto já possui importação de transações e infraestrutura para IA.

### 9.1 O que já existe
- preview de importação
- commit da importação
- sugestão por IA
- configuração via env
- modos `direct` e `webhook`
- scripts/arquivos no backend para import AI

### 9.2 Regras
- não remova ou quebre flows de importação ao mexer em transações
- não acople feature nova de forma a invalidar preview/commit sem necessidade
- se alterar transação/categoria/conta, considere impacto no import

---

## 10. Estratégia para novas features

Ao implementar uma feature nova, siga esta ordem:

1. entender se ela é:
   - extensão de auth,
   - extensão de domínio financeiro,
   - nova leitura de dados,
   - nova área de UI,
   - ajuste de importação/IA

2. localizar pontos de integração já existentes;

3. decidir o menor conjunto de arquivos a alterar;

4. escrever mini-spec curta:
   - objetivo
   - regra de negócio
   - riscos
   - critérios de aceite

5. implementar;

6. validar.

---

## 11. Como trabalhar por tipo de mudança

### 11.1 Nova rota backend
- validar entrada
- usar auth atual se for rota protegida
- manter consistência de response shape
- centralizar regra em service se houver complexidade
- adicionar teste quando relevante

### 11.2 Nova página frontend
- adicionar rota em `src/lib/routes.ts`
- registrar em `src/App.tsx`
- usar hook/service existente ou criar um novo no padrão atual
- tratar loading/error/empty
- manter visual coerente

### 11.3 Evolução de tabela
- criar migration nova
- atualizar repository/service/tipos
- validar compatibilidade com seed e bootstrap, se afetado

### 11.4 Dashboard/métricas
- agregação pesada preferencialmente no backend
- frontend deve renderizar e filtrar o mínimo necessário
- evitar recomputar no componente dados já disponíveis na API

### 11.5 Feature administrativa
- autorização obrigatória no backend
- UI condicional no frontend
- não confiar só em esconder aba
- preservar escopo por usuário para rotas normais
- endpoints administrativos devem ser explícitos e isolados

---

## 12. Estilo de código esperado

### 12.1 Geral
- clareza acima de “esperteza”
- nomes explícitos
- pouca mágica
- sem abstração prematura

### 12.2 TypeScript
- prefira tipos explícitos em fronteiras
- evitar `as` desnecessário
- evitar `any`
- manter coerência com o padrão já presente

### 12.3 React
- componentes focados
- hooks para lógica de dados/estado
- não enfiar regra de negócio pesada no JSX

### 12.4 SQL / dados
- queries legíveis
- filtros consistentes
- nomes de colunas preservados
- cuidado com `NUMERIC(12, 2)` e conversões

---

## 13. Testes e validação

### 13.1 Padrão mínimo
Sempre rodar o mínimo necessário ao escopo:
- frontend: `npm test` ou testes específicos
- backend: testes específicos quando afetar domínio/auth
- lint se a mudança justificar

### 13.2 Quando é obrigatório testar
- auth
- sessão
- cálculos financeiros
- parcelamentos
- importação
- migrations novas
- mudanças de contrato

### 13.3 O que reportar ao final
Sempre informar:
- arquivos alterados
- migrations adicionadas
- comandos executados
- resultado dos testes/checks
- limitações conhecidas

---

## 14. Comandos úteis

Executar na raiz do projeto.

### Instalação
```bash
npm install