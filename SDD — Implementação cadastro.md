# PROMPT SDD — Planejamento e Implementação de Cadastro Público de Usuário

Quero que você atue como uma IA Agent Senior de Arquitetura, Produto, Segurança, Frontend e Backend.

Sua tarefa é PLANEJAR a implementação completa de uma funcionalidade de **cadastro público de usuário** para uma aplicação com:

- Frontend: React + Vite + TypeScript
- Backend: Express + TypeScript

Você deve gerar um **SDD (Software Design Document) completo**, pronto para orientar implementação real.

Não quero resposta genérica.
Não quero apenas opinião.
Quero decisões objetivas, práticas e prontas para produção.

---

# CONTEXTO

A aplicação já possui domínio de autenticação ou terá autenticação baseada em e-mail e senha.

Quero implementar:

- cadastro público de usuário
- login moderno
- sessão autenticada após cadastro
- lembrar login
- esqueci minha senha
- preparo para verificação de e-mail
- UI/UX impecável para telas de auth
- estilo visual atual, premium e coerente com uma aplicação SaaS moderna

O cadastro deve ser tratado como **extensão do domínio auth**, e não como módulo isolado.

O usuário deve:

1. acessar a tela de cadastro
2. criar conta com segurança
3. receber sessão autenticada imediata após signup
4. entrar na aplicação com estado inicial vazio
5. seguir por onboarding guiado ou CTAs de primeiro uso

---

# OBJETIVO

Planejar a melhor implementação de mercado para:

1. tela de cadastro
2. integração com login
3. criação de sessão
4. persistência de autenticação
5. recuperação de senha
6. lembrar login
7. base visual moderna de auth
8. arquitetura segura e escalável

---

# PESQUISA OBRIGATÓRIA

Antes de decidir a arquitetura, considere explicitamente as melhores práticas atuais de mercado para:

- cadastro e login em aplicações web modernas
- UX de formulários de autenticação
- segurança de autenticação
- proteção contra abuso e enumeração
- política de sessão
- fluxo de forgot password
- boas práticas para React forms
- melhores padrões visuais para telas de auth

Ao decidir, priorize:
- OWASP
- documentação oficial do Express
- documentação oficial das libs sugeridas
- boas práticas conhecidas de UX para formulários e autenticação

---

# DECISÕES TÉCNICAS OBRIGATÓRIAS

Planeje a solução assumindo estas decisões como padrão:

## Frontend
- React
- Vite
- TypeScript
- React Router
- React Hook Form
- Zod
- Tailwind CSS
- shadcn/ui

## Backend
- Express
- TypeScript
- validação de payload
- rate limit
- hash seguro de senha
- JWT para access token
- refresh token separado
- cookies HttpOnly para refresh token

## Sessão
- access token curto
- access token mantido em memória no frontend
- refresh token em cookie HttpOnly, Secure e SameSite
- rotação de refresh token
- logout com revogação de sessão
- “lembrar login” controlando maior duração da sessão, nunca salvando senha

## Cadastro
- signup público
- checagem de duplicidade por e-mail
- resposta de signup com mesmo shape de login
- autenticação imediata após cadastro
- usuário novo entra sem dados seeded
- aplicação deve suportar empty state real

## E-mail
- modelar estado de e-mail não verificado
- preparar extensão futura para verificação de e-mail
- não bloquear primeira entrega por isso

## Segurança
- proteção contra brute force
- proteção contra enumeração
- mensagens de erro seguras
- tratamento de duplicidade
- política clara de expiração
- invalidação de sessões em reset de senha

---

# DIRETRIZES DE UX/UI OBRIGATÓRIAS

Quero uma tela de cadastro e um conjunto de telas de auth com padrão premium de mercado.

A experiência deve transmitir:
- modernidade
- clareza
- confiança
- leveza visual
- alto nível de acabamento

## Requisitos visuais
- layout moderno tipo SaaS
- card central refinado
- fundo elegante e sutil
- boa hierarquia tipográfica
- inputs grandes e confortáveis
- CTA principal forte
- ações secundárias discretas
- foco visível
- feedback de erro elegante
- loading refinado
- microinterações suaves
- excelente versão mobile
- excelente versão desktop

