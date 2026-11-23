-- =====================================================================
--  Ferragem da Tiane — estrutura do banco (PDV, estoque, reposição, caixa)
--  Rode este arquivo inteiro no SQL Editor do Supabase, uma única vez.
-- =====================================================================

begin;

-- Trava de segurança: não roda se as tabelas do sistema já existirem.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name in ('produtos','caixas','movimentos_caixa','vendas','itens_venda','reposicao')
  ) then
    raise exception 'Já existem tabelas do sistema neste banco. Nada foi alterado. Avise antes de continuar.';
  end if;
end $$;

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- PRODUTOS
-- ---------------------------------------------------------------------
create table public.produtos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(trim(nome)) > 0),
  codigo_barras   text unique,
  preco           numeric(12,2) not null default 0 check (preco >= 0),
  custo           numeric(12,2) not null default 0 check (custo >= 0),
  estoque         integer not null default 0,
  estoque_minimo  integer not null default 0 check (estoque_minimo >= 0),
  abaixo_minimo   boolean generated always as (estoque_minimo > 0 and estoque <= estoque_minimo) stored,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index produtos_nome_trgm on public.produtos using gin (nome gin_trgm_ops);
create index produtos_abaixo_minimo on public.produtos (abaixo_minimo) where abaixo_minimo;

-- ---------------------------------------------------------------------
-- CAIXA (abertura / fechamento) e movimentos (sangria / suprimento)
-- ---------------------------------------------------------------------
create table public.caixas (
  id                 uuid primary key default gen_random_uuid(),
  aberto_em          timestamptz not null default now(),
  fechado_em         timestamptz,
  status             text not null default 'aberto' check (status in ('aberto','fechado')),
  troco_inicial      numeric(12,2) not null default 0 check (troco_inicial >= 0),
  esperado_dinheiro  numeric(12,2),
  esperado_pix       numeric(12,2),
  esperado_debito    numeric(12,2),
  esperado_credito   numeric(12,2),
  contado_dinheiro   numeric(12,2),
  contado_pix        numeric(12,2),
  contado_debito     numeric(12,2),
  contado_credito    numeric(12,2),
  observacao         text
);
-- Só pode existir UM caixa aberto por vez.
create unique index caixas_um_aberto on public.caixas ((true)) where status = 'aberto';

create table public.movimentos_caixa (
  id         uuid primary key default gen_random_uuid(),
  caixa_id   uuid not null references public.caixas(id) on delete cascade,
  tipo       text not null check (tipo in ('sangria','suprimento')),
  valor      numeric(12,2) not null check (valor > 0),
  descricao  text,
  criado_em  timestamptz not null default now()
);
create index movimentos_caixa_caixa on public.movimentos_caixa (caixa_id);

-- ---------------------------------------------------------------------
-- VENDAS e ITENS
-- ---------------------------------------------------------------------
create table public.vendas (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity unique,
  caixa_id         uuid not null references public.caixas(id),
  criado_em        timestamptz not null default now(),
  total            numeric(12,2) not null default 0,
  forma_pagamento  text not null check (forma_pagamento in ('dinheiro','pix','debito','credito')),
  valor_recebido   numeric(12,2),
  troco            numeric(12,2) not null default 0
);
create index vendas_criado_em on public.vendas (criado_em);
create index vendas_caixa on public.vendas (caixa_id);

create table public.itens_venda (
  id              uuid primary key default gen_random_uuid(),
  venda_id        uuid not null references public.vendas(id) on delete cascade,
  produto_id      uuid references public.produtos(id) on delete set null,
  nome_produto    text not null,
  quantidade      integer not null check (quantidade > 0),
  preco_unitario  numeric(12,2) not null,
  custo_unitario  numeric(12,2) not null default 0
);
create index itens_venda_venda on public.itens_venda (venda_id);
create index itens_venda_produto on public.itens_venda (produto_id);

-- ---------------------------------------------------------------------
-- REPOSIÇÃO (lista automática de compras)
-- ---------------------------------------------------------------------
create table public.reposicao (
  id                   uuid primary key default gen_random_uuid(),
  produto_id           uuid not null references public.produtos(id) on delete cascade,
  status               text not null default 'pendente' check (status in ('pendente','comprado')),
  quantidade_comprada  integer check (quantidade_comprada > 0),
  criado_em            timestamptz not null default now(),
  comprado_em          timestamptz
);
-- Um produto aparece no máximo uma vez como pendente.
create unique index reposicao_um_pendente on public.reposicao (produto_id) where status = 'pendente';

