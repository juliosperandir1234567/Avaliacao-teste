-- Script combinado: rode uma unica vez no SQL Editor do Supabase (projeto heqspsizpzjwlgjuguyo)
-- Gerado a partir de supabase/migrations/0001..0006

-- ==== 0001_profiles.sql ====
-- Perfis de acesso (Admin / Avaliador / Gestor) vinculados a auth.users

create type public.user_role as enum ('admin', 'avaliador', 'gestor');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  role public.user_role not null default 'avaliador',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria automaticamente um profile (role padrao 'avaliador') a cada novo usuario do Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper usado pelas policies de RLS em todo o schema.
create or replace function public.user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ==== 0002_colaboradores.sql ====
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

-- ==== 0003_avaliacoes_schema.sql ====
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

-- ==== 0004_aplicacoes_schema.sql ====
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

-- ==== 0005_rls_policies.sql ====
-- Row Level Security baseada em profiles.role (admin / avaliador / gestor)

alter table public.profiles enable row level security;
alter table public.colaboradores enable row level security;
alter table public.candidatos_externos enable row level security;
alter table public.import_batches enable row level security;
alter table public.equipamentos_tipos enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.avaliacao_secoes enable row level security;
alter table public.avaliacao_competencias enable row level security;
alter table public.avaliacao_perguntas enable row level security;
alter table public.avaliacao_alternativas enable row level security;
alter table public.avaliacoes_aplicadas enable row level security;
alter table public.respostas enable row level security;

-- profiles: qualquer usuario autenticado le todos os profiles (para exibir nome do avaliador etc);
-- so o proprio usuario ou um admin pode alterar.
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.user_role() = 'admin');
create policy "profiles_insert_admin" on public.profiles
  for insert to authenticated with check (public.user_role() = 'admin');

-- colaboradores: leitura para todos autenticados; escrita (cadastro/importacao/edicao) so admin.
create policy "colaboradores_select_authenticated" on public.colaboradores
  for select to authenticated using (true);
create policy "colaboradores_write_admin" on public.colaboradores
  for insert to authenticated with check (public.user_role() = 'admin');
create policy "colaboradores_update_admin" on public.colaboradores
  for update to authenticated using (public.user_role() = 'admin');
create policy "colaboradores_delete_admin" on public.colaboradores
  for delete to authenticated using (public.user_role() = 'admin');

-- candidatos_externos: admin e avaliador podem cadastrar/ler; gestor so le.
create policy "candidatos_externos_select_authenticated" on public.candidatos_externos
  for select to authenticated using (true);
create policy "candidatos_externos_insert_admin_avaliador" on public.candidatos_externos
  for insert to authenticated with check (public.user_role() in ('admin', 'avaliador'));
create policy "candidatos_externos_update_admin_avaliador" on public.candidatos_externos
  for update to authenticated using (public.user_role() in ('admin', 'avaliador'));

-- import_batches: somente admin.
create policy "import_batches_admin_all" on public.import_batches
  for all to authenticated
  using (public.user_role() = 'admin')
  with check (public.user_role() = 'admin');

-- equipamentos_tipos: leitura geral, escrita so admin.
create policy "equipamentos_tipos_select_authenticated" on public.equipamentos_tipos
  for select to authenticated using (true);
create policy "equipamentos_tipos_write_admin" on public.equipamentos_tipos
  for insert to authenticated with check (public.user_role() = 'admin');
create policy "equipamentos_tipos_update_admin" on public.equipamentos_tipos
  for update to authenticated using (public.user_role() = 'admin');
create policy "equipamentos_tipos_delete_admin" on public.equipamentos_tipos
  for delete to authenticated using (public.user_role() = 'admin');

-- avaliacoes (templates): admin ve/edita tudo; avaliador e gestor so veem publicadas.
create policy "avaliacoes_select_admin" on public.avaliacoes
  for select to authenticated using (public.user_role() = 'admin');
create policy "avaliacoes_select_publicada" on public.avaliacoes
  for select to authenticated using (status = 'publicada');
