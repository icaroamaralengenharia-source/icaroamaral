import { isMain, runCli, runSqlOperation } from "./municipal-demo-lib.js";

function verifyDemo(args = {}, options = {}) {
  return runSqlOperation({ kind: "verify", args, env: options.env || process.env, cwd: options.cwd || process.cwd(), executor: options.executor || null });
}

if (isMain(import.meta.url)) {
  runCli("verify", (args) => verifyDemo(args), process.argv.slice(2));
}

export { verifyDemo };
