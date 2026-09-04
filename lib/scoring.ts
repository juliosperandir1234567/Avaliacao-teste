import type {
  AvaliacaoAlternativa,
  AvaliacaoCompetencia,
  AvaliacaoPergunta,
  AvaliacaoSecao,
  ChecklistStatus,
  CriticidadeConsequencia,
  Parecer,
  Resposta,
  RespostaValor,
} from "./types";

/** Indica se o tipo/config da pergunta exige que o avaliador digite a nota manualmente. */
export function precisaCorrecaoManual(p: AvaliacaoPergunta): boolean {
  if (p.tipo === "aberta_curta" || p.tipo === "aberta_longa") return true;
  if ((p.tipo === "verdadeiro_falso" || p.tipo === "sim_nao") && p.config.resposta_correta === undefined)
    return true;
  if (p.tipo === "numerica" && p.config.valor_min === undefined && p.config.valor_max === undefined)
    return true;
  return false;
}

/**
 * Pontuação 0..10 de uma resposta de checklist (item "não avaliado"/N.A. fica de fora do
 * cálculo). `valorParcial` e `valorSim` só importam pra escala 0/5/10/N.A. da seção — nas
 * demais escalas (Sim/Não, com ou sem N.A.) "sim" sempre vale o total (10) e "nao" sempre 0.
 */
export function pontuacaoChecklist(
  status: ChecklistStatus,
  valorParcial = 5,
  valorSim = 10
): number | null {
  switch (status) {
    case "sim":
      return valorSim;
    case "parcial":
      return valorParcial;
    case "nao":
      return 0;
    case "nao_avaliado":
      return null;
  }
}

/**
 * Calcula a pontuação (0..10) de uma resposta a partir da pergunta e do valor informado.
 * Retorna null quando o item não deve entrar no cálculo (não avaliado, ou aberta ainda sem
 * correção manual do avaliador).
 */
export function calcularPontuacaoResposta(
  pergunta: AvaliacaoPergunta,
  valor: RespostaValor | null,
  alternativasCorretas?: Set<string>,
  pontuacaoManual?: number | null
): number | null {
  if (!valor) return null;

  switch (pergunta.tipo) {
    case "checklist": {
      if (!("status" in valor)) return null;
      return pontuacaoChecklist(valor.status, pergunta.config.valor_parcial, pergunta.config.valor_sim);
    }
    case "multipla_escolha": {
      if (!("alternativa_id" in valor) || !valor.alternativa_id) return null;
      if (!alternativasCorretas) return null;
      return alternativasCorretas.has(valor.alternativa_id) ? 10 : 0;
    }
    case "multiplas_respostas": {
      if (!("alternativa_ids" in valor)) return null;
      if (!alternativasCorretas || alternativasCorretas.size === 0) return null;
      const selecionadas = new Set(valor.alternativa_ids);
      if (selecionadas.size === 0) return 0;
      if (!pergunta.config.pontuacao_parcial) {
        const igual =
          selecionadas.size === alternativasCorretas.size &&
          [...selecionadas].every((id) => alternativasCorretas.has(id));
        return igual ? 10 : 0;
      }
      const acertos = [...selecionadas].filter((id) => alternativasCorretas.has(id)).length;
      const erros = [...selecionadas].filter((id) => !alternativasCorretas.has(id)).length;
      const bruto = (acertos - erros) / alternativasCorretas.size;
      return Math.max(0, Math.min(1, bruto)) * 10;
    }
    case "verdadeiro_falso":
    case "sim_nao": {
      if (!("valor_bool" in valor) || valor.valor_bool === null) return null;
      if (pergunta.config.resposta_correta === undefined) {
        // Sem gabarito configurado: pontuação depende de correção manual do avaliador.
        return pontuacaoManual ?? null;
      }
      return valor.valor_bool === pergunta.config.resposta_correta ? 10 : 0;
    }
    case "numerica": {
      if (!("valor_numerico" in valor) || valor.valor_numerico === null) return null;
      const { valor_min, valor_max, tolerancia = 0 } = pergunta.config;
      if (valor_min === undefined && valor_max === undefined) return pontuacaoManual ?? null;
      const min = valor_min !== undefined ? valor_min - tolerancia : -Infinity;
      const max = valor_max !== undefined ? valor_max + tolerancia : Infinity;
      return valor.valor_numerico >= min && valor.valor_numerico <= max ? 10 : 0;
    }
    case "aberta_curta":
    case "aberta_longa":
      // Sempre corrigida manualmente pelo avaliador.
      return pontuacaoManual ?? null;
  }
}

