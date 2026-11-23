-- PASSO 1: rode isto ANTES de criar as tabelas.
-- Mostra o que já existe no banco. Num projeto novo, o resultado vem vazio.
select table_name, table_type
from information_schema.tables
where table_schema = 'public'
order by table_name;
