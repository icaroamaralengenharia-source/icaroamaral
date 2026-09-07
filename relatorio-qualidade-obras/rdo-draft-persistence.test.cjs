const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const js = fs.readFileSync(path.join(__dirname, "relatorio-qualidade-obras.js"), "utf8");

test("RDO draft persistence uses contextual localStorage keys", () => {
  assert.match(js, /RDO_DRAFT_STORAGE_PREFIX = "obrareport:rdo:draft:v1"/);
  assert.match(js, /RDO_DRAFT_INDEX_KEY = "obrareport:rdo:draft:index:v1"/);
  assert.match(js, /RDO_DRAFT_LAST_KEY_PREFIX = "obrareport:rdo:draft:last:v1"/);
  assert.match(js, /function getDailyLogDraftIdentity_/);
  assert.match(js, /tenantId/);
  assert.match(js, /workId/);
  assert.match(js, /date/);
  assert.match(js, /userId/);
  assert.match(js, /buildDailyLogDraftStorageKey_/);
  assert.match(js, /buildDailyLogDraftLastStorageKey_/);
  assert.doesNotMatch(js, /localStorage\.setItem\("rdo:draft"/);
});

test("RDO draft persistence saves automatically and flushes before destructive navigation surfaces", () => {
  assert.match(js, /function scheduleDailyLogDraftSave_/);
  assert.match(js, /setTimeout\(function \(\) \{\s*persistDailyLogDraft_/);
  assert.match(js, /dailyLogForm\.addEventListener\("input", function \(\) \{\s*scheduleDailyLogDraftSave_/);
  assert.match(js, /dailyLogForm\.addEventListener\("change", function \(\) \{\s*scheduleDailyLogDraftSave_/);
  assert.match(js, /window\.addEventListener\("pagehide", function \(\) \{\s*flushDailyLogDraft_/);
  assert.match(js, /flushDailyLogDraft_\(\);\s*openDailyLogPdf_/);
  assert.match(js, /flushDailyLogDraft_\(\);\s*shareDailyLogSummary_\("whatsapp"\)/);
  assert.match(js, /flushDailyLogDraft_\(\);\s*shareDailyLogSummary_\("email"\)/);
});

test("RDO restores only compatible newer drafts and preserves photo captions", () => {
  assert.match(js, /function restoreDailyLogDraftForCurrentContext_/);
  assert.match(js, /findBestDailyLogDraftPayload_/);
  assert.match(js, /findLastDailyLogDraftPayload_/);
  assert.match(js, /findSavedDailyLogForDraft_/);
  assert.match(js, /compareIsoDate_\(saved\.updatedAt, payload\.updatedAt\) >= 0/);
  assert.match(js, /dailyLogDraft\.photos = cloneDailyLogItems_\(logItem\.photos\)/);
  assert.match(js, /currentDailyLogMaterialRequests_ = cloneDailyLogItems_\(logItem\.materialRequests\)/);
  assert.match(js, /photos: cloneDailyLogItems_\(dailyLogDraft\.photos\)/);
  assert.match(js, /captionInput\.dataset\.diaryPhotoCaptionId/);
});

test("RDO clears drafts only on explicit reset or after successful save", () => {
  assert.match(js, /resetDailyLogForm_\(\{ clearDraft: true \}\)/);
  assert.match(js, /saveLocalData\(\{ syncCloud: true \}\);[\s\S]*clearDailyLogDraftForLog_\(logItem\);[\s\S]*resetDailyLogForm_\(\{ clearDraft: false \}\)/);
  assert.match(js, /resetDailyLogForm_\(\{ clearDraft: false, restoreDraft: true \}\)/);
  assert.match(js, /setDailyLogStatus_\("Rascunho restaurado\.", "info"\)/);
});