const fs = require('fs');

const batches = JSON.parse(fs.readFileSync('docs/data/parsed_batches.json', 'utf8'));
const validBatches = batches.filter(b => b.medicine_id !== 0 && b.purchase_id !== 0);
console.log('Valid batch rows:', validBatches.length);

function escSql(s) {
  return s.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

// 500 rows per file
const ROWS_PER_FILE = 500;
const numFiles = Math.ceil(validBatches.length / ROWS_PER_FILE);

for (let fileIdx = 0; fileIdx < numFiles; fileIdx++) {
  const start = fileIdx * ROWS_PER_FILE;
  const end = Math.min(start + ROWS_PER_FILE, validBatches.length);
  const chunk = validBatches.slice(start, end);

  const values = chunk.map(b => {
    const name = escSql(b.name);
    const batch = escSql(b.batch);
    const expiryDate = b.expiry.length === 7 ? b.expiry + '-01' : b.expiry;
    return `(${b.id},'${name}','${batch}','${expiryDate}','${escSql(b.pqty)}',${b.qty},${b.saleprice},${b.purchaseprice},${b.discounttype},${b.discount},${b.discountvalue},${b.taxprice},${b.price},${b.sold},${b.medicine_id},${b.purchase_id},${b.status},'${b.date_of_joining}')`;
  }).join(',\n');

  const sql = `INSERT INTO _staging_old_batches VALUES\n${values};`;
  fs.writeFileSync(`docs/data/stg_${fileIdx}.sql`, sql);
  const kb = Math.round(sql.length / 1024);
  if (fileIdx < 3 || fileIdx === numFiles - 1) {
    console.log(`  stg_${fileIdx}.sql: ${chunk.length} rows, ${kb}KB`);
  }
}
console.log('Total files:', numFiles);

// Also generate purchase map insert in batches of 500
const purchaseMapping = fs.readFileSync('docs/data/purchase_id_mapping.sql', 'utf8');
const purchaseValuesMatch = purchaseMapping.match(/AS \(VALUES\s*\n([\s\S]*?)\n\),/);
const purchaseEntries = [];
if (purchaseValuesMatch) {
  const lines = purchaseValuesMatch[1].trim().split('\n');
  for (const line of lines) {
    const m = line.match(/\((\d+),\s*'([^']+)'::uuid/);
    if (m) purchaseEntries.push({ oldId: parseInt(m[1]), uuid: m[2] });
  }
}

const pBatchSize = 500;
const pNumFiles = Math.ceil(purchaseEntries.length / pBatchSize);
for (let i = 0; i < pNumFiles; i++) {
  const chunk = purchaseEntries.slice(i * pBatchSize, (i + 1) * pBatchSize);
  const values = chunk.map(e => `(${e.oldId},'${e.uuid}'::uuid)`).join(',\n');
  const prefix = i === 0
    ? `CREATE TABLE IF NOT EXISTS _staging_purchase_map (old_id INTEGER PRIMARY KEY, new_uuid UUID NOT NULL);\nTRUNCATE _staging_purchase_map;\n\n`
    : '';
  const sql = `${prefix}INSERT INTO _staging_purchase_map VALUES\n${values};`;
  fs.writeFileSync(`docs/data/stg_p${i}.sql`, sql);
  console.log(`  stg_p${i}.sql: ${chunk.length} rows, ${Math.round(sql.length / 1024)}KB`);
}