-- ---------------------------------------------------------------------
-- GATILHOS
-- ---------------------------------------------------------------------
create function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger produtos_atualizado_em
before update on public.produtos
for each row execute function public.tocar_atualizado_em();

-- Quando o estoque chega no mínimo, o produto entra sozinho na reposição.
-- Quando volta a ficar acima do mínimo, sai da lista de pendentes.
create function public.verificar_estoque_minimo() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.ativo and new.abaixo_minimo then
    insert into reposicao (produto_id) values (new.id)
    on conflict (produto_id) where status = 'pendente' do nothing;
  else
    delete from reposicao where produto_id = new.id and status = 'pendente';
  end if;
  return null;
end $$;

create trigger produtos_estoque_minimo
after insert or update of estoque, estoque_minimo, ativo on public.produtos
for each row execute function public.verificar_estoque_minimo();

-- ---------------------------------------------------------------------
-- FUNÇÕES
-- ---------------------------------------------------------------------

-- Finaliza a venda e baixa o estoque numa única transação.
-- p_itens: [{"produto_id": "...", "quantidade": 2}, ...]
-- O preço vem sempre do cadastro (não do navegador).
create function public.finalizar_venda(
  p_itens jsonb,
  p_forma_pagamento text,
  p_valor_recebido numeric default null
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_caixa   uuid;
  v_venda   uuid;
  v_numero  bigint;
  v_total   numeric(12,2) := 0;
  v_troco   numeric(12,2) := 0;
  v_item    jsonb;
  v_prod    produtos%rowtype;
  v_qtd     integer;
begin
  select id into v_caixa from caixas where status = 'aberto' limit 1;
  if v_caixa is null then
    raise exception 'O caixa está fechado. Abra o caixa antes de vender.';
  end if;
  if p_forma_pagamento not in ('dinheiro','pix','debito','credito') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A venda não tem itens.';
  end if;

  insert into vendas (caixa_id, forma_pagamento)
  values (v_caixa, p_forma_pagamento)
  returning id, numero into v_venda, v_numero;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item->>'quantidade')::integer;
    if v_qtd is null or v_qtd <= 0 then
      raise exception 'Quantidade inválida.';
    end if;

    select * into v_prod from produtos where id = (v_item->>'produto_id')::uuid for update;
    if not found then
      raise exception 'Produto não encontrado. Atualize a página e tente de novo.';
    end if;

    insert into itens_venda (venda_id, produto_id, nome_produto, quantidade, preco_unitario, custo_unitario)
    values (v_venda, v_prod.id, v_prod.nome, v_qtd, v_prod.preco, v_prod.custo);

    update produtos set estoque = estoque - v_qtd where id = v_prod.id;

    v_total := v_total + v_prod.preco * v_qtd;
  end loop;

  if p_forma_pagamento = 'dinheiro' then
    if p_valor_recebido is null then
      p_valor_recebido := v_total;
    end if;
    if p_valor_recebido < v_total then
      raise exception 'Valor recebido (R$ %) é menor que o total (R$ %).',
        replace(round(p_valor_recebido, 2)::text, '.', ','), replace(v_total::text, '.', ',');
    end if;
    v_troco := p_valor_recebido - v_total;
  else
    p_valor_recebido := v_total;
  end if;

  update vendas
     set total = v_total, valor_recebido = p_valor_recebido, troco = v_troco
   where id = v_venda;

  return jsonb_build_object('id', v_venda, 'numero', v_numero, 'total', v_total, 'troco', v_troco);
end $$;

