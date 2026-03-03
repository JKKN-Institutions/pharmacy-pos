// lib/utils/generate-medicines-template.ts
// Uses exceljs (MIT) for data-validation support that SheetJS CE lacks.
import { VALID_UNITS, VALID_GST_SLABS } from '@/lib/validators/medicine-schema'

export async function generateMedicinesTemplate(categories: string[] = []): Promise<void> {
  // Dynamic import keeps exceljs out of the main JS bundle.
  // It only loads when the user actually clicks "Download Template".
  const ExcelJS = await import('exceljs')

  const wb = new ExcelJS.Workbook()

  // ── Sheet 1: Medicines Import ──────────────────────────────────────────────
  const ws = wb.addWorksheet('Medicines Import')

  // Column order matches the legacy system export exactly:
  // Medicine | Company | Unit | Unit/Packing | Category | Storebox | Reorderlevel | Live Stock | Status | Generic Name | Tax%
  ws.columns = [
    { header: 'Medicine',     key: 'medicine',     width: 40 },  // A
    { header: 'Company',      key: 'company',      width: 20 },  // B
    { header: 'Unit',         key: 'unit',         width: 14 },  // C
    { header: 'Unit/Packing', key: 'unitPacking',  width: 16 },  // D
    { header: 'Category',     key: 'category',     width: 18 },  // E
    { header: 'Storebox',     key: 'storebox',     width: 14 },  // F
    { header: 'Reorderlevel', key: 'reorderlevel', width: 14 },  // G
    { header: 'Live Stock',   key: 'liveStock',    width: 12 },  // H — read-only/informational
    { header: 'Status',       key: 'status',       width: 12 },  // I
    { header: 'Generic Name', key: 'genericName',  width: 24 },  // J
    { header: 'Tax%',         key: 'tax',          width: 8  },  // K
  ]

  // Style the header row — blue fill, white bold text, center-aligned
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // 3 example rows with realistic pharmacy data (Live Stock added at position 8)
  ws.addRow(['PARACETAMOL 500MG TAB', 'Cipla Ltd',  'Tablet',  'Strip of 10',  'Analgesic',   'Rack A-1', 20, 150, 'Normal', 'Paracetamol',      5 ])
  ws.addRow(['AMOXICILLIN 250MG CAP', 'Sun Pharma', 'Capsule', 'Strip of 10',  'Antibiotic',  'Rack B-2', 15,  80, 'Normal', 'Amoxicillin',      12])
  ws.addRow(['COUGH SYRUP 100ML',     'Mankind',    'Syrup',   'Bottle 100ml', 'Respiratory', 'Rack C-1', 10,   8, 'Normal', 'Dextromethorphan', 12])

  // ── Enforced dropdown validations ─────────────────────────────────────────
  // exceljs's Worksheet type definition omits `dataValidations` in its @types,
  // but the property exists at runtime. Cast to any to satisfy TypeScript.
  const wsAny = ws as any
  const unitFormula  = `"${VALID_UNITS.join(',')}"`
  const taxFormula   = `"${VALID_GST_SLABS.join(',')}"`

  // Unit — column C
  wsAny.dataValidations.add('C2:C10000', {
    type: 'list',
    allowBlank: true,
    formulae: [unitFormula],
    showErrorMessage: true,
    errorStyle: 'error',
    errorTitle: 'Invalid Unit',
    error: `Unit must be one of: ${VALID_UNITS.join(', ')}`,
  })

  // Status — column I (shifted from H after adding Live Stock at H)
  wsAny.dataValidations.add('I2:I10000', {
    type: 'list',
    allowBlank: true,
    formulae: ['"Normal,Inactive"'],
    showErrorMessage: true,
    errorStyle: 'error',
    errorTitle: 'Invalid Status',
    error: 'Status must be Normal or Inactive',
  })

  // Category — column E — only add dropdown when DB names are available
  if (categories.length > 0) {
    const catFormula = `"${categories.join(',')}"`
    wsAny.dataValidations.add('E2:E10000', {
      type: 'list',
      allowBlank: true,
      formulae: [catFormula],
      showInputMessage: true,
      promptTitle: 'Category',
      prompt: `Pick a category or type a new one: ${categories.join(', ')}`,
    })
  }

  // Tax% — column K (shifted from J after adding Live Stock at H)
  wsAny.dataValidations.add('K2:K10000', {
    type: 'list',
    allowBlank: true,
    formulae: [taxFormula],
    showErrorMessage: true,
    errorStyle: 'error',
    errorTitle: 'Invalid Tax%',
    error: `Tax% must be a GST slab: ${VALID_GST_SLABS.join(', ')}`,
  })

  // ── Sheet 2: Reference ────────────────────────────────────────────────────
  const refWs = wb.addWorksheet('Reference')
  refWs.columns = [
    { header: 'Column',       key: 'col',    width: 16 },
    { header: 'Valid Values', key: 'values', width: 60 },
    { header: 'Notes',        key: 'notes',  width: 40 },
  ]
  refWs.getRow(1).eachCell((cell) => {
    cell.font = { bold: true }
  })
  const refData = [
    ['Medicine',     '(any text)',                        'Required. Minimum 2 characters.'],
    ['Company',      '(any text)',                        'Optional'],
    ['Unit',         VALID_UNITS.join(', '),              'Must match exactly (case-sensitive)'],
    ['Unit/Packing', '(any text)',                        'e.g. Strip of 10, Bottle 100ml'],
    ['Category',     categories.length > 0 ? categories.join(', ') : '(any text)', categories.length > 0 ? 'Pick from dropdown — new names are auto-created' : 'Created automatically if not found'],
    ['Storebox',     '(any text)',                        'e.g. Rack A-1, Shelf B'],
    ['Reorderlevel', '(number)',                          'Defaults to 20 if blank'],
    ['Live Stock',   '(number)',                          'Informational only — NOT imported. Shows current stock from legacy system for review.'],
    ['Status',       'Normal, Inactive',                  'Normal = active medicine'],
    ['Generic Name', '(any text)',                        'Optional, used for duplicate detection'],
    ['Tax%',         VALID_GST_SLABS.join(', '),         'Indian GST slabs only'],
  ]
  refData.forEach((row) => refWs.addRow(row))

  // ── Browser download ──────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'medicines_import_template.xlsx'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
