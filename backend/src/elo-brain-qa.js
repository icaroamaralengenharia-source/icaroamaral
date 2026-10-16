import express from 'express';
import cors from 'cors';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';

export const CANONICAL_IDENTITY_URL = 'https://obrareport-backend.onrender.com/api/elo/me';
const origins = ['https://www.icaroamaral.com.br', 'https://icaroamaral.com.br'];
export function qaInferenceEnv(env) {
  return {
    NODE_ENV: 'qa', OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_ELO_MODEL: env.OPENAI_ELO_MODEL || 'gpt-4.1-mini',
    ELO_CORE_STORE: 'json', ELO_RDO_STORE: 'file', ELO_TELEMETRY_STORE: 'memory',
    ELO_CORE_STORE_PATH: join(tmpdir(), 'elo-brain-qa-core.json'),
    ELO_VECTOR_MEMORY_PATH: join(tmpdir(), 'elo-brain-qa-vector.json'),
    AI_ALLOWED_ORIGINS: origins.join(',')
  };
}

/** Inference only. No Supabase admin credential, history route or production write. */
export function createEloBrainQaApp({env = process.env, fetchImpl = fetch, inferenceApp} = {}) {
  const app = express();
  app.disable('x-powered-by');
  const core = inferenceApp || createApp({env: qaInferenceEnv(env), enableEloTelemetryRetention: false, conversationOnlyChat: true});
  core.locals.resolveAuthContext = async request => request.eloQaAuth;
  core.locals.resolveCanonicalAuthContext = core.locals.resolveAuthContext;
  const allowedHashes = new Set(String(env.ELO_QA_ALLOWED_USER_HASHES || '').split(',').filter(x => /^[a-f0-9]{64}$/.test(x)));
  const attempts = new Map();
  let pending = 0;
  app.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-ELO-Environment', 'qa');
    res.set('X-ELO-Source-Commit', String(env.RENDER_GIT_COMMIT || 'local').replace(/[^a-f0-9]/g, '').slice(0, 40));
    next();
  });
  app.use(cors({origin(origin, done) { done(null, !origin || origins.includes(origin)); }}));
  app.get('/api/health', (req, res) => res.json({ok: true, service: 'elo-brain-qa',
    sourceCommit: env.RENDER_GIT_COMMIT || 'local', inferenceConfigured: Boolean(env.OPENAI_API_KEY),
    allowedUserConfigured: allowedHashes.size > 0, historyRoutesExposed: false,
    productionDatabaseCredentials: false}));
  app.use((req, res, next) => {
    if (req.method !== 'POST' || req.path !== '/api/elo/chat') return res.status(404).json({ok: false, error: 'qa_inference_only'});
    if (req.headers.origin && !origins.includes(req.headers.origin)) return res.status(403).json({ok:false,error:'origin_not_allowed'});
    const key = req.socket.remoteAddress;
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.until < now) attempts.delete(ip);
    const entry = attempts.get(key) || {count:0, until:now+60_000};
    if (attempts.size >= 1000 && !attempts.has(key)) return res.status(429).json({ok:false,error:'qa_busy'});
    attempts.set(key, entry);
    if (++entry.count > 30 || pending >= 2) return res.status(429).json({ok:false,error:'qa_rate_limit'});
    if (!env.OPENAI_API_KEY || !allowedHashes.size) return res.status(503).json({ok:false,error:'qa_not_configured'});
    next();
  });
  app.use(express.json({limit:'1mb'}));
  app.use(async (req, res, next) => {
    const authorization = String(req.headers.authorization || '');
    if (!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization) || authorization.length > 12_100)
      return res.status(401).json({ok:false,error:'authentication_required'});
    pending++;
    let released = false;
    const release = () => { if (!released) { released=true; pending--; } };
    res.once('close',release); res.once('finish',release);
    try {
      const identityResponse = await fetchImpl(CANONICAL_IDENTITY_URL, {method:'GET', redirect:'error',
        headers:{Authorization:authorization,Accept:'application/json'},signal:AbortSignal.timeout(12_000)});
      if (!identityResponse.ok) return res.status([401,403].includes(identityResponse.status)?identityResponse.status:503).json({ok:false,error:'canonical_auth_rejected'});
      const identity = await identityResponse.json();
      if (!identity.ok || typeof identity.user_id !== 'string' || !allowedHashes.has(createHash('sha256').update(identity.user_id).digest('hex')))
        return res.status(403).json({ok:false,error:'qa_user_not_allowed'});
      req.eloQaAuth={ok:true,userId:identity.user_id,institutionId:identity.institution_id,companyId:identity.company_id,
        profile:{auth_user_id:identity.user_id,institution_id:identity.institution_id,company_id:identity.company_id}};
      // A QA request cannot save persistent memory, even if asked by a prompt.
      if (req.body && typeof req.body === 'object') req.body.context={...(req.body.context || {}),memoryScope:'CONVERSATION_ONLY'};
      next();
    } catch { res.status(503).json({ok:false,error:'canonical_auth_unavailable'}); }
  });
  app.use(core);
  app.use((err, req, res, next) => { if (!res.headersSent) res.status(400).json({ok:false,error:'qa_invalid_request'}); });
  return app;
}
