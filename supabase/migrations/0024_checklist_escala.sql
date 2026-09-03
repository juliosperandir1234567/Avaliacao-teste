-- Checklist com 3 escalas possiveis por secao: Sim/Nao (como ja existia), Sim/Nao/N.A. e
-- 0/5/10/N.A. (com valor do 5 e do 10 configuravel por pergunta, guardado em avaliacao_perguntas.config).
-- Escolha da escala fica na secao (nao por pergunta) porque todo checklist de uma mesma secao
-- usa a mesma escala de resposta.
alter table public.avaliacao_secoes
  add column escala_checklist text not null default 'sim_nao'
  check (escala_checklist in ('sim_nao', 'sim_nao_na', 'zero_cinco_dez_na'));
