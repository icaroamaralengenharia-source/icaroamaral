# ELO — Security Model

## Identity and session

Private API access requires a canonical `Authorization: Bearer <token>` session. The backend validates the token with Supabase Auth, resolves the matching `profiles` row by `auth_user_id`, and rejects missing, invalid, expired, or incomplete sessions. Headers and request bodies are input only; they never override the authenticated identity.

The browser's local-only session is an explicit offline/local product mode. It is not an authenticated backend session and cannot authorize private API calls. A failed session validation does not restore a private municipal view from local cache as if it were authorized.

## Scope resolution

- **User:** canonical authenticated user/profile resolved from the validated token.
- **Tenant/institution:** resolved from the profile (`company_id` with `institution_id` fallback, and the canonical institution scope); client-supplied tenant values are ignored.
- **Municipal context:** `institution_id -> unit_id`. Unit access is checked against the resolved institution and role/allowed-unit scope. `unit_id` is never treated as a work/project ID.
- **Work:** `project_id`/`work_id` is a resource inside the authenticated institution. Every work-scoped read or write must verify the resource belongs to that institution.

## Resource rules

- **RDO:** repository operations are scoped by authenticated institution and user/profile context; cross-tenant IDs fail closed.
- **Document:** registry lookup and artifact access are scoped by authenticated institution; document content is private and non-cacheable.
- **Attachment:** upload, read, and persistence use authenticated owner/tenant scope; anonymous and forged ownership are rejected.
- **Memory:** private memory is scoped to the authenticated owner and tenant; anonymous memory is separate and cannot read private memory.
- **Vistoria:** canonical authenticated context and work/institution checks are required.
- **Stock:** institution and unit permissions are enforced server-side; client-supplied institution/unit values cannot expand scope.
- **Prefeitura:** municipal routes require canonical auth and preserve institution/unit separation.
- **Action Bus:** actions are validated against the authenticated scope, with idempotency keys bound to the tenant/resource operation.

## Fail-closed and privacy rules

Missing or invalid IDs, missing auth, expired sessions, cross-tenant/cross-institution resources, and tampered user/tenant/work fields return a safe denial or validation error. Private API responses are marked `Cache-Control: private, no-store`; generated private PDFs are also non-cacheable. Logs use sanitized/masked diagnostics and do not receive raw document content or secrets.

## Validation boundary

Step 10 validation is local and test-only. It does not access a live database, run live migrations, publish production, or alter unrelated roadmap steps.