/**
 * Recalcula a pontuação de cada resposta com a configuração ATUAL da pergunta (gabarito, tipo,
 * valores de checklist etc.) em vez de confiar no valor gravado no momento em que foi
 * respondida. Sem isso, editar uma pergunta (corrigir gabarito, trocar tipo, ajustar valor do
 * 5/10 do checklist) depois que já existem respostas deixa a nota antiga "presa" — o Raio-X e o
 * PDF continuam mostrando o número de antes da edição.
 *
 * Perguntas de correção manual (sem gabarito automático) mantêm o valor gravado: ali a nota é o
 * julgamento do avaliador, não tem como recalcular sozinho.
 */
export function recalcularPontuacaoRespostas(
  perguntas: AvaliacaoPergunta[],
  respostas: Resposta[],
  alternativasPorPergunta: Map<string, AvaliacaoAlternativa[]>
): Resposta[] {
  const perguntaPorId = new Map(perguntas.map((p) => [p.id, p]));
  return respostas.map((r) => {
    const pergunta = perguntaPorId.get(r.pergunta_id);
    if (!pergunta || precisaCorrecaoManual(pergunta)) return r;

    const alternativas = alternativasPorPergunta.get(r.pergunta_id);
    const alternativasCorretas = alternativas
      ? new Set(alternativas.filter((a) => a.correta).map((a) => a.id))
      : undefined;
    const pontuacao = calcularPontuacaoResposta(pergunta, r.resposta, alternativasCorretas, r.pontuacao);
    if (pontuacao === r.pontuacao) return r;

    return { ...r, pontuacao, item_critico_falhou: Boolean(pergunta.item_critico) && pontuacao === 0 };
  });
}

export interface FalhaCritica {
  pergunta: AvaliacaoPergunta;
  consequencia: CriticidadeConsequencia;
}

export function avaliarItensCriticos(
  perguntas: AvaliacaoPergunta[],
  respostas: Resposta[]
): FalhaCritica[] {
  const respostaPorPergunta = new Map(respostas.map((r) => [r.pergunta_id, r]));
  const falhas: FalhaCritica[] = [];
  for (const pergunta of perguntas) {
    if (!pergunta.item_critico) continue;
    const resposta = respostaPorPergunta.get(pergunta.id);
    if (!resposta || resposta.pontuacao === null) continue;
    if (resposta.pontuacao === 0) {
      falhas.push({
        pergunta,
        consequencia: pergunta.criticidade_consequencia ?? "alerta",
      });
    }
  }
  return falhas;
}

function mediaPonderada(itens: { peso: number; pontuacao: number | null }[]): number | null {
  const validos = itens.filter((i) => i.pontuacao !== null && i.peso > 0);
  if (validos.length === 0) return null;
  const pesoTotal = validos.reduce((acc, i) => acc + i.peso, 0);
  if (pesoTotal === 0) return null;
  const soma = validos.reduce((acc, i) => acc + i.peso * (i.pontuacao as number), 0);
  return Math.round((soma / pesoTotal) * 10) / 10;
}

export function calcularNotaCompetencia(
  competenciaId: string,
  perguntas: AvaliacaoPergunta[],
  respostas: Resposta[]
): number | null {
  const respostaPorPergunta = new Map(respostas.map((r) => [r.pergunta_id, r]));
  const itens = perguntas
    .filter((p) => p.competencia_id === competenciaId)
    .map((p) => ({ peso: p.peso, pontuacao: respostaPorPergunta.get(p.id)?.pontuacao ?? null }));
  return mediaPonderada(itens);
}

export function calcularNotasPorCompetencia(
  competencias: AvaliacaoCompetencia[],
  perguntas: AvaliacaoPergunta[],
  respostas: Resposta[]
): Record<string, number> {
  const resultado: Record<string, number> = {};
  for (const c of competencias) {
    const nota = calcularNotaCompetencia(c.id, perguntas, respostas);
    if (nota !== null) resultado[c.nome] = nota;
  }
  return resultado;
}