## Elementos da tela de cadastro
- logo/branding
- título
- subtítulo
- campo nome
- campo e-mail
- campo senha
- campo confirmar senha
- botão mostrar/ocultar senha
- checkbox lembrar login
- botão criar conta
- link para login
- área de feedback de erro
- opcional: bloco visual secundário no desktop

## Regras de UX
- pedir o mínimo de dados necessário
- evitar ruído visual
- estados de erro claros
- validação client-side + server-side
- acessibilidade real
- teclado funcionando bem
- labels corretos
- aria-* quando necessário
- contraste adequado
- responsividade impecável

---

# O QUE VOCÊ DEVE ENTREGAR

Sua resposta deve ser um **SDD completo**, seguindo exatamente esta estrutura.

---

## 1. Resumo Executivo
Explique:
- o que será implementado
- por que essa abordagem foi escolhida
- impacto na arquitetura

## 2. Objetivos
### Objetivos Funcionais
### Objetivos Não Funcionais

## 3. Arquitetura do Sistema
### Frontend
### Backend

## 4. Modelagem de Dados
Defina:
- entidades
- campos
- constraints
- relações
- estado de e-mail não verificado
- sessão e refresh token

## 5. Fluxos do Sistema
Descreva detalhadamente:
- fluxo de signup
- fluxo de login
- fluxo de refresh
- fluxo de logout
- fluxo de forgot password
- fluxo de reset password
- fluxo de sessão expirada
- fluxo de primeiro acesso com conta vazia

## 6. Endpoints / Contratos de API
Defina para cada endpoint:
- método
- rota
- request
- response
- erros possíveis

Inclua no mínimo:
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- GET /api/auth/me

## 7. Segurança
Incluir:
- validação de payload
- rate limit
- hash seguro de senha
- tratamento de duplicidade
- proteção contra enumeração
- estratégia de sessão
- estratégia de rotação de refresh token
- política de cookies
- invalidação de sessões
- logs de auditoria recomendados

## 8. Componentes Frontend
Defina:
- LoginPage
- SignupPage
- ForgotPasswordPage
- ResetPasswordPage
- AuthScreen
- PasswordField
- ProtectedRoute
- AuthProvider ou store
- hooks necessários
- schemas com Zod
- services de auth

## 9. Estrutura de Arquivos
Separar backend e frontend.

### Backend
Estrutura sugerida:
src/
  modules/
    auth/
      controllers/
      services/
      repositories/
      routes/
      schemas/
      dtos/
      utils/
  middlewares/
  shared/
  app.ts
  server.ts

### Frontend
Estrutura sugerida:
src/
  app/
  modules/
    auth/
      pages/
      components/
      hooks/
      services/
      schemas/
      types/
      utils/
  shared/
    components/
    lib/
    hooks/
    styles/

## 10. Arquivos Impactados
Liste os arquivos que precisariam ser criados ou alterados.

## 11. Plano de Implementação
Divida em fases:
- Fase 1 — Modelagem
- Fase 2 — Backend
- Fase 3 — Frontend
- Fase 4 — Integração
- Fase 5 — Testes
- Fase 6 — Polimento visual e acessibilidade

## 12. Verificação
Liste testes necessários:
- cadastro válido
- e-mail duplicado
- sessão criada após signup
- guard de rota
- app vazia sem seed
- refresh token
- logout
- forgot/reset password
- acessibilidade
- responsividade

## 13. Decisões Arquiteturais
Liste decisões finais tomadas e justifique.

## 14. Extensões Futuras
Sugerir:
- verificação de e-mail
- MFA
- login social
- auditoria
- analytics de auth
- device/session management

---

# REGRAS FINAIS

- Não seja genérico.
- Não apresente várias alternativas sem escolher.
- Escolha a melhor abordagem para este cenário e justifique.
- Priorize solução pronta para produção.
- Reutilize ao máximo a base de auth entre login e signup.
- Não trate cadastro como módulo isolado.
- Considere que a aplicação deve funcionar com usuário novo e sem dados seeded.
- O resultado precisa ser prático, implementável e com foco real em React + Vite + Express.

No final, além do SDD, entregue também:

1. uma recomendação objetiva da stack complementar ideal
2. um resumo das decisões críticas
3. uma proposta de direção visual para as telas de auth