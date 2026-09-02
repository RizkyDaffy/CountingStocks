const fs = require("fs");

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: node scripts/extract-changelog.js <tag>");
  process.exit(1);
}

const md = fs.readFileSync("CHANGELOG.md", "utf8");
const start = md.indexOf(`## [${tag}]`);
if (start === -1) {
  console.error(`No changelog section found for ${tag}`);
  process.exit(0);
}

let end = md.indexOf("\n## [", start + 1);
if (end === -1) end = md.length;

process.stdout.write(md.slice(start, end).trim() + "\n");
