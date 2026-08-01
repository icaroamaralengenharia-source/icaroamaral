import { isMain, runCli, runSqlOperation } from "./municipal-demo-lib.js";

function applySchema(args = {}, options = {}) {
  return runSqlOperation({ kind: "schema", args, env: options.env || process.env, cwd: options.cwd || process.cwd(), executor: options.executor || null });
}

if (isMain(import.meta.url)) {
  runCli("schema", (args) => applySchema(args), process.argv.slice(2));
}

export { applySchema };
