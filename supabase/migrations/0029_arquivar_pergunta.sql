-- Pergunta "arquivada" some do construtor e de provas novas, mas continua intacta pra quem ja
-- respondeu (Raio-X/PDF de provas antigas) -- alternativa a excluir de verdade, que trava por
-- causa de respostas ja registradas (FK avaliacao_perguntas <- respostas, sem cascade).
alter table public.avaliacao_perguntas
  add column arquivada boolean not null default false;
