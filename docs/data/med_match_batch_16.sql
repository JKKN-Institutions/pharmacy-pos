WITH old_meds(old_id, old_name) AS (VALUES
  (3074, 'PREGAHEM-DL CAPS'),
  (3075, 'VCARE  VIP RS 24'),
  (3076, 'VASELINE RS 10'),
  (3077, 'TC BEND'),
  (3078, 'TC FOTMOLA'),
  (3079, 'TC PLASTIC'),
  (3080, 'PEARS SOAP YELLOW '),
  (3081, 'PEARS SOAP BLUE'),
  (3082, 'PEARS SOAP GREEN'),
  (3083, 'PEARS SOAP POMEGRANATE'),
  (3084, 'CHANDRIKA SOAP'),
  (3085, 'CLOSEUP PASTE RS 10'),
  (3086, 'HORLICKS JUNIOR POUCH 500GM'),
  (3087, 'LIFEBUOY HANDWASH RS 99'),
  (3088, 'LIFEBUOY HANDWASH RS 30'),
  (3089, 'MEDIMIX SOAP'),
  (3090, 'ALOE REFRESH SOAP'),
  (3091, 'SANTOOR SOAP'),
  (3092, 'GLIMECHECK MF 4/500 TAB'),
  (3093, 'SITAVAC 3D TAB'),
  (3094, 'ELNPRESS-10'),
  (3095, 'KELAC TAB'),
  (3096, 'DAPAKING-TRIO XR TAB'),
  (3097, 'FLUCEMOL-650'),
  (3098, 'GABIPENTA GEL'),
  (3099, 'METROSANC-400 TAB'),
  (3100, 'THYROZOOM-25'),
  (3101, 'MEGACECLO RAB TAB'),
  (3102, 'GLIMITH-MF 4/500 TAB'),
  (3103, 'GLIDUM-MF 4/1000 TAB'),
  (3104, 'ACCUZITH-500'),
  (3105, 'LOPERASANC CAPS'),
  (3106, 'COBANERVE-XT CAPS'),
  (3107, 'EASY TEDDY DIAPER SMALL'),
  (3108, 'EASY TEDDY DIAPER LARGE'),
  (3109, 'EASY TEDDY DIAPER MEDIUM'),
  (3110, 'FLUMET-400'),
  (3111, 'MEGACLAV-625'),
  (3112, 'SENSODYNE RAPID RELIEF BIG PASTE'),
  (3113, 'DYNA LS CORSET XL'),
  (3114, 'ATOWICK-CV 10/75 CAPS'),
  (3115, 'DAPAKING-M 10/500 TAB'),
  (3116, 'DYNA AB BELT XL'),
  (3117, 'C-ONE INJ'),
  (3118, 'ATOWICK-20 '),
  (3119, 'RAMYDER-2.5 TAB'),
  (3120, 'RAMYDER-5 TAB'),
  (3121, 'DICLOFORD-AQ 1ML INJ'),
  (3122, 'BETAFORD 1ML INJ'),
  (3123, 'NECPANTO-40')
),
old_cleaned AS (
  SELECT old_id, old_name,
    UPPER(TRIM(old_name)) AS exact_name,
    UPPER(TRIM(REGEXP_REPLACE(old_name, '\s+(TAB|TABS|TABLET|TABLETS|CAP|CAPS|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|DRPS|DROPS)\s*$', '', 'i'))) AS stripped_name
  FROM old_meds
),
sb_cleaned AS (
  SELECT id, name,
    UPPER(TRIM(REGEXP_REPLACE(name, E'\t.*$', ''))) AS exact_name,
    UPPER(TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(name, E'\t.*$', ''),
      '\s+(TAB|TABS|TABLET|TABLETS|CAP|CAPS|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|DRPS|DROPS)\s*$', '', 'i'
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
ORDER BY old_id;