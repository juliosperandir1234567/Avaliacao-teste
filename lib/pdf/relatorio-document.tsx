import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  APLICACAO_STATUS_LABELS,
  PARECER_LABELS,
  PERGUNTA_TIPO_LABELS,
} from "@/lib/types";
import { calcularNotaSecao } from "@/lib/scoring";
import type {
  AvaliacaoAlternativa,
  AvaliacaoAplicada,
  AvaliacaoCompetencia,
  AvaliacaoPergunta,
  AvaliacaoSecao,
  ChecklistEscala,
  ChecklistStatus,
  Parecer,
  Resposta,
} from "@/lib/types";

const CHECKLIST_STATUS_LABELS: Record<ChecklistEscala, Record<ChecklistStatus, string>> = {
  sim_nao: { sim: "Sim", nao: "Não", parcial: "Parcial", nao_avaliado: "Não avaliado" },
  sim_nao_na: { sim: "Sim", nao: "Não", parcial: "Parcial", nao_avaliado: "N.A." },
  zero_cinco_dez_na: { sim: "10", nao: "0", parcial: "5", nao_avaliado: "N.A." },
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  headerCard: {
    border: "1 solid #86b58c",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  headerLinha: { flexDirection: "row", alignItems: "center" },
  headerLogoCol: { width: 90, alignItems: "flex-start" },
  headerLogo: { width: 90, height: 90, objectFit: "contain" },
  headerTopo: { flexGrow: 1, alignItems: "center", textAlign: "center", gap: 4 },
  headerEmpresa: { fontSize: 10, fontWeight: 700, color: "#6b7280" },
  headerTitulo: { fontSize: 13, fontWeight: 700, marginTop: 1 },
  headerSubtitulo: { fontSize: 12, fontWeight: 700, marginTop: 1 },
  headerDivisor: {
    borderBottom: "1 solid #e5e7eb",
    marginVertical: 8,
  },
  linhaCampo: { marginBottom: 3 },
  h1: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  h2: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    borderBottom: "1 solid #d1d5db",
    paddingBottom: 3,
  },
  sub: { fontSize: 9, color: "#6b7280", marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  field: { width: "50%", marginBottom: 4 },
  label: { color: "#6b7280", fontSize: 8 },
  value: { fontSize: 9.5, fontWeight: 500 },
  notaRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
    marginVertical: 10,
  },
  notaBox: { alignItems: "center" },
  notaValor: { fontSize: 28, fontWeight: 700 },
  statusValor: { fontSize: 16, fontWeight: 700 },
  compGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  compItem: {
    width: "31%",
    border: "1 solid #e5e7eb",
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
  },
  pergunta: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: "0.5 solid #e5e7eb",
  },
  secaoHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 14,
    marginBottom: 6,
    borderBottom: "1 solid #d1d5db",
    paddingBottom: 3,
  },
  secaoNome: { fontSize: 11, fontWeight: 700 },
  secaoNota: { fontSize: 10, fontWeight: 700, color: "#374151" },
  perguntaTitulo: { fontWeight: 600, marginBottom: 2 },
  perguntaMeta: { color: "#6b7280", fontSize: 8, marginBottom: 2 },
  critico: { color: "#b91c1c", fontWeight: 700 },
  correto: { color: "#15803d", fontWeight: 700 },
  errado: { color: "#b91c1c", fontWeight: 700 },
  assinaturas: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  assinaturaBox: { width: "45%", alignItems: "center" },
  assinaturaImg: {
    width: 160,
    height: 70,
    objectFit: "contain",
    border: "1 solid #e5e7eb",
  },
});

function respostaTexto(
  pergunta: AvaliacaoPergunta,
  resposta: Resposta | undefined,
  alternativasTexto: Map<string, string>,
  escalaChecklist: ChecklistEscala = "sim_nao",
) {
  if (!resposta?.resposta) return "Não respondida";
  const v = resposta.resposta as Record<string, unknown>;
  if ("alternativa_id" in v)
    return alternativasTexto.get(String(v.alternativa_id)) ?? "-";
  if ("alternativa_ids" in v)
    return (
      (v.alternativa_ids as string[])
        .map((id) => alternativasTexto.get(id) ?? id)
        .join(", ") || "-"
    );
  if ("valor_bool" in v)
    return v.valor_bool === null
      ? "-"
      : v.valor_bool
        ? "Sim/Verdadeiro"
        : "Não/Falso";
  if ("status" in v) {
    return CHECKLIST_STATUS_LABELS[escalaChecklist][v.status as ChecklistStatus];
  }
  if ("valor_numerico" in v)
    return v.valor_numerico === null
      ? "-"
      : `${v.valor_numerico} ${pergunta.config.unidade ?? ""}`;
  if ("texto" in v) return String(v.texto || "-");
  return "-";
}

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.linhaCampo}>
      <Text style={styles.label}>{label}: </Text>
      <Text style={styles.value}>{value}</Text>
    </Text>
  );
}

