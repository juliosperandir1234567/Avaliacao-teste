-- A migration 0008 nao foi aplicada de fato neste projeto (mesmo padrao das 0007/0016:
-- tabela "configuracoes" e bucket "branding" nao existiam de verdade, por isso logo e
-- nome da empresa nunca salvavam). Reaplica tudo de forma idempotente e adiciona a
-- imagem de fundo da tela inicial.

create table if not exists public.configuracoes (
  id int primary key default 1,
  nome_empresa text,
  logo_path text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint configuracoes_singleton check (id = 1)
);

insert into public.configuracoes (id) values (1) on conflict (id) do nothing;

drop trigger if exists set_configuracoes_updated_at on public.configuracoes;
create trigger set_configuracoes_updated_at
  before update on public.configuracoes
  for each row execute function public.set_updated_at();

alter table public.configuracoes enable row level security;

drop policy if exists "configuracoes_select_public" on public.configuracoes;
create policy "configuracoes_select_public" on public.configuracoes
  for select to public using (true);

drop policy if exists "configuracoes_update_admin" on public.configuracoes;
create policy "configuracoes_update_admin" on public.configuracoes
  for update to authenticated using (public.user_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

drop policy if exists "branding_select_public" on storage.objects;
create policy "branding_select_public"
  on storage.objects for select to public
  using (bucket_id = 'branding');

drop policy if exists "branding_insert_admin" on storage.objects;
create policy "branding_insert_admin"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.user_role() = 'admin');

drop policy if exists "branding_update_admin" on storage.objects;
create policy "branding_update_admin"
  on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.user_role() = 'admin');

-- Nova: imagem de fundo da tela inicial.
alter table public.configuracoes
  add column if not exists background_path text;
