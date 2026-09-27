# ELO Voice/Wake Handoff

## Purpose

Step 13 routes native wake-word and microphone commands through the active official WebView. The WebView remains the authenticated entry point for the existing ELO router and backend.

## Runtime contract

1. Android owns native recognition while the wake service is enabled.
2. A final command is sent only to a foreground `MainActivity` through a package-scoped, non-exported receiver.
3. `MainActivity` accepts the handoff only when the visible URL is trusted and invokes `EloAssistente.dispatchVoiceTranscript`.
4. The Web command path requires both `ELO_AUTH_SESSION_VALIDATED === true` and a usable canonical session token. It then calls the existing `askElo` router with source `native_voice`.
5. The Web response is returned through the trusted native bridge. Native TTS speaks that response; Web automatic TTS is suppressed for the same handoff.

Native Android does not call `/api/elo/command` directly and does not receive or persist a Supabase token. User, tenant, work, RDO, Stock, documents, and other permissions remain resolved by the existing authenticated Web/backend flow.

## Safety invariants

- No active authenticated foreground WebView means no backend command or write is attempted. The safe result is `Abra o ELO para continuar.` or a login-required response.
- Partial recognition is never dispatched; a final transcript is dispatched once per generation.
- Stale generations are ignored, and a single native handoff does not produce a second Web TTS response.
- Wake-only recognition stays local. Existing write-confirmation rules and router guards are unchanged.
- Logout, token expiry, or user/tenant change invalidates the handoff; a response is not accepted as authenticated after the session is lost.
- Background execution is deferred in the native service until the official WebView reports that it is foreground again.

## Validation status

- Web voice/wake and authenticated-handoff contracts: PASS (35 tests in the focused run).
- Android handoff source contracts: PASS (2 tests).
- Android unit tests: PASS with the existing SDK at `C:\Android\Sdk`.
- Physical App smoke: pending while `adb` is unavailable.
- Production deploy/smoke: not claimed; external hosting remains outside this RC.
