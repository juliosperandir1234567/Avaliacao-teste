import { avaliarItensCriticos, calcularNotaGeral, calcularNotaSecao } from "./scoring";
import { PARECER_LABELS } from "./types";
import type { AvaliacaoPergunta, AvaliacaoSecao, Parecer, Resposta } from "./types";

/**
 * Análise automática do resultado (sem IA): monta um resumo por regras fixas a partir das
 * respostas já pontuadas -- aproveitamento por seção, pontos fortes, pontos a melhorar e um
 * parecer em texto. Usado no Raio-X e no PDF do relatório.
 */

export type NivelSecao = "forte" | "adequado" | "atencao";

export const NIVEL_LABELS: Record<NivelSecao, string> = {
  forte: "Ponto forte",
  adequado: "Adequado",
  atencao: "Atenção",
};

export const NIVEL_CORES: Record<NivelSecao, string> = {
  forte: "#15803d",
  adequado: "#ca8a04",
  atencao: "#b91c1c",
};

/** Aproveitamento (%) mínimo de cada nível. */
const LIMITE_FORTE = 80;
const LIMITE_ADEQUADO = 60;
/** Aprovado com nota abaixo disso vira "Aprovado com ressalvas". */
const NOTA_SEM_RESSALVAS = 7;

export interface AnaliseSecao {
  nome: string;
  percentual: number;
  nivel: NivelSecao;
}

export interface AnaliseAvaliacao {
  status: { label: string; cor: string } | null;
  secoes: AnaliseSecao[];
  pontosFortes: string[];
  pontosMelhorar: string[];
  parecer: string;
}

function nivelDoPercentual(percentual: number): NivelSecao {
  if (percentual >= LIMITE_FORTE) return "forte";
  if (percentual >= LIMITE_ADEQUADO) return "adequado";
  return "atencao";
}

