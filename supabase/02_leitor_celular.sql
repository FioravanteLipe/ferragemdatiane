-- =====================================================================
--  Ferragem da Tiane — celular como leitor de código de barras
--  Rode este arquivo inteiro no SQL Editor do Supabase, uma única vez,
--  DEPOIS do 01_estrutura.sql.
-- =====================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'caixas') then
    raise exception 'Rode primeiro o arquivo 01_estrutura.sql. Nada foi alterado.';
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name in ('pareamentos', 'leituras_celular')
  ) then
    raise exception 'O leitor pelo celular já foi instalado neste banco. Nada foi alterado.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- TABELAS
-- ---------------------------------------------------------------------
create table public.pareamentos (
  id           uuid primary key default gen_random_uuid(),
  token_hash   bytea not null unique,      -- só o hash; o token fica só no QR code
  caixa_id     uuid not null references public.caixas(id),
  criado_em    timestamptz not null default now(),
  expira_em    timestamptz not null default now() + interval '8 hours',
  conectado_em timestamptz,                -- última vez que o celular abriu o link
  revogado_em  timestamptz
);

create table public.leituras_celular (
  id            bigint generated always as identity primary key,
  pareamento_id uuid not null references public.pareamentos(id) on delete cascade,
  codigo        text not null check (length(codigo) between 1 and 64),
  lido_em       timestamptz not null default now()
);
create index leituras_celular_pareamento on public.leituras_celular (pareamento_id, lido_em);

-- O notebook (logado) só LÊ estas tabelas, para receber as leituras pelo Realtime.
-- Toda escrita passa pelas funções abaixo.
alter table public.pareamentos      enable row level security;
alter table public.leituras_celular enable row level security;
revoke all on public.pareamentos, public.leituras_celular from public, anon, authenticated;
grant select on public.pareamentos, public.leituras_celular to authenticated;
create policy "logado lê" on public.pareamentos      for select to authenticated using (true);
create policy "logado lê" on public.leituras_celular for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- FUNÇÕES
-- ---------------------------------------------------------------------

-- Uso interno: devolve o pareamento do token se ele ainda vale.
create function public.pareamento_do_token(p_token text) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id
    from public.pareamentos p
    join public.caixas c on c.id = p.caixa_id
   where p.token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
     and p.revogado_em is null
     and p.expira_em > now()
     and c.status = 'aberto';
$$;

-- Notebook: gera o token do QR code. Derruba o celular conectado antes.
create function public.criar_pareamento() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_caixa  uuid;
  v_token  text;
  v_id     uuid;
  v_expira timestamptz;
begin
  select id into v_caixa from public.caixas where status = 'aberto' limit 1;
  if v_caixa is null then
    raise exception 'Abra o caixa antes de conectar o celular.';
  end if;

  update public.pareamentos set revogado_em = now() where revogado_em is null;
  delete from public.pareamentos where criado_em < now() - interval '2 days';

  -- 2 UUIDs aleatórios = ~244 bits de sorteio.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.pareamentos (token_hash, caixa_id)
  values (sha256(convert_to(v_token, 'UTF8')), v_caixa)
  returning id, expira_em into v_id, v_expira;

  return jsonb_build_object('id', v_id, 'token', v_token, 'expira_em', v_expira);
end $$;

-- Notebook: botão "Desconectar".
create function public.encerrar_pareamento(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.pareamentos set revogado_em = now() where id = p_id and revogado_em is null;
$$;

-- Celular (sem login): confere o token ao abrir a página.
create function public.conectar_leitor(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id     uuid := public.pareamento_do_token(p_token);
  v_expira timestamptz;
begin
  if v_id is null then
    raise exception 'Leitor desconectado.';
  end if;
  update public.pareamentos set conectado_em = now() where id = v_id returning expira_em into v_expira;
  return jsonb_build_object('expira_em', v_expira);
end $$;

-- Celular (sem login): envia um código lido e recebe o nome do produto.
create function public.enviar_leitura(p_token text, p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id     uuid := public.pareamento_do_token(p_token);
  v_codigo text := trim(coalesce(p_codigo, ''));
  v_nome   text;
  v_preco  numeric;
begin
  if v_id is null then
    raise exception 'Leitor desconectado.';
  end if;
  if length(v_codigo) not between 1 and 64 then
    raise exception 'Código inválido.';
  end if;
  if (select count(*) from public.leituras_celular
       where pareamento_id = v_id and lido_em > now() - interval '10 seconds') >= 20 then
    raise exception 'Leituras demais. Aguarde um instante.';
  end if;

  insert into public.leituras_celular (pareamento_id, codigo) values (v_id, v_codigo);
  select nome, preco into v_nome, v_preco
    from public.produtos where codigo_barras = v_codigo and ativo;
  return jsonb_build_object('nome', v_nome, 'preco', v_preco);
end $$;

-- Celular (sem login): botão "Desconectar".
create function public.desconectar_leitor(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.pareamentos set revogado_em = now()
   where id = public.pareamento_do_token(p_token);
end $$;

-- Fechou o caixa: todo celular conectado àquele caixa para de funcionar.
create function public.revogar_leitores() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.pareamentos set revogado_em = now()
   where caixa_id = new.id and revogado_em is null;
  return new;
end $$;

create trigger revogar_leitores_ao_fechar
  after update of status on public.caixas
  for each row when (old.status = 'aberto' and new.status = 'fechado')
  execute function public.revogar_leitores();

-- ---------------------------------------------------------------------
-- PERMISSÕES
-- ---------------------------------------------------------------------
revoke execute on function public.pareamento_do_token(text)      from public, anon, authenticated;
revoke execute on function public.revogar_leitores()             from public, anon, authenticated;
revoke execute on function public.criar_pareamento()             from public, anon;
revoke execute on function public.encerrar_pareamento(uuid)      from public, anon;
revoke execute on function public.conectar_leitor(text)          from public;
revoke execute on function public.enviar_leitura(text, text)     from public;
revoke execute on function public.desconectar_leitor(text)       from public;

grant execute on function public.criar_pareamento()              to authenticated;
grant execute on function public.encerrar_pareamento(uuid)       to authenticated;
grant execute on function public.conectar_leitor(text)           to anon, authenticated;
grant execute on function public.enviar_leitura(text, text)      to anon, authenticated;
grant execute on function public.desconectar_leitor(text)        to anon, authenticated;

-- Liga o Realtime nas duas tabelas (o notebook escuta as leituras).
alter publication supabase_realtime add table public.pareamentos, public.leituras_celular;

commit;
