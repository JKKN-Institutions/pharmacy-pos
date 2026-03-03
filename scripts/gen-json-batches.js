const fs = require('fs');
const batches = JSON.parse(fs.readFileSync('docs/data/parsed_batches.json', 'utf8'));
const validBatches = batches.filter(b => b.medicine_id !== 0 && b.purchase_id !== 0);
console.log('Valid batch rows:', validBatches.length);

const cleaned = validBatches.map(b => [
  b.id,
  b.name.replace(/\\n/g, '').replace(/\n/g, ''),
  b.batch.replace(/\\n/g, '').replace(/\n/g, ''),
  b.expiry.length === 7 ? b.expiry + '-01' : b.expiry,
  (b.pqty || '1').replace(/\\n/g, '').replace(/\n/g, ''),
  b.qty, b.saleprice, b.purchaseprice, b.discounttype, b.discount,
  b.discountvalue, b.taxprice, b.price, b.sold,
  b.medicine_id, b.purchase_id, b.status, b.date_of_joining
]);

const ROWS_PER_FILE = 200;
const numFiles = Math.ceil(cleaned.length / ROWS_PER_FILE);

for (let i = 0; i < numFiles; i++) {
  const start = i * ROWS_PER_FILE;
  const end = Math.min(start + ROWS_PER_FILE, cleaned.length);
  const chunk = cleaned.slice(start, end);
  const jsonStr = JSON.stringify(chunk).replace(/'/g, "''");
  const sql = `SELECT import_staging_batch_v2('${jsonStr}'::jsonb);`;
  fs.writeFileSync(`docs/data/jb_${i}.sql`, sql);
}

console.log('Generated', numFiles, 'files');
for (let i = 0; i < Math.min(5, numFiles); i++) {
  console.log(`jb_${i}.sql: ${Math.round(fs.statSync(`docs/data/jb_${i}.sql`).size/1024)}KB`);
}
