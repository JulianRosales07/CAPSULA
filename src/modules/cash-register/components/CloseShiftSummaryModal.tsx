import type { ClosedCashRegister } from '../../../services/api/cash-registers'

type Props = {
  open: boolean
  register: ClosedCashRegister | null
  onClose: () => void
}

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

/**
 * Resumen que aparece al cerrar el turno: ventas, costo de los productos
 * vendidos (COGS), utilidad generada y el arqueo de efectivo.
 */
export function CloseShiftSummaryModal({ open, register, onClose }: Props) {
  if (!open || !register) return null

  const salesTotal = register.salesTotal ?? 0
  const cogs = register.cogsTotal
  const profit = register.profitTotal
  const margin = cogs !== null && salesTotal > 0 ? ((salesTotal - cogs) / salesTotal) * 100 : null
  const difference = register.difference ?? 0

  const differenceTone =
    difference === 0
      ? 'text-slate-900 dark:text-white'
      : difference > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] sm:max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 overflow-hidden">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
              Turno cerrado · Resumen del día
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {formatDateTime(register.openedAt)} →{' '}
              {register.closedAt ? formatDateTime(register.closedAt) : '—'} ·{' '}
              {register.salesCount ?? 0} venta(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {/* Rentabilidad del turno */}
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Rentabilidad del turno</h3>
          <p className="mt-1 text-xs text-slate-400">
            Utilidad = Ventas − Costo de los productos vendidos
          </p>

          <div className="mt-3 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Ventas</p>
              <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                {money(salesTotal)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Efectivo {money(register.cashSalesTotal ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Costo de lo vendido</p>
              <p className="mt-1 text-lg sm:text-xl font-semibold text-amber-600 dark:text-amber-400">
                {cogs !== null ? money(cogs) : 'No disponible'}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">Costo real de la mercancía entregada</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 sm:p-4 dark:border-emerald-900 dark:bg-emerald-500/5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Utilidad generada</p>
              <p
                className={`mt-1 text-lg sm:text-xl font-semibold ${
                  (profit ?? 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {profit !== null ? money(profit) : 'No disponible'}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {margin !== null ? `Margen ${margin.toFixed(1)}%` : 'Sin datos de costo'}
              </p>
            </div>
          </div>

          {cogs === null && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-400">
              No se pudo calcular el costo de lo vendido. Verifica que la migración 016 esté aplicada en
              la base de datos.
            </p>
          )}

          {/* Desglose por método de pago */}
          {register.byPaymentMethod && (
            <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Ventas por método de pago</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {([
                  ['CASH', '💵', 'Efectivo'],
                  ['CARD', '💳', 'Tarjeta'],
                  ['TRANSFER', '🏦', 'Transferencia'],
                  ['PENDING', '⏳', 'Pendiente (Fiado)'],
                  ['OTHER', '🔄', 'Otro'],
                ] as const).map(([key, icon, label]) => {
                  const val = (register.byPaymentMethod as any)?.[key] || 0
                  return (
                    <div key={key} className={`rounded-lg border p-3 text-center ${
                      key === 'PENDING' && val > 0
                        ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
                    }`}>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{icon} {label}</p>
                      <p className={`mt-1 text-sm font-semibold ${
                        key === 'PENDING' && val > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-900 dark:text-white'
                      }`}>{money(val)}</p>
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 flex justify-between rounded-lg border border-slate-300 bg-slate-100 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Total general</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{money(salesTotal)}</span>
              </div>
            </div>
          )}


          {/* Arqueo de caja consolidado y desglosado */}
          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Arqueo y conciliación de turno</h3>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/50 p-1 dark:border-slate-800 dark:bg-slate-800/40">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-700/80">
                  <tr className="bg-emerald-50/40 dark:bg-emerald-950/20">
                    <td className="px-4 py-2.5 font-medium text-emerald-900 dark:text-emerald-300">
                      💵 Base de apertura (Efectivo inicial)
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-900 dark:text-emerald-300">
                      {money(register.openingAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      (+) Ventas en efectivo del turno
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900 dark:text-white">
                      {money(register.cashSalesTotal ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-purple-700 dark:text-purple-300 font-medium">
                      (+) Transferencias bancarias (Nequi/Daviplata/Banco)
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-purple-700 dark:text-purple-300">
                      {money((register.byPaymentMethod as any)?.TRANSFER || 0)}
                    </td>
                  </tr>
                  {((register.byPaymentMethod as any)?.CARD || 0) > 0 && (
                    <tr>
                      <td className="px-4 py-2.5 text-blue-700 dark:text-blue-300 font-medium">
                        (+) Pagos con tarjeta
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-blue-700 dark:text-blue-300">
                        {money((register.byPaymentMethod as any)?.CARD || 0)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-100/70 font-semibold dark:bg-slate-800">
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">
                      (=) Total esperado consolidado del turno
                    </td>
                    <td className="px-4 py-2.5 text-right text-blue-600 dark:text-blue-400">
                      {money(register.expectedAmount ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      Monto reportado al cierre
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                      {money(register.closingAmount ?? 0)}
                    </td>
                  </tr>
                  <tr className="bg-white dark:bg-slate-900 font-bold">
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">
                      Diferencia de arqueo final
                    </td>
                    <td className={`px-4 py-2.5 text-right ${differenceTone}`}>
                      {difference === 0 ? '✅ Sin diferencia ($0)' : difference > 0 ? `+${money(difference)}` : money(difference)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {register.closingNote && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Nota de cierre: </span>
                <span className="text-slate-500 dark:text-slate-400">{register.closingNote}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 border-t border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full sm:w-auto rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 text-center"
          >
            Imprimir
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 text-center"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
