// Build medicine ID mapping by writing out SQL queries for batch checking
const fs = require('fs');

const medMap = JSON.parse(fs.readFileSync('docs/data/medicine_id_names.json', 'utf8'));
const entries = Object.entries(medMap);
console.log('Total unique medicine IDs to map:', entries.length);

// Clean a name for comparison - strip trailing tabs+Tablet/Cap/etc, normalize whitespace, uppercase
function cleanName(name) {
  return name
    .replace(/&amp;/g, '&')
    .replace(/\t+/g, ' ')
    .replace(/\s*(Tablet|Tab|Capsule|Cap|Syrup|Injection|Drops|Cream|Ointment|Gel|Sachet|Powder|Suspension|Solution|Lotion|Spray|Inhaler|Patch)s?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// Build a list of cleaned names to query
const queryNames = [];
for (const [oldId, name] of entries) {
  if (parseInt(oldId) === 0) continue; // skip test data
  const cleaned = cleanName(name);
  queryNames.push({ oldId: parseInt(oldId), originalName: name, cleanedName: cleaned });
}

console.log('Medicine IDs to map (excluding 0):', queryNames.length);

// Write the cleaned names for Supabase matching
// We'll generate SQL that tries exact match first, then cleaned match
// Output as a SQL file that can be run in batches

// For efficiency, let's generate a SQL approach:
// 1. Create a temp table with old_id and cleaned_name
// 2. Join to medicines where UPPER(TRIM) matches

// But first, let's output the mapping data as SQL VALUES
const batchSize = 100;
const batches = [];
for (let i = 0; i < queryNames.length; i += batchSize) {
  batches.push(queryNames.slice(i, i + batchSize));
}

console.log('Will generate', batches.length, 'batch query files');

// Write first batch as test
const testBatch = batches[0].slice(0, 10);
const testValues = testBatch.map(q => {
  const safeName = q.originalName.replace(/'/g, "''");
  return `  (${q.oldId}, '${safeName}')`;
}).join(',\n');

const testSql = `
WITH old_meds(old_id, old_name) AS (VALUES
${testValues}
),
cleaned AS (
  SELECT old_id, old_name,
    UPPER(REGEXP_REPLACE(
      REGEXP_REPLACE(old_name, '\\s*(Tablet|Tab|Capsule|Cap|Syrup|Injection|Drops|Cream|Ointment)s?\\s*$', '', 'i'),
      '\\s+', ' ', 'g'
    )) AS clean_name
  FROM old_meds
),
supabase_cleaned AS (
  SELECT id, name,
    UPPER(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(name, E'\\t+', ' ', 'g'),
        '\\s*(Tablet|Tab|Capsule|Cap|Syrup|Injection|Drops|Cream|Ointment)s?\\s*$', '', 'i'
      ),
      '\\s+', ' ', 'g'
    )) AS clean_name
  FROM medicines
)
SELECT c.old_id, c.old_name, c.clean_name AS old_clean,
       sc.id AS new_uuid, sc.name AS supabase_name, sc.clean_name AS supabase_clean
FROM cleaned c
LEFT JOIN supabase_cleaned sc ON sc.clean_name = c.clean_name
ORDER BY c.old_id;
`;

fs.writeFileSync('docs/data/test_medicine_match.sql', testSql);
console.log('Wrote test query to docs/data/test_medicine_match.sql');
console.log('Test names:');
testBatch.forEach(q => console.log('  ' + q.oldId + ': "' + q.originalName + '" -> "' + q.cleanedName + '"'));
