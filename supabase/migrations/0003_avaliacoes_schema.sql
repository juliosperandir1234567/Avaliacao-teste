-- Banco de avaliacoes: templates (avaliacao -> secoes -> competencias -> perguntas -> alternativas)

create type public.avaliacao_tipo as enum (
  'teorica', 'pratica', 'mista', 'checklist', 'tecnica', 'comportamental', 'competencias'
);

create type public.avaliacao_status as enum (
  'rascunho', 'em_revisao', 'publicada', 'inativa', 'arquivada'
);

create type public.pergunta_tipo as enum (
  'multipla_escolha', 'multiplas_respostas', 'verdadeiro_falso', 'sim_nao',
  'aberta_curta', 'aberta_longa', 'numerica', 'checklist'
);

create type public.criticidade_consequencia as enum (
  'alerta', 'desconto', 'limitar_nota', 'exigir_nova_avaliacao', 'nao_recomendar'
);

-- Familias de equipamento (ex: "Linha Amarela" -> "Escavadeira", "Pa Carregadeira")
create table public.equipamentos_tipos (
  id uuid primary key default gen_random_uuid(),
  familia text not null,
  nome text not null,
  created_at timestamptz not null default now(),
  unique (familia, nome)
);

create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  funcao text not null,
  categoria text,
  tipo public.avaliacao_tipo not null default 'mista',
  descricao text,
  instrucoes_candidato text,
  instrucoes_avaliador text,
  nota_minima numeric(3,1) not null default 6.0,
  tempo_maximo_min int,
  max_tentativas int,
  exige_assinatura boolean not null default false,
  possui_itens_criticos boolean not null default true,
  permite_nova_tentativa boolean not null default true,
  versao int not null default 1,
  status public.avaliacao_status not null default 'rascunho',
  avaliacao_origem_id uuid references public.avaliacoes(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create trigger set_avaliacoes_updated_at
  before update on public.avaliacoes
  for each row execute function public.set_updated_at();

create table public.avaliacao_secoes (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  peso numeric(5,2) not null default 0
);

create table public.avaliacao_competencias (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes(id) on delete cascade,
  nome text not null,
  nota_minima numeric(3,1)
);

create table public.avaliacao_perguntas (
  id uuid primary key default gen_random_uuid(),
  secao_id uuid not null references public.avaliacao_secoes(id) on delete cascade,
  competencia_id uuid references public.avaliacao_competencias(id) on delete set null,
  equipamento_tipo_id uuid references public.equipamentos_tipos(id) on delete set null,
  tipo public.pergunta_tipo not null,
  enunciado text not null,
  peso numeric(5,2) not null default 1,
  ordem int not null default 0,
  item_critico boolean not null default false,
  criticidade_consequencia public.criticidade_consequencia,
  config jsonb not null default '{}'::jsonb,
  evidencia_obrigatoria boolean not null default false,
  observacao_obrigatoria_se_nao boolean not null default false,
  created_at timestamptz not null default now()
);

create index avaliacao_perguntas_secao_idx on public.avaliacao_perguntas (secao_id);
create index avaliacao_perguntas_equipamento_idx on public.avaliacao_perguntas (equipamento_tipo_id);

create table public.avaliacao_alternativas (
  id uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null references public.avaliacao_perguntas(id) on delete cascade,
  texto text not null,
  correta boolean not null default false,
  ordem int not null default 0
);

create index avaliacao_alternativas_pergunta_idx on public.avaliacao_alternativas (pergunta_id);
