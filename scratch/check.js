const fs = require('fs');

const { classifyJob } = require('./src/lib/taxonomy2.js');
// Wait, taxonomy2 is TypeScript. I can't just require it.
// I can just parse taxonomy2.ts textually.

const code = fs.readFileSync('src/lib/taxonomy2.ts', 'utf8');
const treeRegex = /export const INDUSTRY_TREE: IndustryNode\[\] = \[([\s\S]*?)\]\n\n/;
const match = code.match(treeRegex);

let treeCode = match[1]
  .replace(/label:/g, '"label":')
  .replace(/parent:/g, '"parent":')
  .replace(/keywords:/g, '"keywords":')
  .replace(/'/g, '"')
  .replace(/\/\/.*$/gm, '')
  .replace(/,(\s*[\]}])/g, '$1');

const treeStr = `[${treeCode}]`;
let tree = JSON.parse(treeStr);

const cvdata = JSON.parse(fs.readFileSync('../insead-cvbook/data/cvdata.json'));
const labels = tree.map(n => n.label);
const counts = {};
for (const l of labels) counts[l] = 0;

for (const cv of cvdata) {
  for (const exp of (cv.experience || [])) {
    // This is a naive text match to check if it's used.
    // Instead of doing this, I'll just check if the industry is present in skills_categorized maybe?
    // Actually, taxonomy2.ts is used by the frontend. The backend python script classify jobs.
  }
}
// I will just use TS node if available to import aggregate.ts
