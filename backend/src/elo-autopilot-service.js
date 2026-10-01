import { randomUUID } from "node:crypto";
import { prepareEditorialPost, publishPreparedEditorialPost } from "../../scripts/elo-autopilot.mjs";

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function publicDraft(draft) {
  const post = draft && draft.post || {};
  const report = draft && draft.report || {};
  return {
    draftId: draft.draftId,
    topic: draft.topic,
    preparedAt: draft.preparedAt,
    report: {
      candidates: report.candidates || 0,
      pautas: report.pautas || 0,
      sourcesRead: report.sourcesRead || 0,
      llm: report.llm || "FAIL",
      antiCopy: report.antiCopy || "FAIL",
      antiHallucination: report.antiHallucination || "FAIL",
      image: report.image || "FAIL",
      post: report.post || "FAIL",
      seo: report.seo || "FAIL",
      sitemap: report.sitemap || "FAIL",
      publication: report.publication === true,
      blockers: Array.isArray(report.blockers) ? report.blockers.slice(0, 5) : []
    },
    draft: {
      titulo: post.titulo || "",
      subtitulo: post.subtitulo || "",
      resumo: post.resumo || "",
      slug: post.slug || "",
      categoria: post.categoria || "",
      tags: Array.isArray(post.tags) ? post.tags : [],
      fontes: Array.isArray(post.fontes) ? post.fontes : [],
      imagem: post.imagem || "",
      seoTitle: post.seoTitle || "",
      seoDescription: post.seoDescription || ""
    }
  };
}

export function createEloAutopilotService(options = {}) {
  const drafts = options.drafts || new Map();
  const prepareFn = options.prepareEditorialPost || prepareEditorialPost;
  const publishFn = options.publishPreparedEditorialPost || publishPreparedEditorialPost;
  const now = options.now || (() => new Date());
  const fetchImpl = options.fetchImpl;
  const lookup = options.lookup;
  const configPath = options.configPath;
  const log = options.log || (() => {});

  async function prepare(input = {}) {
    const topic = clean(input.topic || input.message).slice(0, 180);
    if (!topic || topic.length < 3) throw Object.assign(new Error("topic_required"), { status: 400 });
    const draft = await prepareFn({ topic, configPath, fetchImpl, lookup, now: now(), log });
    const stored = Object.assign({}, draft, { draftId: draft.draftId || randomUUID(), status: "pending_confirmation" });
    drafts.set(stored.draftId, stored);
    return publicDraft(stored);
  }

  async function publish(input = {}) {
    const draftId = clean(input.draftId);
    if (!draftId) throw Object.assign(new Error("draft_id_required"), { status: 400 });
    const draft = drafts.get(draftId);
    if (!draft) throw Object.assign(new Error("draft_not_found_or_consumed"), { status: 404 });
    if (draft.status === "publishing") throw Object.assign(new Error("draft_already_publishing"), { status: 409 });
    draft.status = "publishing";
    drafts.set(draftId, draft);
    try {
      const publication = await publishFn(draft, { now: now() });
      drafts.delete(draftId);
      return Object.assign({ draftId, topic: draft.topic }, publication);
    } catch (error) {
      draft.status = "pending_confirmation";
      drafts.set(draftId, draft);
      throw error;
    }
  }

  async function cancel(input = {}) {
    const draftId = clean(input.draftId);
    if (draftId) drafts.delete(draftId);
    return { ok: true, draftId };
  }

  return { prepare, publish, cancel, _drafts: drafts };
}

export function sendEloAutopilotError(response, error) {
  response.status(Number(error && error.status) || 500).json({ ok: false, error: clean(error && error.message || "elo_autopilot_error") });
}