function juntarLista(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function minusculaInicial(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

function statusDaAnalise(parecer: Parecer | null, notaGeral: number | null) {
  if (!parecer) return null;
  if (parecer === "apto" && notaGeral !== null && notaGeral < NOTA_SEM_RESSALVAS) {
    return { label: "Aprovado com ressalvas", cor: NIVEL_CORES.adequado };
  }
  const cor =
    parecer === "apto"
      ? NIVEL_CORES.forte
      : parecer === "reprovado" || parecer === "nao_recomendado"
        ? NIVEL_CORES.atencao
        : NIVEL_CORES.adequado;
  return { label: PARECER_LABELS[parecer], cor };
}

export function gerarAnaliseAvaliacao(
  secoes: AvaliacaoSecao[],
  perguntas: AvaliacaoPergunta[],
  respostas: Resposta[],
  parecer: Parecer | null
): AnaliseAvaliacao {
  const respostaPorPergunta = new Map(respostas.map((r) => [r.pergunta_id, r]));
  const notaGeral = calcularNotaGeral(secoes, perguntas, respostas);
  const falhasCriticas = avaliarItensCriticos(perguntas, respostas);

  const analiseSecoes: AnaliseSecao[] = [];
  const pontosFortes: string[] = [];
  const pontosMelhorar: string[] = [];

  if (falhasCriticas.length > 0) {
    pontosMelhorar.push(
      `Falha crítica: ${juntarLista(falhasCriticas.map((f) => f.pergunta.enunciado))}`
    );
  }

  for (const secao of [...secoes].sort((a, b) => a.ordem - b.ordem)) {
    const nota = calcularNotaSecao(secao.id, perguntas, respostas);
    if (nota === null) continue;
    const percentual = Math.round(nota * 10);
    const nivel = nivelDoPercentual(percentual);
    analiseSecoes.push({ nome: secao.nome, percentual, nivel });

    const perguntasSecao = perguntas
      .filter((p) => p.secao_id === secao.id)
      .sort((a, b) => a.ordem - b.ordem);

    // Checklist: lista os itens pelo nome. Questões (múltipla escolha etc.) têm enunciado longo,
    // então entram só como contagem de acertos.
    const checklistOk: string[] = [];
    const checklistFalha: string[] = [];
    let questoesTotal = 0;
    let questoesAcertos = 0;
    for (const p of perguntasSecao) {
      const r = respostaPorPergunta.get(p.id);
      if (!r || r.pontuacao === null) continue;
      if (p.tipo === "checklist") {
        const status = r.resposta && "status" in r.resposta ? r.resposta.status : null;
        if (status === "sim") checklistOk.push(p.enunciado);
        else if (status === "parcial") checklistFalha.push(`${p.enunciado} (parcial)`);
        else if (status === "nao") checklistFalha.push(p.enunciado);
      } else {
        questoesTotal += 1;
        if (r.pontuacao >= 10) questoesAcertos += 1;
      }
    }

    if (questoesTotal > 0) {
      if (questoesAcertos === questoesTotal) {
        pontosFortes.push(
          `${secao.nome}: acertou ${questoesTotal === 1 ? "a questão" : `todas as ${questoesTotal} questões`}`
        );
      } else {
        const texto = `${secao.nome}: acertou ${questoesAcertos} de ${questoesTotal} questões`;
        if (nivel === "atencao") pontosMelhorar.push(texto);
        else pontosFortes.push(texto);
      }
    }
    if (checklistOk.length > 0 && nivel !== "atencao") {
      pontosFortes.push(`${secao.nome}: ${juntarLista(checklistOk.map(minusculaInicial))}`);
    }
    if (checklistFalha.length > 0) {
      pontosMelhorar.push(`${secao.nome}: ${juntarLista(checklistFalha.map(minusculaInicial))}`);
    }
  }

  return {
    status: statusDaAnalise(parecer, notaGeral),
    secoes: analiseSecoes,
    pontosFortes,
    pontosMelhorar,
    parecer: montarParecer(notaGeral, analiseSecoes, falhasCriticas.length),
  };
}

function montarParecer(notaGeral: number | null, secoes: AnaliseSecao[], qtdFalhasCriticas: number): string {
  if (notaGeral === null || secoes.length === 0) return "Sem respostas suficientes para gerar a análise.";

  const fortes = secoes.filter((s) => s.nivel === "forte").map((s) => s.nome);
  const adequadas = secoes.filter((s) => s.nivel === "adequado").map((s) => s.nome);
  const atencao = secoes.filter((s) => s.nivel === "atencao").map((s) => s.nome);

  const frases: string[] = [];
  const desempenho =
    notaGeral >= 8 ? "bom desempenho geral" : notaGeral >= 6 ? "desempenho satisfatório" : "desempenho abaixo do esperado";
  let abertura = `Avaliado com ${desempenho} (nota ${notaGeral.toFixed(1).replace(".", ",")})`;
  if (fortes.length > 0) abertura += `, com destaque em ${juntarLista(fortes)}`;
  frases.push(`${abertura}.`);

  if (atencao.length > 0) {
    frases.push(`Apresentou deficiências em ${juntarLista(atencao)}.`);
  }
  if (adequadas.length > 0) {
    frases.push(`Em ${juntarLista(adequadas)}, o resultado foi adequado, mas com pontos a corrigir.`);
  }
  if (qtdFalhasCriticas > 0) {
    frases.push(
      `Registrou ${qtdFalhasCriticas} falha${qtdFalhasCriticas > 1 ? "s" : ""} crítica${qtdFalhasCriticas > 1 ? "s" : ""}, que exige${qtdFalhasCriticas > 1 ? "m" : ""} atenção imediata.`
    );
  }

  const reciclagem = [...atencao, ...adequadas];
  if (reciclagem.length > 0) {
    frases.push(`Recomenda-se acompanhamento ou reciclagem em ${juntarLista(reciclagem)}.`);
  } else {
    frases.push("Não há recomendações de reciclagem.");
  }
  return frases.join(" ");
}
