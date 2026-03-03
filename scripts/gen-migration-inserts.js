/**
 * Generate migration SQL files that can be loaded via apply_migration.
 * Strips \n from batch/pqty values. Creates proper INSERT statements.
 */
const fs = require('fs');

const batches = JSON.parse(fs.readFileSync('docs/data/parsed_batches.json', 'utf8'));
const validBatches = batches.filter(b => b.medicine_id !== 0 && b.purchase_id !== 0);
console.log('Valid batch rows:', validBatches.length);

function escSql(s) {
  if (typeof s !== 'string') return String(s);
  return s.replace(/\\n/g, '').replace(/\n/g, '').replace(/'/g, "''").trim();
}

// Generate 200-row batch files
const ROWS_PER_FILE = 200;
const numFiles = Math.ceil(validBatches.length / ROWS_PER_FILE);

for (let fileIdx = 0; fileIdx < numFiles; fileIdx++) {
  const start = fileIdx * ROWS_PER_FILE;
  const end = Math.min(start + ROWS_PER_FILE, validBatches.length);
  const chunk = validBatches.slice(start, end);

  const values = chunk.map(b => {
    const expiryDate = b.expiry.length === 7 ? b.expiry + '-01' : b.expiry;
    return `(${b.id},E'${escSql(b.name)}',E'${escSql(b.batch)}','${expiryDate}',E'${escSql(b.pqty)}',${b.qty},${b.saleprice},${b.purchaseprice},${b.discounttype},${b.discount},${b.discountvalue},${b.taxprice},${b.price},${b.sold},${b.medicine_id},${b.purchase_id},${b.status},'${b.date_of_joining}')`;
  }).join(',\n');

  const sql = `INSERT INTO _staging_old_batches VALUES\n${values}\nON CONFLICT (id) DO NOTHING;`;
  fs.writeFileSync(`docs/data/mi_${fileIdx}.sql`, sql);
}

console.log('Generated', numFiles, 'insert files (mi_0.sql to mi_' + (numFiles - 1) + '.sql)');
console.log('File size:', Math.round(fs.statSync('docs/data/mi_0.sql').size / 1024), 'KB');
