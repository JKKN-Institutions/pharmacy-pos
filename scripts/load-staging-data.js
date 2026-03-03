/**
 * Load all batch data into _staging_old_batches via Supabase Edge Function.
 * Sends 500-row batches to the import-staging function.
 */
const fs = require('fs');

const PROJECT_URL = 'https://jlvfbzgkwyufksmhtfan.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsdmZiemdrd3l1ZmtzbWh0ZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDg1NDEsImV4cCI6MjA4NzQ4NDU0MX0.Exl1u4ChAJa3sH2vE4PUyidT1bDnRXD6drC1QoywvmI';

async function main() {
  const batches = JSON.parse(fs.readFileSync('docs/data/parsed_batches.json', 'utf8'));
  const validBatches = batches.filter(b => b.medicine_id !== 0 && b.purchase_id !== 0);
  console.log('Valid rows to load:', validBatches.length);

  // Clean data into arrays
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

  const BATCH_SIZE = 500;
  const numBatches = Math.ceil(cleaned.length / BATCH_SIZE);
  let totalLoaded = 0;

  for (let i = 0; i < numBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, cleaned.length);
    const chunk = cleaned.slice(start, end);

    try {
      const resp = await fetch(`${PROJECT_URL}/functions/v1/import-staging`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`
        },
        body: JSON.stringify({ rows: chunk })
      });

      const result = await resp.json();
      if (result.ok) {
        totalLoaded += chunk.length;
        console.log(`Batch ${i + 1}/${numBatches}: ${chunk.length} rows OK (total: ${totalLoaded})`);
      } else {
        console.error(`Batch ${i + 1}/${numBatches}: ERROR -`, result.error);
      }
    } catch (e) {
      console.error(`Batch ${i + 1}/${numBatches}: NETWORK ERROR -`, e.message);
    }
  }

  console.log('\nDone! Total loaded:', totalLoaded, '/', cleaned.length);
}

main().catch(console.error);
