-- Rastreia quando cada aplicacao finalizada foi incluida num export em ZIP de PDFs,
-- pra alimentar o painel de exportacao (previa exclui as ja exportadas por padrao,
-- e existe uma lista separada das ultimas exportacoes).

alter table public.avaliacoes_aplicadas
  add column exportado_em timestamptz;
