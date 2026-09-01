-- Bucket privado para evidencias (fotos) anexadas as respostas das avaliacoes.

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

create policy "evidencias_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias');

create policy "evidencias_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'evidencias');

create policy "evidencias_delete_admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and public.user_role() = 'admin');
