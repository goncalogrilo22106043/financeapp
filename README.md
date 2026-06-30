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
- Importador inteligente para Revolut CSV e Millennium PDF/CSV com pré-visualização, duplicados, transferências internas e regras aprendidas.
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

O SQL recria as tabelas `profiles`, `accounts`, `categories`, `transactions`, `transaction_rules` e `goals`. Se já tinhas dados antigos, exporta primeiro antes de executar.

Se já tens dados na Supabase, executa o ficheiro `supabase/upgrade-transfers.sql`. Esse ficheiro atualiza a estrutura sem apagar os dados e cria a tabela `transaction_rules`, usada para a app aprender as tuas decisões de importação.

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

1. Exporta o extrato da Revolut em CSV ou o extrato do Millennium em PDF.
2. Na app, escolhe a conta certa: `Revolut`, `Millennium` ou outra.
3. Na app, abre `Movimentos`.
4. Clica em `Importar`.
5. Carrega o ficheiro.
6. Se o formato for desconhecido, associa manualmente as colunas de data, descrição e valor.
7. Confirma apenas os movimentos por rever, ajusta Receita/Despesa/Transferência e categoria.
8. Clica em `Guardar importação`.

A importação nunca guarda movimentos desconhecidos sem confirmação. Quando confirmas uma decisão, a app guarda uma regra para reconhecer descrições semelhantes no mês seguinte.

Podes usar `Dividir por 2` num movimento quando uma despesa/rendimento foi partilhado com outra pessoa. Nesse caso, a app guarda apenas metade do valor.

Regras automáticas:

- Compras reais entram como despesas.
- Créditos reais entram como receitas.
- Movimentos parecidos entre duas contas, em datas próximas e com valores iguais, são sugeridos como `Transferência`.
- Top-ups, MB WAY, SEPA, Revolut, Millennium e descrições de transferência ajudam a ligar os movimentos.
- Transferências puras entre contas ficam fora de receitas, despesas, lucro e estatísticas financeiras.
- Possíveis duplicados aparecem marcados e ficam ignorados, exceto se escolheres `Importar mesmo assim`.
- Descrições já aprendidas, como Spotify, Galp, Apple Pay Top Up ou CGSneakers, são classificadas automaticamente por regras guardadas em `transaction_rules`.

## Nota sobre acesso

Esta versão não tem login. Todos os dispositivos usam o mesmo perfil partilhado `main`. Mantém o link privado, porque qualquer pessoa com acesso ao link pode ver e alterar os dados.
