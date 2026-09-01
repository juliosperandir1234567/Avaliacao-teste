-- Remove da aplicacao os campos de motivo e de equipamento/local/condicoes: nao fazem mais
-- parte do fluxo (cadastro do candidato agora so coleta o essencial e a avaliacao e' auto-matched
-- pela funcao pretendida).

alter table public.avaliacoes_aplicadas
  drop column motivo,
  drop column cargo_atual,
  drop column local,
  drop column equipamento_tipo_id,
  drop column marca,
  drop column modelo,
  drop column identificacao_maquina,
  drop column implemento,
  drop column condicoes_terreno,
  drop column condicoes_climaticas,
  drop column observacoes_iniciais;

drop type public.motivo_avaliacao;
