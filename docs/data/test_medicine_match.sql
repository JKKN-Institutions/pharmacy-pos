
WITH old_meds(old_id, old_name) AS (VALUES
  (1, 'Dolo'),
  (4, 'TENETIC 20MG TAB'),
  (5, 'ALONA PLUS'),
  (6, 'maxirich cap'),
  (10, 'PARACETAMOL 500MG TAB'),
  (27, 'AFENAK PLUS TAB'),
  (51, 'Folic Acid GG'),
  (62, 'ABD PLUS TAB'),
  (64, 'ACARBOSE 50MG'),
  (65, 'ACECLO&PARA&CHORZOXAZON')
),
cleaned AS (
  SELECT old_id, old_name,
    UPPER(REGEXP_REPLACE(
      REGEXP_REPLACE(old_name, '\s*(Tablet|Tab|Capsule|Cap|Syrup|Injection|Drops|Cream|Ointment)s?\s*$', '', 'i'),
      '\s+', ' ', 'g'
    )) AS clean_name
  FROM old_meds
),
supabase_cleaned AS (
  SELECT id, name,
    UPPER(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(name, E'\t+', ' ', 'g'),
        '\s*(Tablet|Tab|Capsule|Cap|Syrup|Injection|Drops|Cream|Ointment)s?\s*$', '', 'i'
      ),
      '\s+', ' ', 'g'
    )) AS clean_name
  FROM medicines
)
SELECT c.old_id, c.old_name, c.clean_name AS old_clean,
       sc.id AS new_uuid, sc.name AS supabase_name, sc.clean_name AS supabase_clean
FROM cleaned c
LEFT JOIN supabase_cleaned sc ON sc.clean_name = c.clean_name
ORDER BY c.old_id;
