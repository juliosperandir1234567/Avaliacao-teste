-- Painel de configuracoes (singleton) e bucket publico para logo da empresa.

create table public.configuracoes (
  id int primary key default 1,
  nome_empresa text,
  logo_path text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint configuracoes_singleton check (id = 1)
);

insert into public.configuracoes (id) values (1);

create trigger set_configuracoes_updated_at
  before update on public.configuracoes
  for each row execute function public.set_updated_at();

alter table public.configuracoes enable row level security;

-- Publica (logo/nome aparecem na tela de login, antes da autenticacao).
create policy "configuracoes_select_public" on public.configuracoes
  for select to public using (true);
create policy "configuracoes_update_admin" on public.configuracoes
  for update to authenticated using (public.user_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy "branding_select_public"
  on storage.objects for select to public
  using (bucket_id = 'branding');

create policy "branding_insert_admin"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.user_role() = 'admin');

create policy "branding_update_admin"
  on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.user_role() = 'admin');
