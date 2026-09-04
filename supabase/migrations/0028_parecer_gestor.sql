-- Guarda separado o parecer que o GESTOR sugeriu ao finalizar (antes de precisar de aprovação)
-- do parecer_final que só passa a existir de verdade quando um avaliador/admin aprova/finaliza.
-- Sem essa coluna, o parecer do gestor era perdido/sobrescrito assim que o avaliador aprovava.
alter table public.avaliacoes_aplicadas
  add column parecer_gestor public.parecer;
