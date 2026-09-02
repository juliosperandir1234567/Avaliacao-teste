-- Faltava a policy de DELETE em avaliacoes_aplicadas. Sem nenhuma policy pro comando DELETE,
-- RLS nega por padrao -- mas o DELETE nao retorna erro, so afeta 0 linhas (comportamento padrao
-- do Postgres com row level security), por isso excluir candidato mostrava "sucesso" mas o nome
-- continuava na lista.
create policy "avaliacoes_aplicadas_delete" on public.avaliacoes_aplicadas
  for delete to authenticated using (
    public.user_role() = 'admin' or (public.user_role() = 'avaliador' and avaliador_id = auth.uid())
  );
