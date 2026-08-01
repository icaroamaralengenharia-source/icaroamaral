import { CONFIRMATIONS, FILES, assertNoBlockedProject, assertSqlSafety, buildContext, isMain, parseArgs, readRequiredFile, runCli, sanitize } from "./municipal-demo-lib.js";

async function preflight(args = {}, options = {}) {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const context = buildContext(args, env, cwd);
  assertNoBlockedProject(env);
  const files = {};
  for (const [kind, relativePath] of Object.entries(FILES)) {
    const file = readRequiredFile(context.root, relativePath);
    assertSqlSafety(kind, file.content);
    files[kind] = {
      path: file.relativePath,
      sha256: file.sha256,
      bytes: file.bytes
    };
  }
  return sanitize({
    ok: true,
    dry_run: true,
    project_ref: context.projectRef ? "[configured]" : "[not_configured]",
    demo_mode: context.demoMode,
    service_role_configured: context.serviceRoleConfigured,
    blocked_projects: "checked",
    confirmations: CONFIRMATIONS,
    files
  });
}

if (isMain(import.meta.url)) {
  runCli("preflight", (args) => preflight(args), process.argv.slice(2));
}

export { parseArgs, preflight };
