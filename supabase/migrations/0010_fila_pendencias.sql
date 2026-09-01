-- Fila de pendencias: cadastro de teste (recrutamento) cria uma linha sem avaliador definido
-- (status 'pendente'); qualquer avaliador pode assumir (pool aberto).
-- Rodar depois da 0009 (usa os valores de enum criados la).

alter table public.avaliacoes_aplicadas
  alter column avaliador_id drop not null;

alter table public.avaliacoes_aplicadas
  add column criado_por uuid references public.profiles(id);

update public.avaliacoes_aplicadas
  set criado_por = avaliador_id
  where criado_por is null;

alter table public.avaliacoes_aplicadas
  alter column status set default 'pendente';

alter table public.avaliacoes_aplicadas
  add constraint aplicacao_avaliador_check check (
    status = 'pendente' or avaliador_id is not null
  );

-- RLS: substitui as policies de select/insert/update de avaliacoes_aplicadas (0005_rls_policies.sql)
drop policy "avaliacoes_aplicadas_select" on public.avaliacoes_aplicadas;
create policy "avaliacoes_aplicadas_select" on public.avaliacoes_aplicadas
  for select to authenticated using (
    public.user_role() in ('admin', 'gestor', 'recrutamento')
    or avaliador_id = auth.uid()
    or status = 'pendente'
  );

drop policy "avaliacoes_aplicadas_insert" on public.avaliacoes_aplicadas;
create policy "avaliacoes_aplicadas_insert" on public.avaliacoes_aplicadas
  for insert to authenticated with check (
    public.user_role() = 'admin'
    or (
      public.user_role() = 'recrutamento'
      and status = 'pendente'
      and avaliador_id is null
      and criado_por = auth.uid()
    )
  );

drop policy "avaliacoes_aplicadas_update" on public.avaliacoes_aplicadas;
create policy "avaliacoes_aplicadas_update" on public.avaliacoes_aplicadas
  for update to authenticated using (
    public.user_role() = 'admin'
    or avaliador_id = auth.uid()
    or (status = 'pendente' and public.user_role() = 'avaliador')
  )
  with check (
    public.user_role() = 'admin'
    or avaliador_id = auth.uid()
  );

-- respostas: recrutamento tambem pode ler (Raio-X / PDF de qualquer aplicacao)
drop policy "respostas_select" on public.respostas;
create policy "respostas_select" on public.respostas
  for select to authenticated using (
    exists (
      select 1 from public.avaliacoes_aplicadas ap
      where ap.id = respostas.aplicacao_id
        and (public.user_role() in ('admin', 'gestor', 'recrutamento') or ap.avaliador_id = auth.uid())
    )
  );

-- candidatos_externos: recrutamento cadastra/edita; avaliador nao cadastra mais diretamente.
drop policy "candidatos_externos_insert_admin_avaliador" on public.candidatos_externos;
create policy "candidatos_externos_insert_admin_recrutamento" on public.candidatos_externos
  for insert to authenticated with check (public.user_role() in ('admin', 'recrutamento'));

drop policy "candidatos_externos_update_admin_avaliador" on public.candidatos_externos;
create policy "candidatos_externos_update_admin_recrutamento" on public.candidatos_externos
  for update to authenticated using (public.user_role() in ('admin', 'recrutamento'));
