import { isMain, runCli, runSqlOperation } from "./municipal-demo-lib.js";

function cleanupDemo(args = {}, options = {}) {
  return runSqlOperation({ kind: "cleanup", args, env: options.env || process.env, cwd: options.cwd || process.cwd(), executor: options.executor || null });
}

if (isMain(import.meta.url)) {
  runCli("cleanup", (args) => cleanupDemo(args), process.argv.slice(2));
}

export { cleanupDemo };
