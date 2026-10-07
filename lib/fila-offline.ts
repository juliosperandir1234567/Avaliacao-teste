/**
 * Fila local (IndexedDB do navegador) do que a prova precisa mandar pro servidor: respostas,
 * arquivos (evidência, foto da CNH, assinaturas) e observação final. Tudo é gravado aqui
 * PRIMEIRO e só sai da fila quando o servidor confirma — se o sinal cair no meio da prova, nada
 * se perde e o envio é refeito sozinho quando a conexão volta (ver aplicacao-runner.tsx).
 *
 * Sem IndexedDB (navegador antigo/modo restrito) cai pra memória: funciona como antes, só não
 * sobrevive a recarregar a página.
 */

import type { SalvarRespostaInput } from "@/app/(app)/aplicacoes/actions";

export type AcaoAposUpload = { tipo: "assinatura"; quem: "avaliado" | "avaliador" } | { tipo: "cnh" } | null;

export type ItemFila =
  | {
      id: string;
      aplicacaoId: string;
      tipo: "resposta";
      perguntaId: string;
      payload: SalvarRespostaInput;
      criadoEm: number;
    }
  | {
      id: string;
      aplicacaoId: string;
      tipo: "upload";
      bucket: "evidencias" | "assinaturas";
      path: string;
      blob: Blob;
      contentType?: string;
      depois: AcaoAposUpload;
      criadoEm: number;
    }
  | { id: string; aplicacaoId: string; tipo: "observacaoFinal"; texto: string; criadoEm: number };

const DB_NOME = "avaliacoes-offline";
const STORE = "fila";

const memoria = new Map<string, ItemFila>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function abrirDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NOME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function requisicao<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(modo: IDBTransactionMode) {
  const db = await abrirDb();
  return db ? db.transaction(STORE, modo).objectStore(STORE) : null;
}

export function idResposta(aplicacaoId: string, perguntaId: string) {
  return `resposta:${aplicacaoId}:${perguntaId}`;
}

/** Grava (ou substitui, mesmo id = mesma pergunta/arquivo) um item na fila. */
export async function enfileirar(item: ItemFila) {
  try {
    const s = await store("readwrite");
    if (s) return void (await requisicao(s.put(item)));
  } catch {
    // cai pra memória
  }
  memoria.set(item.id, item);
}

/** Remove o item só se ele não foi substituído por uma versão mais nova enquanto era enviado. */
export async function removerSeIgual(id: string, criadoEm: number) {
  try {
    const s = await store("readwrite");
    if (s) {
      const atual = (await requisicao(s.get(id))) as ItemFila | undefined;
      if (atual && atual.criadoEm === criadoEm) await requisicao(s.delete(id));
      return;
    }
  } catch {
    // cai pra memória
  }
  if (memoria.get(id)?.criadoEm === criadoEm) memoria.delete(id);
}

export async function listarFila(aplicacaoId: string): Promise<ItemFila[]> {
  let itens: ItemFila[] = [];
  try {
    const s = await store("readonly");
    if (s) itens = (await requisicao(s.getAll())) as ItemFila[];
  } catch {
    itens = [];
  }
  itens = [...itens, ...memoria.values()].filter((i) => i.aplicacaoId === aplicacaoId);
  // Arquivos primeiro (a resposta referencia o caminho da evidência), depois respostas, por
  // último a observação final.
  const ordem = { upload: 0, resposta: 1, observacaoFinal: 2 } as const;
  return itens.sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || a.criadoEm - b.criadoEm);
}

/** Erro de rede (sem sinal) x erro de verdade do servidor: só o primeiro deve ficar na fila. */
export function ehErroDeRede(erro: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = erro instanceof Error ? erro.message : String((erro as { message?: string })?.message ?? erro);
  return /fetch|network|load failed|timeout|offline/i.test(msg);
}
