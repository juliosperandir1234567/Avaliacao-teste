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
  /** v5: rótulo/cor próprios ("Abaixo do mínimo", "Não avaliada"); sem isso usa NIVEL_LABELS/CORES. */
  rotulo?: string;
  cor?: string;
}

export interface AnaliseAvaliacao {
  status: { label: string; cor: string } | null;
  /** Nota geral (0 a 10), mostrada em destaque ao lado do status no card da análise. */
  nota: number | null;
  secoes: AnaliseSecao[];
  pontosFortes: string[];
  pontosMelhorar: GrupoMelhorar[];
  parecer: string;
  /** v5: divergências entre parecer final, resultado calculado e falhas críticas, pra revisão do
   * avaliador. Só aparecem na tela (não entram no texto nem no PDF). */
  alertas: string[];
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

const PRETERITOS_IRREGULARES = new Set(Object.values(PRETERITO_IRREGULAR));

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
function itemNegado(enunciado: string, corrigirPreterito = false): ItemMelhorar {
  const limpo = enunciado.trim().replace(/\s+([,.;])/g, "$1");
  const [primeira, ...resto] = limpo.split(/\s+/);
  const palavra = primeira.toLowerCase();
  const restoTexto = resto.join(" ");

  // v4: item que já começa no pretérito irregular ("Fez as manobras...") -> "não fez as manobras".
  // Antes caía em "não verificou fez as manobras..." -- corrigido só no v4 pra não mudar o texto
  // de provas já finalizadas.
  if (corrigirPreterito && PRETERITOS_IRREGULARES.has(palavra)) {
    return { destaque: "Não", texto: minusculaInicial(limpo) };
  }

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
  /** v5: resultado calculado pelo sistema (gerarParecerSugerido), pra conclusão e alertas. */
  parecerSugerido?: Parecer | null;
}

export type EstiloParecer = "v1" | "v2" | "v3" | "v4" | "v5";

/** Provas finalizadas antes disso continuam com o parecer no estilo antigo (v1) -- o texto delas
 * não pode mudar. Em andamento e finalizadas depois usam o estilo atual (v2). */
const PARECER_V2_DESDE = "2026-10-08T23:35:00Z";
/** v3 = v2 + observações do avaliador em cada pergunta + quais questões teóricas errou.
 * Provas finalizadas antes disso (já entregues/exportadas) mantêm o texto v2 sem mudança. */
const PARECER_V3_DESDE = "2026-11-09T00:20:00Z";
/** v4 = resumo curto "de analista" (resultado, análise, conclusão). Provas finalizadas antes
 * disso mantêm o texto v3 sem mudança; em andamento e futuras usam o v4. */
const PARECER_V4_DESDE = "2026-11-25T01:10:00Z";
/** v5 = padrão técnico (síntese, evidências por etapa, conclusão; sem nota no texto). Provas
 * finalizadas antes disso mantêm o texto v4 sem mudança; em andamento e futuras usam o v5. */
const PARECER_V5_DESDE = "2026-11-25T11:47:00Z";

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
  const f = aplicacao.finalizada_em;
  if (f && f < PARECER_V2_DESDE) return "v1";
  if (f && f < PARECER_V3_DESDE) return "v2";
  if (f && f < PARECER_V4_DESDE) return "v3";
  if (f && f < PARECER_V5_DESDE) return "v4";
  return "v5";
}

/** Enunciado de questão pronto pra citar: sem a numeração do início ("01) ", "3. ") e sem a
 * pontuação do fim ("0,30", "(0,5 pt)") que vêm das provas importadas do Word. */
function textoDaQuestao(enunciado: string): string {
  const limpo = enunciado
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^\d{1,3}\s*[).\-–]\s*/, "")
    .replace(/\s*\(?\s*\d+(?:[,.]\d+)?\s*(?:pts?|pontos?)?\s*\)?\s*$/i, "")
    .trim();
  return limpo.length <= 110 ? limpo : `${limpo.slice(0, 109).replace(/\s+\S*$/, "")}…`;
}

