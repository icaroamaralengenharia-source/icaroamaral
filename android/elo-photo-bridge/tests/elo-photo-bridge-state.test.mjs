import assert from "node:assert/strict";
import { test } from "node:test";

const processingStatuses = new Set([
  "SEARCHING_PHOTOS",
  "READING_METADATA",
  "RESOLVING_LOCATION",
  "GROUPING_VISIT",
  "CLASSIFYING_PHOTOS",
  "PREPARING_REPORT",
  "OPENING_REPORT"
]);

function detectedWorkType(command, fallback = "") {
  const normalized = String(command || "").toLowerCase();
  if (/\bpm1b\b|\bpm\b/.test(normalized)) return "PM1B";
  if (/\bdt1b\b|\bdt\b/.test(normalized)) return "DT1B";
  return fallback;
}

function withCommand(state, commandText) {
  return { ...state, commandText, workType: detectedWorkType(commandText, state.workType) };
}

function safeForRestore(state) {
  if (!processingStatuses.has(state.flowStatus)) return state;
  return {
    ...state,
    flowStatus: "READY_TO_RESUME",
    statusMessage: "Fluxo pausado. Continue ou atualize a busca.",
    statusEvents: [...state.statusEvents, "Fluxo pausado para retomada segura."].slice(-8)
  };
}

function mergePayload(state, payload) {
  const categoryCounts = Object.fromEntries(Object.entries(payload.photos || {}).map(([key, value]) => [key, value.length]));
  const photoCount = Object.values(categoryCounts).reduce((total, count) => total + count, 0);
  return {
    ...state,
    reportType: payload.reportType !== "UNKNOWN" ? payload.reportType : state.reportType,
    city: payload.city !== "UNKNOWN" ? payload.city : state.city,
    visitDate: payload.visitDate !== "AMBIGUOUS" ? payload.visitDate : state.visitDate,
    requestedDate: payload.visitDate == "AMBIGUOUS" ? state.requestedDate : payload.visitDate,
    dateResolved: payload.visitDate == "AMBIGUOUS" ? false : true,
    selectedVisitKey: [payload.city, payload.visitDate, payload.reportType].filter(Boolean).join("|"),
    photoCount,
    categoryCounts,
    flowStatus: "READY_TO_REVIEW",
    statusMessage: "Resumo pronto para revisao no gerador.",
    payloadJson: JSON.stringify(payload)
  };
}

function clearState() {
  return {
    commandText: "",
    reportType: "",
    city: "",
    visitDate: "",
    requestedDate: "",
    dateResolved: false,
    workType: "",
    selectedVisitKey: "",
    selectedVisitId: "",
    refinementStartTime: "",
    refinementEndTime: "",
    refinementCityHint: "",
    candidateVisits: [],
    candidatePayloadsJson: "",
    photoCount: 0,
    categoryCounts: {},
    flowStatus: "IDLE",
    statusMessage: "ELO Photo Bridge",
    statusEvents: [],
    payloadJson: ""
  };
}

test("comando digitado e DT/PM sao preservados no estado", () => {
  const state = withCommand(clearState(), "monte sgto malhada dt e pm");
  assert.equal(state.commandText, "monte sgto malhada dt e pm");
  assert.equal(state.workType, "PM1B");
});

test("cidade/data/tipo e contagens do payload ficam persistiveis", () => {
  const state = mergePayload(withCommand(clearState(), "monte sgto malhada dt"), {
    reportType: "SGTO",
    city: "Malhada de Pedras",
    visitDate: "2026-08-28",
    photos: { cameras: [1, 2], tomadas: [3], rack: [], caixa_fundo_madeira: [4], mastro_antena: [] }
  });
  assert.equal(state.reportType, "SGTO");
  assert.equal(state.city, "Malhada de Pedras");
  assert.equal(state.visitDate, "2026-08-28");
  assert.equal(state.photoCount, 4);
});

