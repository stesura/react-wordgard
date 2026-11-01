// Copies Wordgard's browser tests (test/webtest-*.ts) and the helpers they
// import into test/wordgard/, from the Wordgard repo tag matching the
// installed version. The repo defaults to ../wordgard; set WORDGARD_REPO to
// use another clone.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "test", "wordgard");
const repo = resolve(root, process.env.WORDGARD_REPO ?? "../wordgard");

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const git = (...args) => execFileSync("git", ["-C", repo, ...args], { maxBuffer: 1 << 26 });

const readJSON = (path) => JSON.parse(readFileSync(path, "utf8"));

const { version } = readJSON(join(root, "node_modules", "wordgard", "package.json"));
const pinned = readJSON(join(root, "package.json")).devDependencies.wordgard;
if (pinned !== version)
  fail(
    `package.json asks for wordgard ${pinned} but ${version} is installed; run npm install first.`
  );

if (!existsSync(join(repo, ".git"))) fail(`No Wordgard clone at ${repo}; set WORDGARD_REPO.`);

try {
  git("fetch", "--tags", "--quiet");
} catch {
  console.error("git fetch failed; using the tags already in the clone.");
}
try {
  git("rev-parse", "--verify", "--quiet", `refs/tags/${version}`);
} catch {
  fail(`The Wordgard clone has no tag ${version}.`);
}

const show = (name) => git("show", `${version}:test/${name}`);

// The webtests, plus every local file they import, transitively.
const names = git("ls-tree", "--name-only", `${version}:test/`)
  .toString()
  .split("\n")
  .filter((name) => /^webtest-.*\.ts$/.test(name));
const files = new Map();
for (let i = 0; i < names.length; i++) {
  const name = names[i];
  const content = show(name);
  files.set(name, content);
  for (const [, dep] of content.toString().matchAll(/from\s+["']\.\/([^"']+\.ts)["']/g))
    if (!names.includes(dep)) names.push(dep);
}

mkdirSync(target, { recursive: true });
const existing = new Set(readdirSync(target).filter((n) => n.endsWith(".ts")));
const report = { added: [], changed: [], removed: [] };
for (const [name, content] of files) {
  const path = join(target, name);
  if (!existing.has(name)) report.added.push(name);
  else if (!readFileSync(path).equals(content)) report.changed.push(name);
  writeFileSync(path, content);
  existing.delete(name);
}
for (const name of existing) {
  rmSync(join(target, name));
  report.removed.push(name);
}

console.log(
  `Wordgard ${version}: ${files.size} files in ${basename(target)}/ (${names.filter((n) => n.startsWith("webtest-")).length} test files).`
);
for (const [kind, list] of Object.entries(report))
  if (list.length) console.log(`  ${kind}: ${list.join(", ")}`);
if (!report.added.length && !report.changed.length && !report.removed.length)
  console.log("  No changes.");