-- Valores esperados de um caixa (usado na tela e no fechamento).
create function public.resumo_caixa(p_caixa uuid) returns jsonb
language sql stable set search_path = public as $$
  with c as (select * from caixas where id = p_caixa),
  v as (
    select
      coalesce(sum(total) filter (where forma_pagamento = 'dinheiro'), 0) as dinheiro,
      coalesce(sum(total) filter (where forma_pagamento = 'pix'), 0)      as pix,
      coalesce(sum(total) filter (where forma_pagamento = 'debito'), 0)   as debito,
      coalesce(sum(total) filter (where forma_pagamento = 'credito'), 0)  as credito,
      count(*) filter (where forma_pagamento = 'dinheiro') as n_dinheiro,
      count(*) filter (where forma_pagamento = 'pix')      as n_pix,
      count(*) filter (where forma_pagamento = 'debito')   as n_debito,
      count(*) filter (where forma_pagamento = 'credito')  as n_credito,
      count(*) as n_vendas,
      coalesce(sum(total), 0) as total
    from vendas where caixa_id = p_caixa
  ),
  m as (
    select
      coalesce(sum(valor) filter (where tipo = 'sangria'), 0)    as sangrias,
      coalesce(sum(valor) filter (where tipo = 'suprimento'), 0) as suprimentos
    from movimentos_caixa where caixa_id = p_caixa
  )
  select jsonb_build_object(
    'troco_inicial', c.troco_inicial,
    'vendas_dinheiro', v.dinheiro, 'vendas_pix', v.pix,
    'vendas_debito', v.debito, 'vendas_credito', v.credito,
    'n_dinheiro', v.n_dinheiro, 'n_pix', v.n_pix,
    'n_debito', v.n_debito, 'n_credito', v.n_credito,
    'n_vendas', v.n_vendas, 'total_vendas', v.total,
    'sangrias', m.sangrias, 'suprimentos', m.suprimentos,
    'esperado_dinheiro', c.troco_inicial + v.dinheiro + m.suprimentos - m.sangrias
  )
  from c, v, m;
$$;

-- Fecha o caixa aberto gravando o esperado e o contado de cada forma.
create function public.fechar_caixa(
  p_contado_dinheiro numeric,
  p_contado_pix numeric,
  p_contado_debito numeric,
  p_contado_credito numeric,
  p_observacao text default null
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_caixa uuid;
  r jsonb;
begin
  select id into v_caixa from caixas where status = 'aberto' limit 1 for update;
  if v_caixa is null then
    raise exception 'Não há caixa aberto.';
  end if;
  r := resumo_caixa(v_caixa);
  update caixas set
    status = 'fechado',
    fechado_em = now(),
    esperado_dinheiro = (r->>'esperado_dinheiro')::numeric,
    esperado_pix      = (r->>'vendas_pix')::numeric,
    esperado_debito   = (r->>'vendas_debito')::numeric,
    esperado_credito  = (r->>'vendas_credito')::numeric,
    contado_dinheiro  = coalesce(p_contado_dinheiro, 0),
    contado_pix       = coalesce(p_contado_pix, 0),
    contado_debito    = coalesce(p_contado_debito, 0),
    contado_credito   = coalesce(p_contado_credito, 0),
    observacao        = nullif(trim(p_observacao), '')
  where id = v_caixa;
  return v_caixa;
end $$;

-- "Comprei": marca a reposição como comprada e dá entrada no estoque.
create function public.registrar_compra(
  p_reposicao uuid,
  p_quantidade integer,
  p_novo_custo numeric default null
) returns void
language plpgsql set search_path = public as $$
declare
  v_produto uuid;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe a quantidade comprada.';
  end if;
  update reposicao
     set status = 'comprado', quantidade_comprada = p_quantidade, comprado_em = now()
   where id = p_reposicao and status = 'pendente'
  returning produto_id into v_produto;
  if v_produto is null then
    raise exception 'Este item já foi marcado como comprado.';
  end if;
  update produtos
     set estoque = estoque + p_quantidade,
         custo = coalesce(p_novo_custo, custo)
   where id = v_produto;
end $$;

-- Faturamento, lucro e nº de vendas por dia (fuso de Brasília).
create function public.dashboard_diario(p_dias integer default 30)
returns table (dia date, faturamento numeric, lucro numeric, num_vendas bigint)
language sql stable set search_path = public as $$
  with lim as (
    select ((now() at time zone 'America/Sao_Paulo')::date - (p_dias - 1)) as d0,
           (now() at time zone 'America/Sao_Paulo')::date as d1
  ),
  dias as (
    select generate_series(lim.d0, lim.d1, interval '1 day')::date as dia from lim
  ),
  v as (
    select (criado_em at time zone 'America/Sao_Paulo')::date as dia,
           count(*) as n, sum(total) as fat
    from vendas, lim
    where criado_em >= (lim.d0::timestamp at time zone 'America/Sao_Paulo')
    group by 1
  ),
  l as (
    select (v.criado_em at time zone 'America/Sao_Paulo')::date as dia,
           sum(i.quantidade * (i.preco_unitario - i.custo_unitario)) as lucro
    from itens_venda i join vendas v on v.id = i.venda_id, lim
    where v.criado_em >= (lim.d0::timestamp at time zone 'America/Sao_Paulo')
    group by 1
  )
  select d.dia, coalesce(v.fat, 0), coalesce(l.lucro, 0), coalesce(v.n, 0)
  from dias d
  left join v on v.dia = d.dia
  left join l on l.dia = d.dia
  order by d.dia;
$$;

-- Produtos mais vendidos no período.
create function public.mais_vendidos(p_dias integer default 30, p_limite integer default 5)
returns table (produto_id uuid, nome text, quantidade bigint, faturamento numeric)
language sql stable set search_path = public as $$
  select i.produto_id, max(i.nome_produto), sum(i.quantidade), sum(i.quantidade * i.preco_unitario)
  from itens_venda i
  join vendas v on v.id = i.venda_id
  where v.criado_em >= ((((now() at time zone 'America/Sao_Paulo')::date - (p_dias - 1)))::timestamp at time zone 'America/Sao_Paulo')
  group by i.produto_id
  order by 3 desc
  limit p_limite;
$$;

-- Números gerais do estoque.
create function public.resumo_estoque() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'produtos', count(*),
    'unidades', coalesce(sum(greatest(estoque, 0)), 0),
    'valor_custo', coalesce(sum(greatest(estoque, 0) * custo), 0),
    'valor_venda', coalesce(sum(greatest(estoque, 0) * preco), 0),
    'abaixo_minimo', count(*) filter (where abaixo_minimo),
    'zerados', count(*) filter (where estoque <= 0)
  )
  from produtos where ativo;
