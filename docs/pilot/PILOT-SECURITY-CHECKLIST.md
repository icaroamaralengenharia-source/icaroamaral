# ELO Pilot — Security Checklist

## Before pilot access

- [ ] Login uses a real, valid account/session.
- [ ] User, tenant/institution, role, and allowed unit are resolved by the backend.
- [ ] Local-only mode is not presented as authenticated mode.
- [ ] Anonymous and invalid sessions are blocked from private modules.

## Scope and isolation

- [ ] Same-tenant work, RDO, document, attachment, memory, vistoria, stock, and Action Bus flows pass.
- [ ] Cross-tenant and cross-institution reads/writes are blocked.
- [ ] Cross-unit municipal access is blocked unless the unit is authorized.
- [ ] Work context and municipal unit context remain separate.
- [ ] Forged `user_id`, `tenant_id`, `institution_id`, `unit_id`, `project_id`, `work_id`, and resource IDs do not expand access.

## Session and cache

- [ ] Reload with a valid session preserves authorized context.
- [ ] Expired/invalid session returns to login or a denied state; stale private cache is not treated as authorization.
- [ ] Private API and document responses use `Cache-Control: private, no-store`.
- [ ] Logout removes private auth context without deleting unrelated local operational data.

## Pilot evidence

- [ ] Focused security and regression suites pass.
- [ ] Unauthorized access attempts are denied without private data in the response.
- [ ] Logs contain no tokens, secrets, or raw private document content.
- [ ] No live database or migration was used for this checkpoint.
