'use client'

import * as React from 'react'
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  RowSelectionState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  useReactTable,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Search, ChevronLeft, ChevronRight, InboxIcon,
  Trash2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { bulkDeleteCategoriesAction } from '@/app/(dashboard)/medicine-categories/actions'
import type { CategoryWithCount } from '@/app/(dashboard)/medicine-categories/columns'

interface CategoriesDataTableProps {
  columns: ColumnDef<CategoryWithCount, unknown>[]
  data: CategoryWithCount[]
}

export function CategoriesDataTable({ columns, data }: CategoriesDataTableProps) {
  const [search, setSearch]   = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection]     = React.useState<RowSelectionState>({})
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [bulkLoading, setBulkLoading]       = React.useState(false)

  const table = useReactTable({
    data,
    columns,
    getRowId: row => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    initialState: { pagination: { pageSize: 15 } },
    state: { sorting, columnVisibility, rowSelection },
  })

  // Apply search filter
  React.useEffect(() => {
    table.getColumn('name')?.setFilterValue(search || undefined)
  }, [search, table])

  const selectedIds  = Object.keys(rowSelection)
  const selectedCount = selectedIds.length

  const totalRows  = table.getFilteredRowModel().rows.length
  const pageIndex  = table.getState().pagination.pageIndex
  const pageSize   = table.getState().pagination.pageSize
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const to   = Math.min((pageIndex + 1) * pageSize, totalRows)

  // ── Bulk handlers ────────────────────────────────────────────────────────────

  async function handleBulkDelete() {
    setBulkLoading(true)
    const result = await bulkDeleteCategoriesAction(selectedIds)
    setBulkLoading(false)
    setBulkDeleteOpen(false)
    if (result?.error) toast.error(result.error)
    else { toast.success(`${result.deleted} categories deleted`); setRowSelection({}) }
  }

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearch('')}
              className="px-2 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Bulk action toolbar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2.5">
          <Badge variant="secondary" className="font-semibold">
            {selectedCount} selected
          </Badge>
          <div className="flex items-center gap-1 ml-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={bulkLoading}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2 text-muted-foreground"
            onClick={() => setRowSelection({})}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="bg-muted/60 hover:bg-muted/60 border-b-2 border-border">
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className="font-semibold text-xs uppercase tracking-wider text-foreground/70 py-3 px-4 first:pl-6 last:pr-6"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className={`border-b border-border/50 transition-colors hover:bg-primary/5 ${
                    row.getIsSelected()
                      ? 'bg-primary/8'
                      : idx % 2 === 1 ? 'bg-muted/20' : 'bg-card'
                  }`}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="py-3 px-4 first:pl-6 last:pr-6">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <InboxIcon className="h-8 w-8 opacity-30" />
                    <span className="text-sm">No categories found</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {totalRows === 0
            ? 'No categories'
            : `Showing ${from}–${to} of ${totalRows} categor${totalRows !== 1 ? 'ies' : 'y'}`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-3 py-1 rounded-md bg-muted">
            {pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk delete confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} categories?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedCount} selected
              {selectedCount === 1 ? ' category' : ' categories'}.
              Medicines using them will lose their classification. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkLoading ? 'Deleting...' : `Delete ${selectedCount}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
