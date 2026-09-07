import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'

type DataTableProps<TData> = {
  data: TData[]
  columns: ColumnDef<TData>[]
  /** Habilita paginación con selector de tamaño de página (10/50/100). Por defecto: true. */
  paginated?: boolean
  /** Tamaño de página inicial. Por defecto: 10. */
  defaultPageSize?: number
  /** Renderizado opcional de tarjeta para pantallas móviles (< md) */
  renderMobileCard?: (item: TData, index: number) => React.ReactNode
}

const PAGE_SIZE_OPTIONS = [10, 50, 100]

export function DataTable<TData>({
  data,
  columns,
  paginated = true,
  defaultPageSize = 10,
  renderMobileCard,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: defaultPageSize })

  const table = useReactTable({
    data,
    columns,
    state: { sorting, ...(paginated ? { pagination } : {}) },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(paginated ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  })

  const rows = table.getRowModel().rows
  const totalRows = data.length
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const rangeStart = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, totalRows)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      {renderMobileCard && (
        <div className="divide-y divide-slate-100 bg-slate-50/50 p-3 space-y-3 dark:divide-slate-800/60 dark:bg-slate-900/40 md:hidden">
          {rows.map((row, idx) => (
            <div key={row.id} className={idx > 0 ? 'pt-3' : ''}>
              {renderMobileCard(row.original, idx)}
            </div>
          ))}
        </div>
      )}

      <div className={`overflow-x-auto ${renderMobileCard ? 'hidden md:block' : ''}`}>
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="flex items-center gap-2"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? '↑' : ''}
                        {header.column.getIsSorted() === 'desc' ? '↓' : ''}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginated && totalRows > 0 ? (
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span>Mostrar</span>
            <select
              value={pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>
              {totalRows === 0 ? '0 resultados' : `${rangeStart}–${rangeEnd} de ${totalRows}`}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-slate-200 px-2 py-1 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-slate-200 px-2 py-1 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              ‹
            </button>
            <span className="px-2 text-slate-500 dark:text-slate-400">
              Página {table.getPageCount() === 0 ? 0 : pageIndex + 1} de {table.getPageCount()}
            </span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-slate-200 px-2 py-1 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-slate-200 px-2 py-1 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              »
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