/**
 * Pontuação máxima (na régua de 0 a 10) que uma pergunta pode valer. Pra quase todo tipo é
 * sempre 10 (acerto total = 10, gabarito certo = 10, etc). Checklist é a exceção: o "máximo" é
 * o que a própria pergunta configurou pro 10 (Valor do 10), porque essa escala pode usar
 * qualquer número, não necessariamente 10 — sem isso, uma pergunta configurada com Valor do
 * 10 = 0,5 (por exemplo) puxava a média da seção pra quase zero mesmo sendo respondida
 * perfeitamente.
 */
function maximoPontuacaoPergunta(pergunta: AvaliacaoPergunta): number {
  if (pergunta.tipo === "checklist") return pergunta.config.valor_sim ?? 10;
  return 10;
}

/**
 * Nota de uma seção: soma do que foi obtido dividido pela soma do que era possível obter
 * (excluindo perguntas não respondidas/N.A.), na régua de 0 a 10 — não é mais uma média simples
 * das pontuações, porque isso só funciona se toda pergunta valer 0 a 10; com o Valor do 5/10
 * customizável do checklist, o "máximo" de cada pergunta pode ser outro número, então o
 * aproveitamento tem que ser calculado contra o máximo real de cada uma.
 * "seção vale 3 pontos com 15 itens de 0 a 10 cada" ainda dá cada item valendo 3/15 = 0,20,
 * igual antes — a mudança só aparece quando o máximo de uma pergunta não é 10.
 */
export function calcularNotaSecao(
  secaoId: string,
  perguntas: AvaliacaoPergunta[],
  respostas: Resposta[]
): number | null {
  const respostaPorPergunta = new Map(respostas.map((r) => [r.pergunta_id, r]));
  let somaObtida = 0;
  let somaMaxima = 0;
  for (const p of perguntas) {
    if (p.secao_id !== secaoId) continue;
    const pontuacao = respostaPorPergunta.get(p.id)?.pontuacao ?? null;
    if (pontuacao === null) continue;
    somaObtida += pontuacao;
    somaMaxima += maximoPontuacaoPergunta(p);
  }
  if (somaMaxima === 0) return null;
  return (somaObtida / somaMaxima) * 10;
}

/**
 * Nota geral: média ponderada das seções, onde o peso de cada seção é quantos pontos ela
 * vale (a soma dos pontos das seções sempre é 10).
 */
export function calcularNotaGeral(
  secoes: AvaliacaoSecao[],
  perguntas: AvaliacaoPergunta[],
  respostas: Resposta[]
): number | null {
  const itens = secoes.map((s) => ({
    peso: s.peso,
    pontuacao: calcularNotaSecao(s.id, perguntas, respostas),
  }));
  return mediaPonderada(itens);
}

export interface ParecerInput {
  notaGeral: number | null;
  notaMinima: number;
  competencias: AvaliacaoCompetencia[];
  notasPorCompetencia: Record<string, number>;
  falhasCriticas: FalhaCritica[];
}

/** Regra determinística de apoio à decisão (seção 54) — nunca substitui o avaliador. */
export function gerarParecerSugerido(input: ParecerInput): Parecer | null {
  const { notaGeral, notaMinima, competencias, notasPorCompetencia, falhasCriticas } = input;

  if (falhasCriticas.some((f) => f.consequencia === "nao_recomendar")) {
    return "nao_recomendado";
  }
  if (falhasCriticas.some((f) => f.consequencia === "exigir_nova_avaliacao")) {
    return "nova_avaliacao";
  }
  if (notaGeral === null) return null;

  const competenciaAbaixoDoMinimo = competencias.some((c) => {
    if (c.nota_minima === null) return false;
    const nota = notasPorCompetencia[c.nome];
    return nota !== undefined && nota < c.nota_minima;
  });

  const notaLimitada = falhasCriticas.some((f) => f.consequencia === "limitar_nota");

  if (notaGeral < notaMinima || notaLimitada) {
    return "reprovado";
  }
  if (competenciaAbaixoDoMinimo) {
    return "apto_acompanhamento";
  }
  return "apto";
}
