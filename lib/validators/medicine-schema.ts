import { z } from 'zod'

export const medicineSchema = z.object({
  name: z.string().min(1, 'Medicine name is required'),
  company: z.string().optional(),
  generic_name: z.string().optional(),
  category_id: z.string().uuid().optional().or(z.literal('')),
  unit: z.string().optional(),
  unit_packing: z.string().optional(),
  medicine_group: z.string().optional(),
  store_location: z.string().optional(),
  min_level: z.coerce.number().min(0).default(0),
  reorder_level: z.coerce.number().min(0).default(0),
  tax_percent: z.coerce.number().min(0).max(100).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
})

// ── Bulk import field validation ──────────────────────────────────────────────

/** Fixed unit values accepted by the bulk import wizard. */
export const VALID_UNITS = [
  // Oral solid
  'Tablet', 'Capsule', 'Lozenge', 'Sachet', 'Powder', 'Granules',
  // Oral liquid
  'Syrup', 'Suspension', 'Solution', 'Liquid', 'Drops',
  // Topical / Dermal
  'Cream', 'Ointment', 'Gel', 'Lotion', 'Paste', 'Foam', 'Spray', 'Patch', 'Roll',
  // Parenteral
  'Injection', 'Vial', 'Ampoule',
  // Inhalation
  'Inhaler', 'Nebulizer',
  // Rectal / Vaginal
  'Suppository', 'Enema',
  // Wound care / Surgical
  'Bandage', 'Gauze', 'Cotton', 'Tape', 'Dressing', 'Syringe', 'Needle', 'Suture',
  // Orthopedic / Support
  'Belt', 'Brace', 'Splint',
  // Diagnostic / Devices
  'Strip', 'Kit', 'Device', 'Glucometer', 'Thermometer', 'Lancet',
  // Personal care / Para-pharmacy
  'Soap', 'Shampoo', 'Bar', 'Diaper', 'Wipes', 'Pad', 'Mask',
  // Drug delivery devices
  'Pen', 'Cartridge',
  // Containers (when used as unit)
  'Bottle', 'Tube', 'Jar',
] as const
export type ValidUnit = typeof VALID_UNITS[number]

/** Indian GST slabs applicable to medicines (0% for essentials, etc.). */
export const VALID_GST_SLABS = [0, 5, 12, 18, 28] as const
export type GstSlab = typeof VALID_GST_SLABS[number]
