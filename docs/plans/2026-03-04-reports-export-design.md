# Reports Export — Design Document
**Date:** 2026-03-04
**Feature:** Excel + Print + PDF Download export for all 9 report pages

---

## Summary

Add export functionality to all report pages under `/reports/`. Each report gains three export options in the `PageHeader` action area: **Print**, **Download PDF**, and **Export Excel**. All export logic runs entirely on the client; the Server Component pages pass their already-fetched data to a shared client-side `ExportButtons` component via props.

---

## Architecture

### Three shared building blocks

#### 1. `components/reports/export-buttons.tsx` — Client Component
- Placed inside each report's `<PageHeader>` actions area (right side, alongside the ← Reports button)
- Props interface:
  ```ts
  interface ExportButtonsProps {
    title: string                              // e.g. "POS / Bill Report"
    filename: string                           // e.g. "pos-bill-2026-03-04" (no extension)
    columns: { header: string; key: string; width?: number }[]
    rows: Record<string, unknown>[]
    summaryItems: { label: string; value: string }[]
    dateRange?: { from?: string; to?: string } // shown in PDF header
  }
  ```
- **Print button**: calls `window.print()`. Each report page already renders a table that can be styled with `@media print` CSS.
- **Download PDF button**: renders a `PDFDownloadLink` from `@react-pdf/renderer` wrapping the shared `ReportDocument`. Opens a download of `{filename}.pdf`.
- **Export Excel button**: calls `exportReportExcel(options)` utility with dynamic import of `exceljs`.
- Three icon buttons: `Printer`, `FileDown` (PDF), `Sheet` (Excel) from `lucide-react`. Use `Button variant="outline" size="sm"` from shadcn/ui.

#### 2. `components/reports/report-pdf.tsx` — Client Component
A generic `@react-pdf/renderer` Document for all reports. Structure:
- **Header row**: pharmacy name "Om Sakthi Medicals" (left) + report title (right)
- **Meta row**: "Generated: DD MMM YYYY HH:mm" + optional date range
- **Summary section**: grid of `{label: value}` cards (totals, counts)
- **Data table**: auto-rendered from `columns` + `rows` arrays. Right-aligned number columns (detected by `₹` prefix or numeric values).
- **Footer**: page numbers ("Page X of Y")
- Uses `@react-pdf/renderer` `Document`, `Page`, `View`, `Text`, `StyleSheet`.

#### 3. `lib/utils/export-report-excel.ts` — Utility function
- Signature: `async function exportReportExcel(options: ExportExcelOptions): Promise<void>`
- Dynamic import of `exceljs` (keeps bundle size down, same pattern as `generate-medicines-template.ts`)
- **Sheet 1 "Data"**: styled header row (green fill `#166534`, white bold text), then all data rows. Column widths from config.
- **Sheet 2 "Summary"**: report title, generated date, then each `summaryItem` as a key/value pair. Bold keys.
- Browser download via `URL.createObjectURL(blob)` + anchor click (same pattern as existing utility).

---

## Data Flow Per Report

```
page.tsx (Server Component)
  ├─ fetches rows from Supabase
  ├─ computes summaryItems (totals, counts)
  └─ renders:
       <PageHeader ...>
         <ExportButtons
           title="..."
           filename="...-YYYY-MM-DD"
           columns={[...]}
           rows={rows}
           summaryItems={[...]}
           dateRange={params}
         />
         <Button>← Reports</Button>
       </PageHeader>
```

The `rows` are plain serializable objects already fetched for the table — no additional DB query needed.

---

## Per-Report Configuration

| Report | Table type | Key summary items |
|--------|-----------|-------------------|
| POS/Bill | DataTable (PosBillTable) | Total Revenue, Bill Count |
| Purchase | DataTable (PurchaseTable) | Total Cost, Purchase Count, Avg Value |
| Invoice | DataTable (InvoiceTable) | Total Revenue, Collected, Outstanding |
| Expenses | DataTable (ExpensesTable) | Total Expenses, Record Count, Categories |
| Salary | DataTable (SalaryTable) | Total Salary Paid, Staff Count, Records |
| Inventory | Native HTML table | Total Stock Value, Total Units, Active Batches |
| Account | Native HTML table | Total Invoiced, Collected, Outstanding |
| Out-of-Stock | Native HTML table | Out of Stock count, Low Stock count |
| Income & Expense | Chart + native table | Total Income, Total Expenses, Net Profit/Loss |

---

## Print CSS Strategy

Add a shared `print.css` or inline `<style>` media query that:
- Hides: sidebar, topbar, bottom nav, PWA banners, export buttons, pagination controls, search bar
- Shows: PageHeader title, summary cards, data table
- Sets table font size to 10pt, ensures full-width layout

---

## Constraints & Notes

- **Income & Expense PDF**: The Recharts bar chart cannot render inside `@react-pdf/renderer`. The PDF exports only the monthly data table (not the chart). This is acceptable since the numbers tell the full story.
- **Large datasets**: Reports with many rows (e.g., 5000+ bills) will cause the PDF to be slow to generate. Acceptable trade-off — this is an on-demand admin operation.
- **Filename convention**: `{report-slug}-{YYYY-MM-DD}.xlsx` / `.pdf` — date is the export date, not the filter date.
- **No new Supabase queries**: all export data comes from props already fetched by the Server Component.
- **ExcelJS dynamic import**: keeps `exceljs` out of the initial JS bundle (it's ~1MB).

---

## File List

**New files:**
- `components/reports/export-buttons.tsx`
- `components/reports/report-pdf.tsx`
- `lib/utils/export-report-excel.ts`

**Modified files (add ExportButtons to PageHeader):**
- `app/(dashboard)/reports/pos-bill/page.tsx`
- `app/(dashboard)/reports/purchase/page.tsx`
- `app/(dashboard)/reports/invoice/page.tsx`
- `app/(dashboard)/reports/expenses/page.tsx`
- `app/(dashboard)/reports/salary/page.tsx`
- `app/(dashboard)/reports/inventory/page.tsx`
- `app/(dashboard)/reports/account/page.tsx`
- `app/(dashboard)/reports/out-of-stock/page.tsx`
- `app/(dashboard)/reports/income-expense/page.tsx`
