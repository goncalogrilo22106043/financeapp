# FinanceFlow

App web/PWA de finanças pessoais em português de Portugal, construída com Next.js, React, TypeScript, TailwindCSS, componentes no estilo shadcn/ui e Supabase.

## Funcionalidades

- Sem login: abre direto no dashboard
- Dados guardados na Supabase numa base partilhada entre PC e telemóvel
- Ecrã inicial mobile-first com saldo do mês, receitas, despesas e poupança
- Bottom sheet rápida para adicionar receitas/despesas
- Página de transações com filtros, pesquisa, edição e remoção
- Página de categorias para criar, editar e apagar categorias
- Importador Excel/CSV da Revolut e PDF do Millennium com pré-visualização e seleção manual
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

1. Cria um projeto na Supabase.
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

Não há ecrã de login. Todos os dispositivos usam o mesmo perfil partilhado `main`, por isso o que adicionas no PC aparece no telemóvel e vice-versa.

Como não há login nem PIN, qualquer pessoa com acesso ao link da app pode ver e alterar os dados. Para uso pessoal, mantém o link privado.

## Importar transações bancárias

1. Na Revolut, exporta o extrato/movimentos em Excel (`.xlsx`) ou CSV.
2. No Millennium, exporta o extrato/movimentos em PDF.
3. Na app, abre `Transações`.
4. Clica em `Importar`.
5. Escolhe o ficheiro.
6. Confirma a pré-visualização e desmarca o que não quiseres importar.
7. Se for preciso, muda uma linha entre `Despesa` e `Receita` ou ajusta a categoria.
8. Clica em `Importar selecionadas`.

O importador de PDF usa leitura automática de texto. Como PDFs bancários podem mudar de formato, confirma sempre a pré-visualização antes de importar.

Regras automáticas:

- Valores negativos entram como despesas.
- Valores positivos entram como receitas.
- Reembolsos não são importados.
- Carregamentos/top-ups, incluindo Apple Pay e Open Banking, não são importados.
- Transferências para `Gonçalo Grilo` ou `Gonçalo Galvão de Sousa Grilo` não são importadas, porque são movimentos entre contas tuas.
- No PDF do Millennium, `TRF. P/O Gonçalo Grilo` entra como receita por defeito, porque representa dinheiro vindo da Revolut para o Millennium.
- No PDF do Millennium, compras `Revolut 5625 Dublin IE` não são importadas porque são carregamentos da Revolut.
- Movimentos ignorados aparecem desmarcados por defeito, mas podes marcá-los manualmente antes de importar se forem o único registo desse rendimento/despesa.
- Categorias novas são criadas automaticamente na Supabase com o nome vindo do banco ou sugerido pela app.
- Duplicados simples são ignorados por tipo, data, valor, descrição e categoria.
