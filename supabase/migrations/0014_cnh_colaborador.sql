-- Cadastro de interno tambem coleta CNH, igual ja acontecia com externo.

alter table public.colaboradores
  add column possui_cnh boolean,
  add column categoria_cnh text;
