import fs from 'fs'
import { INDUSTRY_TREE, classifyJob } from '../src/lib/taxonomy2'

const cvdata = JSON.parse(fs.readFileSync('../../insead-cvbook/data/cvdata.json', 'utf8'))

const counts: Record<string, number> = {}
for (const ind of INDUSTRY_TREE) counts[ind.label] = 0

for (const cv of cvdata) {
  for (const exp of (cv.experience || [])) {
    const v2 = classifyJob(exp)
    if (v2.primary && counts[v2.primary] !== undefined) {
      counts[v2.primary]++
    }
  }
}

const empty = []
for (const [k, v] of Object.entries(counts)) {
  if (v === 0) empty.push(k)
}

console.log(empty.join(','))
