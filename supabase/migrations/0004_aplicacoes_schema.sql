-- Aplicacoes reais de avaliacao (instancias) e respostas

create type public.tipo_pessoa as enum ('interno', 'externo');

create type public.motivo_avaliacao as enum (
  'selecao_externa', 'selecao_interna', 'promocao', 'mudanca_funcao',
  'movimentacao', 'periodica', 'reciclagem', 'retorno_funcao',
  'validacao_tecnica', 'outro'
);

create type public.aplicacao_status as enum (
  'em_andamento', 'aguardando_parecer', 'finalizada', 'cancelada'
);

create type public.parecer as enum (
  'apto', 'apto_acompanhamento', 'necessita_treinamento', 'nova_avaliacao', 'nao_recomendado'
);

create table public.avaliacoes_aplicadas (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes(id),
  avaliacao_versao int not null,
  tipo_pessoa public.tipo_pessoa not null,
  colaborador_id uuid references public.colaboradores(id),
  colaborador_snapshot jsonb,
  candidato_externo_id uuid references public.candidatos_externos(id),
  motivo public.motivo_avaliacao not null,
  cargo_atual text,
  funcao_avaliada text not null,
  data date not null default current_date,
  horario time not null default current_time,
  avaliador_id uuid not null references public.profiles(id),
  local text,
  equipamento_tipo_id uuid references public.equipamentos_tipos(id),
  marca text,
  modelo text,
  identificacao_maquina text,
  implemento text,
  condicoes_terreno text,
  condicoes_climaticas text,
  observacoes_iniciais text,
  status public.aplicacao_status not null default 'em_andamento',
  interrompida_seguranca boolean not null default false,
  motivo_interrupcao text,
  nota_geral numeric(3,1),
  notas_por_competencia jsonb,
  falhas_criticas_count int not null default 0,
  parecer_sugerido public.parecer,
  parecer_final public.parecer,
  parecer_justificativa text,
  finalizada_em timestamptz,
  finalizada_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aplicacao_pessoa_check check (
    (tipo_pessoa = 'interno' and colaborador_id is not null and candidato_externo_id is null) or
    (tipo_pessoa = 'externo' and candidato_externo_id is not null and colaborador_id is null)
  )
);

create index avaliacoes_aplicadas_colaborador_idx on public.avaliacoes_aplicadas (colaborador_id);
create index avaliacoes_aplicadas_candidato_idx on public.avaliacoes_aplicadas (candidato_externo_id);
create index avaliacoes_aplicadas_avaliador_idx on public.avaliacoes_aplicadas (avaliador_id);
create index avaliacoes_aplicadas_avaliacao_idx on public.avaliacoes_aplicadas (avaliacao_id);

create trigger set_avaliacoes_aplicadas_updated_at
  before update on public.avaliacoes_aplicadas
  for each row execute function public.set_updated_at();

create table public.respostas (
  id uuid primary key default gen_random_uuid(),
  aplicacao_id uuid not null references public.avaliacoes_aplicadas(id) on delete cascade,
  pergunta_id uuid not null references public.avaliacao_perguntas(id),
  tipo public.pergunta_tipo not null,
  resposta jsonb,
  correta boolean,
  pontuacao numeric(5,2),
  observacao text,
  evidencias text[] not null default '{}',
  item_critico_falhou boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (aplicacao_id, pergunta_id)
);

create index respostas_aplicacao_idx on public.respostas (aplicacao_id);

create trigger set_respostas_updated_at
  before update on public.respostas
  for each row execute function public.set_updated_at();
