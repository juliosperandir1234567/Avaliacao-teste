-- Dashboard, Exportar e Candidatos sao paineis de relatorio geral, nao trabalho pessoal --
-- restringir a leitura de avaliacoes_aplicadas a "so o que eu mesmo apliquei" deixava esses
-- paineis incompletos pra avaliador e recrutamento (viam so a fila de pendencias + as proprias
-- aplicacoes). Agora qualquer usuario autenticado ve todas as aplicacoes, igual gestor/admin ja
-- viam. Escrita (update/insert/delete) continua restrita como estava, so a leitura mudou.
alter policy "avaliacoes_aplicadas_select" on public.avaliacoes_aplicadas
  using (true);

-- respostas alimenta o dashboard (ranking de falhas criticas) -- mesma restricao, mesmo motivo.
alter policy "respostas_select" on public.respostas
  using (true);
