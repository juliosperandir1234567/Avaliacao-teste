-- Recria os buckets de storage que deveriam ter sido criados nas migrations 0006/0007,
-- caso nao existam de fato no projeto (idempotente - seguro rodar de novo).

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('assinaturas', 'assinaturas', false)
on conflict (id) do nothing;

drop policy if exists "evidencias_insert_authenticated" on storage.objects;
create policy "evidencias_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias');

drop policy if exists "evidencias_select_authenticated" on storage.objects;
create policy "evidencias_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'evidencias');

drop policy if exists "evidencias_delete_admin" on storage.objects;
create policy "evidencias_delete_admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and public.user_role() = 'admin');

drop policy if exists "assinaturas_insert_authenticated" on storage.objects;
create policy "assinaturas_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'assinaturas');

drop policy if exists "assinaturas_select_authenticated" on storage.objects;
create policy "assinaturas_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'assinaturas');
