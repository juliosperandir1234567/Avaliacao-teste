-- Gestor agora responde provas (fila de pendencias no Inicio), mas a policy de update de
-- avaliacoes_aplicadas so deixava reivindicar uma pendencia ('pendente' -> 'em_andamento',
-- gravando avaliador_id) pra quem tem role 'avaliador'. Sem isso, gestor clicava na pendencia
-- e o claimPendenciaSeNecessario falhava silenciosamente na RLS (0 linhas afetadas), o status
-- continuava 'pendente' e a tela de aplicar devolvia ele pro Inicio.
alter policy "avaliacoes_aplicadas_update" on public.avaliacoes_aplicadas
  using (
    public.user_role() = 'admin'
    or avaliador_id = auth.uid()
    or (status = 'pendente' and public.user_role() in ('avaliador', 'gestor'))
  )
  with check (
    public.user_role() = 'admin'
    or avaliador_id = auth.uid()
  );
