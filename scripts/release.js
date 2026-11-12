// Releases the packages, together and at one version (the views pin the core),
// in two steps around the release commit, which stays the maintainer's to make:
//
//   npm run release:prepare -- <version>   CHANGELOGs and versions set, checks
//                                          and tests run locally, on React 18
//                                          and 19
//   (commit and push)
//   npm run release:publish                CI run on the pushed commit, then
//                                          npm publish, tag, GitHub release,
//                                          demo deployed
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// In publishing order: the views depend on the core.
const packages = ["core", "react", "vue"].map((dir) => join(root, "packages", dir));
const changelogOf = (dir) => join(dir, "CHANGELOG.md");
const core = "@stesura/wordgard-view";
const branch = "master";

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

// npm's own script run with Node, as update-wordgard.js does: on Windows the
// npm command is npm.cmd, which would need a shell.
const npmCli = process.env.npm_execpath;
if (!npmCli) fail("Run this with npm run release:prepare or npm run release:publish.");

const run = (command, args, { quiet = false } = {}) =>
  execFileSync(command, args, {
    cwd: root,
    stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
  })
    ?.toString()
    .trim() ?? "";
const output = (command, args) => run(command, args, { quiet: true });
const npm = (...args) => run(process.execPath, [npmCli, ...args]);
const npmOutput = (...args) => output(process.execPath, [npmCli, ...args]);
const git = (...args) => output("git", args);
const gh = (...args) => output("gh", args);

const succeeds = (f) => {
  try {
    f();
    return true;
  } catch {
    return false;
  }
};

const pkg = (dir) => JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
const names = () => packages.map((dir) => pkg(dir).name);
const workspaces = () => names().flatMap((name) => ["-w", name]);

// On the release branch, nothing uncommitted, the same commit as origin's.
const checkTree = () => {
  if (git("branch", "--show-current") != branch) fail(`Release from ${branch}.`);
  if (git("status", "--porcelain")) fail("Commit or discard your changes first.");
  git("fetch", "origin", branch);
  if (git("rev-parse", "HEAD") != git("rev-parse", `origin/${branch}`))
    fail(`HEAD isn't origin/${branch}: pull or push first.`);
};

// The CHANGELOG section of `version`, without its heading.
const section = (changelog, version) => {
  const start = changelog.indexOf(`## ${version} (`);
  if (start < 0) return null;
  const body = changelog.indexOf("\n", start) + 1;
  const end = changelog.indexOf("\n## ", body);
  return changelog.slice(body, end < 0 ? undefined : end).trim();
};

const prepare = (version) => {
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? ""))
    fail("Usage: npm run release:prepare -- <version>, as 0.2.0.");
  checkTree();
  for (const name of names())
    if (succeeds(() => npmOutput("view", `${name}@${version}`, "version")))
      fail(`${name}@${version} is on npm already: a version can't be published twice.`);

  const date = new Date().toISOString().slice(0, 10);
  for (const dir of packages) {
    const path = changelogOf(dir);
    const changelog = readFileSync(path, "utf8");
    if (changelog.startsWith("## Unreleased\n")) {
      writeFileSync(path, changelog.replace("## Unreleased", `## ${version} (${date})`));
      console.log(`${pkg(dir).name}: ## Unreleased is now ## ${version} (${date}).`);
    } else if (!section(changelog, version)) {
      writeFileSync(
        path,
        `## ${version} (${date})\n\nNo changes of its own: released with the other packages.\n\n` +
          changelog
      );
      console.log(`${pkg(dir).name}: no ## Unreleased, ## ${version} added without changes.`);
    }
  }
  // No install yet: the views still pin the old core, which the bumped workspace no longer is.
  npm(
    "version",
    version,
    ...workspaces(),
    "--no-git-tag-version",
    "--allow-same-version",
    "--no-workspaces-update"
  );
  // The views pin the core exactly: it reaches Wordgard's internals for them.
  npm("pkg", "set", `dependencies.${core}=${version}`, ...workspaces().slice(2));
  npm("install");

  npm("run", "check");
  npm("test");
  npm("run", "test:react19");
  console.log(`\nReady: commit and push, then npm run release:publish.`);
};

// Starts the check workflow on `sha` and waits for it.
const runCI = async (sha) => {
  const before = new Set(
    JSON.parse(
      gh("run", "list", "--workflow", "check.yml", "--commit", sha, "--json", "databaseId")
    ).map((r) => r.databaseId)
  );
  gh("workflow", "run", "check.yml", "--ref", branch);
  console.log("CI started on the release commit.");
  for (let tries = 0; tries < 30; tries++) {
    await new Promise((done) => setTimeout(done, 2000));
    const runs = JSON.parse(
      gh("run", "list", "--workflow", "check.yml", "--commit", sha, "--json", "databaseId")
    );
    const started = runs.find((r) => !before.has(r.databaseId));
    if (started) {
      if (!succeeds(() => run("gh", ["run", "watch", String(started.databaseId), "--exit-status"])))
        fail("CI failed: nothing was published.");
      return;
    }
  }
  fail("CI didn't start within a minute: check the Actions tab.");
};

const publish = async () => {
  checkTree();
  const { version } = pkg(packages[0]);
  if (packages.some((dir) => pkg(dir).version != version))
    fail("The packages' versions differ: run npm run release:prepare.");
  const notes = packages
    .map((dir) => {
      const { name } = pkg(dir);
      const notes = section(readFileSync(changelogOf(dir), "utf8"), version);
      if (!notes) fail(`${name}'s CHANGELOG.md has no ## ${version} section.`);
      return `## ${name}\n\n${notes}`;
    })
    .join("\n\n");
  const tag = `v${version}`;
  if (git("tag", "--list", tag) || git("ls-remote", "--tags", "origin", tag))
    fail(`The tag ${tag} exists already.`);
  for (const name of names())
    if (succeeds(() => npmOutput("view", `${name}@${version}`, "version")))
      fail(`${name}@${version} is on npm already.`);

  await runCI(git("rev-parse", "HEAD"));

  const list = names().join(", ");
  console.log(
    `\nAbout to publish ${list} at ${version} to npm. This can't be undone: the version can ` +
      "never be published again, and unpublishing it blocks the package name for 24 hours."
  );
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`Publish ${list} at ${version}? [y/N] `);
  prompt.close();
  if (answer.trim().toLowerCase() != "y") fail("Nothing was published.");

  // In the workspaces' order, the core first. Each package builds in its prepack.
  npm("publish", ...workspaces());
  run("git", ["tag", tag]);
  run("git", ["push", "origin", tag]);
  run("gh", ["release", "create", tag, "--title", version, "--notes", notes]);
  // Pages deploys from master only, which is the release commit now.
  gh("workflow", "run", "demo.yml", "--ref", branch);
  console.log("Demo deploy started.");
  for (const name of names())
    console.log(`Released: https://www.npmjs.com/package/${name}/v/${version}`);
};

const [command, version] = process.argv.slice(2);
if (command == "prepare") prepare(version);
else if (command == "publish") await publish();
else fail("Usage: node scripts/release.js prepare <version> | publish");
