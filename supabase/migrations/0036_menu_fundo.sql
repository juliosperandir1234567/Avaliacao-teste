-- Imagem de fundo do menu lateral (Configuracoes > Identidade visual). Fica no bucket "branding",
-- igual logo_path/background_path. null = menu com o fundo padrao.
alter table public.configuracoes add column if not exists menu_fundo_path text;
