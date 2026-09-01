-- O equipamento passa a ser escolhido na criacao da avaliacao (nao mais por aplicacao,
-- que nao existe mais desde a 0011). Perguntas com equipamento_tipo_id especifico so entram
-- na prova quando bate com o equipamento da avaliacao.

alter table public.avaliacoes
  add column equipamento_tipo_id uuid references public.equipamentos_tipos(id);
