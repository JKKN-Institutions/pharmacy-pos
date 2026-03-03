const fs = require('fs');
const data = fs.readFileSync('docs/data/ds_medicine_batch.sql', 'utf8');

// Find all INSERT VALUES
const insertIdx = data.indexOf('VALUES\n');
if (insertIdx === -1) { console.log('No INSERT found'); process.exit(1); }

const valuesBlock = data.substring(insertIdx + 7);

// Parse each row with regex
const rowRegex = /\((\d+),\s*'((?:[^'\\]|\\.|\'{2})*)',\s*'((?:[^'\\]|\\.|\'{2})*)',\s*'((?:[^'\\]|\\.|\'{2})*)',\s*'((?:[^'\\]|\\.|\'{2})*)',\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*(\d+),\s*([\d.]+),\s*([\d.]+),\s*'((?:[^'\\]|\\.|\'{2})*)',\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})'\)/g;

let match;
let count = 0;
const rows = [];
const medIds = new Set();
const purchaseIds = new Set();

while ((match = rowRegex.exec(valuesBlock)) !== null) {
  count++;
  const id = parseInt(match[1]);
  const name = match[2].replace(/&amp;/g, '&');
  const batch = match[3].replace(/\n/g, '').trim();
  const expiry = match[4];
  const pqty = match[5].replace(/\n/g, '').trim();
  const sqty = parseFloat(match[6]);
  const qty = parseFloat(match[7]);
  const saleprice = parseFloat(match[8]);
  const purchaseprice = parseFloat(match[9]);
  const totalpurchaseprice = parseFloat(match[10]);
  const discounttype = parseInt(match[11]);
  const discount = parseFloat(match[12]);
  const discountvalue = parseFloat(match[13]);
  const tax = match[14];
  const taxprice = parseFloat(match[15]);
  const price = parseFloat(match[16]);
  const sold = parseFloat(match[17]);
  const medicine_id = parseInt(match[18]);
  const purchase_id = parseInt(match[19]);
  const status = parseInt(match[20]);
  const user_id = parseInt(match[21]);
  const date_of_joining = match[22];

  rows.push({ id, name, batch, expiry, pqty, sqty, qty, saleprice, purchaseprice, totalpurchaseprice, discounttype, discount, discountvalue, tax, taxprice, price, sold, medicine_id, purchase_id, status, user_id, date_of_joining });
  medIds.add(medicine_id);
  purchaseIds.add(purchase_id);
}

console.log('Total rows parsed:', count);
console.log('Unique medicine_ids:', medIds.size);
console.log('Unique purchase_ids:', purchaseIds.size);

// Show unique medicine_id -> name mappings
const medMap = new Map();
for (const row of rows) {
  if (!medMap.has(row.medicine_id)) {
    medMap.set(row.medicine_id, row.name);
  }
}
console.log('\nFirst 20 medicine_id -> name:');
let i = 0;
for (const [mid, mname] of medMap) {
  if (i++ >= 20) break;
  console.log('  ' + mid + ' -> ' + mname);
}

// Check for medicine_id=0
const zeroMeds = rows.filter(r => r.medicine_id === 0);
console.log('\nRows with medicine_id=0:', zeroMeds.length);

// Check for purchase_id=0
const zeroPurchases = rows.filter(r => r.purchase_id === 0);
console.log('Rows with purchase_id=0:', zeroPurchases.length);

// Write parsed data to JSON for later use
fs.writeFileSync('docs/data/parsed_batches.json', JSON.stringify(rows, null, 0));
console.log('\nWrote', rows.length, 'records to docs/data/parsed_batches.json');

// Also write unique medicine_id -> name mapping
const medMapObj = {};
for (const [mid, mname] of medMap) {
  medMapObj[mid] = mname;
}
fs.writeFileSync('docs/data/medicine_id_names.json', JSON.stringify(medMapObj, null, 2));
console.log('Wrote', Object.keys(medMapObj).length, 'medicine mappings to docs/data/medicine_id_names.json');
