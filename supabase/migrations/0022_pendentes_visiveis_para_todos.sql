-- A fila de pendencias (status = 'pendente', ainda sem avaliador atribuido) precisa ser
-- visivel pra qualquer usuario autenticado, nao so admin/gestor/quem ja reivindicou -- senao
-- avaliador e recrutamento nunca veem os itens novos (nem no selo do menu Inicio, nem na
-- fila em si), porque avaliador_id fica nulo ate alguem comecar a aplicar a prova.
alter policy "avaliacoes_aplicadas_select" on public.avaliacoes_aplicadas
  using (
    public.user_role() in ('admin', 'gestor') or avaliador_id = auth.uid() or status = 'pendente'
  );
