// Pins wordgard's development dependency to its latest npm release, sets the
// peer range to its patches, then syncs test/wordgard/ to the matching tag.
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Run npm's own script with Node rather than the npm command, which is
// npm.cmd on Windows and would need a shell. npm sets npm_execpath when it
// runs this script.
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("Run this with npm run update-wordgard.");
  process.exit(1);
}
const npm = (...args) =>
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    stdio: ["ignore", "pipe", "inherit"],
  })
    .toString()
    .trim();

const latest = npm("view", "wordgard", "version");
if (!/^\d+\.\d+\.\d+$/.test(latest)) {
  console.error(`Unexpected version from npm: ${latest}`);
  process.exit(1);
}

console.log(`Pinning wordgard ${latest}.`);
npm("install", "--save-dev", "--save-exact", `wordgard@${latest}`);
npm("pkg", "set", `peerDependencies.wordgard=~${latest}`);

execFileSync(process.execPath, [join(root, "scripts", "sync-wordgard-tests.js")], {
  stdio: "inherit",
});
console.log("Now run npm test.");
