import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useReactToPrint } from 'react-to-print'
import type { ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { SectionCard } from '../../../components/ui/SectionCard'
import { DataTable } from '../../../components/ui/DataTable'
import { Receipt } from '../../../components/Receipt'
import { listSales, listSaleReturns, payPendingSale, PAYMENT_METHOD_LABELS, type Sale, type PaymentMethod } from '../../../services/api/sales'
import { useReceiptConfig } from '../../../hooks/useReceiptConfig'
import { ReturnModal } from '../components/ReturnModal'

function money(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function invoiceNumber(saleId: string) {
  return `#${saleId.substring(0, 8).toUpperCase()}`
}

function renderSaleStatus(status: string) {
  switch (status) {
    case 'RETURNED':
      return (
        <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
          Devuelta
        </span>
      )
    case 'PARTIAL_RETURN':
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          Dev. Parcial
        </span>
      )
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          Cancelada
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          Completada
        </span>
      )
  }
}

type RangePreset = 'today' | 'week' | 'month' | 'custom'

export function InvoicesPage() {
  const today = useMemo(() => new Date(), [])

  // Por defecto se muestran solo las facturas del día actual.
  const [preset, setPreset] = useState<RangePreset>('today')
  const [dateFrom, setDateFrom] = useState(toDateInputValue(today))
  const [dateTo, setDateTo] = useState(toDateInputValue(today))
  const [search, setSearch] = useState('')

  const applyPreset = (nextPreset: RangePreset) => {
    setPreset(nextPreset)
    if (nextPreset === 'custom') return

    const now = new Date()
    if (nextPreset === 'today') {
      setDateFrom(toDateInputValue(now))
      setDateTo(toDateInputValue(now))
      return
    }
    const start = new Date(now)
    start.setDate(start.getDate() - (nextPreset === 'week' ? 7 : 30))
    setDateFrom(toDateInputValue(start))
    setDateTo(toDateInputValue(now))
  }
  const [viewingSale, setViewingSale] = useState<Sale | null>(null)
  const [printingSale, setPrintingSale] = useState<Sale | null>(null)
  const [returningSale, setReturningSale] = useState<Sale | null>(null)
  const [payingPendingSale, setPayingPendingSale] = useState<Sale | null>(null)
  const [pendingPayMethod, setPendingPayMethod] = useState<PaymentMethod>('CASH')
  const [showOnlyPending, setShowOnlyPending] = useState(false)
  const queryClient = useQueryClient()

  const receiptRef = useRef<HTMLDivElement>(null)
  const receiptConfig = useReceiptConfig()

  const salesQuery = useQuery({
    queryKey: ['sales'],
    queryFn: () => listSales(),
  })

  const viewingSaleReturnsQuery = useQuery({
    queryKey: ['sale-returns', viewingSale?.id],
    queryFn: () => listSaleReturns(viewingSale!.id),
    enabled: !!viewingSale?.id,
  })

  const sales = salesQuery.data ?? []

  const filteredSales = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null
    const term = search.trim().toLowerCase()

    return sales
      .filter((sale) => {
        const created = new Date(sale.created_at)
        if (from && created < from) return false
        if (to && created > to) return false
        if (term) {
          const matchesInvoice = invoiceNumber(sale.id).toLowerCase().includes(term)
          const customerNameStr =
            sale.customers?.full_name ||
            (sale.notes ? sale.notes.replace('Cliente: ', '') : '') ||
            'venta de mostrador'
          const matchesCustomer = customerNameStr.toLowerCase().includes(term)
          const matchesProduct = sale.sale_items.some((item) =>
            item.products.name.toLowerCase().includes(term),
          )
          if (!matchesInvoice && !matchesCustomer && !matchesProduct) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [sales, dateFrom, dateTo, search])

  const stats = useMemo(() => {
    const count = filteredSales.length
    const totalAmount = filteredSales.reduce((sum, s) => sum + s.total, 0)
    const totalItems = filteredSales.reduce(
      (sum, s) => sum + s.sale_items.reduce((iSum, item) => iSum + item.unit_quantity, 0),
      0,
    )
    return { count, totalAmount, totalItems }
  }, [filteredSales])

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Factura-${printingSale?.id || 'reimpresion'}`,
    onAfterPrint: () => setPrintingSale(null),
  })

  const handleReprint = (sale: Sale) => {
    setPrintingSale(sale)
    setTimeout(() => handlePrint(), 100)
  }

  const payPendingMutation = useMutation({
    mutationFn: ({ saleId, paymentMethod }: { saleId: string; paymentMethod: PaymentMethod }) =>
      payPendingSale(saleId, { paymentMethod }),
    onSuccess: () => {
      toast.success('Pago registrado correctamente')
      setPayingPendingSale(null)
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['cash-register-current'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar el pago')
    },
  })

  const columns = useMemo<ColumnDef<Sale>[]>(
    () => [
      {
        header: 'Factura',
        id: 'invoice',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
            {invoiceNumber(row.original.id)}
          </span>
        ),
      },
      {
        header: 'Fecha',
        accessorKey: 'created_at',
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
      {
        header: 'Cliente',
        id: 'customer',
        cell: ({ row }) => {
          const isPending = row.original.payment_method === 'PENDING'
          const customerName =
            row.original.customers?.full_name ||
            (row.original.notes ? row.original.notes.replace('Cliente: ', '') : null) ||
            'Venta de mostrador'

          if (isPending) {
            return (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-500/40">
                <span className="text-amber-600 dark:text-amber-400">⏳</span>
                <span>{customerName}</span>
              </span>
            )
          }

          return (
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {customerName}
            </span>
          )
        },
      },
      {
        header: 'Cajero',
        id: 'cashier',
        cell: ({ row }) => row.original.users?.full_name || '—',
      },
      {
        header: 'Medio de pago',
        id: 'payment_method',
        cell: ({ row }) => {
          const s = row.original
          if (s.payment_method_2) {
            return (
              <div className="text-xs">
                <span className="font-medium text-slate-900 dark:text-white">
                  {PAYMENT_METHOD_LABELS[s.payment_method]} + {PAYMENT_METHOD_LABELS[s.payment_method_2]}
                </span>
                <p className="text-[10px] text-slate-400">
                  {money(s.amount_paid_1 || 0)} / {money(s.amount_paid_2 || 0)}
                </p>
              </div>
            )
          }
          return (
            <div className="flex flex-col gap-0.5">
              {s.payment_method === 'PENDING' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  ⏳ Pendiente (Fiado)
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {PAYMENT_METHOD_LABELS[s.payment_method] || s.payment_method}
                </span>
              )}
            </div>
          )
        },
      },
      {
        header: 'Estado',
        accessorKey: 'status',
        cell: ({ row }) => renderSaleStatus(row.original.status),
      },
      {
        header: 'Ítems',
        id: 'items',
        cell: ({ row }) => row.original.sale_items.reduce((sum, item) => sum + item.unit_quantity, 0),
      },
      {
        header: 'Total',
        accessorKey: 'total',
        cell: ({ row }) => (
          <span className={`font-semibold ${
            row.original.payment_method === 'PENDING'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-900 dark:text-white'
          }`}>{money(row.original.total)}</span>
        ),
      },
      {
        header: '',
        id: 'actions',
        cell: ({ row }) => {
          const canReturn = row.original.status !== 'RETURNED' && row.original.status !== 'CANCELLED'
          const isPending = row.original.payment_method === 'PENDING'
          return (
            <div className="flex items-center gap-2.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setViewingSale(row.original)
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Ver detalle
              </button>
              {isPending && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setPayingPendingSale(row.original)
                    setPendingPayMethod('CASH')
                  }}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5"
                  title="Registrar el pago de esta factura fiada"
                >
                  ✅ Cobrar
                </button>
              )}
              {canReturn && !isPending && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setReturningSale(row.original)
                  }}
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-0.5"
                  title="Devolver productos de esta factura"
                >
                  🔄 Devolver
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleReprint(row.original)
                }}
                className="text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
              >
                🖨️
              </button>
            </div>
          )
        },
      },
    ],
    [],
  )

  const renderSaleCard = (sale: Sale) => {
    const canReturn = sale.status !== 'RETURNED' && sale.status !== 'CANCELLED'
    const isPending = sale.payment_method === 'PENDING'
    const customerName =
      sale.customers?.full_name ||
      (sale.notes ? sale.notes.replace('Cliente: ', '') : null) ||
      'Venta de mostrador'
    const itemsCount = sale.sale_items?.reduce((sum, item) => sum + item.unit_quantity, 0) || 0
    const paymentLabel = sale.payment_method_2
      ? `${PAYMENT_METHOD_LABELS[sale.payment_method] || sale.payment_method} + ${PAYMENT_METHOD_LABELS[sale.payment_method_2] || sale.payment_method_2}`
      : PAYMENT_METHOD_LABELS[sale.payment_method] || sale.payment_method

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
        {/* Encabezado: Nº Factura, Estado y Total */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {invoiceNumber(sale.id)}
            </span>
            {renderSaleStatus(sale.status)}
          </div>
          <span
            className={`text-base font-bold shrink-0 ${
              isPending ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {money(sale.total)}
          </span>
        </div>

        {/* Metadatos: Fecha e Ítems */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>📅 {formatDateTime(sale.created_at)}</span>
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {itemsCount} {itemsCount === 1 ? 'ítem' : 'ítems'}
          </span>
        </div>

        {/* Cliente y Medio de pago */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-slate-400 shrink-0">👤</span>
            <span className="truncate font-medium text-slate-700 dark:text-slate-300" title={customerName}>
              {customerName}
            </span>
          </div>
          <div className="shrink-0">
            {isPending ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300">
                ⏳ Fiado
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {paymentLabel}
              </span>
            )}
          </div>
        </div>

        {/* Cajero si existe */}
        {sale.users?.full_name && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Atendió: <span className="font-medium text-slate-600 dark:text-slate-300">{sale.users.full_name}</span>
          </p>
        )}

        {/* Botones de acción táctiles y accesibles */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setViewingSale(sale)
            }}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50 transition active:scale-95"
          >
            Ver detalle
          </button>

          {isPending && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPayingPendingSale(sale)
                setPendingPayMethod('CASH')
              }}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition active:scale-95 shadow-sm"
              title="Registrar cobro"
            >
              ✅ Cobrar
            </button>
          )}

          {canReturn && !isPending && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setReturningSale(sale)
              }}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40 transition active:scale-95"
              title="Devolver productos"
            >
              🔄 Devolver
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleReprint(sale)
            }}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition active:scale-95"
            title="Reimprimir ticket"
          >
            🖨️
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Facturas"
        description="Consulta todas las facturas emitidas y los productos vendidos en cada una."
      >
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {preset === 'today' ? 'Facturas de hoy' : 'Facturas en el rango'}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{stats.count}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total facturado</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{money(stats.totalAmount)}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">Unidades vendidas</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{stats.totalItems}</p>
          </article>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5 items-center">
          {(
            [
              { key: 'today', label: 'Hoy' },
              { key: 'week', label: '7 días' },
              { key: 'month', label: '30 días' },
              { key: 'custom', label: 'Rango' },
            ] as { key: RangePreset; label: string }[]
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => applyPreset(opt.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                preset === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowOnlyPending((v) => !v)}
            className={`ml-auto rounded-md px-3 py-1.5 text-xs font-medium transition border ${
              showOnlyPending
                ? 'border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            ⏳ {showOnlyPending ? 'Mostrando fiados' : 'Ver fiados pendientes'}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-55">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Buscar
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Número de factura, cliente o producto…"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPreset('custom')
              }}
              className="rounded-md border border-slate-200 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPreset('custom')
              }}
              className="rounded-md border border-slate-200 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {salesQuery.isLoading ? (
          <div className="py-10 text-center text-sm text-slate-400">Cargando facturas…</div>
        ) : salesQuery.isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">
            Error al cargar las facturas
          </div>
        ) : filteredSales.filter(s => !showOnlyPending || s.payment_method === 'PENDING').length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400 dark:border-slate-700">
            {showOnlyPending
              ? 'No hay facturas pendientes de pago (fiadas) en este rango.'
              : preset === 'today'
              ? 'Aún no hay facturas registradas hoy.'
              : 'No hay facturas registradas en el rango seleccionado.'}
          </div>
        ) : (
          <DataTable
            data={filteredSales.filter(s => !showOnlyPending || s.payment_method === 'PENDING')}
            columns={columns}
            renderMobileCard={renderSaleCard}
          />
        )}
      </SectionCard>

      {/* ===== Modal de detalle de factura ===== */}
      {viewingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] sm:max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white p-4 sm:p-6 shadow-2xl dark:bg-slate-900 overflow-hidden">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                  Factura {invoiceNumber(viewingSale.id)}
                </h2>
                {renderSaleStatus(viewingSale.status)}
              </div>
              <button
                onClick={() => setViewingSale(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              {formatDateTime(viewingSale.created_at)}
              {' · '}
              {viewingSale.customers?.full_name || 'Venta de mostrador'}
              {viewingSale.users?.full_name ? ` · Atendió: ${viewingSale.users.full_name}` : ''}
            </p>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[320px] text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Producto</th>
                      <th className="px-3 py-2 text-center font-medium">Cant.</th>
                      <th className="px-3 py-2 text-right font-medium">Precio</th>
                      <th className="px-3 py-2 text-right font-medium">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingSale.sale_items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                          {item.products.name}
                          {item.unit_label !== 'Unidad' && (
                            <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                              {item.unit_label}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400">
                          {item.unit_quantity}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                          {money(item.unit_price)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">
                          {money(item.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Historial de Devoluciones registradas para esta factura */}
              {viewingSaleReturnsQuery.data && viewingSaleReturnsQuery.data.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                    <span>🔄</span> Historial de Devoluciones
                  </p>
                  <div className="space-y-2.5">
                    {viewingSaleReturnsQuery.data.map((ret) => (
                      <div
                        key={ret.id}
                        className="rounded-lg bg-white p-2.5 shadow-sm text-xs dark:bg-slate-800 border border-amber-100 dark:border-slate-700"
                      >
                        <div className="flex justify-between items-start font-medium text-slate-800 dark:text-slate-200">
                          <span>{formatDateTime(ret.created_at)}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Reembolso: {money(ret.total_refund)}
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 italic">
                          "{ret.notes}"
                        </p>
                        <ul className="mt-1.5 space-y-0.5 text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-700/50 pt-1">
                          {ret.sale_return_items.map((item) => (
                            <li key={item.id} className="flex justify-between">
                              <span>• {item.products?.name || 'Producto'}</span>
                              <span className="font-semibold">{item.unit_quantity} devueltos</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span>{money(viewingSale.subtotal)}</span>
              </div>
              {viewingSale.discount > 0 && (
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Descuento</span>
                  <span>-{money(viewingSale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-slate-900 dark:text-white">
                <span>Total</span>
                <span>{money(viewingSale.total)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span>Medio de pago</span>
                <span>
                  {viewingSale.payment_method_2 ? (
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {PAYMENT_METHOD_LABELS[viewingSale.payment_method]} ({money(viewingSale.amount_paid_1 || 0)}) +{' '}
                      {PAYMENT_METHOD_LABELS[viewingSale.payment_method_2]} ({money(viewingSale.amount_paid_2 || 0)})
                    </span>
                  ) : (
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {PAYMENT_METHOD_LABELS[viewingSale.payment_method] || viewingSale.payment_method}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              {viewingSale.status !== 'RETURNED' && viewingSale.status !== 'CANCELLED' && (
                <button
                  onClick={() => {
                    const target = viewingSale
                    setViewingSale(null)
                    setReturningSale(target)
                  }}
                  className="w-full sm:flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 text-center"
                >
                  🔄 Devolver productos
                </button>
              )}
              <button
                onClick={() => handleReprint(viewingSale)}
                className="w-full sm:flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 text-center"
              >
                🖨️ Reimprimir
              </button>
              <button
                onClick={() => setViewingSale(null)}
                className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 text-center"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal de procesamiento de devolución ===== */}
      {returningSale && (
        <ReturnModal
          sale={returningSale}
          onClose={() => setReturningSale(null)}
        />
      )}

      {/* ===== Modal de pago de factura fiada ===== */}
      {payingPendingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 sm:p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Registrar pago — Factura {invoiceNumber(payingPendingSale.id)}
              </h2>
              <button
                onClick={() => setPayingPendingSale(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >✕</button>
            </div>

            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
              <p className="font-medium text-amber-800 dark:text-amber-300">⏳ Pago pendiente (Fiado)</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {payingPendingSale.customers?.full_name || payingPendingSale.notes?.replace('Cliente: ', '') || 'Sin cliente'}
              </p>
              <p className="text-lg font-bold text-amber-900 dark:text-amber-200 mt-1">
                Total a cobrar: {money(payingPendingSale.total)}
              </p>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Método de pago con el que canceló
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['CASH', 'CARD', 'TRANSFER', 'OTHER'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPendingPayMethod(m)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      pendingPayMethod === m
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {PAYMENT_METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPayingPendingSale(null)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={payPendingMutation.isPending}
                onClick={() => payPendingMutation.mutate({ saleId: payingPendingSale.id, paymentMethod: pendingPayMethod })}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {payPendingMutation.isPending ? 'Registrando...' : '✅ Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Recibo usado solo para reimpresión ===== */}
      {printingSale && (
        <div className="fixed left-[-9999px] top-0">
          <Receipt
            ref={receiptRef}
            saleId={printingSale.id}
            date={printingSale.created_at}
            customerName={
              printingSale.customers?.full_name ||
              (printingSale.notes ? printingSale.notes.replace('Cliente: ', '') : undefined) ||
              undefined
            }
            paymentMethod={printingSale.payment_method}
            paymentMethod2={printingSale.payment_method_2}
            amountPaid1={printingSale.amount_paid_1}
            amountPaid2={printingSale.amount_paid_2}
            items={printingSale.sale_items.map((item) => ({
              name: `${item.products.name}${item.unit_label !== 'Unidad' ? ` (${item.unit_label})` : ''}`,
              quantity: item.unit_quantity,
              unitPrice: item.unit_price,
              lineTotal: item.line_total,
            }))}
            subtotal={printingSale.subtotal}
            tax={printingSale.tax}
            discount={printingSale.discount}
            total={printingSale.total}
            config={receiptConfig}
          />
        </div>
      )}
    </div>
  )
}

