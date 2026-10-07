-- Parecer da análise automática editado pelo avaliador. null = usa o texto gerado pelas regras
-- (lib/analise.ts); preenchido = texto revisado à mão, que substitui o automático na tela e no PDF.
alter table public.avaliacoes_aplicadas
  add column if not exists parecer_texto text;
