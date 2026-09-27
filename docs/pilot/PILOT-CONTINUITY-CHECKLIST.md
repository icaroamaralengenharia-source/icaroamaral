# Pilot Continuity Checklist — Step 11

Use this checklist against a local/RC build. It is not a production sign-off.

## Session and identity

- [ ] Login produces a validated token and canonical user context.
- [ ] Reload keeps the session only after backend/token validation.
- [ ] Expired/invalid session shows login or a closed state; it never becomes a
      silent local user.
- [ ] Logout clears the active private surface.
- [ ] Switching user or tenant clears the previous private context.

## Work and municipal context

- [ ] Current work is restored only from the authenticated work list.
- [ ] A municipal institution and unit are revalidated for the current user.
- [ ] Switching Unit A → Unit B leaves no Unit A data in the active query.
- [ ] Switching institution blocks access to the previous institution's unit.
- [ ] Work IDs and municipal unit IDs are never substituted for one another.

## RDO, vistoria, documents and attachments

- [ ] RDO draft reload uses the same tenant/work/date/user binding.
- [ ] RDO registry/document access is revalidated after reload.
- [ ] A completed action is not written twice after refresh/reopen.
- [ ] A pending action resumes only with the same operation ID and tenant.
- [ ] An interrupted upload does not leave an infinite spinner or phantom file.
- [ ] Vistoria/document/attachment references fail closed when the ID is invalid.

## ELO continuity

- [ ] The conversation pointer is identity-scoped.
- [ ] Last analysis is not exposed to a different user, tenant or source record.
- [ ] Memory is loaded from the authorized backend/context; malformed local data
      is ignored.
- [ ] Back/forward, hash navigation and reload do not change authorization.

## Evidence to attach to the RC

- focused Step 11 tests;
- Step 06–10 regression results;
- `git diff --check` and clean staged diff summary;
- CI result for the Step 11 pull request;
- no production deploy or production-pass claim while Netlify is blocked.
