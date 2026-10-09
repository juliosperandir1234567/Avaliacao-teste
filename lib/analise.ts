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
  pontosMelhorar: GrupoMelhorar[];
  parecer: string;
}

/** Item a melhorar: `destaque` ("Não", "Parcial", "Errou"...) aparece em negrito/vermelho. */
export interface ItemMelhorar {
  destaque: string;
  texto: string;
}

export interface GrupoMelhorar {
  titulo: string;
  itens: ItemMelhorar[];
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

/** Pretérito perfeito irregular (3ª pessoa) dos verbos que costumam abrir item de checklist. */
const PRETERITO_IRREGULAR: Record<string, string> = {
  manter: "manteve",
  fazer: "fez",
  dar: "deu",
  ter: "teve",
  ver: "viu",
  ir: "foi",
  ser: "foi",
  estar: "esteve",
  saber: "soube",
  trazer: "trouxe",
  dizer: "disse",
  por: "pôs",
  pôr: "pôs",
  poder: "pôde",
  obter: "obteve",
  conter: "conteve",
  deter: "deteve",
};

/** Palavras que terminam em -ar/-er/-ir/-eu mas não são verbo. */
const NAO_VERBOS = new Set(["ar", "mar", "lugar", "par", "colar", "cooler", "pneu", "filtro"]);

/** Verbos no presente que podem abrir um item ("Sabe ativar...", "Conhece..."). */
const VERBOS_PRESENTE = new Set([
  "sabe", "conhece", "possui", "tem", "faz", "usa", "utiliza", "verifica", "realiza", "mantém",
  "executa", "identifica", "opera", "respeita", "aplica", "domina", "consegue",
]);

/**
 * Transforma o nome de um item de checklist que falhou numa frase negativa: "Usou o cinto" ->
 * "Não usou o cinto", "Utilizar a embreagem" -> "Não utilizou a embreagem", "Água da bateria"
 * -> "Não verificou água da bateria". Item já negativo ("Não descansou o pé...") volta sem o
 * "Não", porque falhar nele significa ter feito.
 */
function itemNegado(enunciado: string): ItemMelhorar {
  const limpo = enunciado.trim().replace(/\s+([,.;])/g, "$1");
  const [primeira, ...resto] = limpo.split(/\s+/);
  const palavra = primeira.toLowerCase();
  const restoTexto = resto.join(" ");

  if (palavra === "não" || palavra === "nao") {
    return { destaque: "", texto: restoTexto.charAt(0).toUpperCase() + restoTexto.slice(1) };
  }
  if (!NAO_VERBOS.has(palavra)) {
    const infinitivo = /^(.{2,})(ar|er|ir)$/.exec(palavra);
    if (PRETERITO_IRREGULAR[palavra] || infinitivo) {
      const preterito =
        PRETERITO_IRREGULAR[palavra] ??
        infinitivo![1] + { ar: "ou", er: "eu", ir: "iu" }[infinitivo![2] as "ar" | "er" | "ir"];
      return { destaque: "Não", texto: [preterito, restoTexto].filter(Boolean).join(" ") };
    }
    if (/(ou|iu|eu)$/.test(palavra) && palavra.length > 3) {
      return { destaque: "Não", texto: minusculaInicial(limpo) };
    }
    if (VERBOS_PRESENTE.has(palavra)) {
      return { destaque: "Não", texto: minusculaInicial(limpo) };
    }
  }
  return { destaque: "Não", texto: `verificou ${minusculaInicial(limpo)}` };
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

/** Contexto da pessoa avaliada, usado só pra redigir o parecer. */
export interface ContextoParecer {
  tipoPessoa?: "interno" | "externo" | null;
  funcao?: string | null;
  /** "v1" = texto antigo, mantido só pras provas finalizadas antes da troca de estilo. */
  estiloParecer?: EstiloParecer;
}

export type EstiloParecer = "v1" | "v2";

/** Provas finalizadas antes disso continuam com o parecer no estilo antigo (v1) -- o texto delas
 * não pode mudar. Em andamento e finalizadas depois usam o estilo atual (v2). */
const PARECER_V2_DESDE = "2026-10-08T23:35:00Z";

/** Observação final do avaliador/gestor, mostrada logo abaixo do parecer (estilo v2) com o
 * título "Considerações do ...". No estilo v1 ela continua no bloco "Observações" antigo. */
export interface Consideracao {
  titulo: string;
  texto: string;
}

export function consideracoesDaAplicacao(aplicacao: {
  observacao_gestor: string | null;
  parecer_justificativa: string | null;
}): Consideracao[] {
  const lista: Consideracao[] = [];
  if (aplicacao.parecer_justificativa?.trim()) {
    lista.push({ titulo: "Considerações do avaliador", texto: aplicacao.parecer_justificativa.trim() });
  }
  if (aplicacao.observacao_gestor?.trim()) {
    lista.push({ titulo: "Considerações do gestor", texto: aplicacao.observacao_gestor.trim() });
  }
  return lista;
}

export function estiloParecerDaAplicacao(aplicacao: { finalizada_em: string | null }): EstiloParecer {
  return aplicacao.finalizada_em && aplicacao.finalizada_em < PARECER_V2_DESDE ? "v1" : "v2";
}

type CategoriaSecao = "teorica" | "inspecao" | "operacao" | "tecnologia" | "outra";

/** Dados de uma seção já apurados, base dos pontos fortes/a melhorar e do parecer. */
interface SecaoApurada extends AnaliseSecao {
  categoria: CategoriaSecao;
  questoesTotal: number;
  questoesAcertos: number;
  checklistTotal: number;
  checklistOk: number;
  falhas: ItemMelhorar[];
}

/** Classifica a seção pelo conteúdo/nome, pra escolher como ela é descrita no parecer. */
function categoriaDaSecao(nome: string, soQuestoes: boolean): CategoriaSecao {
  if (soQuestoes) return "teorica";
  const n = nome.toLowerCase();
  if (/verifica|inspe|check/.test(n)) return "inspecao";
  if (/tecnolog|piloto|embarcad/.test(n)) return "tecnologia";
  if (/comport|opera|condu|pr[aá]tic|manobr/.test(n)) return "operacao";
  return "outra";
}

const NOME_AREA: Record<CategoriaSecao, string | null> = {
  teorica: "conhecimento teórico",
  inspecao: "inspeção pré-operacional",
  operacao: "práticas de operação",
  tecnologia: "tecnologia embarcada",
  outra: null,
};

export function gerarAnaliseAvaliacao(
  secoes: AvaliacaoSecao[],
  perguntas: AvaliacaoPergunta[],
  respostas: Resposta[],
  parecer: Parecer | null,
  contexto: ContextoParecer = {}
): AnaliseAvaliacao {
  const respostaPorPergunta = new Map(respostas.map((r) => [r.pergunta_id, r]));
  const notaGeral = calcularNotaGeral(secoes, perguntas, respostas);
  const falhasCriticas = avaliarItensCriticos(perguntas, respostas);

  const apuradas: SecaoApurada[] = [];
  for (const secao of [...secoes].sort((a, b) => a.ordem - b.ordem)) {
    const nota = calcularNotaSecao(secao.id, perguntas, respostas);
    if (nota === null) continue;
    const percentual = Math.round(nota * 10);

    let questoesTotal = 0;
    let questoesAcertos = 0;
    let checklistTotal = 0;
    let checklistOk = 0;
    const falhas: ItemMelhorar[] = [];
    for (const p of perguntas.filter((p) => p.secao_id === secao.id).sort((a, b) => a.ordem - b.ordem)) {
      const r = respostaPorPergunta.get(p.id);
      if (!r || r.pontuacao === null) continue;
      if (p.tipo === "checklist") {
        const status = r.resposta && "status" in r.resposta ? r.resposta.status : null;
        checklistTotal += 1;
        if (status === "sim") checklistOk += 1;
        else if (status === "parcial") falhas.push({ destaque: "Parcial:", texto: p.enunciado.trim() });
        else if (status === "nao") falhas.push(itemNegado(p.enunciado));
      } else {
        questoesTotal += 1;
        if (r.pontuacao >= 10) questoesAcertos += 1;
      }
    }

    apuradas.push({
      nome: secao.nome,
      percentual,
      nivel: nivelDoPercentual(percentual),
      categoria: categoriaDaSecao(secao.nome, checklistTotal === 0),
      questoesTotal,
      questoesAcertos,
      checklistTotal,
      checklistOk,
      falhas,
    });
  }

  // Pontos fortes: só a contagem por seção (os itens um a um ficam nos pontos a melhorar).
  const pontosFortes: string[] = [];
  for (const s of apuradas) {
    if (s.nivel === "atencao") continue;
    if (s.questoesTotal > 0) {
      pontosFortes.push(
        s.questoesAcertos === s.questoesTotal
          ? `${s.nome}: acertou todas as ${s.questoesTotal} questões`
          : `${s.nome}: acertou ${s.questoesAcertos} de ${s.questoesTotal} questões`
      );
    }
    if (s.checklistTotal > 0) {
      pontosFortes.push(
        s.checklistOk === s.checklistTotal
          ? `${s.nome}: atendeu todos os ${s.checklistTotal} itens`
          : `${s.nome}: atendeu ${s.checklistOk} de ${s.checklistTotal} itens (${s.percentual}%)`
      );
    }
  }

  const pontosMelhorar: GrupoMelhorar[] = [];
  if (falhasCriticas.length > 0) {
    pontosMelhorar.push({
      titulo: "Falhas críticas",
      itens: falhasCriticas.map((f) => ({ destaque: "Falha crítica:", texto: f.pergunta.enunciado.trim() })),
    });
  }
  for (const s of apuradas) {
    const itens: ItemMelhorar[] = [];
    if (s.questoesTotal > 0 && s.questoesAcertos < s.questoesTotal && s.nivel === "atencao") {
      itens.push({ destaque: "Errou", texto: `${s.questoesTotal - s.questoesAcertos} de ${s.questoesTotal} questões` });
    }
    itens.push(...s.falhas);
    if (itens.length > 0) pontosMelhorar.push({ titulo: s.nome, itens });
  }

  return {
    status: statusDaAnalise(parecer, notaGeral),
    secoes: apuradas.map(({ nome, percentual, nivel }) => ({ nome, percentual, nivel })),
    pontosFortes,
    pontosMelhorar,
    parecer: (contexto.estiloParecer === "v1" ? montarParecerV1 : montarParecer)(
      notaGeral,
      apuradas,
      falhasCriticas.map((f) => f.pergunta.enunciado.trim()),
      parecer,
      contexto
    ),
  };
}

/** Pareceres em que a pessoa não segue na função: aí não cabe recomendar treinamento. */
const PARECERES_SEM_RECOMENDACAO: Parecer[] = ["reprovado", "nao_recomendado", "nova_avaliacao"];

const ITEM_DE_SEGURANCA = /cinto|extintor|epi\b|seguran/i;

function formatarNota(n: number) {
  return n.toFixed(1).replace(".", ",");
}

/** Frase de uma falha dentro do texto corrido: "não usou o cinto", "descansou o pé...". */
function falhaEmFrase(item: ItemMelhorar): string {
  if (item.destaque === "Parcial:") return `atendeu apenas parcialmente o item ${minusculaInicial(item.texto)}`;
  if (item.destaque === "Não") return `não ${item.texto}`;
  return minusculaInicial(item.texto);
}

const ABERTURA_SECAO: Record<Exclude<CategoriaSecao, "teorica" | "outra">, string> = {
  inspecao: "Na inspeção pré-operacional",
  operacao: "Durante a operação",
  tecnologia: "Quanto à tecnologia embarcada",
};

/** Parágrafo de uma seção, em terceira pessoa (estilo antigo, v1). */
function paragrafoSecaoV1(s: SecaoApurada): string {
  if (s.categoria === "teorica") {
    const base = `Na parte teórica, acertou ${s.questoesAcertos} de ${s.questoesTotal} questões`;
    if (s.questoesAcertos === s.questoesTotal) return `${base}, demonstrando domínio dos procedimentos avaliados.`;
    if (s.percentual >= LIMITE_ADEQUADO) return `${base}, demonstrando bom conhecimento, com pontos a revisar.`;
    return `${base}, o que indica a necessidade de consolidar os procedimentos básicos de operação e manutenção.`;
  }

  const abertura = s.categoria === "outra" ? `Em ${s.nome}` : ABERTURA_SECAO[s.categoria];
  const frases: string[] = [];
  if (s.checklistOk === s.checklistTotal) {
    frases.push(`${abertura}, atendeu todos os ${s.checklistTotal} itens avaliados.`);
  } else {
    const quantidade =
      s.percentual >= LIMITE_ADEQUADO
        ? "a maior parte dos itens"
        : s.checklistOk > 0
          ? "apenas parte dos itens"
          : "nenhum dos itens";
    frases.push(`${abertura}, atendeu ${quantidade} avaliados (${s.checklistOk} de ${s.checklistTotal}).`);
  }

  // Itens de conferência ("Não verificou faróis") viram uma frase só; as demais falhas, outra.
  const ehConferencia = (f: ItemMelhorar) => f.destaque === "Não" && f.texto.startsWith("verificou ");
  const naoConferidos = s.falhas.filter(ehConferencia).map((f) => f.texto.slice("verificou ".length));
  const outras = s.falhas.filter((f) => !ehConferencia(f)).map(falhaEmFrase);
  if (naoConferidos.length > 0) frases.push(`Deixou de verificar ${juntarLista(naoConferidos)}.`);
  if (outras.length > 0) frases.push(`${naoConferidos.length > 0 ? "Também" : "Porém,"} ${juntarLista(outras)}.`);
  return frases.join(" ");
}

/** Estilo antigo (v1) -- só pras provas finalizadas antes de PARECER_V2_DESDE. Não alterar. */
function montarParecerV1(
  notaGeral: number | null,
  secoes: SecaoApurada[],
  falhasCriticas: string[],
  parecer: Parecer | null,
  contexto: ContextoParecer
): string {
  if (notaGeral === null || secoes.length === 0) return "Sem respostas suficientes para gerar a análise.";

  const sujeito = contexto.tipoPessoa === "externo" ? "O candidato" : "O colaborador";
  const desempenho =
    notaGeral >= 8 ? "bom desempenho" : notaGeral >= 6 ? "desempenho satisfatório" : "desempenho abaixo do esperado";
  const naFuncao = contexto.funcao ? ` na avaliação de ${contexto.funcao}` : " na avaliação";

  const paragrafos: string[] = [
    `${sujeito} obteve nota final de ${formatarNota(notaGeral)}, com ${desempenho}${naFuncao}.`,
  ];
  if (falhasCriticas.length > 0) {
    paragrafos.push(
      `Registrou falha crítica em ${juntarLista(falhasCriticas.map(minusculaInicial))}, o que exige atenção imediata.`
    );
  }
  paragrafos.push(...secoes.map(paragrafoSecaoV1));

  if (parecer && PARECERES_SEM_RECOMENDACAO.includes(parecer)) {
    paragrafos.push(
      parecer === "nova_avaliacao"
        ? `Diante dos resultados apresentados, recomenda-se que ${sujeito.toLowerCase()} passe por nova avaliação.`
        : `Diante dos resultados apresentados, ${sujeito.toLowerCase()} não atingiu o desempenho mínimo exigido para a função.`
    );
    return paragrafos.join("\n\n");
  }

  const areas = [...new Set(secoes.filter((s) => s.nivel !== "forte").map((s) => NOME_AREA[s.categoria] ?? s.nome))];
  const falhouSeguranca = secoes.some((s) => s.falhas.some((f) => ITEM_DE_SEGURANCA.test(f.texto)));
  if (areas.length === 0) {
    paragrafos.push(`${sujeito} demonstrou estar apto a desempenhar a função, sem necessidade de reciclagem.`);
  } else {
    paragrafos.push(
      `Recomenda-se reciclagem em ${juntarLista(areas)}` +
        (falhouSeguranca ? ", com atenção especial aos itens de segurança não atendidos." : ".")
    );
  }
  return paragrafos.join("\n\n");
}

// ============================================================================
// Estilo atual (v2): "Na inspeção pré-operacional, cumpriu 8 dos 14 critérios. O candidato não
// verificou ..., nem realizou ..."
// ============================================================================

const ABERTURA_SECAO_V2: Record<Exclude<CategoriaSecao, "teorica" | "outra">, string> = {
  inspecao: "Na inspeção pré-operacional",
  operacao: "Na avaliação operacional",
  tecnologia: "Em tecnologia embarcada",
};

/** Itens de checklist que são uma tarefa ("Drenagem filtro...") -> "não realizou drenagem...". */
const ITEM_DE_TAREFA = /^(drenagem|limpeza|lubrifica|regulagem|calibragem|troca|aferi)/i;

/** Verbo no presente vira pretérito no texto corrido: "não sabe ativar" -> "não soube ativar". */
const PRESENTE_PARA_PRETERITO: Record<string, string> = {
  sabe: "soube",
  conhece: "demonstrou conhecer",
  consegue: "conseguiu",
  possui: "possuía",
  tem: "teve",
  faz: "fez",
  usa: "usou",
  utiliza: "utilizou",
  verifica: "verificou",
  realiza: "realizou",
  mantém: "manteve",
  executa: "executou",
  identifica: "identificou",
  opera: "operou",
  respeita: "respeitou",
  aplica: "aplicou",
  domina: "dominou",
};

function falhaEmFraseV2(item: ItemMelhorar): string {
  if (item.destaque === "Parcial:") return `atendeu apenas parcialmente o item ${minusculaInicial(item.texto)}`;
  if (item.destaque === "Não") {
    const [primeira, ...resto] = item.texto.split(" ");
    const preterito = PRESENTE_PARA_PRETERITO[primeira.toLowerCase()];
    return `não ${preterito ? [preterito, ...resto].join(" ") : item.texto}`;
  }
  return minusculaInicial(item.texto);
}

function maiusculaInicial(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "8 dos 14 critérios" / "4 das 4 questões" / "1 de 1 critério". */
function contagem(qtd: number, total: number, singular: string, plural: string, feminino = false): string {
  return `${qtd} ${total === 1 ? "de" : feminino ? "das" : "dos"} ${total} ${total === 1 ? singular : plural}`;
}

function paragrafoSecao(s: SecaoApurada, sujeito: string): string {
  if (s.categoria === "teorica") {
    const base = `Na avaliação teórica, acertou ${contagem(s.questoesAcertos, s.questoesTotal, "questão", "questões", true)}`;
    if (s.questoesAcertos === s.questoesTotal) return `${base}, demonstrando domínio dos conhecimentos avaliados.`;
    if (s.percentual >= LIMITE_ADEQUADO) return `${base}, demonstrando bom conhecimento, com pontos a revisar.`;
    return `${base}, o que indica a necessidade de reforçar os conhecimentos avaliados.`;
  }

  const abertura = s.categoria === "outra" ? `Em ${s.nome}` : ABERTURA_SECAO_V2[s.categoria];
  const frases: string[] = [
    s.checklistOk === s.checklistTotal
      ? `${abertura}, cumpriu ${s.checklistTotal === 1 ? "o critério avaliado" : `todos os ${s.checklistTotal} critérios`}.`
      : `${abertura}, cumpriu ${contagem(s.checklistOk, s.checklistTotal, "critério", "critérios")}.`,
  ];

  // Itens de conferência ("Não verificou faróis") e de tarefa ("drenagem...") viram uma frase
  // com o sujeito ("O candidato não verificou ..., nem realizou ..."); as demais falhas, outra.
  const ehConferencia = (f: ItemMelhorar) => f.destaque === "Não" && f.texto.startsWith("verificou ");
  const conferencias = s.falhas.filter(ehConferencia).map((f) => f.texto.slice("verificou ".length));
  const naoVerificados = conferencias.filter((t) => !ITEM_DE_TAREFA.test(t));
  const naoRealizados = conferencias.filter((t) => ITEM_DE_TAREFA.test(t));
  const outras = s.falhas.filter((f) => !ehConferencia(f)).map(falhaEmFraseV2);

  if (naoVerificados.length > 0 || naoRealizados.length > 0) {
    const partes: string[] = [];
    if (naoVerificados.length > 0) partes.push(`não verificou ${juntarLista(naoVerificados)}`);
    if (naoRealizados.length > 0) {
      partes.push(`${naoVerificados.length > 0 ? "nem" : "não"} realizou ${juntarLista(naoRealizados)}`);
    }
    frases.push(`${sujeito} ${partes.join(", ")}.`);
  }
  if (outras.length > 0) frases.push(`${maiusculaInicial(juntarLista(outras))}.`);
  return frases.join(" ");
}

function montarParecer(
  notaGeral: number | null,
  secoes: SecaoApurada[],
  falhasCriticas: string[],
  parecer: Parecer | null,
  contexto: ContextoParecer
): string {
  if (notaGeral === null || secoes.length === 0) return "Sem respostas suficientes para gerar a análise.";

  const sujeito = contexto.tipoPessoa === "externo" ? "O candidato" : "O colaborador";
  const desempenho =
    notaGeral >= 8 ? "bom desempenho" : notaGeral >= 6 ? "desempenho satisfatório" : "desempenho abaixo do esperado";
  const naFuncao = contexto.funcao ? ` na avaliação para a função de ${contexto.funcao}` : " na avaliação";

  const paragrafos: string[] = [
    `${sujeito} obteve nota final de ${formatarNota(notaGeral)}, apresentando ${desempenho}${naFuncao}.`,
  ];
  if (falhasCriticas.length > 0) {
    paragrafos.push(
      `Registrou falha crítica em ${juntarLista(falhasCriticas.map(minusculaInicial))}, o que exige atenção imediata.`
    );
  }
  paragrafos.push(...secoes.map((s) => paragrafoSecao(s, sujeito)));

  if (parecer && PARECERES_SEM_RECOMENDACAO.includes(parecer)) {
    paragrafos.push(
      parecer === "nova_avaliacao"
        ? `Diante dos resultados apresentados, recomenda-se que ${sujeito.toLowerCase()} passe por nova avaliação.`
        : `Diante dos resultados apresentados, ${sujeito.toLowerCase()} não atingiu o desempenho mínimo exigido para a função.`
    );
    return paragrafos.join("\n\n");
  }

  const areas = [...new Set(secoes.filter((s) => s.nivel !== "forte").map((s) => NOME_AREA[s.categoria] ?? s.nome))];
  const falhouSeguranca = secoes.some((s) => s.falhas.some((f) => ITEM_DE_SEGURANCA.test(f.texto)));
  if (areas.length === 0) {
    paragrafos.push(`${sujeito} demonstrou estar apto a desempenhar a função, sem necessidade de reciclagem.`);
  } else {
    paragrafos.push(
      `Recomenda-se reciclagem em ${juntarLista(areas)}` +
        (falhouSeguranca ? ", com atenção especial aos itens de segurança não atendidos." : ".")
    );
  }
  return paragrafos.join("\n\n");
}
