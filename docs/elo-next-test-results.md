# ELO NEXT — test results

Date: 2026-10-03

## Passed

- `node --test --test-reporter=spec relatorio-qualidade-obras/elo-central-orchestrator.test.cjs tests/elo-central-orchestrator-static.test.cjs`: 20/20.
- Focused primary adapter gate: `ELO central primary: adapters legados são registrados no orquestrador`: pass.
- `node --check relatorio-qualidade-obras/elo-central-orchestrator.js`: pass.
- `node --check relatorio-qualidade-obras/elo-assistente.js`: pass.
- `git diff --check`: pass.
- `node --test tests/elo-conversation-conductor-unit.test.cjs relatorio-qualidade-obras/elo-offline-core-v2.test.cjs`: 8/8.

## Android environment blocker

Command attempted: `android-elo/gradlew.bat :app:compileDebugKotlin --no-daemon`

Result: `FAIL` before Kotlin compilation because Gradle could not establish its loopback connection. The wrapper download was also blocked by the restricted sandbox on the first attempt. No APK was produced and no device data was changed.

## Scope protection

- Stock Full files were not modified.
- No secrets were read, printed, committed or copied.
- No database, Supabase, authentication or production environment mutation was performed.
- Stock Full implementation remains untouched; it is not registered as a central implementation.
- Web central mode is primary only for the first migrated cluster: deterministic fast paths, explicit memory, active document, engineering, report-from-context, active-work, budget, writing, explicit tool navigation and explicit media. Attachments, RDO and Stock Full retain their existing contracts.
- The rollout exposes shadow comparison and promotion-gate telemetry with fallback reasons.
