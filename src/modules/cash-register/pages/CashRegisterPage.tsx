import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { DataTable } from '../../../components/ui/DataTable'
import { SectionCard } from '../../../components/ui/SectionCard'
import {
  closeCashRegister,
  getCurrentCashRegister,
  listCashRegisterHistory,
  openCashRegister,
  type CashRegister,
  type ClosedCashRegister,
} from '../../../services/api/cash-registers'
import { CloseShiftSummaryModal } from '../components/CloseShiftSummaryModal'

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

export function CashRegisterPage() {
  const queryClient = useQueryClient()
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingNote, setOpeningNote] = useState('')

  // Arqueo desglosado: efectivo físico en gaveta + transferencias en banco/billeteras
  const [closingCashAmount, setClosingCashAmount] = useState('')
  const [closingTransferAmount, setClosingTransferAmount] = useState('')
  const [closingNote, setClosingNote] = useState('')
  const [lastClosed, setLastClosed] = useState<ClosedCashRegister | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)

  const currentQuery = useQuery({
    queryKey: ['cash-register-current'],
    queryFn: getCurrentCashRegister,
  })

  const historyQuery = useQuery({
    queryKey: ['cash-register-history'],
    queryFn: listCashRegisterHistory,
  })

  const openMutation = useMutation({
    mutationFn: openCashRegister,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-register-current'] })
      queryClient.invalidateQueries({ queryKey: ['cash-register-history'] })
      setOpeningAmount('')
      setOpeningNote('')
      toast.success('Caja abierta exitosamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al abrir la caja')
    },
  })

  const closeMutation = useMutation({
    mutationFn: closeCashRegister,
    onSuccess: (register) => {
      queryClient.invalidateQueries({ queryKey: ['cash-register-current'] })
      queryClient.invalidateQueries({ queryKey: ['cash-register-history'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setClosingCashAmount('')
      setClosingTransferAmount('')
      setClosingNote('')
      setLastClosed(register)
      setSummaryOpen(true)
      toast.success('Caja cerrada correctamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cerrar la caja')
    },
  })

  const current = currentQuery.data
  const history = historyQuery.data ?? []

  // Valores del turno actual
  const opening = current?.openingAmount ?? 0
  const cashSales = current?.cashSalesTotalSoFar ?? 0
  const transferSales = current?.salesByPaymentMethodSoFar?.TRANSFER ?? 0
  const cardSales = current?.salesByPaymentMethodSoFar?.CARD ?? 0
  const pendingSales = current?.salesByPaymentMethodSoFar?.PENDING ?? 0
  const otherSales = current?.salesByPaymentMethodSoFar?.OTHER ?? 0
  const totalSales = current?.salesTotalSoFar ?? 0

  // Efectivo físico esperado en la gaveta = Base + Ventas en efectivo
  const expectedCashInDrawer = opening + cashSales
  // Transferencias esperadas en bancos / billeteras
  const expectedTransfers = transferSales
  // Total consolidado esperado del turno = Base + Efectivo + Transferencias + Tarjetas + Otros
  const expectedTotalTurn = opening + totalSales

  // Cálculos de arqueo en tiempo real
  const parsedCash = parseFloat(closingCashAmount)
  const parsedTransfer = parseFloat(closingTransferAmount)

  const cashDiff = !Number.isNaN(parsedCash) ? parsedCash - expectedCashInDrawer : null
  const transferDiff = !Number.isNaN(parsedTransfer) ? parsedTransfer - expectedTransfers : null

  // Total ingresado en el arqueo
  const totalReported = (Number.isNaN(parsedCash) ? 0 : parsedCash) +
    (Number.isNaN(parsedTransfer) ? 0 : parsedTransfer) +
    cardSales + otherSales

  const hasEnteredAmounts = !Number.isNaN(parsedCash) || !Number.isNaN(parsedTransfer)
  const totalDiff = hasEnteredAmounts ? totalReported - expectedTotalTurn : null

  const handleOpen = () => {
    const amount = parseFloat(openingAmount)
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Ingresa un monto de apertura válido')
      return
    }
    openMutation.mutate({ openingAmount: amount, note: openingNote.trim() || undefined })
  }

  const handleFillExactAll = () => {
    setClosingCashAmount(String(expectedCashInDrawer))
    setClosingTransferAmount(String(expectedTransfers))
  }

  const handleFillExactCash = () => {
    setClosingCashAmount(String(expectedCashInDrawer))
  }

  const handleFillExactTransfer = () => {
    setClosingTransferAmount(String(expectedTransfers))
  }

  const handleClose = () => {
    if (closingCashAmount === '' && closingTransferAmount === '') {
      toast.error('Ingresa al menos el efectivo contado o transferencias')
      return
    }

    const cashVal = parseFloat(closingCashAmount)
    const transVal = parseFloat(closingTransferAmount)

    if (!Number.isNaN(cashVal) && cashVal < 0) {
      toast.error('El efectivo no puede ser negativo')
      return
    }
    if (!Number.isNaN(transVal) && transVal < 0) {
      toast.error('Las transferencias no pueden ser negativas')
      return
    }

    // El monto total de cierre que se envía al backend
    const finalClosingAmount = (Number.isNaN(cashVal) ? expectedCashInDrawer : cashVal) +
      (Number.isNaN(transVal) ? expectedTransfers : transVal) +
      cardSales + otherSales

    if (!confirm('¿Cerrar la caja? Se generará el arqueo y el resumen del turno.')) return

    closeMutation.mutate({
      closingAmount: finalClosingAmount,
      note: closingNote.trim() || undefined,
    })
  }

  const historyColumns: ColumnDef<CashRegister>[] = [
    { header: 'Apertura', accessorKey: 'openedAt', cell: ({ row }) => formatDateTime(row.original.openedAt) },
    {
      header: 'Cierre',
      id: 'closedAt',
      cell: ({ row }) => (row.original.closedAt ? formatDateTime(row.original.closedAt) : '—'),
    },
    { header: 'Abrió', id: 'openedBy', cell: ({ row }) => row.original.openedByName ?? '—' },
    { header: 'Cerró', id: 'closedBy', cell: ({ row }) => row.original.closedByName ?? '—' },
    { header: 'Base', id: 'openingAmount', cell: ({ row }) => money(row.original.openingAmount) },
    {
      header: 'Efectivo ventas',
      id: 'cashSalesTotal',
      cell: ({ row }) => (row.original.cashSalesTotal !== null ? money(row.original.cashSalesTotal) : '—'),
    },
    {
      header: 'Total ventas',
      id: 'salesTotal',
      cell: ({ row }) => (row.original.salesTotal !== null ? money(row.original.salesTotal) : '—'),
    },
    {
      header: 'Monto cierre',
      id: 'closingAmount',
      cell: ({ row }) => (row.original.closingAmount !== null ? money(row.original.closingAmount) : '—'),
    },
    {
      header: 'Diferencia',
      id: 'difference',
      cell: ({ row }) => {
        if (row.original.difference === null) return '—'
        const diff = row.original.difference
        const tone = diff === 0
          ? 'text-slate-600 dark:text-slate-300 font-medium'
          : diff > 0
            ? 'text-emerald-600 dark:text-emerald-400 font-bold'
            : 'text-red-600 dark:text-red-400 font-bold'
        return <span className={tone}>{diff > 0 ? `+${money(diff)}` : money(diff)}</span>
      },
    },
    {
      header: 'Estado',
      id: 'status',
      cell: ({ row }) => (
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            row.original.status === 'OPEN'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {row.original.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <SectionCard
        title="Caja y Cuadre de Turno"
        description="Control de apertura, arqueo de efectivo, conciliación de transferencias y cierre de caja."
      >
        {currentQuery.isLoading ? (
          <div className="py-6 text-center text-sm text-slate-400">Cargando estado de caja…</div>
        ) : current ? (
          <div className="space-y-6">
            {/* Tarjetas informativas del turno */}
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Abierta desde</p>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    En curso
                  </span>
                </div>
                <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                  {formatDateTime(current.openedAt)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Por: {current.openedByName ?? 'Usuario'}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Base de apertura</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {money(current.openingAmount)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Efectivo inicial en gaveta</p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">💵 Efectivo esperado en caja</p>
                </div>
                <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {money(expectedCashInDrawer)}
                </p>
                <p className="mt-0.5 text-xs text-emerald-600/80 dark:text-emerald-400/80">
                  Base ({money(opening)}) + Ventas efectivo ({money(cashSales)})
                </p>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 shadow-sm dark:border-purple-900/60 dark:bg-purple-950/20">
                <p className="text-xs font-semibold text-purple-800 dark:text-purple-300">🏦 Transferencias del turno</p>
                <p className="mt-1 text-2xl font-bold text-purple-700 dark:text-purple-400">
                  {money(expectedTransfers)}
                </p>
                <p className="mt-0.5 text-xs text-purple-600/80 dark:text-purple-400/80">
                  Nequi, Daviplata, Bancolombia
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">📊 Total recaudado turno</p>
                <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {money(totalSales)}
                </p>
                <p className="mt-0.5 text-xs text-blue-600/80 dark:text-blue-400/80">
                  {current.salesCountSoFar} venta(s) registradas
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total esperado consolidado</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {money(expectedTotalTurn)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Base + Todas las ventas recaudadas</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Costo de lo vendido (COGS)</p>
                <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {current.cogsTotalSoFar !== null ? money(current.cogsTotalSoFar) : '—'}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Costo de adquisición</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Utilidad del turno</p>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    (current.profitTotalSoFar ?? 0) >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {current.profitTotalSoFar !== null ? money(current.profitTotalSoFar) : '—'}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Margen bruto generado</p>
              </div>
            </div>

            {/* Desglose por método de pago */}
            {current.salesByPaymentMethodSoFar && (
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Ventas registradas por método de pago
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {([
                    ['CASH', '💵', 'Efectivo', cashSales],
                    ['TRANSFER', '🏦', 'Transferencia', transferSales],
                    ['CARD', '💳', 'Tarjeta', cardSales],
                    ['PENDING', '⏳', 'Fiado (Por cobrar)', pendingSales],
                    ['OTHER', '🔄', 'Otro', otherSales],
                  ] as const).map(([key, icon, label, val]) => {
                    const isPending = key === 'PENDING'
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-3.5 transition ${
                          key === 'TRANSFER' && val > 0
                            ? 'border-purple-200 bg-purple-50/40 dark:border-purple-800/60 dark:bg-purple-950/20'
                            : key === 'CASH' && val > 0
                            ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                            : isPending && val > 0
                            ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-900/15'
                            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800/60'
                        }`}
                      >
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {icon} {label}
                        </p>
                        <p
                          className={`mt-1.5 text-lg font-bold ${
                            key === 'TRANSFER' && val > 0
                              ? 'text-purple-700 dark:text-purple-300'
                              : key === 'CASH' && val > 0
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : isPending && val > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {money(val)}
                        </p>
                        {isPending && val > 0 && (
                          <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">Pendiente de recaudo</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* SECCIÓN DE CIERRE Y ARQUEO DE CAJA */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/60 p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-800/60">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    🔒 Arqueo y Cierre de Caja
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Ingresa el efectivo contado en gaveta y las transferencias verificadas en cuentas bancarias.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFillExactCash}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    💵 Copiar efectivo esperado
                  </button>
                  <button
                    type="button"
                    onClick={handleFillExactTransfer}
                    className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                  >
                    🏦 Copiar transferencias esperadas
                  </button>
                  <button
                    type="button"
                    onClick={handleFillExactAll}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-blue-700"
                  >
                    ⚡ Cuadrar todo exacto
                  </button>
                </div>
              </div>

              {/* Formulario de Arqueo Dual */}
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {/* 1. Arqueo de Efectivo Físico */}
                <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm dark:border-emerald-900/50 dark:bg-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                      💵 Arqueo de Efectivo Físico (Gaveta)
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Esperado: <span className="text-emerald-700 dark:text-emerald-300 font-bold">{money(expectedCashInDrawer)}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Base ({money(opening)}) + Ventas en efectivo ({money(cashSales)})
                  </p>

                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Efectivo contado en billetes y monedas:
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={closingCashAmount}
                      onChange={(e) => setClosingCashAmount(e.target.value)}
                      placeholder={`Ej: ${expectedCashInDrawer}`}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base font-bold text-slate-900 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />

                    {cashDiff !== null && (
                      <div
                        className={`mt-2 flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          cashDiff === 0
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : cashDiff > 0
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        }`}
                      >
                        <span>
                          {cashDiff === 0
                            ? '✅ Efectivo exacto (sin descuadre)'
                            : cashDiff > 0
                            ? `Sobran en efectivo:`
                            : `Faltan en efectivo:`}
                        </span>
                        <span>{cashDiff > 0 ? `+${money(cashDiff)}` : money(cashDiff)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Arqueo de Transferencias Electrónicas */}
                <div className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm dark:border-purple-900/50 dark:bg-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide">
                      🏦 Arqueo de Transferencias (Bancos/Billeteras)
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Esperado: <span className="text-purple-700 dark:text-purple-300 font-bold">{money(expectedTransfers)}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Total transferencias registradas en Nequi, Daviplata y Bancolombia
                  </p>

                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Transferencias verificadas en comprobantes/cuentas:
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={closingTransferAmount}
                      onChange={(e) => setClosingTransferAmount(e.target.value)}
                      placeholder={`Ej: ${expectedTransfers}`}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base font-bold text-slate-900 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />

                    {transferDiff !== null && (
                      <div
                        className={`mt-2 flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          transferDiff === 0
                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                            : transferDiff > 0
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        }`}
                      >
                        <span>
                          {transferDiff === 0
                            ? '✅ Transferencias exactas verificadas'
                            : transferDiff > 0
                            ? `Sobran en transferencias:`
                            : `Faltan en transferencias:`}
                        </span>
                        <span>{transferDiff > 0 ? `+${money(transferDiff)}` : money(transferDiff)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Consolidación y Botón de Cierre */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Resumen del arqueo consolidado:
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        Total esperado: {money(expectedTotalTurn)}
                      </span>
                      {hasEnteredAmounts && (
                        <>
                          <span>→</span>
                          <span className="rounded bg-blue-50 px-2 py-0.5 font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            Total reportado: {money(totalReported)}
                          </span>
                          {totalDiff !== null && (
                            <span
                              className={`rounded px-2 py-0.5 font-bold ${
                                totalDiff === 0
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : totalDiff > 0
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                              }`}
                            >
                              {totalDiff === 0
                                ? '✅ Cuadre general exacto'
                                : totalDiff > 0
                                ? `Sobran: +${money(totalDiff)}`
                                : `Faltan: ${money(totalDiff)}`}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-wrap items-center justify-end gap-3 min-w-[280px]">
                    <input
                      type="text"
                      value={closingNote}
                      onChange={(e) => setClosingNote(e.target.value)}
                      placeholder="Nota u observaciones del cierre (opcional)"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={closeMutation.isPending}
                      className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {closeMutation.isPending ? 'Cerrando caja...' : '🔒 Cerrar turno'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">No hay caja abierta</h3>
            <p className="mt-1 text-xs text-slate-400">
              Registra el monto de base con el que inicias el turno para habilitar las ventas en el punto de venta.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <input
                type="number"
                min={0}
                step="0.01"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="Monto de apertura / Base ($)"
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="text"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                placeholder="Nota de apertura (opcional)"
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="button"
                onClick={handleOpen}
                disabled={openMutation.isPending}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {openMutation.isPending ? 'Abriendo...' : '🔓 Abrir caja'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {lastClosed ? (
        <SectionCard
          title="Resumen del último cierre"
          description="Ventas, costo, utilidad y arqueo registrados en el turno recién cerrado."
          action={
            <button
              type="button"
              onClick={() => setSummaryOpen(true)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              📄 Ver comprobante completo
            </button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total ventas del turno</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {money(lastClosed.salesTotal ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{lastClosed.salesCount ?? 0} venta(s)</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
              <p className="text-xs text-slate-500 dark:text-slate-400">Ventas en efectivo</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {money(lastClosed.cashSalesTotal ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Recibido en gaveta</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
              <p className="text-xs text-slate-500 dark:text-slate-400">Utilidad del turno</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  (lastClosed.profitTotal ?? 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {lastClosed.profitTotal !== null ? money(lastClosed.profitTotal) : '—'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Margen bruto</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
              <p className="text-xs text-slate-500 dark:text-slate-400">Diferencia de arqueo</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  (lastClosed.difference ?? 0) === 0
                    ? 'text-slate-900 dark:text-white'
                    : (lastClosed.difference ?? 0) > 0
                      ? 'text-emerald-600'
                      : 'text-red-600'
                }`}
              >
                {(lastClosed.difference ?? 0) > 0 ? `+${money(lastClosed.difference ?? 0)}` : money(lastClosed.difference ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {(lastClosed.difference ?? 0) === 0 ? 'Sin diferencia' : (lastClosed.difference ?? 0) > 0 ? 'Sobrante' : 'Faltante'}
              </p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Historial de turnos de caja" description="Registro histórico de aperturas y cierres auditados.">
        {historyQuery.isLoading ? (
          <div className="py-6 text-center text-sm text-slate-400">Cargando historial…</div>
        ) : history.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400 dark:border-slate-700">
            Aún no hay registros de caja.
          </div>
        ) : (
          <DataTable data={history} columns={historyColumns} />
        )}
      </SectionCard>

      <CloseShiftSummaryModal
        open={summaryOpen}
        register={lastClosed}
        onClose={() => setSummaryOpen(false)}
      />
    </div>
  )
}
