# Banco e migrations

## Bootstrap

Fluxo padrão:

```bash
npm run db:migrate
```

As migrations são controladas por `schema_migrations` e aplicadas em ordem lexicográfica do nome do arquivo.

## Banco vazio

- o banco vazio sobe pela sequência atual de migrations
- existe uma migration final de limpeza (`039_cleanup_legacy_demo_seed.sql`) para remover o seed legado de demonstração quando o banco foi criado do zero com os dados históricos antigos

## Seed de categorias por usuário

- o seed padrão de categorias usa `ON CONFLICT (user_id, slug) DO NOTHING`
- signup continua transacional; se o seed falhar, a criação do usuário não deve ficar parcial

## Riscos operacionais conhecidos

- existem migrations históricas com prefixo numérico duplicado (`011_*`)
- como a ordem é lexicográfica por filename, não renomeie migrations antigas já aplicadas em ambientes existentes
- o seed histórico em `002_seed_initial_data.sql` fazia sentido no bootstrap legado; o MVP atual depende da limpeza posterior e do seed por usuário no fluxo de signup/bootstrap

## Regras de operação

- não editar migrations antigas já aplicadas
- qualquer ajuste novo deve entrar em migration nova
- rollback de dados deve ser tratado como forward-fix sempre que possível
