-- Row Level Security baseada em profiles.role (admin / avaliador / gestor)

alter table public.profiles enable row level security;
alter table public.colaboradores enable row level security;
alter table public.candidatos_externos enable row level security;
alter table public.import_batches enable row level security;
alter table public.equipamentos_tipos enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.avaliacao_secoes enable row level security;
alter table public.avaliacao_competencias enable row level security;
alter table public.avaliacao_perguntas enable row level security;
alter table public.avaliacao_alternativas enable row level security;
alter table public.avaliacoes_aplicadas enable row level security;
alter table public.respostas enable row level security;

-- profiles: qualquer usuario autenticado le todos os profiles (para exibir nome do avaliador etc);
-- so o proprio usuario ou um admin pode alterar.
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.user_role() = 'admin');
create policy "profiles_insert_admin" on public.profiles
  for insert to authenticated with check (public.user_role() = 'admin');

-- colaboradores: leitura para todos autenticados; escrita (cadastro/importacao/edicao) so admin.
create policy "colaboradores_select_authenticated" on public.colaboradores
  for select to authenticated using (true);
create policy "colaboradores_write_admin" on public.colaboradores
  for insert to authenticated with check (public.user_role() = 'admin');
create policy "colaboradores_update_admin" on public.colaboradores
  for update to authenticated using (public.user_role() = 'admin');
create policy "colaboradores_delete_admin" on public.colaboradores
  for delete to authenticated using (public.user_role() = 'admin');

-- candidatos_externos: admin e avaliador podem cadastrar/ler; gestor so le.
create policy "candidatos_externos_select_authenticated" on public.candidatos_externos
  for select to authenticated using (true);
create policy "candidatos_externos_insert_admin_avaliador" on public.candidatos_externos
  for insert to authenticated with check (public.user_role() in ('admin', 'avaliador'));
create policy "candidatos_externos_update_admin_avaliador" on public.candidatos_externos
  for update to authenticated using (public.user_role() in ('admin', 'avaliador'));

-- import_batches: somente admin.
create policy "import_batches_admin_all" on public.import_batches
  for all to authenticated
  using (public.user_role() = 'admin')
  with check (public.user_role() = 'admin');

-- equipamentos_tipos: leitura geral, escrita so admin.
create policy "equipamentos_tipos_select_authenticated" on public.equipamentos_tipos
  for select to authenticated using (true);
create policy "equipamentos_tipos_write_admin" on public.equipamentos_tipos
  for insert to authenticated with check (public.user_role() = 'admin');
create policy "equipamentos_tipos_update_admin" on public.equipamentos_tipos
  for update to authenticated using (public.user_role() = 'admin');
create policy "equipamentos_tipos_delete_admin" on public.equipamentos_tipos
  for delete to authenticated using (public.user_role() = 'admin');

-- avaliacoes (templates): admin ve/edita tudo; avaliador e gestor so veem publicadas.
create policy "avaliacoes_select_admin" on public.avaliacoes
  for select to authenticated using (public.user_role() = 'admin');
create policy "avaliacoes_select_publicada" on public.avaliacoes
  for select to authenticated using (status = 'publicada');
create policy "avaliacoes_write_admin" on public.avaliacoes
  for insert to authenticated with check (public.user_role() = 'admin');
create policy "avaliacoes_update_admin" on public.avaliacoes
  for update to authenticated using (public.user_role() = 'admin');
create policy "avaliacoes_delete_admin" on public.avaliacoes
  for delete to authenticated using (public.user_role() = 'admin');

-- secoes/competencias/perguntas/alternativas seguem a visibilidade da avaliacao pai.
create policy "avaliacao_secoes_select" on public.avaliacao_secoes
  for select to authenticated using (
    exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_secoes.avaliacao_id
        and (a.status = 'publicada' or public.user_role() = 'admin')
    )
  );
create policy "avaliacao_secoes_write_admin" on public.avaliacao_secoes
  for all to authenticated
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

create policy "avaliacao_competencias_select" on public.avaliacao_competencias
  for select to authenticated using (
    exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_competencias.avaliacao_id
        and (a.status = 'publicada' or public.user_role() = 'admin')
    )
  );
create policy "avaliacao_competencias_write_admin" on public.avaliacao_competencias
  for all to authenticated
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

create policy "avaliacao_perguntas_select" on public.avaliacao_perguntas
  for select to authenticated using (
    exists (
      select 1 from public.avaliacao_secoes s
      join public.avaliacoes a on a.id = s.avaliacao_id
      where s.id = avaliacao_perguntas.secao_id
        and (a.status = 'publicada' or public.user_role() = 'admin')
    )
  );
create policy "avaliacao_perguntas_write_admin" on public.avaliacao_perguntas
  for all to authenticated
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

create policy "avaliacao_alternativas_select" on public.avaliacao_alternativas
  for select to authenticated using (
    exists (
      select 1 from public.avaliacao_perguntas p
      join public.avaliacao_secoes s on s.id = p.secao_id
      join public.avaliacoes a on a.id = s.avaliacao_id
      where p.id = avaliacao_alternativas.pergunta_id
        and (a.status = 'publicada' or public.user_role() = 'admin')
    )
  );
create policy "avaliacao_alternativas_write_admin" on public.avaliacao_alternativas
  for all to authenticated
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

-- avaliacoes_aplicadas: admin tudo; avaliador CRUD nas proprias; gestor so le.
create policy "avaliacoes_aplicadas_select" on public.avaliacoes_aplicadas
  for select to authenticated using (
    public.user_role() in ('admin', 'gestor') or avaliador_id = auth.uid()
  );
create policy "avaliacoes_aplicadas_insert" on public.avaliacoes_aplicadas
  for insert to authenticated with check (
    public.user_role() = 'admin' or (public.user_role() = 'avaliador' and avaliador_id = auth.uid())
  );
create policy "avaliacoes_aplicadas_update" on public.avaliacoes_aplicadas
  for update to authenticated using (
    public.user_role() = 'admin' or (public.user_role() = 'avaliador' and avaliador_id = auth.uid())
  );

-- respostas: seguem a mesma regra da aplicacao pai.
create policy "respostas_select" on public.respostas
  for select to authenticated using (
    exists (
      select 1 from public.avaliacoes_aplicadas ap
      where ap.id = respostas.aplicacao_id
        and (public.user_role() in ('admin', 'gestor') or ap.avaliador_id = auth.uid())
    )
  );
create policy "respostas_write" on public.respostas
  for all to authenticated
  using (
    exists (
      select 1 from public.avaliacoes_aplicadas ap
      where ap.id = respostas.aplicacao_id
        and (public.user_role() = 'admin' or ap.avaliador_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.avaliacoes_aplicadas ap
      where ap.id = respostas.aplicacao_id
        and (public.user_role() = 'admin' or ap.avaliador_id = auth.uid())
    )
  );
