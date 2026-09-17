-- Bug: "Data/Hora" da aplicacao saia errado (ate ~3h de diferenca e, perto da meia-noite, o dia
-- errado). Causa: os defaults de "data"/"horario" usavam current_date/current_time, que seguem o
-- timezone da sessao do banco -- no Supabase isso e UTC, nao o horario de Brasilia (America/Sao_Paulo).
-- current_time tambem trazia microssegundos (ex: "00:48:18.907323"), exibido cru no relatorio/raio-x.
-- Fix: default calcula explicitamente em America/Sao_Paulo, com horario truncado no segundo.
alter table public.avaliacoes_aplicadas
  alter column data set default ((now() at time zone 'America/Sao_Paulo')::date),
  alter column horario set default ((now() at time zone 'America/Sao_Paulo')::time(0));
