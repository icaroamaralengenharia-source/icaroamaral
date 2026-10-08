# ELO QA Source Manifest

- Base commit: `42c2023760c5b1d11a5b218468efc2152ea17ab0`
- Branch: `qa/elo-mobile-auth-header-ci-20261008`
- Worktree: `C:\elo-auth-header-qa-ci-20261008`
- Source comparison: `C:\elo-auth-header-qa-reconcile-20261008\reports\DRIFT_REPORT.md`

## Applied files and provenance

| File | SHA-256 | Provenance and selection |
|---|---|---|
| `app/build.gradle.kts` | `487D43AEEDE8423A7E2B88B48B74AE41F95DC9F6D519356E581ADDD0642F5D83` | Exact base retained; QA flavor added with isolated package/version overrides. Default production identity remains code 3 / 0.3.0. |
| `app/src/qa/AndroidManifest.xml` | `1AA09F3952DAC9836C4D781472865C98526651C4EDA8BB560E26A9DFB48067B2` | Source and ASCII copies were byte-identical; selected from source. |
| `app/src/main/java/br/com/icaroamaral/elo/EloWebViewHotfix.kt` | `9347EF5F5B14EF80F41BD55DA077F63B8FDA91897391CFB40B3D7722DCA567B8` | Source version selected; it preserves the full QA-only mobile auth/header override. ASCII copy had only chip suppression. |
| `app/src/main/java/br/com/icaroamaral/elo/MainActivity.kt` | `80AB3B60BDFEFDD8FA9B89869D7115046651034C89815D396EFD5BB45FB8CDB6` | Exact base commit plus only the QA interception, QA cache, and QA service-worker blocks common to both copies. No full source/ASCII file was imported. |
| `app/src/main/java/br/com/icaroamaral/elo/EloQaWebResourcePolicy.kt` | `A91C5FFA3F262533388C82E028E21AAA0D18884B04328E15CA32B5F1EBCBD156` | Source and ASCII copies were byte-identical; selected from source. |
| `app/src/test/kotlin/br/com/icaroamaral/elo/EloQaShellContractTest.kt` | `C6065125E8A834533D7BF82059188F6E492158C8F606A0448AAF25C4D385C9AF` | Source and ASCII copies were byte-identical; selected from source. |
| `app/src/qa/assets/elo-qa/elo.html` | `7A052B74438AE6BCCBEF2DB7009DA6E74B055FA827C3C6149382F1FB548C9F9B` | Source and ASCII copies were byte-identical; supplied expected hash verified. |
| `app/src/qa/assets/elo-qa/elo.css` | `BCB456342C2344A09DA3D864433BAC35CAA8EFD9C93B4A1CFE5D89AC2F5BD4D8` | Source and ASCII copies were byte-identical; supplied expected hash verified. |
| `.github/workflows/elo-qa-build.yml` | `F9FD728A4B2B49FAF7D909F3BDD4EDDFFFF9F6947CE90643948A32AFAC2FA8E6` | New QA-only workflow; existing workflows did not target this branch/flavor. |

## Preserved contracts

- QA application ID: `br.com.icaroamaral.elo.qa`.
- QA label: `ELO QA`.
- QA version: `0.4.2-qa` (version code 6).
- Production default identity remains `br.com.icaroamaral.elo`, version code 3, version `0.3.0`.
- HTML and CSS hashes match the supplied values; native routing validates HTTPS, exact host, exact path, and QA debug flavor before serving QA assets.
- Query strings are accepted for the exact asset paths; unrelated requests fall through to the normal WebView path.
- WebView cache and service-worker interception are gated to QA debug; the QA service-worker response is no-op and responses carry no-cache headers.
- Hotfix retains the QA-only single Online marker, compact menu actions, EDU-REX and logout handlers, idempotence, and no forced `.elo-core-actions` grid.
- CI uses JDK 17, runs `:app:testQaDebugUnitTest` and `:app:assembleQaDebug`, verifies asset hashes, and uploads `elo-qa-apk`. It has no deployment/release steps.

## Validation basis

- Android Gradle Plugin: `8.7.3`; Kotlin Android plugin: `2.0.21`.
- QA flavor `qa`, debug build type, and the test under `app/src/test/kotlin` yield the `testQaDebugUnitTest` task name.
- Static QA contract checks passed. The default staged `git diff --check` reports only the exact HTML asset’s intentional blank line at EOF; its required SHA-256 is unchanged. All staged files pass `git diff --check` with only `blank-at-eof` disabled for this verification.
- No Gradle command was run on Windows.
