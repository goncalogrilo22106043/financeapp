# Finanças

App web/PWA de finanças pessoais em português de Portugal, construída com Next.js, React, TypeScript, TailwindCSS e Supabase.

## Modelo financeiro

A app usa três conceitos:

- Contas: Millennium, Revolut, Dinheiro ou outras.
- Receitas/despesas: dinheiro que entra ou sai do património.
- Transferências: dinheiro movido entre contas próprias.

Transferências não contam para receitas, despesas, lucro nem taxa de poupança. Exemplo: `Millennium -> Revolut 500€` só reduz o saldo do Millennium e aumenta o saldo da Revolut.

## Funcionalidades

- Dashboard com receitas, despesas, lucro, poupança, património total e saldos por conta.
- Botão `Novo movimento` com Receita, Despesa ou Transferência.
- Página Contas para editar saldos e criar novas contas.
- Página Movimentos com filtros por mês, conta, tipo, categoria e pesquisa.
- Categorias editáveis para receitas e despesas.
- Estatísticas que ignoram transferências.
- Importador Excel/CSV da Revolut e PDF do Millennium com pré-visualização.
- Dados guardados na Supabase, partilhados entre PC e telemóvel.
- PWA-ready para instalar no telemóvel.

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

O SQL recria as tabelas `profiles`, `accounts`, `categories`, `transactions` e `goals`. Se já tinhas dados antigos, exporta primeiro antes de executar.

## Deploy na Vercel

1. Coloca os ficheiros do projeto no GitHub.
2. Liga o repositório à Vercel.
3. Na Vercel, adiciona as variáveis:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

4. Faz deploy.

## Importar movimentos

1. Na Revolut, exporta o extrato em Excel (`.xlsx`) ou CSV.
2. No Millennium, exporta o extrato em PDF.
3. Na app, abre `Movimentos`.
4. Clica em `Importar`.
5. Confirma a pré-visualização.
6. Ajusta Receita/Despesa e categoria, se necessário.
7. Clica em `Importar selecionadas`.

Importações da Revolut entram na conta `Revolut`. PDFs do Millennium entram na conta `Millennium`.

Regras automáticas:

- Compras reais entram como despesas.
- Créditos reais entram como receitas.
- Compras `Revolut 5625 Dublin IE` no Millennium entram como transferência `Millennium -> Revolut`.
- `TRF. P/O Gonçalo Grilo` no Millennium entra como transferência `Revolut -> Millennium`.
- Transferências puras entre contas ficam fora de receitas, despesas, lucro e estatísticas financeiras.
- Duplicados simples são ignorados por tipo, data, valor, descrição, categoria e conta.

## Nota sobre acesso

Esta versão não tem login. Todos os dispositivos usam o mesmo perfil partilhado `main`. Mantém o link privado, porque qualquer pessoa com acesso ao link pode ver e alterar os dados.