create policy "avaliacoes_write_admin" on public.avaliacoes
  for insert to authenticated with check (public.user_role() = 'admin');
create policy "avaliacoes_update_admin" on public.avaliacoes
  for update to authenticated using (public.user_role() = 'admin');
create policy "avaliacoes_delete_admin" on public.avaliacoes
  for delete to authenticated using (public.user_role() = 'admin');

-- secoes/competencias/perguntas/alternativas seguem a visibilidade da avaliacao pai.
create policy "avaliacao_secoes_select" on public.avaliacao_secoes
  for select to authenticated using (
    exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_secoes.avaliacao_id
        and (a.status = 'publicada' or public.user_role() = 'admin')
    )
  );
create policy "avaliacao_secoes_write_admin" on public.avaliacao_secoes
  for all to authenticated
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

create policy "avaliacao_competencias_select" on public.avaliacao_competencias
  for select to authenticated using (
    exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_competencias.avaliacao_id
        and (a.status = 'publicada' or public.user_role() = 'admin')
    )
  );
create policy "avaliacao_competencias_write_admin" on public.avaliacao_competencias
  for all to authenticated
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

create policy "avaliacao_perguntas_select" on public.avaliacao_perguntas
  for select to authenticated using (
    exists (
      select 1 from public.avaliacao_secoes s
      join public.avaliacoes a on a.id = s.avaliacao_id
      where s.id = avaliacao_perguntas.secao_id
        and (a.status = 'publicada' or public.user_role() = 'admin')
    )
  );
create policy "avaliacao_perguntas_write_admin" on public.avaliacao_perguntas
  for all to authenticated
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

create policy "avaliacao_alternativas_select" on public.avaliacao_alternativas
  for select to authenticated using (
    exists (
      select 1 from public.avaliacao_perguntas p
      join public.avaliacao_secoes s on s.id = p.secao_id
      join public.avaliacoes a on a.id = s.avaliacao_id
      where p.id = avaliacao_alternativas.pergunta_id
        and (a.status = 'publicada' or public.user_role() = 'admin')
    )
  );
create policy "avaliacao_alternativas_write_admin" on public.avaliacao_alternativas
  for all to authenticated
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

-- avaliacoes_aplicadas: admin tudo; avaliador CRUD nas proprias; gestor so le.
create policy "avaliacoes_aplicadas_select" on public.avaliacoes_aplicadas
  for select to authenticated using (
    public.user_role() in ('admin', 'gestor') or avaliador_id = auth.uid()
  );
create policy "avaliacoes_aplicadas_insert" on public.avaliacoes_aplicadas
  for insert to authenticated with check (
    public.user_role() = 'admin' or (public.user_role() = 'avaliador' and avaliador_id = auth.uid())
  );
create policy "avaliacoes_aplicadas_update" on public.avaliacoes_aplicadas
  for update to authenticated using (
    public.user_role() = 'admin' or (public.user_role() = 'avaliador' and avaliador_id = auth.uid())
  );

-- respostas: seguem a mesma regra da aplicacao pai.
create policy "respostas_select" on public.respostas
  for select to authenticated using (
    exists (
      select 1 from public.avaliacoes_aplicadas ap
      where ap.id = respostas.aplicacao_id
        and (public.user_role() in ('admin', 'gestor') or ap.avaliador_id = auth.uid())
    )
  );
create policy "respostas_write" on public.respostas
  for all to authenticated
  using (
    exists (
      select 1 from public.avaliacoes_aplicadas ap
      where ap.id = respostas.aplicacao_id
        and (public.user_role() = 'admin' or ap.avaliador_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.avaliacoes_aplicadas ap
      where ap.id = respostas.aplicacao_id
        and (public.user_role() = 'admin' or ap.avaliador_id = auth.uid())
    )
  );

-- ==== 0006_storage.sql ====
-- Bucket privado para evidencias (fotos) anexadas as respostas das avaliacoes.

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

create policy "evidencias_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias');

create policy "evidencias_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'evidencias');

create policy "evidencias_delete_admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and public.user_role() = 'admin');

