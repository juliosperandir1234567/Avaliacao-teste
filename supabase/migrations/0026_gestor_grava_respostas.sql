-- Mesma causa do problema anterior (0025): a policy de escrita em "respostas" só liberava
-- gravar quando avaliador_id da aplicacao bate com o usuario logado (ou admin). Isso cobre o
-- avaliador que reivindicou a pendencia, mas deixa de fora qualquer caso em que o gestor acaba
-- respondendo uma aplicacao cujo avaliador_id ainda nao e o dele (ex: aplicacao que ja estava
-- em andamento por outro motivo). Alinha com a policy de leitura, que ja liberava gestor.
alter policy "respostas_write" on public.respostas
  using (
    exists (
      select 1 from public.avaliacoes_aplicadas ap
      where ap.id = respostas.aplicacao_id
        and (public.user_role() in ('admin', 'gestor') or ap.avaliador_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.avaliacoes_aplicadas ap
      where ap.id = respostas.aplicacao_id
        and (public.user_role() in ('admin', 'gestor') or ap.avaliador_id = auth.uid())
    )
  );
