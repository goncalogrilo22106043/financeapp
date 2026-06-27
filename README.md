# FinanceFlow

App web/PWA de finanças pessoais em português de Portugal, construída com Next.js, React, TypeScript, TailwindCSS e componentes no estilo shadcn/ui.

## Funcionalidades

- Sem login: abre direto no dashboard
- Dados guardados no browser com `localStorage`
- Ecrã inicial mobile-first com saldo do mês, receitas, despesas e poupança
- Bottom sheet rápida para adicionar receitas/despesas
- Página de transações com filtros, pesquisa, edição e remoção
- Página de estatísticas com gráficos simples
- Página de objetivos financeiros
- PWA-ready com `manifest.json`, ícone e service worker

## Correr localmente

```bash
npm install
npm run dev
```

Depois abre:

```text
http://localhost:3000
```

## Deploy na Vercel

1. Cria um repositório no GitHub.
2. Coloca estes ficheiros no repositório.
3. Liga o repositório à Vercel.
4. Faz deploy.

A Vercel deteta automaticamente Next.js. Não precisas de mudar o build command.
Não precisas de variáveis de ambiente para esta versão.

## Estrutura

```text
app/                  Páginas da app
components/           Componentes reutilizáveis
components/ui/        Componentes base estilo shadcn/ui
components/finance/   Componentes específicos da app financeira
lib/                  Helpers, tipos e armazenamento local
public/               Manifest, ícone e service worker
```

## Nota sobre dados

Os dados ficam guardados no browser/dispositivo onde usas a app. Se limpares os dados do browser, os dados da app também podem desaparecer.
