-- Novos valores de enum: papel "recrutamento" e status "pendente" (fila de pendencias).
-- Precisa rodar sozinha (colar e executar) antes da 0010: um valor novo de enum nao pode
-- ser usado na mesma transacao em que foi criado.

alter type public.user_role add value 'recrutamento';
alter type public.aplicacao_status add value 'pendente';
