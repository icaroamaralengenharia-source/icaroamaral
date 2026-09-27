# Pilot Voice/Wake Checklist

- [ ] Official Android app is installed and the physical device is reachable.
- [ ] Native wake recognition can start and stop without duplicate listeners.
- [ ] Partial transcripts are ignored and one final transcript produces one dispatch.
- [ ] No-auth or expired-session handoff is blocked with login-required guidance.
- [ ] Authenticated WebView preserves the same user and tenant as the Web session.
- [ ] Native transcript reaches the existing ELO router with source `native_voice`.
- [ ] Calculator, RDO, Stock, Vistoria, Documents, Prefeitura, and other existing routes keep their current guards.
- [ ] Write commands still require the existing confirmation flow.
- [ ] The native TTS speaks the Web response exactly once.
- [ ] Logout blocks a pending or subsequent native command.
- [ ] User switch and tenant switch do not bleed context or permissions.
- [ ] Cross-user, cross-tenant, and invalid-work requests remain blocked.
- [ ] Wake-only acknowledgement does not call the backend.
- [ ] Manual microphone input and native wake input do not run two recognizers at once.
- [ ] Physical App smoke is completed when `adb` is available.
- [ ] Production smoke is completed only after the external hosting blocker is released.

Current RC evidence: focused Web contracts 35/35, Android handoff contracts 2/2, Android unit tests PASS. Physical and production checks remain pending and are not production claims.
