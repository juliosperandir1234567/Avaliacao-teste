-- A migration 0007 nao foi aplicada de fato neste projeto (colunas de assinatura e
-- tabela de auditoria estavam faltando). Reaplica de forma segura (idempotente).

alter table public.avaliacoes_aplicadas
  add column if not exists assinatura_avaliado_path text,
  add column if not exists assinatura_avaliador_path text;

create table if not exists public.audit_log (
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

create index if not exists audit_log_registro_idx on public.audit_log (tabela, registro_id);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated using (public.user_role() = 'admin');

drop policy if exists "audit_log_insert_admin" on public.audit_log;
create policy "audit_log_insert_admin" on public.audit_log
  for insert to authenticated with check (public.user_role() = 'admin');
