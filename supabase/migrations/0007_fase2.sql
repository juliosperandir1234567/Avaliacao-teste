-- Fase 2: assinatura digital, trilha de auditoria de correcoes pos-finalizacao

alter table public.avaliacoes_aplicadas
  add column assinatura_avaliado_path text,
  add column assinatura_avaliador_path text;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid not null,
  acao text not null,
  usuario_id uuid references public.profiles(id),
  antes jsonb,
  depois jsonb,
  motivo text,
  created_at timestamptz not null default now()
);

create index audit_log_registro_idx on public.audit_log (tabela, registro_id);

alter table public.audit_log enable row level security;

create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated using (public.user_role() = 'admin');
create policy "audit_log_insert_admin" on public.audit_log
  for insert to authenticated with check (public.user_role() = 'admin');

-- Bucket privado para assinaturas capturadas no encerramento da avaliacao.
insert into storage.buckets (id, name, public)
values ('assinaturas', 'assinaturas', false)
on conflict (id) do nothing;

create policy "assinaturas_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'assinaturas');

create policy "assinaturas_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'assinaturas');
