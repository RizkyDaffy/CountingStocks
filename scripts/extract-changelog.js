import fs from "node:fs";

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: node scripts/extract-changelog.js <tag>");
  process.exit(1);
}
const version = tag.replace(/^v/, "");

const md = fs.readFileSync("CHANGELOG.md", "utf8");
const start = md.indexOf(`## [${version}]`);
if (start === -1) {
  console.error(`No changelog section found for ${version}`);
  process.exit(0);
}

let end = md.indexOf("\n## [", start + 1);
if (end === -1) end = md.length;

process.stdout.write(md.slice(start, end).trim() + "\n");
