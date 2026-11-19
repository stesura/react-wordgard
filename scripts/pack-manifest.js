// Takes the "@stesura/source" export condition out of a package's package.json while npm packs
// it: the condition points at src, which only the workspace has (0.4.0 shipped it, and tools
// resolving it, as Stesura's tests, failed). Each package runs `strip` last in its prepack, and
// `restore` as its postpack and postpublish; the release script restores after publishing too.
//
//   node scripts/pack-manifest.js strip|restore [package directory, the current one by default]
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const condition = "@stesura/source";

const [command, dir = "."] = process.argv.slice(2);
const manifest = join(resolve(dir), "package.json");
// The workspace's package.json while the stripped one is there; never packed (not in `files`).
const backup = `${manifest}.dev`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const withoutCondition = (target) =>
  Array.isArray(target)
    ? target.map(withoutCondition)
    : typeof target == "object" && target != null
      ? Object.fromEntries(
          Object.entries(target)
            .filter(([key]) => key != condition)
            .map(([key, value]) => [key, withoutCondition(value)])
        )
      : target;

const strip = () => {
  if (existsSync(backup))
    fail(
      `${backup} exists: a pack or publish stopped before restoring package.json. Check it, then ` +
        "run node scripts/pack-manifest.js restore <package directory>."
    );
  const text = readFileSync(manifest, "utf8");
  const pkg = JSON.parse(text);
  writeFileSync(backup, text);
  writeFileSync(
    manifest,
    `${JSON.stringify({ ...pkg, exports: withoutCondition(pkg.exports) }, null, 2)}\n`
  );
};

const restore = () => {
  // npm publish reads package.json again after postpack, for the registry's copy of the
  // manifest: under publish (or stage), postpublish restores.
  if (
    process.env.npm_lifecycle_event == "postpack" &&
    (process.env.npm_command == "publish" || process.env.npm_command == "stage")
  )
    return;
  if (existsSync(backup)) renameSync(backup, manifest);
};

if (command == "strip") strip();
else if (command == "restore") restore();
else fail("Usage: node scripts/pack-manifest.js strip|restore [package directory]");
