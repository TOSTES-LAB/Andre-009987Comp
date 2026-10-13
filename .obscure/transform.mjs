// Rebrands the upstream snapshot checked out in the current directory.
// Names come from env so this file carries none of them.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const { SRC_OWNER, SRC_NAME, NEW_NAME, DST_SLUG } = process.env;
if (!SRC_OWNER || !SRC_NAME || !NEW_NAME || !DST_SLUG) throw new Error("missing env");
// Lowercase token for the owner inside code (npm scopes, image names); defaults to the GitHub owner.
const DST_OWNER = process.env.DST_OWNER || DST_SLUG.split("/")[0];
// CAMEL=1 also renames the name inside camelCase identifiers (oldHome, runOldTask, OLD_HOME).
const CAMEL = process.env.CAMEL === "1";

// License texts must keep their copyright lines (MIT condition). Submodules belong to others.
const KEEP = [/^(LICEN[CS]E|COPYING|NOTICE)/i, /^licenses\//, /^THIRD_PARTY_NOTICES\.md$/, /^third_party\//, /^\.obscure\//, /^\.github\/workflows\/sync\.yml$/];
const DROP = [/^\.github\//, /^README_[^/]+\.md$/, /^CHANGELOG\.md$/, /^\.mailmap$/, /^screenshots\//, /^releases\/(?!\.gitkeep$)/, /^report\//];
// Per repo: [regex, replacement] applied after renaming, e.g. to alias back an external symbol that shares the old name.
const lo = SRC_NAME.toLowerCase(), up = SRC_NAME.toUpperCase();
const FIXUPS = [
  // Tokens that start with the old name and run on in lowercase (generated tool names, fixtures).
  [new RegExp(`(?<![\\p{L}\\p{N}])${lo}(?=\\p{Ll})`, "gu"), NEW_NAME.toLowerCase()],
  // Rust library file names and errno-style codes.
  [new RegExp(`lib${lo}_`, "g"), `lib${NEW_NAME.toLowerCase()}_`],
  [new RegExp(`\\bE${up}_`, "g"), `E${NEW_NAME.toUpperCase()}_`],
  // The icon library exports a symbol spelled like the old name; import it under the new one.
  [
  /import(\s*(?:type\s*)?\{)([^}]*)(\}\s*from\s*["']lucide-react["'])/g,
  (all, open, names, close) => {
    const icon = process.env.SRC_NAME[0].toUpperCase() + process.env.SRC_NAME.slice(1).toLowerCase();
    const alias = process.env.NEW_NAME[0].toUpperCase() + process.env.NEW_NAME.slice(1).toLowerCase();
    return `import${open}${names.replace(new RegExp(`\\b${alias}\\b`), `${icon} as ${alias}`)}${close}`;
  },
]];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A letter right after an escape ("\n", "\0") or a URL-encoded byte (%40, %2F) still starts a word.
const START = "(?:(?<![\\p{L}\\p{N}])|(?<=\\\\[0nrtb])|(?<=%[0-9A-Fa-f]{2}))";
const word = (s) => new RegExp(`${START}${esc(s)}(?![\\p{L}\\p{N}])`, "giu");
const cap = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();
const caseLike = (token) => (m) =>
  m === m.toUpperCase() ? token.toUpperCase() : m[0] === m[0].toUpperCase() ? cap(token) : token.toLowerCase();

// owner/name only as a whole path, so "@owner/name-plugin" (an npm package) is left to the owner rule.
const slugRe = new RegExp(`(?<![\\p{L}\\p{N}@])${esc(SRC_OWNER)}/${esc(SRC_NAME)}(?![\\p{L}\\p{N}_-])`, "giu");
const rules = [
  [slugRe, DST_SLUG],
  [word(SRC_OWNER), caseLike(DST_OWNER)],
  [word(SRC_NAME), caseLike(NEW_NAME)],
];
if (CAMEL) {
  const n = SRC_NAME.toLowerCase();
  rules.push(
    [new RegExp(`${START}${esc(n)}(?!\\p{Ll})`, "gu"), NEW_NAME.toLowerCase()],
    [new RegExp(`(?<!\\p{Lu})${esc(cap(n))}(?!\\p{Ll})`, "gu"), cap(NEW_NAME)],
    [new RegExp(`(?<!\\p{Lu})${esc(n.toUpperCase())}(?!\\p{Lu})`, "gu"), NEW_NAME.toUpperCase()],
  );
}
const rebrand = (s) => rules.reduce((t, [re, to]) => t.replace(re, to), s);

const rebrandLock = (text) => {
  const lock = JSON.parse(text);
  lock.name = rebrand(lock.name);
  if (lock.packages?.[""]) lock.packages[""] = JSON.parse(rebrand(JSON.stringify(lock.packages[""])));
  return JSON.stringify(lock, null, 2) + "\n";
};

const entries = execFileSync("git", ["ls-files", "-s", "-z"], { encoding: "utf8", maxBuffer: 1 << 28 })
  .split("\0").filter(Boolean)
  .map((l) => ({ mode: l.slice(0, 6), file: l.slice(l.indexOf("\t") + 1) }));

for (const { mode, file } of entries) {
  if (mode === "160000" || KEEP.some((r) => r.test(file))) continue;
  if (DROP.some((r) => r.test(file))) { fs.rmSync(file, { force: true }); continue; }
  if (mode === "120000") {
    // Symlink: rename the link and its target, never read through it (it may point at a folder).
    const target = rebrand(fs.readlinkSync(file));
    fs.rmSync(file);
    fs.mkdirSync(path.dirname(rebrand(file)), { recursive: true });
    fs.symlinkSync(target, rebrand(file));
    continue;
  }

  const buf = fs.readFileSync(file);
  if (!buf.subarray(0, 8000).includes(0)) {
    const text = buf.toString("utf8");
    // package-lock holds base64 integrity hashes, so only its own package entry is touched.
    let out = file.endsWith("package-lock.json") ? rebrandLock(text) : rebrand(text);
    for (const [re, to] of FIXUPS) out = out.replace(re, to);
    if (out !== text) fs.writeFileSync(file, out);
  }

  const to = rebrand(file);
  if (to !== file) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(file, to);
  }
}

fs.copyFileSync(".obscure/README.md", "README.md");