$$;

-- ---------------------------------------------------------------------
-- SEGURANÇA (RLS): só quem está logado acessa. Visitantes não veem nada.
-- ---------------------------------------------------------------------
alter table public.produtos         enable row level security;
alter table public.caixas           enable row level security;
alter table public.movimentos_caixa enable row level security;
alter table public.vendas           enable row level security;
alter table public.itens_venda      enable row level security;
alter table public.reposicao        enable row level security;

create policy "logado acessa" on public.produtos         for all to authenticated using (true) with check (true);
create policy "logado acessa" on public.caixas           for all to authenticated using (true) with check (true);
create policy "logado acessa" on public.movimentos_caixa for all to authenticated using (true) with check (true);
create policy "logado acessa" on public.vendas           for all to authenticated using (true) with check (true);
create policy "logado acessa" on public.itens_venda      for all to authenticated using (true) with check (true);
create policy "logado acessa" on public.reposicao        for all to authenticated using (true) with check (true);

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on function public.finalizar_venda(jsonb, text, numeric)          from public, anon;
revoke execute on function public.resumo_caixa(uuid)                             from public, anon;
revoke execute on function public.fechar_caixa(numeric, numeric, numeric, numeric, text) from public, anon;
revoke execute on function public.registrar_compra(uuid, integer, numeric)       from public, anon;
revoke execute on function public.dashboard_diario(integer)                      from public, anon;
revoke execute on function public.mais_vendidos(integer, integer)                from public, anon;
revoke execute on function public.resumo_estoque()                               from public, anon;

grant execute on function public.finalizar_venda(jsonb, text, numeric)          to authenticated;
grant execute on function public.resumo_caixa(uuid)                             to authenticated;
grant execute on function public.fechar_caixa(numeric, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.registrar_compra(uuid, integer, numeric)       to authenticated;
grant execute on function public.dashboard_diario(integer)                      to authenticated;
grant execute on function public.mais_vendidos(integer, integer)                to authenticated;
grant execute on function public.resumo_estoque()                               to authenticated;

commit;
