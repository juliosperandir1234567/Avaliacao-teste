-- Reminder de foto da CNH virou um upload de verdade (ver aplicacao-runner.tsx) -- precisa de
-- onde gravar o caminho do arquivo, igual ja existe pras assinaturas (ver 0016).
alter table public.avaliacoes_aplicadas
  add column if not exists foto_cnh_path text;