/** Encurta um enunciado pra caber numa frase: tira espaços extras e corta em ~`max` caracteres. */
function resumir(texto: string, max = 90): string {
  const limpo = texto.trim().replace(/\s+/g, " ").replace(/[\s:?.]+$/, "");
  return limpo.length <= max ? limpo : `${limpo.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
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
  /** v3: enunciado (resumido) das questões que errou. */
  questoesErradas: string[];
  /** v3: observações que o avaliador escreveu nas perguntas desta seção ("Item: texto"). */
  observacoes: string[];
  /** v5: questões com acerto parcial (0 < nota < 10), separadas das erradas (nota 0). */
  questoesParciais: string[];
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
  const estilo: EstiloParecer = contexto.estiloParecer ?? "v5";
  const v5 = estilo === "v5";
  const respostaPorPergunta = new Map(respostas.map((r) => [r.pergunta_id, r]));
  const notaGeral = calcularNotaGeral(secoes, perguntas, respostas);
  const falhasCriticas = avaliarItensCriticos(perguntas, respostas);

  const apuradas: SecaoApurada[] = [];
  /** v5: etapas sem nenhum item válido avaliado (tudo N.A./sem resposta) -> "Não avaliada". */
  const naoAvaliadas: string[] = [];
  for (const secao of [...secoes].sort((a, b) => a.ordem - b.ordem)) {
    const nota = calcularNotaSecao(secao.id, perguntas, respostas);
    if (nota === null) {
      const temPerguntas = perguntas.some((p) => p.secao_id === secao.id);
      if (v5 && temPerguntas) {
        const soQuestoes = perguntas.filter((p) => p.secao_id === secao.id).every((p) => p.tipo !== "checklist");
        naoAvaliadas.push(nomeEtapaV5(secao.nome, categoriaDaSecao(secao.nome, soQuestoes)));
      }
      continue;
    }
    const percentual = Math.round(nota * 10);

    let questoesTotal = 0;
    let questoesAcertos = 0;
    let checklistTotal = 0;
    let checklistOk = 0;
    const falhas: ItemMelhorar[] = [];
    const questoesErradas: string[] = [];
    const questoesParciais: string[] = [];
    const observacoes: string[] = [];
    for (const p of perguntas.filter((p) => p.secao_id === secao.id).sort((a, b) => a.ordem - b.ordem)) {
      const r = respostaPorPergunta.get(p.id);
      const obs = r?.observacao?.trim();
      if (obs) observacoes.push(`${resumir(textoDaQuestao(p.enunciado), 60)}: ${obs.replace(/\s+/g, " ").replace(/[.\s]+$/, "")}`);
      if (!r || r.pontuacao === null) continue;
      if (p.tipo === "checklist") {
        const status = r.resposta && "status" in r.resposta ? r.resposta.status : null;
        checklistTotal += 1;
        if (status === "sim") checklistOk += 1;
        else if (status === "parcial") falhas.push({ destaque: "Parcial:", texto: p.enunciado.trim() });
        else if (status === "nao") falhas.push(itemNegado(p.enunciado, estilo === "v4" || v5));
      } else {
        questoesTotal += 1;
        if (r.pontuacao >= 10) questoesAcertos += 1;
        // v5: acerto parcial não é "errou" (não dá pra afirmar que errou tudo).
        else if (v5 && r.pontuacao > 0) questoesParciais.push(textoDaQuestao(p.enunciado));
        else questoesErradas.push(textoDaQuestao(p.enunciado));
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
      questoesErradas,
      observacoes,
      questoesParciais,
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
    if (estilo === "v3" || estilo === "v4") {
      // v3: lista cada questão errada (antes só dizia "Errou X de Y", e só com aproveitamento baixo).
      itens.push(...s.questoesErradas.map((q) => ({ destaque: "Errou:", texto: q })));
    } else if (s.questoesTotal > 0 && s.questoesAcertos < s.questoesTotal && s.nivel === "atencao") {
      itens.push({ destaque: "Errou", texto: `${s.questoesTotal - s.questoesAcertos} de ${s.questoesTotal} questões` });
    }
    itens.push(...s.falhas);
    if (itens.length > 0) pontosMelhorar.push({ titulo: s.nome, itens });
  }

  return {
    status: statusDaAnalise(parecer, notaGeral),
    nota: notaGeral,
    secoes: v5
      ? [
          ...apuradas.map(({ nome, percentual, nivel, categoria }) => ({
            nome: nomeEtapaV5(nome, categoria),
            percentual,
            nivel,
            ...(nivel === "atencao" ? { rotulo: "Abaixo do mínimo" } : {}),
          })),
          ...naoAvaliadas.map((nome) => ({ nome, percentual: 0, nivel: "atencao" as NivelSecao, rotulo: "Não avaliada", cor: "#9ca3af" })),
        ]
      : apuradas.map(({ nome, percentual, nivel }) => ({ nome, percentual, nivel })),
    // v4/v5: só o parecer (análise) -- as listas de pontos fortes/a melhorar saem da tela e do PDF.
    pontosFortes: estilo === "v4" || v5 ? [] : pontosFortes,
    pontosMelhorar: estilo === "v4" || v5 ? [] : pontosMelhorar,
    alertas: v5 ? alertasV5(parecer, contexto.parecerSugerido ?? null, falhasCriticas.length) : [],
    parecer: v5
      ? montarParecerV5(
          apuradas,
          naoAvaliadas,
          falhasCriticas.map((f) => f.pergunta.enunciado.trim()),
          parecer,
          contexto.parecerSugerido ?? null
        )
      : (estilo === "v1" ? montarParecerV1 : estilo === "v4" ? montarParecerV4 : montarParecer)(
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

/** v3: parágrafo da v2 + quais questões teóricas errou + observações do avaliador na seção. */
function paragrafoSecaoV3(s: SecaoApurada, sujeito: string): string {
  let texto = paragrafoSecao(s, sujeito);
  if (s.questoesErradas.length > 0) {
    const lista = s.questoesErradas.map((q) => `“${q}”`);
    texto += ` ${s.questoesErradas.length === 1 ? "Errou a questão" : "Errou as questões"} ${juntarLista(lista)}.`;
  }
  if (s.observacoes.length > 0) {
    texto += ` Observações do avaliador: ${s.observacoes.join("; ")}.`;
  }
  return texto;
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
  paragrafos.push(
    ...secoes.map((s) =>
      (contexto.estiloParecer ?? "v3") === "v3" ? paragrafoSecaoV3(s, sujeito) : paragrafoSecao(s, sujeito)
    )
  );

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
// Estilo v4 ("analista"): resumo curto -- Resultado, análise em poucas frases e Conclusão.
// Os itens um a um continuam no bloco "Pontos a melhorar". Sem sujeito ("o candidato"), pra
// nunca errar o gênero. Reprovado não recebe recomendação de treinamento.
// ============================================================================

const AREA_V4: Record<CategoriaSecao, string | null> = {
  teorica: "conhecimento teórico",
  inspecao: "inspeção pré-operacional",
  operacao: "operação",
  tecnologia: "tecnologia embarcada",
  outra: null,
};

function areaV4(s: SecaoApurada): string {
  return AREA_V4[s.categoria] ?? s.nome.toLowerCase();
}

/** "tensão das Correias" -> "tensão das correias"; siglas (AB, EPI) ficam como estão. */
function normalizarCaixa(texto: string): string {
  return texto
    .split(" ")
    .map((w, i) => (i === 0 ? minusculaInicial(w) : /^[A-ZÀ-Ú][a-zà-ú]+$/.test(w) ? w.toLowerCase() : w))
    .join(" ");
}

/** Falhas de checklist em frases curtas, juntando as parecidas:
 * "não utilizou corretamente o freio manet/de serviço/estacionário" ->
 * "não utilizou corretamente o freio (manet, de serviço e estacionário)". */
function frasesDasFalhasV4(falhas: ItemMelhorar[]): string[] {
  const naoVerificados: string[] = [];
  const naoRealizados: string[] = [];
  const outras: string[] = [];
  for (const f of falhas) {
    if (f.destaque === "Não" && f.texto.startsWith("verificou ")) {
      const alvo = normalizarCaixa(f.texto.slice("verificou ".length));
      (ITEM_DE_TAREFA.test(alvo) ? naoRealizados : naoVerificados).push(alvo);
    } else {
      outras.push(normalizarCaixa(falhaEmFraseV2(f)));
    }
  }

  // Agrupa frases com as mesmas 5 primeiras palavras.
  const grupos = new Map<string, string[]>();
  for (const frase of outras) {
    const palavras = frase.split(" ");
    const chave = palavras.length > 5 ? palavras.slice(0, 5).join(" ") : frase;
    const lista = grupos.get(chave) ?? [];
    lista.push(palavras.length > 5 ? palavras.slice(5).join(" ") : "");
    grupos.set(chave, lista);
  }
  const frases: { texto: string; peso: number }[] = [];
  for (const [chave, sufixos] of grupos) {
    if (sufixos.length === 1) frases.push({ texto: sufixos[0] ? `${chave} ${sufixos[0]}` : chave, peso: 1 });
    else frases.push({ texto: `${chave} (${juntarLista(sufixos)})`, peso: sufixos.length });
  }
  if (naoVerificados.length > 0) {
    frases.push({ texto: `deixou de verificar ${juntarLista(naoVerificados)}`, peso: naoVerificados.length });
  }
  if (naoRealizados.length > 0) {
    frases.push({ texto: `não realizou ${juntarLista(naoRealizados)}`, peso: naoRealizados.length });
  }
  // Os grupos maiores primeiro (mais representativos da dificuldade).
  return frases.sort((a, b) => b.peso - a.peso).map((f) => f.texto);
}

/** "na inspeção pré-operacional" / "em <nome da seção>". */
function naArea(s: SecaoApurada): string {
  return AREA_V4[s.categoria] && s.categoria !== "teorica" ? `na ${areaV4(s)}` : `em ${areaV4(s)}`;
}

/** Resumo das etapas que não são a mais fraca, agrupadas por nível (sem repetir a expressão):
 * "Nas demais etapas, foi bem na operação; ficou abaixo do esperado na inspeção (8 de 14 itens)
 * e na tecnologia embarcada (2 de 4 itens). Na prova teórica, acertou 2 de 4 questões." */
function resumoDemaisEtapas(outras: SecaoApurada[], todasFracas: boolean): string {
  const praticas = outras.filter((s) => s.categoria !== "teorica");
  const itens = (s: SecaoApurada) => `${naArea(s)} (${s.checklistOk} de ${s.checklistTotal} itens)`;
  const partes: string[] = [];
  const fortes = praticas.filter((s) => s.nivel === "forte");
  const medias = praticas.filter((s) => s.nivel === "adequado");
  const fracas = praticas.filter((s) => s.nivel === "atencao");
  if (fortes.length > 0) partes.push(`foi bem ${juntarLista(fortes.map(naArea))}`);
  if (medias.length > 0) partes.push(`teve resultado razoável ${juntarLista(medias.map(itens))}`);
  if (fracas.length > 0) {
    partes.push(`${todasFracas ? "ficou" : "também ficou"} abaixo do esperado ${juntarLista(fracas.map(itens))}`);
  }
  const frases: string[] = [];
  if (partes.length > 0) {
    frases.push(`Nas demais etapas, ${partes.length > 2 ? `${partes.slice(0, -1).join("; ")}; e ${partes[partes.length - 1]}` : partes.join("; ")}.`);
  }
  // Teoria em frase própria (evita "... e na tecnologia embarcada e na prova teórica ...").
  for (const t of outras.filter((s) => s.categoria === "teorica")) {
    frases.push(
      t.questoesAcertos === t.questoesTotal
        ? "Na prova teórica, acertou todas as questões."
        : `Na prova teórica, acertou ${t.questoesAcertos} de ${t.questoesTotal} questões.`
    );
  }
  return frases.join(" ");
}

function montarParecerV4(
  notaGeral: number | null,
  secoes: SecaoApurada[],
  falhasCriticas: string[],
  parecer: Parecer | null,
  contexto: ContextoParecer
): string {
  if (notaGeral === null || secoes.length === 0) return "Sem respostas suficientes para gerar a análise.";
  void contexto; // mesmo formato dos outros estilos; o v4 não usa sujeito nem função

  const faixa = notaGeral >= 8 ? "bom desempenho" : notaGeral >= 6 ? "desempenho satisfatório" : "abaixo do esperado";
  const paragrafos: string[] = [`Resultado: ${faixa} (nota ${formatarNota(notaGeral)}).`];

  const analise: string[] = [];
  const todasFracas = secoes.length > 1 && secoes.every((s) => s.nivel === "atencao");
  if (todasFracas) analise.push("O desempenho ficou abaixo do mínimo em todas as etapas da avaliação.");

  const maisFraca = secoes
    .filter((s) => s.nivel !== "forte")
    .reduce<SecaoApurada | null>((pior, s) => (!pior || s.percentual < pior.percentual ? s : pior), null);

  if (maisFraca) {
    if (maisFraca.categoria === "teorica") {
      analise.push(
        `O ponto mais fraco foi a prova teórica, com ${maisFraca.questoesAcertos} de ${maisFraca.questoesTotal} questões certas.`
      );
    } else {
      const frases = frasesDasFalhasV4(maisFraca.falhas);
      const principais = frases.slice(0, 3);
      const nome = maisFraca.categoria === "outra" ? `a etapa "${maisFraca.nome}"` : `a ${areaV4(maisFraca)}`;
      analise.push(
        `O ponto mais fraco foi ${nome}` +
          (principais.length > 0
            ? `: ${juntarLista(principais)}${frases.length > principais.length ? ", entre outros pontos" : ""}.`
            : ".")
      );
    }
    const outras = secoes.filter((s) => s !== maisFraca);
    if (outras.length > 0) analise.push(resumoDemaisEtapas(outras, todasFracas));
  } else {
    const pontuais = frasesDasFalhasV4(secoes.flatMap((s) => s.falhas));
    analise.push(
      pontuais.length === 0
        ? "Teve bom desempenho em todas as etapas, sem falhas relevantes."
        : `Teve bom desempenho em todas as etapas, com poucas falhas pontuais (${juntarLista(pontuais.slice(0, 2))}).`
    );
  }

  // Segurança sempre aparece: falha crítica ou item de segurança (cinto, extintor, EPI).
  if (falhasCriticas.length > 0) {
    analise.push(
      `Registrou falha crítica em ${juntarLista(falhasCriticas.map(normalizarCaixa))}, o que exige atenção imediata.`
    );
  } else {
    const itensSeguranca = [
      ...new Set(
        secoes.flatMap((s) =>
          s.falhas
            .filter((f) => ITEM_DE_SEGURANCA.test(f.texto))
            .map((f) => normalizarCaixa(f.texto.replace(/^verificou /, "")))
        )
      ),
    ];
    if (itensSeguranca.length > 0) {
      analise.push(`Atenção ao item de segurança não atendido (${juntarLista(itensSeguranca)}).`);
    }
  }

  const observacoes = secoes.flatMap((s) => s.observacoes).slice(0, 3);
  if (observacoes.length > 0) {
    analise.push(
      `${observacoes.length === 1 ? "Observação do avaliador" : "Observações do avaliador"}: ${observacoes.join("; ")}.`
    );
  }
  paragrafos.push(analise.join(" "));

  if (parecer) {
    const areas = [...new Set(secoes.filter((s) => s.nivel !== "forte").map(areaV4))];
    let conclusao: string;
    if (parecer === "reprovado" || parecer === "nao_recomendado") {
      conclusao = "não atende aos requisitos da função neste momento.";
    } else if (parecer === "nova_avaliacao") {
      conclusao = "recomenda-se uma nova avaliação.";
    } else if (parecer === "necessita_treinamento") {
      conclusao = `necessita de treinamento${areas.length > 0 ? ` em ${juntarLista(areas)}` : ""} antes de assumir a função.`;
    } else {
      conclusao =
        "apto para a função" +
        (parecer === "apto_acompanhamento" ? ", com acompanhamento" : "") +
        (areas.length > 0 ? `, com recomendação de treinamento em ${juntarLista(areas)}` : "") +
        ".";
    }
    paragrafos.push(`Conclusão: ${conclusao}`);
  }
  return paragrafos.join("\n\n");
}

// ============================================================================
// Estilo v5 (padrão técnico): Síntese, Evidências por etapa e Conclusão. Técnico, impessoal e só
// com o que está registrado na avaliação: sem nota no texto, sem "entre outros pontos", sem
// classificar risco por conta própria (falha crítica só se o item estiver configurado assim),
// N.A. e perguntas sem resposta fora, etapa sem itens válidos = "Não avaliada".
// ============================================================================

const APROVADOS: Parecer[] = ["apto", "apto_acompanhamento"];

/** Nome da etapa no texto e nas barras: "Questões" -> "Conhecimento teórico", "Uso de
 * Tecnologia" -> "Tecnologia embarcada" (quando o conteúdo corresponde). */
function nomeEtapaV5(nome: string, categoria: CategoriaSecao): string {
  if (categoria === "teorica") return "Conhecimento teórico";
  if (categoria === "tecnologia") return "Tecnologia embarcada";
  return nome;
}

/** "Na verificação inicial", "No comportamento operacional", "Nas ..." (pelo gênero provável da
 * primeira palavra do nome da etapa). */
function naEtapa(nome: string): string {
  const primeira = nome.split(" ")[0].toLowerCase();
  const plural = /s$/.test(primeira) && !/(ês|is|us)$/.test(primeira);
  const feminino = /(a|ão|ção|dade|gem|ões|as)$/.test(primeira);
  const prep = feminino ? (plural ? "Nas" : "Na") : plural ? "Nos" : "No";
  return `${prep} ${minusculaInicial(nome)}`;
}

/** Assunto da questão, sem copiar a pergunta inteira: "Qual a função da bomba alimentadora? Em
 * qual ocasião..." -> "a função da bomba alimentadora". */
function assuntoDaQuestao(enunciado: string): string {
  const primeiraFrase = textoDaQuestao(enunciado).split("?")[0].split(" (")[0].replace(/…$/, "").trim();
  let t = primeiraFrase
    .replace(/^(qual|quais)\s+(é|são|seria|seriam)?\s*/i, "")
    .replace(/^o que\s+(é|são)?\s*/i, "")
    .trim();
  t = normalizarCaixa(t).replace(/[\s:.,;]+$/, "");
  return t.length <= 90 ? t : `${t.slice(0, 89).replace(/\s+\S*$/, "")}…`;
}

function evidenciaEtapaV5(s: SecaoApurada, nome: string): string {
  const na = naEtapa(nome);
  let texto: string;
  if (s.questoesTotal > 0 && s.checklistTotal === 0) {
    const partes = [`acertou ${s.questoesAcertos} de ${s.questoesTotal} questões`];
    if (s.questoesErradas.length > 0) {
      partes.push(
        `${s.questoesErradas.length === 1 ? "houve erro na questão sobre" : "houve erro nas questões sobre"} ${juntarLista(s.questoesErradas.map(assuntoDaQuestao))}`
      );
    }
    if (s.questoesParciais.length > 0) {
      partes.push(
        `${s.questoesParciais.length === 1 ? "houve acerto parcial na questão sobre" : "houve acerto parcial nas questões sobre"} ${juntarLista(s.questoesParciais.map(assuntoDaQuestao))}`
      );
    }
    texto = `${na}, ${partes.join("; ")}.`;
  } else {
    const frases = frasesDasFalhasV4(s.falhas);
    if (s.questoesErradas.length > 0) {
      frases.push(`errou ${s.questoesErradas.length === 1 ? "a questão sobre" : "as questões sobre"} ${juntarLista(s.questoesErradas.map(assuntoDaQuestao))}`);
    }
    if (s.questoesParciais.length > 0) {
      frases.push(`teve acerto parcial ${s.questoesParciais.length === 1 ? "na questão sobre" : "nas questões sobre"} ${juntarLista(s.questoesParciais.map(assuntoDaQuestao))}`);
    }
    texto = frases.length > 0 ? `${na}, ${juntarFrases(frases)}.` : `${na}, os itens avaliados foram atendidos.`;
  }
  if (s.observacoes.length > 0) {
    texto += ` ${s.observacoes.length === 1 ? "Registro do avaliador" : "Registros do avaliador"}: ${s.observacoes.join("; ")}.`;
  }
  return texto;
}

/** Junta frases da evidência; se alguma já tem lista interna ("a, b e c"), separa com ";" pra
 * não virar "... e c e não realizou ...". */
function juntarFrases(frases: string[]): string {
  if (frases.length <= 1) return frases.join("");
  if (!frases.some((f) => /,| e /.test(f))) return juntarLista(frases);
  return `${frases.slice(0, -1).join("; ")}; e ${frases[frases.length - 1]}`;
}

function temRegistroDeMelhoria(s: SecaoApurada): boolean {
  return s.falhas.length > 0 || s.questoesErradas.length > 0 || s.questoesParciais.length > 0;
}

function montarParecerV5(
  secoes: SecaoApurada[],
  naoAvaliadas: string[],
  falhasCriticas: string[],
  parecer: Parecer | null,
  parecerSugerido: Parecer | null
): string {
  if (secoes.length === 0) return "Sem respostas suficientes para gerar a análise.";

  const resultado = parecer ?? parecerSugerido;
  const aprovado = resultado ? APROVADOS.includes(resultado) : null;
  const nome = (s: SecaoApurada) => maiusculaInicial(normalizarCaixa(nomeEtapaV5(s.nome, s.categoria)));
  const abaixo = secoes.filter((s) => s.nivel === "atencao").sort((a, b) => a.percentual - b.percentual);
  const fortes = secoes.filter((s) => s.nivel === "forte");

  // 1. Síntese
  const sintese: string[] = [];
  if (aprovado === false) {
    let frase = "O desempenho não atingiu os critérios de aprovação desta avaliação";
    if (abaixo.length > 0 && abaixo.length === secoes.length && secoes.length > 1) {
      frase += `, ficando abaixo do mínimo em todas as etapas avaliadas, com maior dificuldade em ${minusculaInicial(nome(abaixo[0]))}`;
    } else if (abaixo.length > 0) {
      frase += `, com maior dificuldade em ${juntarLista(abaixo.slice(0, 2).map((s) => minusculaInicial(nome(s))))}`;
    }
    sintese.push(`${frase}.`);
  } else if (aprovado === true) {
    let frase = "O desempenho atingiu os critérios de aprovação desta avaliação";
    if (fortes.length > 0) frase += `, com domínio demonstrado em ${juntarLista(fortes.map((s) => minusculaInicial(nome(s))))}`;
    sintese.push(`${frase}.`);
    if (abaixo.length > 0) {
      sintese.push(
        `${abaixo.length === 1 ? "A etapa" : "As etapas"} ${juntarLista(abaixo.map((s) => minusculaInicial(nome(s))))} ${abaixo.length === 1 ? "ficou" : "ficaram"} abaixo do mínimo.`
      );
    }
  } else if (abaixo.length > 0) {
    sintese.push(`A maior dificuldade foi em ${juntarLista(abaixo.slice(0, 2).map((s) => minusculaInicial(nome(s))))}.`);
  }
  if (falhasCriticas.length > 0) {
    sintese.push(
      `${falhasCriticas.length === 1 ? "Houve falha em item configurado como crítico" : "Houve falha em itens configurados como críticos"}: ${juntarLista(falhasCriticas.map(normalizarCaixa))}.`
    );
  }

  // 2. Evidências: a etapa com mais dificuldade fecha o 1º parágrafo; as demais vão no 2º.
  const comRegistro = [...secoes].filter(temRegistroDeMelhoria).sort((a, b) => a.percentual - b.percentual);
  const paragrafos: string[] = [];
  if (aprovado === true) {
    paragrafos.push(sintese.join(" "));
    const oportunidades = comRegistro.map((s) => evidenciaEtapaV5(s, nome(s)));
    if (oportunidades.length > 0) paragrafos.push(`Foram registrados pontos de melhoria. ${oportunidades.join(" ")}`);
  } else {
    const [principal, ...demais] = comRegistro;
    paragrafos.push([...sintese, principal ? evidenciaEtapaV5(principal, nome(principal)) : ""].filter(Boolean).join(" "));
    const segundo = demais.map((s) => evidenciaEtapaV5(s, nome(s)));
    const semRegistro = secoes.filter((s) => !temRegistroDeMelhoria(s));
    if (semRegistro.length > 0) {
      segundo.push(
        `${semRegistro.length === 1 ? `${naEtapa(nome(semRegistro[0]))}, os itens avaliados foram atendidos.` : `Nas etapas ${juntarLista(semRegistro.map((s) => minusculaInicial(nome(s))))}, os itens avaliados foram atendidos.`}`
      );
    }
    if (segundo.length > 0) paragrafos.push(segundo.join(" "));
  }
  if (naoAvaliadas.length > 0) {
    paragrafos.push(
      `${naoAvaliadas.length === 1 ? "A etapa" : "As etapas"} ${juntarLista(naoAvaliadas.map(normalizarCaixa))} ${naoAvaliadas.length === 1 ? "não foi avaliada" : "não foram avaliadas"} (sem itens válidos registrados).`
    );
  }

  // 3. Conclusão (segue o resultado; capacitação nos pontos com registro).
  const pontos = [...new Set(comRegistro.map((s) => minusculaInicial(nome(s))))];
  const emPontos = pontos.length > 0 ? ` em ${juntarLista(pontos)}` : " nos pontos identificados";
  let conclusao: string | null = null;
  if (resultado === "reprovado" || resultado === "nao_recomendado") {
    conclusao = `não atingiu os critérios de aprovação nesta avaliação. Recomenda-se capacitação${emPontos} antes de uma nova avaliação.`;
  } else if (resultado === "nova_avaliacao") {
    conclusao = `recomenda-se uma nova avaliação, precedida de capacitação${emPontos}.`;
  } else if (resultado === "necessita_treinamento") {
    conclusao = `necessita de capacitação${emPontos} antes de assumir a função.`;
  } else if (resultado === "apto" || resultado === "apto_acompanhamento") {
    conclusao =
      "atingiu os critérios de aprovação nesta avaliação" +
      (resultado === "apto_acompanhamento" ? ", com acompanhamento recomendado" : "") +
      "." +
      (pontos.length > 0 ? ` Recomenda-se reforço${emPontos}.` : "");
  }
  if (conclusao) paragrafos.push(`Conclusão: ${conclusao}`);
  return paragrafos.join("\n\n");
}

/** Divergências pra revisão do avaliador (só na tela; não entram no texto nem no PDF). */
function alertasV5(parecer: Parecer | null, parecerSugerido: Parecer | null, falhasCriticas: number): string[] {
  const alertas: string[] = [];
  if (parecer && parecerSugerido) {
    const finalAprova = APROVADOS.includes(parecer);
    const sistemaAprova = APROVADOS.includes(parecerSugerido);
    if (finalAprova !== sistemaAprova) {
      alertas.push(
        `O parecer final (${PARECER_LABELS[parecer]}) diverge do resultado calculado pelo sistema (${PARECER_LABELS[parecerSugerido]}). Revise antes de finalizar.`
      );
    }
  }
  if (falhasCriticas > 0 && parecer && APROVADOS.includes(parecer)) {
    alertas.push("Há falha em item configurado como crítico, mas o parecer final é de aprovação. Revise antes de finalizar.");
  }
  return alertas;
}
