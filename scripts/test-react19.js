// Type-checks and tests on React 19, as CI's React 19 job does: the lockfile
// pins React 18. Puts React 18 back after, as the lockfile has it.
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// npm's own script run with Node, as update-wordgard.js does: on Windows the
// npm command is npm.cmd, which would need a shell.
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("Run this with npm run test:react19.");
  process.exit(1);
}
const npm = (...args) =>
  execFileSync(process.execPath, [npmCli, ...args], { cwd: root, stdio: "inherit" });

let failed = false;
try {
  npm("install", "--no-save", "react@19", "react-dom@19", "@types/react@19", "@types/react-dom@19");
  // Not through turbo: its cache doesn't know React changed.
  npm("run", "typecheck", "--workspaces");
  npm("exec", "--", "tsc");
  npm("test");
} catch {
  failed = true;
} finally {
  npm("install");
}
if (failed) {
  console.error("Failed on React 19.");
  process.exit(1);
}