/** Cor do status final: verde pra aprovado, vermelho pra reprovado/não recomendado. */
function corStatusParecer(parecer: Parecer | null | undefined) {
  if (parecer === "apto") return styles.correto;
  if (parecer === "reprovado" || parecer === "nao_recomendado")
    return styles.errado;
  return undefined;
}

/** Resposta correta (gabarito), quando o tipo de pergunta tem um gabarito objetivo. */
function respostaCorretaTexto(
  pergunta: AvaliacaoPergunta,
  alternativasDaPergunta: AvaliacaoAlternativa[],
) {
  switch (pergunta.tipo) {
    case "multipla_escolha":
    case "multiplas_respostas":
      return (
        alternativasDaPergunta
          .filter((a) => a.correta)
          .map((a) => a.texto)
          .join(", ") || "-"
      );
    case "verdadeiro_falso":
    case "sim_nao":
      if (pergunta.config.resposta_correta === undefined)
        return "Correção manual";
      return pergunta.config.resposta_correta
        ? pergunta.tipo === "sim_nao"
          ? "Sim"
          : "Verdadeiro"
        : pergunta.tipo === "sim_nao"
          ? "Não"
          : "Falso";
    case "numerica":
      if (
        pergunta.config.valor_min === undefined &&
        pergunta.config.valor_max === undefined
      )
        return "Correção manual";
      return `${pergunta.config.valor_min ?? "-"} a ${pergunta.config.valor_max ?? "-"} ${pergunta.config.unidade ?? ""}`.trim();
    default:
      return null;
  }
}

