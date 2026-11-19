// Packs each package as npm publishes it and fails if the packed package.json names a file the
// tarball doesn't hold (0.4.0's exports pointed at src), or if packing left package.json changed.
//
//   npm run check:pack
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = ["core", "react", "vue", "svelte"].map((dir) => join(root, "packages", dir));

// npm's own script run with Node, as release.js does: on Windows the npm command is npm.cmd.
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("Run this with npm run check:pack.");
  process.exit(1);
}

// The tarball's files by path, without npm's `package/` prefix. Tar is 512-byte blocks: a header
// (name, octal size, type), then the content; a PAX header ("x") carries a long path.
const untar = (tgz) => {
  const tar = gunzipSync(tgz);
  const files = new Map();
  let longPath = null;
  for (let at = 0; at + 512 <= tar.length && tar[at] != 0;) {
    const field = (start, length) =>
      tar.toString("utf8", at + start, at + start + length).replace(/\0.*$/s, "");
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1);
    const prefix = field(345, 155);
    const content = tar.subarray(at + 512, at + 512 + size);
    if (type == "x") longPath = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(content.toString())?.[1] ?? null;
    else {
      const path = longPath ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
      if (type == "0" || type == "") files.set(path.replace(/^package\//, ""), content);
      longPath = null;
    }
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
};

// Every path the manifest points a resolver at.
const targets = (pkg) => {
  const of = (target) =>
    typeof target == "string"
      ? [target]
      : Array.isArray(target)
        ? target.flatMap(of)
        : typeof target == "object" && target != null
          ? Object.values(target).flatMap(of)
          : [];
  return of([pkg.main, pkg.module, pkg.types, pkg.typings, pkg.svelte, pkg.bin, pkg.exports]);
};

const out = mkdtempSync(join(tmpdir(), "check-pack-"));
let failed = 0;
const problem = (name, message) => {
  console.error(`${name}: ${message}`);
  failed++;
};
try {
  for (const dir of packages) {
    const manifest = join(dir, "package.json");
    const before = readFileSync(manifest, "utf8");
    const { name } = JSON.parse(before);
    // A directory of its own: the one file in it is the tarball (prepack prints to stdout).
    const to = join(out, name.replace("/", "-"));
    mkdirSync(to);
    execFileSync(process.execPath, [npmCli, "pack", "--pack-destination", to], {
      cwd: dir,
      stdio: "inherit",
    });
    const [filename] = readdirSync(to);

    if (readFileSync(manifest, "utf8") != before || existsSync(`${manifest}.dev`))
      problem(name, "packing left package.json changed.");
    const files = untar(readFileSync(join(to, filename)));
    const packed = JSON.parse(files.get("package.json").toString());
    for (const target of targets(packed)) {
      const path = target.replace(/^\.\//, "");
      if (path.includes("*")) problem(name, `${target}: a pattern, which this check can't follow.`);
      else if (!files.has(path)) problem(name, `${target} is in package.json, not in the tarball.`);
    }
    console.log(`${name}: ${files.size} files, ${targets(packed).length} targets checked.`);
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}
if (failed) process.exit(1);