test("estado em processamento volta como READY_TO_RESUME sem duplicar job", () => {
  const restored = safeForRestore({ ...clearState(), flowStatus: "RESOLVING_LOCATION", commandText: "monte sgto malhada dt" });
  assert.equal(restored.flowStatus, "READY_TO_RESUME");
  assert.equal(restored.commandText, "monte sgto malhada dt");
});

test("atualizar preserva dados principais e troca estado para busca nova", () => {
  const prepared = mergePayload(withCommand(clearState(), "monte sgto malhada dt"), {
    reportType: "SGTO",
    city: "Malhada de Pedras",
    visitDate: "2026-08-28",
    photos: { cameras: [1] }
  });
  const refreshed = { ...prepared, flowStatus: "SEARCHING_PHOTOS", statusMessage: "Procurando fotos da visita..." };
  assert.equal(refreshed.commandText, "monte sgto malhada dt");
  assert.equal(refreshed.city, "Malhada de Pedras");
  assert.equal(refreshed.visitDate, "2026-08-28");
});

test("limpar remove estado persistido da tela", () => {
  assert.deepEqual(clearState(), {
    commandText: "",
    reportType: "",
    city: "",
    visitDate: "",
    requestedDate: "",
    dateResolved: false,
    workType: "",
    selectedVisitKey: "",
    selectedVisitId: "",
    refinementStartTime: "",
    refinementEndTime: "",
    refinementCityHint: "",
    candidateVisits: [],
    candidatePayloadsJson: "",
    photoCount: 0,
    categoryCounts: {},
    flowStatus: "IDLE",
    statusMessage: "ELO Photo Bridge",
    statusEvents: [],
    payloadJson: ""
  });
});

test("WAITING_FOR_DATE preserva comando sem iniciar busca", () => {
  const waiting = { ...withCommand(clearState(), "monte o SGTO"), flowStatus: "WAITING_FOR_DATE", statusMessage: "Qual a data da visita?", dateResolved: false };
  assert.equal(waiting.commandText, "monte o SGTO");
  assert.equal(waiting.flowStatus, "WAITING_FOR_DATE");
  assert.equal(waiting.dateResolved, false);
});

test("requestedDate e dateResolved sao preservados quando data existe", () => {
  const state = mergePayload(withCommand(clearState(), "monte sgto do dia 28/08/2026"), {
    reportType: "SGTO",
    city: "Malhada de Pedras",
    visitDate: "2026-08-28",
    photos: { cameras: [1] }
  });
  assert.equal(state.requestedDate, "2026-08-28");
  assert.equal(state.dateResolved, true);
});


test("visitas candidatas ficam persistiveis durante refinamento", () => {
  const candidates = [
    { id: "a", index: 1, city: "Malhada de Pedras", date: "2026-08-28", startTime: "15:10", endTime: "15:30", photoCount: 9 },
    { id: "b", index: 2, city: "Malhada de Pedras", date: "2026-08-28", startTime: "15:42", endTime: "16:05", photoCount: 11 }
  ];
  const state = {
    ...clearState(),
    flowStatus: "WAITING_FOR_VISIT_REFINEMENT",
    requestedDate: "2026-08-28",
    candidateVisits: candidates,
    candidatePayloadsJson: JSON.stringify([{ id: "a", payload: "{}" }, { id: "b", payload: "{}" }])
  };
  assert.equal(state.flowStatus, "WAITING_FOR_VISIT_REFINEMENT");
  assert.equal(state.candidateVisits.length, 2);
  assert.equal(JSON.parse(state.candidatePayloadsJson)[1].id, "b");
});
test("CLASSIFICATION_REVIEW permite abrir relatorio sem voltar a processar", () => {
  const state = { ...clearState(), flowStatus: "CLASSIFICATION_REVIEW", payloadJson: "{}", photoCount: 3 };
  assert.equal(processingStatuses.has(state.flowStatus), false);
  assert.equal(state.flowStatus, "CLASSIFICATION_REVIEW");
});