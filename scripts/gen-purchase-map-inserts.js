/**
 * Generate direct INSERT statements for _staging_purchase_map
 * by parsing purchase_id_mapping.sql VALUES and creating the
 * mapping SQL in smaller chunks.
 */
const fs = require('fs');

const sql = fs.readFileSync('docs/data/purchase_id_mapping.sql', 'utf8');

// Extract VALUES rows
const valueLines = sql.split('\n').filter(l => l.trim().match(/^\(\d+,/));
console.log('Purchase mapping rows:', valueLines.length);

// Parse each row
const rows = valueLines.map(line => {
  const m = line.trim().match(/^\((\d+),\s*'([^']+)'::uuid,\s*'([^']+)'::date,\s*([\d.]+)\)/);
  if (!m) return null;
  return { old_id: parseInt(m[1]), supplier_uuid: m[2], purchase_date: m[3], subtotal: m[4] };
}).filter(Boolean);

console.log('Parsed:', rows.length, 'rows');

// Generate batch SQL files that do the CTE + INSERT in chunks of 100
const CHUNK = 100;
const numFiles = Math.ceil(rows.length / CHUNK);

for (let i = 0; i < numFiles; i++) {
  const start = i * CHUNK;
  const end = Math.min(start + CHUNK, rows.length);
  const chunk = rows.slice(start, end);

  const values = chunk.map(r =>
    `(${r.old_id},'${r.supplier_uuid}'::uuid,'${r.purchase_date}'::date,${r.subtotal})`
  ).join(',\n');

  const sql = `WITH old_p(old_id, supplier_uuid, purchase_date, subtotal) AS (VALUES
${values}
)
INSERT INTO _staging_purchase_map (old_id, new_uuid)
SELECT op.old_id, p.id
FROM old_p op
JOIN purchases p ON p.supplier_id = op.supplier_uuid AND p.purchase_date = op.purchase_date AND p.subtotal = op.subtotal
ON CONFLICT (old_id) DO NOTHING;`;

  fs.writeFileSync(`docs/data/pm_${i}.sql`, sql);
}

console.log('Generated', numFiles, 'files');
for (let i = 0; i < Math.min(3, numFiles); i++) {
  console.log(`pm_${i}.sql: ${Math.round(fs.statSync(`docs/data/pm_${i}.sql`).size/1024)}KB`);
}
