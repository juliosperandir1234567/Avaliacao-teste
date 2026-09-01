// Parser do formato de prova em Word usado pela empresa: checklist como "Nome do item"
// seguido de linhas "Sim (    )" / "Não (    )", e alternativas de múltipla escolha como
// parênteses em branco "(    ) texto" (sem letras A/B/C/D). Também aceita checkbox
// unicode/ASCII (☐ / [ ]) soltos como item de checklist.

export interface ParsedAlternativa {
  texto: string;
  correta: boolean;
}

export interface ParsedPergunta {
  enunciado: string;
  tipo: "multipla_escolha" | "checklist";
  alternativas: ParsedAlternativa[];
  precisaRevisao: boolean;
}

export interface ParsedAvaliacao {
  perguntas: ParsedPergunta[];
  checklist: ParsedPergunta[];
}

const CHECKBOX_PREFIXO_RE = /^(?:[☐☑✓]|\[\s?[xX]?\s?\])\s*/;
const SIM_NAO_LINHA_RE = /^(Sim|Não|Nao)\s*\(\s*\)\s*$/i;
const ALTERNATIVA_PARENTESES_RE = /^\(\s*\)\s*(.+)$/;

export function parseWordText(text: string): ParsedAvaliacao {
  const linhas = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const perguntas: ParsedPergunta[] = [];
  const checklist: ParsedPergunta[] = [];

  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];

    // "Nome do item" seguido de "Sim (    )" / "Não (    )" -> item de checklist
    if (i + 1 < linhas.length && SIM_NAO_LINHA_RE.test(linhas[i + 1])) {
      let j = i + 1;
      while (j < linhas.length && SIM_NAO_LINHA_RE.test(linhas[j])) j++;
      checklist.push({
        enunciado: linha.replace(CHECKBOX_PREFIXO_RE, ""),
        tipo: "checklist",
        alternativas: [],
        precisaRevisao: false,
      });
      i = j;
      continue;
    }

    // enunciado seguido de "(    ) alternativa" -> múltipla escolha (gabarito sempre
    // precisa ser revisado manualmente, o Word não indica qual é a correta)
    if (i + 1 < linhas.length && ALTERNATIVA_PARENTESES_RE.test(linhas[i + 1])) {
      const alternativas: ParsedAlternativa[] = [];
      let j = i + 1;
      while (j < linhas.length) {
        const m = linhas[j].match(ALTERNATIVA_PARENTESES_RE);
        if (!m) break;
        alternativas.push({ texto: m[1].trim(), correta: false });
        j++;
      }
      perguntas.push({
        enunciado: linha.replace(CHECKBOX_PREFIXO_RE, ""),
        tipo: "multipla_escolha",
        alternativas,
        precisaRevisao: true,
      });
      i = j;
      continue;
    }

    // checkbox solto (☐ / [ ]) -> item de checklist avulso
    if (CHECKBOX_PREFIXO_RE.test(linha)) {
      checklist.push({
        enunciado: linha.replace(CHECKBOX_PREFIXO_RE, ""),
        tipo: "checklist",
        alternativas: [],
        precisaRevisao: false,
      });
      i++;
      continue;
    }

    i++;
  }

  return { perguntas, checklist };
}
