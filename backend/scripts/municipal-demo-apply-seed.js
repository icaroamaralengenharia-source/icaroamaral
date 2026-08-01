import { isMain, runCli, runSqlOperation } from "./municipal-demo-lib.js";

function applySeed(args = {}, options = {}) {
  return runSqlOperation({ kind: "seed", args, env: options.env || process.env, cwd: options.cwd || process.cwd(), executor: options.executor || null });
}

if (isMain(import.meta.url)) {
  runCli("seed", (args) => applySeed(args), process.argv.slice(2));
}

export { applySeed };
