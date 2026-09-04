-- Continuação do ajuste em 0025: a policy de update de avaliacoes_aplicadas ainda dependia de
-- avaliador_id bater com quem está atualizando (fora do caso especial de reivindicar pendência),
-- o que quebrava dois fluxos novos:
--   1) finalizarAplicacao de um gestor numa aplicacao cujo avaliador_id nao e o dele (o update
--      "passava" sem erro, mas nao afetava nenhuma linha, e o usuario via mensagem de sucesso
--      mesmo nada tendo mudado -- ver checagem de linha afetada em finalizarAplicacao/actions.ts).
--   2) aprovarAplicacao: QUALQUER avaliador (ou admin) deve poder aprovar uma prova respondida
--      por um gestor, mas o avaliador_id daquela prova continua sendo o do gestor -- um avaliador
--      diferente nunca bateria em "avaliador_id = auth.uid()".
-- Solucao: gestor e avaliador passam a ter acesso de update igual ao admin (a UI/as server
-- actions continuam controlando exatamente quais campos cada fluxo altera). Recrutamento
-- continua sem nenhum acesso de escrita aqui, como sempre foi.
alter policy "avaliacoes_aplicadas_update" on public.avaliacoes_aplicadas
  using (
    public.user_role() in ('admin', 'gestor', 'avaliador')
    or avaliador_id = auth.uid()
  )
  with check (
    public.user_role() in ('admin', 'gestor', 'avaliador')
    or avaliador_id = auth.uid()
  );
