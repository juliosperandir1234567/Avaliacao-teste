-- Assinatura salva de cada usuario (menu do usuario > Minha assinatura). Fica no bucket
-- "assinaturas" em usuarios/<id>/... -- no fim da prova o botao "Usar minha assinatura" copia o
-- arquivo pra pasta da aplicacao, entao trocar a assinatura depois nao altera provas ja assinadas.
-- null = usuario ainda nao salvou assinatura (assina desenhando na hora, como antes).
alter table public.profiles add column if not exists assinatura_path text;
