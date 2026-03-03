/**
 * Load purchase mapping SQL files via Edge Function.
 * Each pm_*.sql file is a CTE + INSERT that matches old purchase IDs to Supabase UUIDs.
 */
const fs = require('fs');

const PROJECT_URL = 'https://jlvfbzgkwyufksmhtfan.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsdmZiemdrd3l1ZmtzbWh0ZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDg1NDEsImV4cCI6MjA4NzQ4NDU0MX0.Exl1u4ChAJa3sH2vE4PUyidT1bDnRXD6drC1QoywvmI';

async function main() {
  // Find all pm_*.sql files
  const files = [];
  for (let i = 0; i < 20; i++) {
    const path = `docs/data/pm_${i}.sql`;
    if (fs.existsSync(path)) files.push(path);
    else break;
  }
  console.log('Purchase mapping files:', files.length);

  for (let i = 0; i < files.length; i++) {
    const sql = fs.readFileSync(files[i], 'utf8');

    try {
      const resp = await fetch(`${PROJECT_URL}/functions/v1/import-staging`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`
        },
        body: JSON.stringify({ sql })
      });

      const text = await resp.text();
      let result;
      try { result = JSON.parse(text); } catch { result = { raw: text.substring(0, 200) }; }

      if (result.ok || result.error === undefined) {
        console.log(`pm_${i}.sql: OK`);
      } else {
        console.error(`pm_${i}.sql: ERROR -`, result.error || result.raw);
      }
    } catch (e) {
      console.error(`pm_${i}.sql: NETWORK ERROR -`, e.message);
    }
  }

  // Check final count
  console.log('\nChecking count via another approach...');
}

main().catch(console.error);
