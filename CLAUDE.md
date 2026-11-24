# Sistema de venda e estoque

Sistema web de PDV, estoque e reposição para uma loja. Responder sempre em português.

## Stack
- Next.js (App Router) + Tailwind
- Supabase (banco Postgres + login)
- Deploy na Vercel (via repositório no GitHub; cada push publica)

## O que o usuário pediu (decidido)
- Vender lendo código de barras com **leitor USB e câmera do celular**, ou digitando o nome do produto cadastrado.
- Na tela de venda aparecem valor, quantidade de cada item e o **total somado**.
- **Aviso quando o estoque de um produto chega no mínimo** que o usuário definir, e o produto entra **automaticamente numa lista de reposição**.
- Aba de **Venda**.
- Aba de **Dashboards + controle de estoque** (na mesma aba).
- O erro mais comum na loja acontece no **fechamento do caixa**.

## Decidido com o usuário (23/11/2026)
- **1 usuário só** (o dono). Login único; cadastro público desativado no Supabase.
- Abas: **Venda**, **Dashboard + Estoque**, **Produtos** (código de barras, preço, custo, mínimo), **Reposição** (marcar "comprei" e dar entrada no estoque), **Caixa** (abertura/fechamento, troco inicial, sangria, total por forma de pagamento, contagem, diferença).
- **Histórico de vendas NÃO foi aprovado** (não construir sem pedir).
- Estoque mínimo **por produto**; guardar **preço de custo** para o dashboard mostrar lucro.
- Formas de pagamento: **Dinheiro (com troco), Pix, Débito, Crédito**.
- Notificação: sino dentro do sistema; push no celular (PWA) fica para depois.
- Visual: cores da logo (amarelo ~#F7B52C + preto), logo em `public/logo.png`.

## Tabelas previstas
- `produtos`: nome, código de barras (único), preço, custo, quantidade em estoque, estoque mínimo.
- `vendas`: data, total, forma de pagamento.
- `itens_venda`: venda, produto, quantidade, preço unitário.
- `reposicao`: produto, status (pendente/comprado), quantidade comprada.
- `caixa`: abertura, fechamento, valores esperado e contado.
- Uma função no banco finaliza a venda e baixa o estoque numa única transação.
- Login + RLS no Supabase.

## Ordem sugerida
1. Banco e login
2. Cadastro de produtos
3. Tela de venda (leitor USB, câmera, busca por nome)
4. Estoque + reposição + aviso de mínimo
5. Dashboard
6. Caixa e histórico
7. Deploy

## Em aberto
- Push no celular (PWA).

## Regras de trabalho
- Antes de criar tabelas, inspecionar o que já existe no Supabase.
- Nunca colocar chaves secretas no código; usar `.env.local` e variáveis da Vercel.

## Situação (23/11/2026)
- Código das 5 abas pronto (Next.js 16 + Tailwind 4, `cacheComponents` ligado; páginas são client components).
- Banco: `supabase/01_estrutura.sql` (testado em PGlite: venda, troco, baixa de estoque, reposição automática, comprei, caixa, dashboard, RLS).
- Passo a passo do usuário em `LEIA-ME.md`. **Falta o usuário criar o projeto no Supabase e o `.env.local`.**
- Confirmado pelo usuário: venda **não é bloqueada** por estoque insuficiente; o sistema só avisa e o estoque pode ficar negativo.
- Next 16: middleware agora é `src/proxy.ts`. Ler `node_modules/next/dist/docs/` antes de mexer em APIs do Next.
- Próximos: deploy na Vercel; push no celular (PWA).

## Celular como leitor (24/11/2026)
- Aprovado: botão "Celular" na Venda gera QR com token aleatório (8h). A página `/leitor` abre sem login (liberada no proxy), lê com a câmera e envia cada código; a Venda recebe pelo Realtime (postgres_changes) e adiciona como o leitor USB.
- Banco em `supabase/02_leitor_celular.sql` (roda depois do 01). Só o hash do token fica no banco; o token vai no `#` da URL. Anon só executa `conectar_leitor`, `enviar_leitura` e `desconectar_leitor`. QR novo, desconectar ou fechar o caixa (gatilho) revogam o token. Limite de 20 leituras em 10s. Testado em PGlite.
- Decidido: 1 celular por vez; cada leitura = quantidade 1; só funciona com caixa aberto.
- Só dá para testar de verdade com o site publicado (https). Se a Venda não estiver aberta no notebook, a leitura se perde; em duas abas, entra nas duas.
- Pendente do pedido anterior (interrompido pelo usuário): aba de vendas do dia com exclusão por senha e forma de pagamento "Nota". Não retomar sem ele pedir.
