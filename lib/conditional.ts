import type { AvaliacaoPergunta, RespostaValor } from "./types";

/** Rótulos do valor-gatilho disponíveis, por tipo de pergunta "pai". */
export function opcoesGatilho(paiTipo: AvaliacaoPergunta["tipo"]): { value: string; label: string }[] {
  switch (paiTipo) {
    case "checklist":
      return [
        { value: "sim", label: "Sim" },
        { value: "nao", label: "Não" },
        { value: "parcial", label: "Parcial" },
      ];
    case "sim_nao":
      return [
        { value: "true", label: "Sim" },
        { value: "false", label: "Não" },
      ];
    case "verdadeiro_falso":
      return [
        { value: "true", label: "Verdadeiro" },
        { value: "false", label: "Falso" },
      ];
    default:
      return [];
  }
}

/** Tipos de pergunta que podem servir de "pai" de uma condicional. */
export function podeSerPai(tipo: AvaliacaoPergunta["tipo"]): boolean {
  return tipo === "checklist" || tipo === "sim_nao" || tipo === "verdadeiro_falso";
}

function valorAtual(paiTipo: AvaliacaoPergunta["tipo"], valor: RespostaValor | null | undefined): string | null {
  if (!valor) return null;
  if (paiTipo === "checklist" && "status" in valor) return valor.status;
  if ((paiTipo === "sim_nao" || paiTipo === "verdadeiro_falso") && "valor_bool" in valor) {
    if (valor.valor_bool === null) return null;
    return String(valor.valor_bool);
  }
  return null;
}

/** Verifica se a pergunta deve ser exibida, dado o mapa de respostas já dadas. */
export function condicaoAtendida(
  pergunta: AvaliacaoPergunta,
  perguntasPorId: Map<string, AvaliacaoPergunta>,
  respostaPorPergunta: Map<string, RespostaValor | null | undefined>
): boolean {
  const paiId = pergunta.config.condicional_pergunta_id;
  const gatilho = pergunta.config.condicional_valor;
  if (!paiId || gatilho === undefined) return true;

  const pai = perguntasPorId.get(paiId);
  if (!pai) return true;

  const atual = valorAtual(pai.tipo, respostaPorPergunta.get(paiId));
  return atual === gatilho;
}
