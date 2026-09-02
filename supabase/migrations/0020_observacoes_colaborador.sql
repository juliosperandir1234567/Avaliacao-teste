-- Campo de observacao no cadastro de colaborador interno, espelhando o que ja existe em
-- candidatos_externos.observacoes.
alter table public.colaboradores add column observacoes text;
