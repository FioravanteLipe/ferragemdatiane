# Ferragem da Tiane: sistema de vendas e estoque

## Parte 1: instalar o Node.js (uma vez só)

1. Acesse **https://nodejs.org** e baixe a versão **LTS** (botão verde).
2. Instale clicando em "Avançar" até o fim.
3. Feche e abra de novo o VS Code.

## Parte 2: criar o banco de dados no Supabase

### 2.1 Criar a conta e o projeto
1. Acesse **https://supabase.com** e clique em **Start your project**. Entre com sua conta do GitHub ou com e-mail.
2. Clique em **New project**.
   - **Name:** `ferragem-da-tiane`
   - **Database Password:** clique em *Generate a password* e **guarde essa senha** num lugar seguro.
   - **Region:** `South America (São Paulo)`
3. Clique em **Create new project** e espere uns 2 minutos até ficar pronto.

### 2.2 Conferir se o banco está vazio
1. No menu da esquerda, abra **SQL Editor**.
2. Clique em **New query**, cole o conteúdo do arquivo [`supabase/00_inspecionar.sql`](supabase/00_inspecionar.sql) e clique em **Run**.
3. O resultado deve vir **vazio** ("No rows returned"). Se aparecer alguma tabela, **pare e me avise** antes de seguir.

### 2.3 Criar as tabelas
1. Ainda no **SQL Editor**, clique em **New query**.
2. Abra o arquivo [`supabase/01_estrutura.sql`](supabase/01_estrutura.sql), copie **tudo** (Ctrl+A, Ctrl+C), cole no editor e clique em **Run**.
3. Deve aparecer **"Success. No rows returned"**.
4. Para conferir, abra **Table Editor** no menu: devem aparecer as tabelas `produtos`, `caixas`, `movimentos_caixa`, `vendas`, `itens_venda` e `reposicao`.

> Se o Supabase avisar algo como *"This query has destructive operations"* ou *"New tables will not have RLS"*, pode confirmar: o arquivo já liga a segurança (RLS) em todas as tabelas.

### 2.4 Criar o seu login (usuário único)
1. Menu **Authentication** > **Users** > **Add user** > **Create new user**.
2. Coloque seu e-mail e uma senha forte. Marque **Auto Confirm User** e clique em **Create user**.
3. Agora **bloqueie novos cadastros**: **Authentication** > **Sign In / Providers** (ou *Settings*), desligue **Allow new users to sign up** e clique em **Save**.
   Assim ninguém consegue criar conta no seu sistema.

### 2.5 Pegar as chaves do projeto
1. Clique em **Project Settings** (engrenagem) > **Data API** e copie a **Project URL**.
2. Em **Project Settings** > **API Keys**, copie a **Publishable key** (começa com `sb_publishable_`).
   Em projetos antigos ela aparece como **anon public**, e serve do mesmo jeito.
   **Não use a secret / service_role key.**
3. Na pasta do projeto, copie o arquivo `.env.example` com o nome **`.env.local`** e preencha:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

## Parte 3: rodar no computador

No terminal do VS Code (menu **Terminal** > **New Terminal**):

```
npm install
npm run dev
```

Abra **http://localhost:3000** e entre com o e-mail e a senha do passo 2.4.

## Como usar (resumo)

| Aba | Para que serve |
|---|---|
| **Venda** | Passe o leitor USB (ou toque em *Câmera* no celular) ou digite o nome. `3*código` lança 3 unidades. **F2** finaliza. Em dinheiro, o troco é calculado na hora. |
| **Dashboard e Estoque** | Faturamento e lucro de hoje e do período, gráfico por dia, mais vendidos, valor do estoque. Na tabela: **Entrada** (chegou mercadoria) e **Corrigir** (após contar a prateleira). |
| **Produtos** | Cadastro com código de barras, custo, preço (mostra a margem), estoque e **estoque mínimo**. |
| **Reposição** | Os produtos entram aqui **sozinhos** quando chegam no mínimo, e o sino no topo avisa. **Comprei** dá entrada no estoque. **Copiar lista** gera a lista para mandar no WhatsApp. |
| **Caixa** | Abrir com o troco inicial, registrar sangria/suprimento e **fechar**: conte cédulas e moedas, digite o que a maquininha e o Pix mostram, e o sistema aponta a diferença de cada forma de pagamento. |

> A câmera do celular só funciona no site publicado (https). Em `localhost`, só no próprio computador.

## Parte 4: publicar na internet (Vercel), quando quiser
Este passo fica para depois. Quando chegar a hora, eu te passo o passo a passo (GitHub + Vercel + chaves).
