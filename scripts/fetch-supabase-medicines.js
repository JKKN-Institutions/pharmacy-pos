// This script reads the tool output files and builds the mapping
// Instead, let's just read the batch SQL results and process them
// Actually, we need a different approach - let's output the medicine data as CSV-friendly SQL

const fs = require('fs');

// Read the already-parsed batch data
const batches = JSON.parse(fs.readFileSync('docs/data/parsed_batches.json', 'utf8'));
const medNames = JSON.parse(fs.readFileSync('docs/data/medicine_id_names.json', 'utf8'));

// Get unique (medicine_id, name) pairs from actual batch data
// Use the LATEST name for each medicine_id (some may have been renamed)
const medIdToNames = new Map();
for (const row of batches) {
  if (row.medicine_id === 0) continue;
  if (!medIdToNames.has(row.medicine_id)) {
    medIdToNames.set(row.medicine_id, new Set());
  }
  medIdToNames.get(row.medicine_id).add(row.name);
}

console.log('Unique medicine IDs (excl 0):', medIdToNames.size);

// Check how many have multiple names
let multiName = 0;
for (const [id, names] of medIdToNames) {
  if (names.size > 1) {
    multiName++;
    if (multiName <= 5) {
      console.log(`  ID ${id} has ${names.size} names: ${[...names].join(' | ')}`);
    }
  }
}
console.log('Medicine IDs with multiple names:', multiName);

// Build the VALUES SQL for all medicine IDs - output in batches
// Use the first name seen for each ID
const allEntries = [];
for (const [id, names] of medIdToNames) {
  const firstName = [...names][0];
  allEntries.push({ oldId: id, name: firstName });
}

// Sort by oldId
allEntries.sort((a, b) => a.oldId - b.oldId);

// Write as a simple TSV for later use
const lines = allEntries.map(e => `${e.oldId}\t${e.name}`);
fs.writeFileSync('docs/data/old_medicine_ids.tsv', lines.join('\n'));
console.log('Wrote', allEntries.length, 'entries to docs/data/old_medicine_ids.tsv');

// Generate batch SQL files with 200 entries each
const batchSize = 200;
for (let i = 0; i < allEntries.length; i += batchSize) {
  const batch = allEntries.slice(i, i + batchSize);
  const batchIdx = Math.floor(i / batchSize);

  const values = batch.map(e => {
    const safeName = e.name.replace(/'/g, "''");
    return `  (${e.oldId}, '${safeName}')`;
  }).join(',\n');

  const sql = `WITH old_meds(old_id, old_name) AS (VALUES
${values}
),
old_cleaned AS (
  SELECT old_id, old_name,
    UPPER(TRIM(old_name)) AS exact_name,
    UPPER(TRIM(REGEXP_REPLACE(old_name, '\\s+(TAB|TABS|TABLET|TABLETS|CAP|CAPS|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|DRPS|DROPS)\\s*$', '', 'i'))) AS stripped_name
  FROM old_meds
),
sb_cleaned AS (
  SELECT id, name,
    UPPER(TRIM(REGEXP_REPLACE(name, E'\\t.*$', ''))) AS exact_name,
    UPPER(TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(name, E'\\t.*$', ''),
      '\\s+(TAB|TABS|TABLET|TABLETS|CAP|CAPS|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|DRPS|DROPS)\\s*$', '', 'i'
    ))) AS stripped_name
  FROM medicines
),
exact_match AS (
  SELECT DISTINCT ON (o.old_id) o.old_id, s.id AS new_uuid, 'exact' AS match_type
  FROM old_cleaned o
  JOIN sb_cleaned s ON s.exact_name = o.exact_name
  ORDER BY o.old_id
),
stripped_match AS (
  SELECT DISTINCT ON (o.old_id) o.old_id, s.id AS new_uuid, 'stripped' AS match_type
  FROM old_cleaned o
  JOIN sb_cleaned s ON s.stripped_name = o.stripped_name
  WHERE o.old_id NOT IN (SELECT old_id FROM exact_match)
  ORDER BY o.old_id
)
SELECT old_id, new_uuid::text, match_type FROM exact_match
UNION ALL
SELECT old_id, new_uuid::text, match_type FROM stripped_match
ORDER BY old_id;`;

  fs.writeFileSync(`docs/data/med_match_b${batchIdx}.sql`, sql);
}

const numBatches = Math.ceil(allEntries.length / batchSize);
console.log('Generated', numBatches, 'batch files: med_match_b0.sql through med_match_b' + (numBatches - 1) + '.sql');
