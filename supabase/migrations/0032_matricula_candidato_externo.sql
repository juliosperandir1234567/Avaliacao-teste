-- Candidato externo ganha matricula (codigo de identificacao), pra poder ser localizado/atualizado
-- por esse codigo -- igual ja funciona com colaboradores (upsert por matricula) -- e usado tanto
-- pelo acesso rapido (prova sem cadastro completo) quanto pela importacao em massa.
-- Unique permite reaplicar o mesmo cadastro (upsert) sem duplicar; nulo e permitido pra registros
-- antigos que nunca tiveram matricula.
alter table public.candidatos_externos add column matricula text;
alter table public.candidatos_externos add constraint candidatos_externos_matricula_key unique (matricula);
