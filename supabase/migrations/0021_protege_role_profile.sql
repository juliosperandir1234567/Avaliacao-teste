-- A policy "profiles_update_self_or_admin" deixa qualquer usuario autenticado atualizar a
-- propria linha em profiles, mas RLS so controla QUAL linha pode ser alterada -- nao QUAIS
-- colunas. Sem essa trigger, qualquer usuario logado podia chamar
-- supabase.from('profiles').update({ role: 'admin' }).eq('id', meuId) direto pelo client e se
-- promover a admin sozinho, contornando toda checagem de role feita nas telas/actions.
create or replace function public.protege_role_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.user_role() <> 'admin' then
    new.role := old.role;
    new.ativo := old.ativo;
  end if;
  return new;
end;
$$;

create trigger protege_role_profile_trigger
  before update on public.profiles
  for each row
  execute function public.protege_role_profile();
