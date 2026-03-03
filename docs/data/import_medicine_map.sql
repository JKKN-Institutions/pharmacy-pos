-- Medicine ID mapping via name matching
-- Two-layer matching: exact match first, then suffix-stripped match

CREATE TABLE IF NOT EXISTS _staging_medicine_map (
  old_id INTEGER PRIMARY KEY,
  new_uuid UUID NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'exact'
);
TRUNCATE _staging_medicine_map;

-- Build medicine mapping from staging batch names
WITH old_meds AS (
  SELECT DISTINCT ON (medicine_id) medicine_id AS old_id, name AS old_name
  FROM _staging_old_batches
  ORDER BY medicine_id, id DESC  -- use latest name for each medicine
),
old_cleaned AS (
  SELECT old_id, old_name,
    UPPER(TRIM(old_name)) AS exact_name,
    UPPER(TRIM(REGEXP_REPLACE(old_name,
      '\s+(TAB|TABS|TABLET|TABLETS|CAP|CAPS|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|DRPS|DROPS)\s*$',
      '', 'i'))) AS stripped_name
  FROM old_meds
),
sb_cleaned AS (
  SELECT id, name,
    UPPER(TRIM(REGEXP_REPLACE(name, E'\t.*$', ''))) AS exact_name,
    UPPER(TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(name, E'\t.*$', ''),
      '\s+(TAB|TABS|TABLET|TABLETS|CAP|CAPS|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|DRPS|DROPS)\s*$',
      '', 'i'
    ))) AS stripped_name
  FROM medicines
),
exact_match AS (
  SELECT DISTINCT ON (o.old_id) o.old_id, s.id AS new_uuid, 'exact'::text AS match_type
  FROM old_cleaned o
  JOIN sb_cleaned s ON s.exact_name = o.exact_name
  ORDER BY o.old_id, s.id
),
stripped_match AS (
  SELECT DISTINCT ON (o.old_id) o.old_id, s.id AS new_uuid, 'stripped'::text AS match_type
  FROM old_cleaned o
  JOIN sb_cleaned s ON s.stripped_name = o.stripped_name
  WHERE o.old_id NOT IN (SELECT old_id FROM exact_match)
  ORDER BY o.old_id, s.id
)
INSERT INTO _staging_medicine_map (old_id, new_uuid, match_type)
SELECT old_id, new_uuid, match_type FROM exact_match
UNION ALL
SELECT old_id, new_uuid, match_type FROM stripped_match;

-- Report mapping stats
SELECT
  (SELECT COUNT(*) FROM _staging_medicine_map) AS mapped,
  (SELECT COUNT(DISTINCT medicine_id) FROM _staging_old_batches) AS total_unique,
  (SELECT COUNT(*) FROM _staging_medicine_map WHERE match_type = 'exact') AS exact_matches,
  (SELECT COUNT(*) FROM _staging_medicine_map WHERE match_type = 'stripped') AS stripped_matches;
