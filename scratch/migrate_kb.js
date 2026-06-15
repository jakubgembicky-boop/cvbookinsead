const fs = require('fs');
const path = require('path');

const kbPath = path.join(__dirname, '../data/company_kb.json');
const kb = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));

const MAPPING = {
  // Finance
  'Investment Banking': 'Finance',
  'Retail & Commercial Banking': 'Finance',
  'Fintech & Payments': 'Finance',
  'Asset & Wealth Management': 'Finance',
  'Hedge Funds & Trading': 'Finance',
  'Venture Capital': 'Finance',
  'Private Equity': 'Finance',
  'Insurance': 'Finance',

  // Tech & Telecom
  'IT Services & Data': 'Technology & Telecom',
  'Software & SaaS': 'Technology & Telecom',
  'Internet & Consumer Tech': 'Technology & Telecom',
  'Semiconductors & Hardware': 'Technology & Telecom',
  'Telecom': 'Technology & Telecom',
  'Cybersecurity': 'Technology & Telecom',

  // Others to consolidate to the 13 buckets
  'Consumer Goods & Retail': 'Consumer Goods, Retail & Hospitality',
  'Hospitality & Travel': 'Consumer Goods, Retail & Hospitality',
  'Manufacturing & Industrials': 'Manufacturing, Industrials & Agriculture',
  'Energy & Utilities': 'Energy, Utilities & Sustainability',
  'NGO & Development': 'Public Sector, NGO & Education',
  'Government & Public Sector': 'Public Sector, NGO & Education',
  'Education & Research': 'Public Sector, NGO & Education',
  'Legal Services': 'Professional & Legal Services'
};

let modified = 0;

for (const [key, value] of Object.entries(kb)) {
  if (MAPPING[value.primary]) {
    value.primary = MAPPING[value.primary];
    modified++;
  }
}

console.log(`Updated ${modified} entries in company_kb.json`);
fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2));

const newPrimaries = [...new Set(Object.values(kb).map(x => x.primary))].sort();
console.log('New primaries list (count = ' + newPrimaries.length + '):');
console.log(newPrimaries.join('\n'));
