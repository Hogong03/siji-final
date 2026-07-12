const fs = require('fs');
const path = require('path');

const subDir = 'C:/Users/c3798/Desktop/思迹/utils/storage';
const storageFile = 'C:/Users/c3798/Desktop/思迹/utils/storage.js';

// Original exports (from the original file)
const original = new Set([
  'getDiaryList','saveDiary','deleteDiary','getDiaryById',
  'getBillList','saveBill','deleteBill',
  'getPlanTemplates','savePlanTemplate','deletePlanTemplate','ensureDefaultTemplates',
  'getPlanList','savePlan','deletePlan','getChildPlans','getPlanTree',
  'rebuildIndex','getIndex','searchByIndex','updateIndex','globalSearch',
  'exportAllData','exportJson','exportCsv',
  'getFeedbackList','saveFeedback','deleteFeedback','updateFeedback','getFeedbackStats',
  'getTags','getUsedTags','addCustomTag','removeCustomTag',
  'getRawList','getMonthFromDate','getMonthFromDateStr'
]);

// Collect exports from sub-modules
const subExports = new Set();
const files = fs.readdirSync(subDir).filter(f => f.endsWith('.js'));
files.forEach(f => {
  const content = fs.readFileSync(path.join(subDir, f), 'utf-8');
  const re = /export\s+(function|const)\s+(\w+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    subExports.add(m[2]);
  }
});

console.log('=== Sub-module exports ===');
[...subExports].sort().forEach(e => console.log('  ' + e));

// Check re-exports from aggregator storage.js
const storageContent = fs.readFileSync(storageFile, 'utf-8');
const reExportRe = /\b(\w+)\b\s*\}\s*from\s+['"]\.\/storage\//g;
// Simpler: find all identifiers before } from './storage/
const reExportNames = new Set();
const lines = storageContent.split('\n');
lines.forEach(line => {
  const m = line.match(/^\s*(\w+)\s*,?\s*$/);
  // Collect names from export { ... } blocks
});
// Better approach: extract all names between export { and } from
const reBlock = /export\s*\{([^}]+)\}\s*from/g;
let bm;
while ((bm = reBlock.exec(storageContent)) !== null) {
  const names = bm[1].split(',').map(s => s.trim()).filter(Boolean);
  names.forEach(n => reExportNames.add(n));
}

console.log('\n=== Aggregator re-exports ===');
[...reExportNames].sort().forEach(e => console.log('  ' + e));

console.log('\n=== Missing from sub-modules ===');
const missing = [...original].filter(f => !subExports.has(f));
console.log(missing.length === 0 ? 'NONE - all accounted for!' : missing.join(', '));

console.log('\n=== Extra in sub-modules (not in original) ===');
const extra = [...subExports].filter(f => !original.has(f));
console.log(extra.length === 0 ? 'NONE' : extra.join(', '));

console.log('\n=== Missing from aggregator re-exports ===');
const missingRe = [...subExports].filter(f => !reExportNames.has(f));
console.log(missingRe.length === 0 ? 'NONE - all re-exported!' : missingRe.join(', '));

console.log('\n=== Re-exports not from sub-modules ===');
const extraRe = [...reExportNames].filter(f => !subExports.has(f));
console.log(extraRe.length === 0 ? 'NONE' : extraRe.join(', '));
