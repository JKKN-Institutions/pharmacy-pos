const fs = require('fs');

// Read old medicine ID -> name mapping
const medMap = JSON.parse(fs.readFileSync('docs/data/medicine_id_names.json', 'utf8'));
const entries = Object.entries(medMap)
  .filter(([id]) => parseInt(id) !== 0)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

console.log('Total entries:', entries.length);

// Generate INSERT batches of 300 rows each
const batchSize = 300;
for (let i = 0; i < entries.length; i += batchSize) {
  const batch = entries.slice(i, i + batchSize);
  const batchIdx = Math.floor(i / batchSize);

  const values = batch.map(([oldId, name]) => {
    const safeName = name.replace(/'/g, "''");
    return `(${oldId}, '${safeName}')`;
  }).join(',\n');

  const sql = `INSERT INTO _staging_old_medicines (old_id, old_name) VALUES\n${values}\nON CONFLICT (old_id) DO NOTHING;`;

  fs.writeFileSync(`docs/data/staging_insert_${batchIdx}.sql`, sql);
}

const numBatches = Math.ceil(entries.length / batchSize);
console.log('Generated', numBatches, 'insert batch files');

// Also generate the purchase mapping inserts from purchase_id_mapping.sql
// Read the purchase mapping file and extract the VALUES
const purchaseMapping = fs.readFileSync('docs/data/purchase_id_mapping.sql', 'utf8');
const valuesMatch = purchaseMapping.match(/AS \(VALUES\s*\n([\s\S]*?)\n\),/);
if (valuesMatch) {
  // Parse each (old_id, uuid, date, amount) row
  const lines = valuesMatch[1].trim().split('\n');
  const purchaseEntries = [];
  for (const line of lines) {
    const m = line.match(/\((\d+),\s*'([^']+)'::uuid/);
    if (m) {
      purchaseEntries.push({ oldId: parseInt(m[1]), uuid: m[2] });
    }
  }

  console.log('Purchase entries found:', purchaseEntries.length);

  // Generate purchase staging inserts in batches of 400
  const pBatchSize = 400;
  for (let i = 0; i < purchaseEntries.length; i += pBatchSize) {
    const batch = purchaseEntries.slice(i, i + pBatchSize);
    const batchIdx = Math.floor(i / pBatchSize);

    const values = batch.map(e => `(${e.oldId}, '${e.uuid}'::uuid)`).join(',\n');
    const sql = `INSERT INTO _staging_purchase_map (old_id, new_uuid) VALUES\n${values}\nON CONFLICT (old_id) DO NOTHING;`;

    fs.writeFileSync(`docs/data/staging_purchase_${batchIdx}.sql`, sql);
  }

  const pNumBatches = Math.ceil(purchaseEntries.length / pBatchSize);
  console.log('Generated', pNumBatches, 'purchase staging insert files');
}
