/**
 * Load purchase ID mapping into _staging_purchase_map.
 * Reads the purchase_id_mapping.sql, extracts VALUES rows,
 * sends via Edge Function to build the mapping.
 */
const fs = require('fs');

const PROJECT_URL = 'https://jlvfbzgkwyufksmhtfan.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsdmZiemdrd3l1ZmtzbWh0ZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDg1NDEsImV4cCI6MjA4NzQ4NDU0MX0.Exl1u4ChAJa3sH2vE4PUyidT1bDnRXD6drC1QoywvmI';

async function main() {
  const sql = fs.readFileSync('docs/data/purchase_id_mapping.sql', 'utf8');

  // Extract the VALUES rows: each line looks like:
  //   (1, '311df951-...'::uuid, '2023-08-18'::date, 47520.00),
  const valueLines = sql.split('\n').filter(l => l.trim().match(/^\(\d+,/));
  console.log('Purchase mapping rows:', valueLines.length);

  // Parse each row
  const rows = valueLines.map(line => {
    const m = line.trim().match(/^\((\d+),\s*'([^']+)'::uuid,\s*'([^']+)'::date,\s*([\d.]+)\)/);
    if (!m) {
      console.error('Failed to parse:', line.substring(0, 80));
      return null;
    }
    return { old_id: parseInt(m[1]), supplier_uuid: m[2], purchase_date: m[3], subtotal: parseFloat(m[4]) };
  }).filter(Boolean);

  console.log('Parsed:', rows.length, 'rows');

  // Send in batches of 200
  const BATCH_SIZE = 200;
  const numBatches = Math.ceil(rows.length / BATCH_SIZE);
  let totalLoaded = 0;

  for (let i = 0; i < numBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, rows.length);
    const chunk = rows.slice(start, end);

    const resp = await fetch(`${PROJECT_URL}/functions/v1/import-staging`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({ purchase_rows: chunk })
    });

    const result = await resp.json();
    if (result.ok) {
      totalLoaded += chunk.length;
      console.log(`Batch ${i + 1}/${numBatches}: ${chunk.length} rows OK (total: ${totalLoaded})`);
    } else {
      console.error(`Batch ${i + 1}/${numBatches}: ERROR -`, JSON.stringify(result).substring(0, 200));
    }
  }

  console.log('\nDone! Total loaded:', totalLoaded, '/', rows.length);
}

main().catch(console.error);
