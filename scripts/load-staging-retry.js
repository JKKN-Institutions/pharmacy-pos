/**
 * Retry loading batch 15 (index 14) that failed with SSL error.
 */
const fs = require('fs');

const PROJECT_URL = 'https://jlvfbzgkwyufksmhtfan.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsdmZiemdrd3l1ZmtzbWh0ZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDg1NDEsImV4cCI6MjA4NzQ4NDU0MX0.Exl1u4ChAJa3sH2vE4PUyidT1bDnRXD6drC1QoywvmI';

async function main() {
  const batches = JSON.parse(fs.readFileSync('docs/data/parsed_batches.json', 'utf8'));
  const validBatches = batches.filter(b => b.medicine_id !== 0 && b.purchase_id !== 0);

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

  // Retry batch 15 (index 14: rows 7000-7499)
  const BATCH_SIZE = 500;
  const batchIdx = 14;
  const start = batchIdx * BATCH_SIZE;
  const end = Math.min(start + BATCH_SIZE, cleaned.length);
  const chunk = cleaned.slice(start, end);

  console.log(`Retrying batch ${batchIdx + 1}: rows ${start}-${end - 1} (${chunk.length} rows)`);

  const resp = await fetch(`${PROJECT_URL}/functions/v1/import-staging`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`
    },
    body: JSON.stringify({ rows: chunk })
  });

  const text = await resp.text();
  console.log('Status:', resp.status);
  try {
    console.log('Result:', JSON.parse(text));
  } catch {
    console.log('Raw:', text.substring(0, 200));
  }
}

main().catch(console.error);