export function RelatorioDocument({
  aplicacao,
  avaliacaoNome,
  pessoaNome,
  matricula,
  cargo,
  estrutura,
  possuiCnhInterno,
  categoriaCnhInterno,
  observacoesInterno,
  candidatoExterno,
  avaliadorNome,
  secoes,
  perguntas,
  respostas,
  alternativas,
  alternativasTexto,
  competencias,
  assinaturaAvaliadoUrl,
  assinaturaAvaliadorUrl,
  logoUrl,
  nomeEmpresa,
}: {
  aplicacao: AvaliacaoAplicada;
  avaliacaoNome: string;
  pessoaNome: string;
  matricula: string;
  cargo: string;
  estrutura: string;
  possuiCnhInterno: boolean | null;
  categoriaCnhInterno: string | null;
  observacoesInterno: string | null;
  candidatoExterno: {
    telefone: string | null;
    possui_cnh: boolean | null;
    categoria_cnh: string | null;
    funcao_pretendida: string | null;
    empresas_anteriores: string | null;
    observacoes: string | null;
  } | null;
  avaliadorNome: string;
  secoes: AvaliacaoSecao[];
  perguntas: AvaliacaoPergunta[];
  respostas: Resposta[];
  alternativas: AvaliacaoAlternativa[];
  alternativasTexto: Map<string, string>;
  competencias: AvaliacaoCompetencia[];
  assinaturaAvaliadoUrl: string | null;
  assinaturaAvaliadorUrl: string | null;
  logoUrl: string | null;
  nomeEmpresa: string | null;
}) {
  const respostaPorPergunta = new Map(respostas.map((r) => [r.pergunta_id, r]));
  const secoesOrdenadas = [...secoes].sort((a, b) => a.ordem - b.ordem);
  const alternativasPorPergunta = new Map<string, AvaliacaoAlternativa[]>();
  for (const a of alternativas) {
    const lista = alternativasPorPergunta.get(a.pergunta_id) ?? [];
    lista.push(a);
    alternativasPorPergunta.set(a.pergunta_id, lista);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerCard}>
          <View style={styles.headerLinha}>
            <View style={styles.headerLogoCol}>
              {logoUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={logoUrl} style={styles.headerLogo} />
              ) : null}
            </View>
            <View style={styles.headerTopo}>
              {nomeEmpresa ? (
                <Text style={styles.headerEmpresa}>{nomeEmpresa}</Text>
              ) : null}
              <Text style={styles.headerTitulo}>RELATÓRIO DE AVALIAÇÃO</Text>
              <Text style={styles.headerSubtitulo}>{avaliacaoNome}</Text>
            </View>
            <View style={styles.headerLogoCol} />
          </View>

          <View style={styles.headerDivisor} />

          <FieldLine label="Teste" value={aplicacao.tipo_pessoa === "interno" ? "Interno" : "Externo"} />
          {aplicacao.tipo_pessoa === "interno" ? (
            <>
              <FieldLine label="Matrícula" value={matricula} />
              <FieldLine label="Colaborador" value={pessoaNome} />
              <FieldLine label="Cargo" value={cargo} />
              <FieldLine label="Estrutura" value={estrutura} />
              <FieldLine
                label="CNH"
                value={
                  possuiCnhInterno
                    ? categoriaCnhInterno || "Sim"
                    : possuiCnhInterno === false
                      ? "Não"
                      : "-"
                }
              />
              {observacoesInterno ? (
                <FieldLine label="Observações" value={observacoesInterno} />
              ) : null}
            </>
          ) : (
            <>
              <FieldLine label="Candidato" value={pessoaNome} />
              <FieldLine
                label="Telefone"
                value={candidatoExterno?.telefone ?? "-"}
              />
              <FieldLine
                label="CNH"
                value={
                  candidatoExterno?.possui_cnh
                    ? candidatoExterno.categoria_cnh || "Sim"
                    : candidatoExterno?.possui_cnh === false
                      ? "Não"
                      : "-"
                }
              />
              <FieldLine
                label="Último emprego"
                value={candidatoExterno?.empresas_anteriores ?? "-"}
              />
              {candidatoExterno?.observacoes ? (
                <FieldLine
                  label="Observações"
                  value={candidatoExterno.observacoes}
                />
              ) : null}
            </>
          )}
          <FieldLine label="Função avaliada" value={aplicacao.funcao_avaliada} />

          <View style={styles.headerDivisor} />

          <FieldLine label="Avaliador" value={avaliadorNome} />
          <FieldLine
            label="Data/Hora"
            value={`${new Date(aplicacao.data).toLocaleDateString("pt-BR")}, ${aplicacao.horario}`}
          />
          <Text style={styles.linhaCampo}>
            <Text style={styles.label}>Situação: </Text>
            <Text style={styles.value}>
              {APLICACAO_STATUS_LABELS[aplicacao.status]}
            </Text>
          </Text>
        </View>

        <View style={styles.notaRow}>
          <View style={styles.notaBox}>
            <Text style={styles.label}>NOTA GERAL</Text>
            <Text style={styles.notaValor}>
              {aplicacao.nota_geral !== null
                ? aplicacao.nota_geral.toFixed(1)
                : "-"}{" "}
              / 10
            </Text>
          </View>
          <View style={styles.notaBox}>
            <Text style={styles.label}>STATUS</Text>
            <Text
              style={[
                styles.statusValor,
                corStatusParecer(aplicacao.parecer_final as Parecer | null),
              ]}
            >
              {aplicacao.parecer_final
                ? PARECER_LABELS[aplicacao.parecer_final as Parecer]
                : "-"}
            </Text>
          </View>
        </View>

        {competencias.length > 0 ? (
          <>
            <Text style={styles.h2}>Competências</Text>
            <View style={styles.compGrid}>
              {competencias.map((c) => (
                <View key={c.id} style={styles.compItem}>
                  <Text style={styles.label}>{c.nome}</Text>
                  <Text style={styles.value}>
                    {aplicacao.notas_por_competencia?.[c.nome]?.toFixed(1) ??
                      "-"}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.h2}>
          Falhas críticas: {aplicacao.falhas_criticas_count}
          {aplicacao.interrompida_seguranca
            ? " — INTERROMPIDA POR SEGURANÇA"
            : ""}
        </Text>
        {aplicacao.motivo_interrupcao ? (
          <Text>{aplicacao.motivo_interrupcao}</Text>
        ) : null}

        {aplicacao.parecer_justificativa ? (
          <>
            <Text style={styles.h2}>Observação</Text>
            <Text>{aplicacao.parecer_justificativa}</Text>
          </>
        ) : null}

        {secoesOrdenadas.map((secao) => {
          const pesoSecao = Number(secao.peso || 0);
          const notaSecao = calcularNotaSecao(secao.id, perguntas, respostas);
          const pontosConquistados = notaSecao !== null ? (notaSecao * pesoSecao) / 10 : null;
          return (
          <View key={secao.id}>
            <View style={styles.secaoHeaderRow}>
              <Text style={styles.secaoNome}>{secao.nome}</Text>
              <Text style={styles.secaoNota}>
                {pontosConquistados !== null ? pontosConquistados.toFixed(1) : "-"} / {pesoSecao.toFixed(1)} pts
              </Text>
            </View>
            {perguntas
              .filter((p) => p.secao_id === secao.id)
              .sort((a, b) => a.ordem - b.ordem)
              .map((p) => {
                const r = respostaPorPergunta.get(p.id);

                if (p.tipo === "checklist") {
                  const status =
                    r?.resposta && "status" in r.resposta
                      ? r.resposta.status
                      : null;
                  const corStatus =
                    status === "sim"
                      ? styles.correto
                      : status === "nao"
                        ? styles.errado
                        : undefined;
                  return (
                    <View key={p.id} style={styles.pergunta}>
                      <Text style={styles.perguntaTitulo}>{p.enunciado}</Text>
                      <Text style={corStatus}>
                        {respostaTexto(p, r, alternativasTexto, secao.escala_checklist)}
                      </Text>
                      {r?.observacao ? (
                        <Text style={styles.perguntaMeta}>
                          Obs: {r.observacao}
                        </Text>
                      ) : null}
                      {r?.item_critico_falhou ? (
                        <Text style={styles.critico}>FALHA CRÍTICA</Text>
                      ) : null}
                    </View>
                  );
                }

                if (
                  p.tipo === "multipla_escolha" ||
                  p.tipo === "multiplas_respostas"
                ) {
                  const alternativasDaPergunta =
                    alternativasPorPergunta.get(p.id) ?? [];
                  const marcadas = new Set<string>();
                  if (r?.resposta) {
                    const v = r.resposta as Record<string, unknown>;
                    if ("alternativa_id" in v && v.alternativa_id)
                      marcadas.add(String(v.alternativa_id));
                    if ("alternativa_ids" in v)
                      (v.alternativa_ids as string[]).forEach((id) =>
                        marcadas.add(id),
                      );
                  }
                  return (
                    <View key={p.id} style={styles.pergunta}>
                      <Text style={styles.perguntaTitulo}>{p.enunciado}</Text>
                      <Text style={styles.perguntaMeta}>
                        {PERGUNTA_TIPO_LABELS[p.tipo]}
                        {p.item_critico ? " · ITEM CRÍTICO" : ""} · Nota:{" "}
                        {r?.pontuacao?.toFixed(1) ?? "-"}
                      </Text>
                      {alternativasDaPergunta.map((alt, i) => {
                        const letra = String.fromCharCode(65 + i);
                        const marcada = marcadas.has(alt.id);
                        const estilo = alt.correta
                          ? styles.correto
                          : marcada
                            ? styles.errado
                            : undefined;
                        return (
                          <Text key={alt.id} style={estilo}>
                            {letra}) {alt.texto}
                            {alt.correta
                              ? " ✓"
                              : marcada
                                ? " ✗ (marcada pelo candidato)"
                                : ""}
                          </Text>
                        );
                      })}
                      {r?.observacao ? (
                        <Text style={styles.perguntaMeta}>
                          Obs: {r.observacao}
                        </Text>
                      ) : null}
                      {r?.item_critico_falhou ? (
                        <Text style={styles.critico}>FALHA CRÍTICA</Text>
                      ) : null}
                    </View>
                  );
                }

                const errada = r?.pontuacao === 0;
                const acertouTotal =
                  r?.pontuacao !== null &&
                  r?.pontuacao !== undefined &&
                  r.pontuacao >= 10;
                const correta = respostaCorretaTexto(
                  p,
                  alternativasPorPergunta.get(p.id) ?? [],
                );
                return (
                  <View key={p.id} style={styles.pergunta}>
                    <Text style={styles.perguntaTitulo}>{p.enunciado}</Text>
                    <Text style={styles.perguntaMeta}>
                      {PERGUNTA_TIPO_LABELS[p.tipo]}
                      {p.item_critico ? " · ITEM CRÍTICO" : ""} · Nota:{" "}
                      {r?.pontuacao?.toFixed(1) ?? "-"}
                    </Text>
                    <Text
                      style={
                        errada
                          ? styles.errado
                          : acertouTotal
                            ? styles.correto
                            : undefined
                      }
                    >
                      Resposta marcada: {respostaTexto(p, r, alternativasTexto)}
                    </Text>
                    {correta && correta !== "Correção manual" ? (
                      <Text style={styles.correto}>
                        Resposta correta: {correta}
                      </Text>
                    ) : null}
                    {r?.observacao ? (
                      <Text style={styles.perguntaMeta}>
                        Obs: {r.observacao}
                      </Text>
                    ) : null}
                    {r?.item_critico_falhou ? (
                      <Text style={styles.critico}>FALHA CRÍTICA</Text>
                    ) : null}
                  </View>
                );
              })}
          </View>
          );
        })}

        <Text style={styles.h2}>Assinaturas</Text>
        <View style={styles.assinaturas}>
          <View style={styles.assinaturaBox}>
            {assinaturaAvaliadoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={assinaturaAvaliadoUrl} style={styles.assinaturaImg} />
            ) : (
              <Text>Não coletada</Text>
            )}
            <Text style={styles.label}>Avaliado — {pessoaNome}</Text>
          </View>
          <View style={styles.assinaturaBox}>
            {assinaturaAvaliadorUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={assinaturaAvaliadorUrl}
                style={styles.assinaturaImg}
              />
            ) : (
              <Text>Não coletada</Text>
            )}
            <Text style={styles.label}>Avaliador — {avaliadorNome}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
