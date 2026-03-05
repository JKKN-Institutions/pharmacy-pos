INSERT INTO medicines (name, unit, status, tax_percent, branch_id)
SELECT name, '1', 'active', 0, '0ee7be87-875f-4f75-9d7c-189a87383879'::uuid
FROM (VALUES
  ('Whisper Mrp 40'),
  ('Whisper Mrp 50'),
  ('X CARE Adult DIAPER L SIZE'),
  ('XYLOMETAZOLINE NASAL DROPS I.P 0.1 W/V'),
  ('YELOPAR'),
  ('ZANDU BALM GREEN'),
  ('ZANDU BALM RED'),
  ('ZANDU BALM RS 2'),
  ('ZEEBEE TABLETS'),
  ('ZEFCORT 6MG TAB'),
  ('ZELDINAC NANO GEL 30G'),
  ('ZELDINAC SPRAY 55G'),
  ('ZENEGRA 100MG'),
  ('ZENEGRA 50MG'),
  ('ZENLEPSY SYP'),
  ('ZENSAMAX BETA M-50'),
  ('ZENSARTAN 40 TAB'),
  ('ZENSARTAN H TAB'),
  ('ZENSARTAN-M25'),
  ('ZENSARTAN-M50'),
  ('ZENVAST-10'),
  ('ZENVAST-CV 10/75'),
  ('ZERODUO P TAB'),
  ('ZINC-OK TAB'),
  ('ZINCOPRIT TAB'),
  ('ZINCOTOP SYRUP 200ML'),
  ('ZINCOTOP TAB'),
  ('ZINKOFIT SYRUP 200ML'),
  ('ZOLPIDEM 10MG TAB'),
  ('ZOSTER CREAM 5GM'),
  ('ZOSTER-400 DT'),
  ('ZYMOX-500'),
  ('ZYNOL- 150'),
  ('Zen Lepsy 500mg Tab'),
  ('test'),
  ('vogli 0.2mg & glime 1mg & metform 500mg')
) AS csv(name)
WHERE NOT EXISTS (
  SELECT 1 FROM medicines m WHERE m.name = csv.name AND m.branch_id = '0ee7be87-875f-4f75-9d7c-189a87383879'::uuid
);