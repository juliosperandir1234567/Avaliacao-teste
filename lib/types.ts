// Tipos alinhados ao schema em supabase/migrations/*.sql

export type UserRole = "admin" | "avaliador" | "gestor" | "recrutamento";

export interface Profile {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
}

export interface Colaborador {
  id: string;
  matricula: string;
  nome: string;
  cargo: string;
  estrutura: string;
  possui_cnh: boolean | null;
  categoria_cnh: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CandidatoExterno {
  id: string;
  nome: string;
  cpf: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  cidade: string | null;
  funcao_pretendida: string | null;
  experiencia_profissional: string | null;
  tempo_experiencia: string | null;
  empresas_anteriores: string | null;
  maquinas_operadas: string | null;
  possui_cnh: boolean | null;
  categoria_cnh: string | null;
  cursos: string | null;
  treinamentos: string | null;
  observacoes: string | null;
  created_at: string;
}

export type AvaliacaoTipo =
  | "teorica"
  | "pratica"
  | "mista"
  | "checklist"
  | "tecnica"
  | "comportamental"
  | "competencias";

export type AvaliacaoStatus =
  | "rascunho"
  | "em_revisao"
  | "publicada"
  | "inativa"
  | "arquivada";

export type PerguntaTipo =
  | "multipla_escolha"
  | "multiplas_respostas"
  | "verdadeiro_falso"
  | "sim_nao"
  | "aberta_curta"
  | "aberta_longa"
  | "numerica"
  | "checklist";

export type CriticidadeConsequencia =
  | "alerta"
  | "desconto"
  | "limitar_nota"
  | "exigir_nova_avaliacao"
  | "nao_recomendar";

export interface EquipamentoTipo {
  id: string;
  familia: string;
  nome: string;
}

export interface Avaliacao {
  id: string;
  nome: string;
  funcao: string;
  categoria: string | null;
  tipo: AvaliacaoTipo;
  descricao: string | null;
  instrucoes_candidato: string | null;
  instrucoes_avaliador: string | null;
  nota_minima: number;
  tempo_maximo_min: number | null;
  max_tentativas: number | null;
  equipamento_tipo_id: string | null;
  exige_assinatura: boolean;
  possui_itens_criticos: boolean;
  permite_nova_tentativa: boolean;
  versao: number;
  status: AvaliacaoStatus;
  avaliacao_origem_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface AvaliacaoSecao {
  id: string;
  avaliacao_id: string;
  nome: string;
  ordem: number;
  peso: number;
}

export interface AvaliacaoCompetencia {
  id: string;
  avaliacao_id: string;
  nome: string;
  nota_minima: number | null;
}

export interface PerguntaConfigChecklist {
  escala?: "sim_nao_na" | "sim_parcial_nao_na";
}
export interface PerguntaConfigNumerica {
  unidade?: string;
  valor_min?: number;
  valor_max?: number;
  tolerancia?: number;
}
export interface PerguntaConfigAberta {
  criterios_esperados?: string;
}
export interface PerguntaConfigObjetiva {
  resposta_correta?: boolean;
  pontuacao_parcial?: boolean;
}

export interface PerguntaConfigCondicional {
  condicional_pergunta_id?: string;
  condicional_valor?: string;
}

export interface PerguntaConfigImagem {
  imagem_path?: string;
}

export interface PerguntaConfigImportacao {
  precisa_revisao?: boolean;
}

export type PerguntaConfig = PerguntaConfigChecklist &
  PerguntaConfigNumerica &
  PerguntaConfigAberta &
  PerguntaConfigObjetiva &
  PerguntaConfigCondicional &
  PerguntaConfigImagem &
  PerguntaConfigImportacao;

export interface AvaliacaoPergunta {
  id: string;
  secao_id: string;
  competencia_id: string | null;
  equipamento_tipo_id: string | null;
  tipo: PerguntaTipo;
  enunciado: string;
  peso: number;
  ordem: number;
  item_critico: boolean;
  criticidade_consequencia: CriticidadeConsequencia | null;
  config: PerguntaConfig;
  evidencia_obrigatoria: boolean;
  observacao_obrigatoria_se_nao: boolean;
}

export interface AvaliacaoAlternativa {
  id: string;
  pergunta_id: string;
  texto: string;
  correta: boolean;
  ordem: number;
}

export type TipoPessoa = "interno" | "externo";

export type AplicacaoStatus =
  | "pendente"
  | "em_andamento"
  | "aguardando_parecer"
  | "finalizada"
  | "cancelada";

export const APLICACAO_STATUS_LABELS: Record<AplicacaoStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aguardando_parecer: "Aguardando parecer",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export type Parecer =
  | "apto"
  | "apto_acompanhamento"
  | "reprovado"
  | "necessita_treinamento"
  | "nova_avaliacao"
  | "nao_recomendado";

export interface ColaboradorSnapshot {
  matricula: string;
  nome: string;
  cargo: string;
  estrutura: string;
  possui_cnh?: boolean | null;
  categoria_cnh?: string | null;
}

export interface AvaliacaoAplicada {
  id: string;
  avaliacao_id: string;
  avaliacao_versao: number;
  tipo_pessoa: TipoPessoa;
  colaborador_id: string | null;
  colaborador_snapshot: ColaboradorSnapshot | null;
  candidato_externo_id: string | null;
  funcao_avaliada: string;
  data: string;
  horario: string;
  avaliador_id: string | null;
  criado_por: string | null;
  status: AplicacaoStatus;
  interrompida_seguranca: boolean;
  motivo_interrupcao: string | null;
  nota_geral: number | null;
  notas_por_competencia: Record<string, number> | null;
  falhas_criticas_count: number;
  parecer_sugerido: Parecer | null;
  parecer_final: Parecer | null;
  parecer_justificativa: string | null;
  finalizada_em: string | null;
  finalizada_por: string | null;
  assinatura_avaliado_path: string | null;
  assinatura_avaliador_path: string | null;
}

export interface AuditLogEntry {
  id: string;
  tabela: string;
  registro_id: string;
  acao: string;
  usuario_id: string | null;
  antes: unknown;
  depois: unknown;
  motivo: string | null;
  created_at: string;
}

export type ChecklistStatus = "sim" | "nao" | "parcial" | "nao_avaliado";

export type RespostaValor =
  | { alternativa_id: string | null }
  | { alternativa_ids: string[] }
  | { valor_bool: boolean | null }
  | { texto: string }
  | { valor_numerico: number | null }
  | { status: ChecklistStatus };

export interface Resposta {
  id: string;
  aplicacao_id: string;
  pergunta_id: string;
  tipo: PerguntaTipo;
  resposta: RespostaValor | null;
  correta: boolean | null;
  pontuacao: number | null;
  observacao: string | null;
  evidencias: string[];
  item_critico_falhou: boolean;
}

export const PARECER_LABELS: Record<Parecer, string> = {
  apto: "Apto",
  apto_acompanhamento: "Apto com acompanhamento",
  reprovado: "Reprovado",
  necessita_treinamento: "Necessita treinamento",
  nova_avaliacao: "Nova avaliação",
  nao_recomendado: "Não recomendado no momento",
};

export const PERGUNTA_TIPO_LABELS: Record<PerguntaTipo, string> = {
  multipla_escolha: "Resposta única",
  multiplas_respostas: "Múltipla escolha",
  verdadeiro_falso: "Verdadeiro ou falso",
  sim_nao: "Sim ou não",
  aberta_curta: "Resposta curta",
  aberta_longa: "Resposta escrita",
  numerica: "Numérica",
  checklist: "Checklist",
};

/** Tipos oferecidos no construtor. Os demais tipos continuam funcionando (dados antigos,
 * banco de questões, relatórios) mas ficam fora da lista para simplificar a criação.
 * "Múltipla escolha" (multiplas_respostas) permite marcar mais de uma alternativa certa;
 * "Resposta única" (multipla_escolha) permite marcar só uma. */
export const TIPOS_PERGUNTA_DISPONIVEIS: PerguntaTipo[] = [
  "multiplas_respostas",
  "multipla_escolha",
  "aberta_longa",
  "sim_nao",
  "checklist",
];
