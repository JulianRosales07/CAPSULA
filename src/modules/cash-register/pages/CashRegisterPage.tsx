import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { DataTable } from '../../../components/ui/DataTable'
import { SectionCard } from '../../../components/ui/SectionCard'
import { CashIcon } from '../../../components/icons'
import { useUiStore } from '../../../store/ui-store'
import { openSupportWhatsApp } from '../../../shared/utils/supportContact'
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
  const user = useUiStore((state) => state.user)
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
            {/* Banner de Guía Principal: ¿Qué dinero debo tener al final? */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    💰 ¿Cuánto dinero debe haber al finalizar el turno?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    El dinero se divide en lo que está físicamente en el cajón y lo que está en cuentas bancarias.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Turno en curso
                </span>
              </div>

              {/* 3 Tarjetas Principales y Claras */}
              <div className="grid gap-3.5 sm:grid-cols-3">
                {/* 1. Efectivo Físico */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/80 to-emerald-100/40 p-4.5 shadow-sm dark:border-emerald-500/30 dark:from-emerald-950/40 dark:to-emerald-900/20">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white shadow-xs">
                      💵 1. DINERO EN CAJÓN
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Físico</span>
                  </div>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-emerald-800 dark:text-emerald-300">
                    {money(expectedCashInDrawer)}
                  </p>
                  <div className="mt-2 border-t border-emerald-200/60 pt-2 dark:border-emerald-800/40">
                    <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                      Base ({money(opening)}) + Ventas efectivo ({money(cashSales)})
                    </p>
                    <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                      👉 Lo que debes contar en billetes y monedas.
                    </p>
                  </div>
                </div>

                {/* 2. Transferencias Bancarias */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-purple-500/40 bg-gradient-to-br from-purple-50/80 to-purple-100/40 p-4.5 shadow-sm dark:border-purple-500/30 dark:from-purple-950/40 dark:to-purple-900/20">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-2 py-0.5 text-xs font-bold text-white shadow-xs">
                      📱 2. DINERO EN BANCOS
                    </span>
                    <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300">Electrónico</span>
                  </div>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-purple-800 dark:text-purple-300">
                    {money(expectedTransfers)}
                  </p>
                  <div className="mt-2 border-t border-purple-200/60 pt-2 dark:border-purple-800/40">
                    <p className="text-xs font-medium text-purple-900 dark:text-purple-200">
                      Nequi, Daviplata y Bancolombia
                    </p>
                    <p className="mt-0.5 text-[11px] text-purple-700/80 dark:text-purple-400/80">
                      👉 Lo que debes verificar en tus apps/cuentas.
                    </p>
                  </div>
                </div>

                {/* 3. Total General */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-blue-500/40 bg-gradient-to-br from-blue-50/80 to-blue-100/40 p-4.5 shadow-sm dark:border-blue-500/30 dark:from-blue-950/40 dark:to-blue-900/20">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2 py-0.5 text-xs font-bold text-white shadow-xs">
                      📊 TOTAL DEL TURNO
                    </span>
                    <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Consolidado</span>
                  </div>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-blue-800 dark:text-blue-300">
                    {money(expectedTotalTurn)}
                  </p>
                  <div className="mt-2 border-t border-blue-200/60 pt-2 dark:border-blue-800/40">
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
                      Ventas totales ({money(totalSales)}) + Base ({money(opening)})
                    </p>
                    <p className="mt-0.5 text-[11px] text-blue-700/80 dark:text-blue-400/80">
                      👉 Suma total de Cajón ($ {money(expectedCashInDrawer)}) + Bancos ($ {money(expectedTransfers)}).
                    </p>
                  </div>
                </div>
              </div>

              {/* Fila compacta de detalles secundarios */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
                <div>
                  <span className="text-slate-400">Abierta:</span>{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{formatDateTime(current.openedAt)}</span>
                </div>
                <div>
                  <span className="text-slate-400">Responsable:</span>{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{current.openedByName ?? 'Usuario'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Ventas hechas:</span>{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{current.salesCountSoFar} facturas ({money(totalSales)})</span>
                </div>
                <div>
                  <span className="text-slate-400">Ganancia bruta:</span>{' '}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{current.profitTotalSoFar !== null ? money(current.profitTotalSoFar) : '—'}</span>
                </div>
              </div>
            </div>

            {/* Desglose por método de pago */}
            {current.salesByPaymentMethodSoFar && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Desglose de ventas según cómo pagaron los clientes
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {([
                    ['CASH', '💵', 'Efectivo', cashSales],
                    ['TRANSFER', '📱', 'Transferencia', transferSales],
                    ['CARD', '💳', 'Tarjeta', cardSales],
                    ['PENDING', '⏳', 'Fiado (Por cobrar)', pendingSales],
                    ['OTHER', '🔄', 'Otro', otherSales],
                  ] as const).map(([key, icon, label, val]) => {
                    const isPending = key === 'PENDING'
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-3 transition ${
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
                          className={`mt-1 text-base font-bold ${
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
                          <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">Por cobrar</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* SECCIÓN DE CIERRE Y ARQUEO DE CAJA */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>🔒</span> Cerrar Turno y Cuadrar Caja
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Ingresa lo que tienes en el cajón y lo que verificaste en transferencias bancarias:
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFillExactAll}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    ⚡ Cuadrar todo exacto con el sistema
                  </button>
                </div>
              </div>

              {/* Formulario de Arqueo en 2 Pasos */}
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                {/* Paso 1. Arqueo de Efectivo Físico */}
                <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/30 p-4.5 dark:border-emerald-800/80 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                      💵 Paso 1: Cuenta el dinero físico del cajón
                    </span>
                    <button
                      type="button"
                      onClick={handleFillExactCash}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline dark:text-emerald-400"
                    >
                      ⚡ Copiar esperado
                    </button>
                  </div>
                  
                  <div className="mt-2 rounded-lg bg-emerald-100/60 p-2.5 text-xs text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
                    <span>Debes tener en gaveta: </span>
                    <span className="font-extrabold text-sm text-emerald-800 dark:text-emerald-300">{money(expectedCashInDrawer)}</span>
                    <span className="block text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                      Base ({money(opening)}) + Ventas en efectivo ({money(cashSales)})
                    </span>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      ¿Cuánto dinero en billetes y monedas contaste en el cajón?
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={closingCashAmount}
                        onChange={(e) => setClosingCashAmount(e.target.value)}
                        placeholder={`Ej: ${expectedCashInDrawer}`}
                        className="w-full rounded-xl border border-slate-300 pl-8 pr-3.5 py-2.5 text-lg font-extrabold text-slate-900 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    {cashDiff !== null && (
                      <div
                        className={`mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold ${
                          cashDiff === 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : cashDiff > 0
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                        }`}
                      >
                        <span>
                          {cashDiff === 0
                            ? '✅ Efectivo en cajón exacto (Sin descuadre)'
                            : cashDiff > 0
                            ? '➕ Sobran en efectivo en cajón:'
                            : '❌ Faltan en efectivo en cajón:'}
                        </span>
                        <span className="text-sm">{cashDiff > 0 ? `+${money(cashDiff)}` : money(cashDiff)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Paso 2. Arqueo de Transferencias Bancarias */}
                <div className="rounded-xl border-2 border-purple-300 bg-purple-50/30 p-4.5 dark:border-purple-800/80 dark:bg-purple-950/20">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wide">
                      📱 Paso 2: Verifica el dinero en cuentas/Nequi
                    </span>
                    <button
                      type="button"
                      onClick={handleFillExactTransfer}
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-800 underline dark:text-purple-400"
                    >
                      ⚡ Copiar esperado
                    </button>
                  </div>

                  <div className="mt-2 rounded-lg bg-purple-100/60 p-2.5 text-xs text-purple-900 dark:bg-purple-900/30 dark:text-purple-200">
                    <span>Debes tener en bancos/Nequi: </span>
                    <span className="font-extrabold text-sm text-purple-800 dark:text-purple-300">{money(expectedTransfers)}</span>
                    <span className="block text-[11px] text-purple-700 dark:text-purple-400 mt-0.5">
                      Recibido por transferencias durante el turno
                    </span>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      ¿Cuánto dinero verificaste en comprobantes/apps bancarias?
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={closingTransferAmount}
                        onChange={(e) => setClosingTransferAmount(e.target.value)}
                        placeholder={`Ej: ${expectedTransfers}`}
                        className="w-full rounded-xl border border-slate-300 pl-8 pr-3.5 py-2.5 text-lg font-extrabold text-slate-900 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    {transferDiff !== null && (
                      <div
                        className={`mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold ${
                          transferDiff === 0
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                            : transferDiff > 0
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                        }`}
                      >
                        <span>
                          {transferDiff === 0
                            ? '✅ Transferencias verificadas exactas'
                            : transferDiff > 0
                            ? '➕ Sobran en transferencias:'
                            : '❌ Faltan en transferencias:'}
                        </span>
                        <span className="text-sm">{transferDiff > 0 ? `+${money(transferDiff)}` : money(transferDiff)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Barra de Confirmación y Cierre Final */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/80">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Resumen final del cierre:
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-lg bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-xs dark:bg-slate-700 dark:text-slate-200">
                        Esperado total: {money(expectedTotalTurn)}
                      </span>
                      {hasEnteredAmounts && (
                        <>
                          <span>→</span>
                          <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            Entregado: {money(totalReported)} (Cajón {money(Number.isNaN(parsedCash) ? 0 : parsedCash)} + Bancos {money(Number.isNaN(parsedTransfer) ? 0 : parsedTransfer)})
                          </span>
                          {totalDiff !== null && (
                            <span
                              className={`rounded-lg px-2.5 py-1 font-bold ${
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
                      className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={closeMutation.isPending}
                      className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {closeMutation.isPending ? 'Cerrando caja...' : '🔒 Cerrar turno'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <CashIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No hay caja abierta</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Registra el monto de base con el que inicias el turno para habilitar las ventas en el punto de venta.
                </p>
              </div>
            </div>

            {user?.isTrialExpired ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                <p className="font-bold flex items-center gap-1.5 text-sm">
                  <span>⚠️</span> Modo Solo Lectura Activado
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  El período de prueba de tu establecimiento ha finalizado. Para abrir nuevas cajas y registrar ventas, por favor contacta a soporte o activa tu plan.
                </p>
                <button
                  type="button"
                  onClick={() => openSupportWhatsApp(user?.storeName, user?.fullName, 'activar suscripción para abrir caja')}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition"
                >
                  <span>💬 Contactar a Soporte por WhatsApp</span>
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleOpen()
                }}
                className="mt-5 space-y-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Monto de apertura / Base ($) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        value={openingAmount}
                        onChange={(e) => setOpeningAmount(e.target.value)}
                        placeholder="Ej: 50000"
                        className="w-full rounded-xl border border-slate-300 pl-7 pr-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nota de apertura <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={openingNote}
                      onChange={(e) => setOpeningNote(e.target.value)}
                      placeholder="Ej: Turno mañana"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={openMutation.isPending}
                    className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    <span>🔓</span>
                    <span>{openMutation.isPending ? 'Abriendo caja...' : 'Abrir caja'}</span>
                  </button>
                </div>
              </form>
            )}
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
