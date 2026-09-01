-- Colaboradores internos, candidatos externos e log de importacao

create table public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  matricula text not null unique,
  nome text not null,
  cargo text not null,
  estrutura text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index colaboradores_nome_idx on public.colaboradores (lower(nome));
create index colaboradores_cargo_idx on public.colaboradores (cargo);
create index colaboradores_estrutura_idx on public.colaboradores (estrutura);

create trigger set_colaboradores_updated_at
  before update on public.colaboradores
  for each row execute function public.set_updated_at();

create table public.candidatos_externos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text,
  data_nascimento date,
  telefone text,
  cidade text,
  funcao_pretendida text,
  experiencia_profissional text,
  tempo_experiencia text,
  empresas_anteriores text,
  maquinas_operadas text,
  possui_cnh boolean,
  categoria_cnh text,
  cursos text,
  treinamentos text,
  observacoes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_candidatos_externos_updated_at
  before update on public.candidatos_externos
  for each row execute function public.set_updated_at();

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'colaboradores',
  total int not null default 0,
  novos int not null default 0,
  existentes int not null default 0,
  alterados int not null default 0,
  erros int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
