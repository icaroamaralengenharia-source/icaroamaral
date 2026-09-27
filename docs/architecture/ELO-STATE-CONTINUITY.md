# ELO — State Continuity (Step 11)

## Scope

Step 11 defines what may survive a reload or close/reopen and how that state is
bound to the authenticated principal. It does not add Offline V2 behavior and
does not replace server authorization.

## Ownership and lifetime

| State | Owner | Reload | Close/reopen | Boundary |
| --- | --- | --- | --- | --- |
| Auth session/token | Supabase + canonical session layer | Restore only after token validation | Restore/refresh only while valid; otherwise login | user |
| User/tenant | Auth context and backend | Re-resolve from the validated session | Re-resolve from the validated session | user + tenant/institution |
| Current work | ObraReport route/state plus authenticated work list | Revalidate before use | Revalidate before use | user + tenant + work |
| Institution/unit | Municipal action adapter and authorized API | Revalidate institution; unit is cleared on identity mismatch | Re-select/revalidate | user + institution |
| RDO/draft | RDO contextual storage and backend registry | Restore only with matching tenant/work/date identity | Restore only with matching binding and TTL | user + tenant + work |
| Vistoria/document | Backend registry and authenticated route context | Re-fetch/revalidate by authorized ID | Re-fetch/revalidate by authorized ID | user + tenant + work |
| Attachment upload | RAM while uploading; backend document/evidence after success | Interrupted upload is discarded safely | Not restored as an in-flight operation | user + tenant + source record |
| Last analysis | RAM/session memory | Not restored as an unbound private fact; may be reconstructed from an authorized document/conversation | Not restored without authorized source | user + tenant + source |
| Conversation/memory | Backend conversation/memory APIs with identity-scoped client pointers | Restore only after valid auth and scoped pointer validation | Same rule; logout clears active surface | user + tenant |
| Work-session engine | Local continuity envelope | Restores only matching user, tenant/institution, work and unit | Same rule, with a bounded TTL | user + tenant + work/unit |

The client never treats a route, hash, local pointer, or cached object as proof
of authorization. Invalid, expired, malformed, or mismatched state is ignored
and the surface fails closed.

## Identity binding

The Step 11 work-session envelope is stored under a namespaced key containing
the normalized user, tenant/institution, work and municipal unit scope. The
envelope also stores a version and binding, so a value copied from another
scope cannot be adopted accidentally. Unauthenticated sessions are not
persisted by the private engine. Local mode is persistable only when the caller
explicitly selects `mode: "local"`/`localOnly: true`.

Municipal working context carries the user ID in addition to the institution.
When an authenticated user changes, a previously selected unit is discarded;
the next unit must come from the current institution's authorized list. A
different institution is also rejected by the existing tenant guard.

## Safety rules

- logout clears the active conversation surface and invalidates the canonical
  session; it does not make the browser appear authenticated through local data;
- a pending write may be resumed only by its existing operation ID and tenant
  binding; duplicate execution remains an idempotency concern of the action bus;
- corrupted JSON, expired envelopes, invalid IDs and stale route pointers are
  treated as absent, never as trusted context;
- refresh/reopen does not replay a completed write or create a second message;
- Netlify production remains outside this RC. Production smoke for Steps 05–15
  is pending the external hosting block.
