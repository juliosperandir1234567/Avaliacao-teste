-- Mesmo problema do parecer_gestor (0028): a observacao que o gestor escreve ao finalizar
-- ficava gravada em parecer_justificativa e era perdida/sobrescrita quando o avaliador
-- aprovava e escrevia a observacao dele. Agora fica separada: observacao_gestor guarda o que
-- o gestor escreveu, parecer_justificativa passa a ser so a observacao do avaliador/admin.
alter table public.avaliacoes_aplicadas
  add column observacao_gestor text;
