const fs = require('fs');

const medMap = JSON.parse(fs.readFileSync('docs/data/medicine_id_names.json', 'utf8'));
const entries = Object.entries(medMap).filter(([id]) => parseInt(id) !== 0);
console.log('Medicine IDs to map (excluding 0):', entries.length);

const batchSize = 150;
const batches = [];
for (let i = 0; i < entries.length; i += batchSize) {
  batches.push(entries.slice(i, i + batchSize));
}
console.log('Batches:', batches.length);

for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
  const batch = batches[batchIdx];
  const values = batch.map(([oldId, name]) => {
    const safeName = name.replace(/'/g, "''").replace(/\\/g, '\\\\');
    return `  (${oldId}, '${safeName}')`;
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
SELECT old_id, new_uuid, match_type FROM exact_match
UNION ALL
SELECT old_id, new_uuid, match_type FROM stripped_match
ORDER BY old_id;`;

  fs.writeFileSync(`docs/data/med_match_batch_${batchIdx}.sql`, sql);
}

console.log('Generated', batches.length, 'batch SQL files in docs/data/med_match_batch_*.sql');
