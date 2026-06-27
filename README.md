# FinanceFlow

App web/PWA de finanças pessoais em português de Portugal, construída com Next.js, React, TypeScript, TailwindCSS, componentes no estilo shadcn/ui e Supabase.

## Funcionalidades

- Login com email/password via Supabase Auth
- Login com Google, se estiver ativo no projeto Supabase
- Dados por utilizador com Row Level Security
- Ecrã inicial mobile-first com saldo do mês, receitas, despesas e poupança
- Bottom sheet rápida para adicionar receitas/despesas
- Página de transações com filtros, pesquisa, edição e remoção
- Página de estatísticas com gráficos simples
- Página de objetivos financeiros
- PWA-ready com `manifest.json`, ícone e service worker

## Correr localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Depois abre:

```text
http://localhost:3000
```

## Ligar à Supabase

1. Cria um projeto em Supabase.
2. Vai a `SQL Editor`.
3. Cola e executa o conteúdo de `supabase/schema.sql`.
4. Vai a `Project Settings > API`.
5. Copia:
   - Project URL
   - anon public key
6. Preenche `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Auth

Em `Authentication > Providers`:

- Ativa Email/password.
- Para Google, ativa o provider Google e adiciona as credenciais OAuth.
- Em `Authentication > URL Configuration`, adiciona:

```text
http://localhost:3000/auth/callback
https://o-teu-dominio.vercel.app/auth/callback
```

Também adiciona o domínio da Vercel aos allowed redirect URLs.

## Deploy na Vercel

1. Cria um repositório no GitHub.
2. Coloca estes ficheiros no repositório.
3. Liga o repositório à Vercel.
4. Na Vercel, adiciona as variáveis:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

5. Faz deploy.

A Vercel deteta automaticamente Next.js. Não precisas de mudar o build command.

## Estrutura

```text
app/                  Páginas da app
components/           Componentes reutilizáveis
components/ui/        Componentes base estilo shadcn/ui
components/finance/   Componentes específicos da app financeira
lib/                  Helpers, tipos e Supabase
public/               Manifest, ícone e service worker
supabase/schema.sql   Base de dados e políticas RLS
```

## Nota sobre dados

Os dados vivem na Supabase. Cada utilizador só consegue ler e alterar os seus próprios registos graças às políticas RLS no ficheiro `supabase/schema.sql`.
