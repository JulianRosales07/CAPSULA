import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bar } from 'react-chartjs-2'
import 'chart.js/auto'
import { getDashboardSummary, getProfitSummary } from '../../../services/api/dashboard'
import { listSales, PAYMENT_METHOD_LABELS, type Sale } from '../../../services/api/sales'
import { getCurrentCashRegister } from '../../../services/api/cash-registers'
import { listOutstandingBySupplier } from '../../../services/api/purchases'
import { useUiStore } from '../../../store/ui-store'

function money(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

/** Fecha local en formato YYYY-MM-DD (lo que esperan los endpoints de rentabilidad) */
function toISODate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function isSameDay(dateStr: string, reference: Date) {
  return new Date(dateStr).toDateString() === reference.toDateString()
}

type Range = 'today' | 'week' | 'month'

const RANGE_LABELS: Record<Range, string> = { today: 'Hoy', week: 'Semana', month: 'Mes' }
const RANGE_TITLES: Record<Range, string> = {
  today: 'Utilidad de hoy',
  week: 'Utilidad de los últimos 7 días',
  month: 'Utilidad del mes',
}

/** Rango de fechas (from/to) según el selector */
function rangeDates(range: Range) {
  const today = new Date()
  if (range === 'today') return { from: toISODate(today), to: toISODate(today) }
  if (range === 'week') {
    const from = new Date()
    from.setDate(from.getDate() - 6)
    return { from: toISODate(from), to: toISODate(today) }
  }
  const from = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: toISODate(from), to: toISODate(today) }
}

/** Utilidad de una venta: total facturado menos el costo congelado de cada línea */
function saleProfit(sale: Sale) {
  const cost = sale.sale_items.reduce(
    (sum, item) => sum + item.quantity * (Number(item.unit_cost) || 0),
    0,
  )
  return sale.total - cost
}

const CARD = 'rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'

export function DashboardPage() {
  const storeName = useUiStore((state) => state.user?.storeName)
  const [range, setRange] = useState<Range>('today')
  const { from, to } = rangeDates(range)

  const summaryQuery = useQuery({ queryKey: ['dashboard-summary'], queryFn: getDashboardSummary })
  const salesQuery = useQuery({ queryKey: ['sales'], queryFn: () => listSales() })
  const cashQuery = useQuery({ queryKey: ['cash-register-current'], queryFn: getCurrentCashRegister })
  const outstandingQuery = useQuery({
    queryKey: ['outstanding-by-supplier'],
    queryFn: listOutstandingBySupplier,
  })
  const profitQuery = useQuery({
    queryKey: ['profit-summary', from, to],
    queryFn: () => getProfitSummary(from, to),
  })

  const summary = summaryQuery.data
  const sales = salesQuery.data ?? []
  const cash = cashQuery.data
  const profit = profitQuery.data
  const daily = summary?.profitDaily ?? []

  const salesTotal = profit?.salesTotal ?? 0
  const cogs = profit?.cogs ?? 0
  const profitValue = profit?.profit ?? 0
  const margin = salesTotal > 0 ? (profitValue / salesTotal) * 100 : 0

  // Variación de la utilidad de hoy respecto a ayer (serie diaria del backend)
  const profitDelta = useMemo(() => {
    if (daily.length < 2) return null
    const todayProfit = daily[daily.length - 1]!.profit
    const yesterdayProfit = daily[daily.length - 2]!.profit
    if (yesterdayProfit === 0) return null
    return ((todayProfit - yesterdayProfit) / Math.abs(yesterdayProfit)) * 100
  }, [daily])

  const todaySales = useMemo(() => {
    const today = new Date()
    return sales
      .filter((sale) => isSameDay(sale.created_at, today))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [sales])

  // Productos que más utilidad dejaron hoy, calculados desde las líneas de venta
  const topProducts = useMemo(() => {
    const byProduct = new Map<string, { name: string; units: number; profit: number }>()
    for (const sale of todaySales) {
      for (const item of sale.sale_items) {
        const key = item.product_id
        const lineProfit = item.line_total - item.quantity * (Number(item.unit_cost) || 0)
        const current = byProduct.get(key)
        if (current) {
          current.units += item.unit_quantity
          current.profit += lineProfit
        } else {
          byProduct.set(key, {
            name: item.products?.name ?? 'Producto',
            units: item.unit_quantity,
            profit: lineProfit,
          })
        }
      }
    }
    return Array.from(byProduct.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 4)
  }, [todaySales])

  const maxTopProfit = topProducts[0]?.profit ?? 0
  const supplierDebt = (outstandingQuery.data ?? []).reduce((sum, row) => sum + row.balance, 0)
  const supplierDebtCount = (outstandingQuery.data ?? []).reduce((sum, row) => sum + row.purchaseCount, 0)
  const avgTicket = (profit?.salesCount ?? 0) > 0 ? salesTotal / profit!.salesCount : 0
  const lowStock = summary?.lowStock ?? []

  const today = new Date()
  const subtitle = [
    storeName,
    today.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }),
    cash
      ? `Turno abierto desde ${new Date(cash.openedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
      : 'Sin caja abierta',
  ]
    .filter(Boolean)
    .join(' · ')

  const kpis = [
    {
      label: 'Compras del período',
      value: money(profit?.purchasesTotal ?? 0),
      hint: 'Mercancía ingresada',
      icon: '🛍️',
    },
    {
      label: 'Ticket promedio',
      value: money(avgTicket),
      hint: `${profit?.salesCount ?? 0} venta(s) en el período`,
      icon: '🧾',
    },
    {
      label: 'Productos activos',
      value: String(summary?.counts?.products ?? 0),
      hint: `${lowStock.length} en stock crítico`,
      icon: '📦',
    },
    {
      label: 'Cartera proveedores',
      value: money(supplierDebt),
      hint: `${supplierDebtCount} factura(s) por pagar`,
      icon: '🚚',
    },
  ]

  return (
    <div className="space-y-5">
      {/* Encabezado de sección */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Resumen del día</h1>
          <p className="mt-1 text-sm capitalize text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {(Object.keys(RANGE_LABELS) as Range[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                aria-pressed={range === key}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  range === key
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>
          <Link
            to="/caja"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
          >
            {cash ? 'Cerrar turno' : 'Abrir caja'}
          </Link>
        </div>
      </header>

      {/* Región dominante: rentabilidad + caja y alertas */}
      <section className="grid gap-5 xl:grid-cols-[1.9fr_1fr]">
        <article className={`${CARD} flex flex-col gap-5 p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {RANGE_TITLES[range]}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Ventas menos el costo de los productos vendidos
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                profitValue >= 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
              }`}
            >
              Margen {margin.toFixed(1)}%
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-7">
            <div>
              <p
                className={`text-4xl font-bold tracking-tight ${
                  profitValue >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {profitQuery.isLoading ? '—' : money(profitValue)}
              </p>
              {range === 'today' && profitDelta !== null && (
                <p
                  className={`mt-1 text-xs font-medium ${
                    profitDelta >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {profitDelta >= 0 ? '+' : ''}
                  {profitDelta.toFixed(1)}% frente a ayer
                </p>
              )}
            </div>
            <div className="hidden h-14 w-px bg-slate-200 dark:bg-slate-800 sm:block" />
            <div className="flex flex-wrap gap-7">
              {[
                { label: 'Ventas', value: money(salesTotal), tone: 'text-slate-900 dark:text-white' },
                { label: 'Costo de lo vendido', value: money(cogs), tone: 'text-amber-600 dark:text-amber-400' },
                {
                  label: 'Ventas registradas',
                  value: String(profit?.salesCount ?? 0),
                  tone: 'text-slate-900 dark:text-white',
                },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className={`mt-1 text-lg font-semibold ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Serie diaria real: utilidad sobre costo */}
          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="mb-3 text-xs font-semibold text-slate-700 dark:text-slate-200">Últimos 14 días</p>
            {daily.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                Aún no hay ventas para calcular la rentabilidad.
              </p>
            ) : (
              <div className="h-52">
                <Bar
                  data={{
                    labels: daily.map((d) =>
                      new Date(`${d.day}T12:00:00`).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                      }),
                    ),
                    datasets: [
                      {
                        label: 'Utilidad',
                        data: daily.map((d) => d.profit),
                        backgroundColor: '#10b981',
                        borderRadius: 5,
                        stack: 'total',
                      },
                      {
                        label: 'Costo',
                        data: daily.map((d) => d.cogs),
                        backgroundColor: '#f0d49b',
                        borderRadius: 5,
                        stack: 'total',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } },
                      tooltip: {
                        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(Number(ctx.parsed.y))}` },
                      },
                    },
                    scales: {
                      x: { stacked: true, grid: { display: false } },
                      y: {
                        stacked: true,
                        border: { display: false },
                        ticks: { callback: (value) => money(Number(value)) },
                      },
                    },
                  }}
                />
              </div>
            )}
          </div>
        </article>

        <div className="flex flex-col gap-5">
          {/* Caja del turno */}
          <article className={`${CARD} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Caja del turno</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  cash
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cash ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {cash ? 'Abierta' : 'Cerrada'}
              </span>
            </div>

            {cash ? (
              <>
                <dl className="mt-4 space-y-2.5">
                  {[
                    ['Base de apertura', money(cash.openingAmount), false],
                    ['Ventas en efectivo', money(cash.cashSalesTotalSoFar), false],
                    ['Transferencias', money((cash.salesByPaymentMethodSoFar as any)?.TRANSFER || 0), false],
                    ['Utilidad del turno', cash.profitTotalSoFar !== null ? money(cash.profitTotalSoFar) : '—', false],
                    ['Efectivo esperado en caja', money(cash.openingAmount + cash.cashSalesTotalSoFar), true],
                  ].map(([label, value, strong]) => (
                    <div key={String(label)} className="flex items-center justify-between">
                      <dt
                        className={`text-[13px] ${
                          strong
                            ? 'font-semibold text-slate-700 dark:text-slate-200'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {label}
                      </dt>
                      <dd
                        className={`font-semibold text-slate-900 dark:text-white ${
                          strong ? 'text-[15px]' : 'text-[13px]'
                        }`}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] text-slate-400 dark:border-slate-800">
                  Total turno: <span className="font-semibold text-blue-600 dark:text-blue-400">{money(cash.openingAmount + cash.salesTotalSoFar)}</span> (Base + Todas las ventas)
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Abre la caja para poder registrar ventas en el punto de venta.
              </p>
            )}
          </article>

          {/* Stock crítico */}
          <article className={`${CARD} flex-1 p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Stock crítico</h2>
              <Link to="/inventario" className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Ver todo ({lowStock.length})
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {lowStock.slice(0, 4).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-900 dark:text-white">{product.name}</p>
                    <p className="text-[10px] text-slate-400">Mínimo sugerido {product.min_stock}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">
                    {product.stock} u
                  </span>
                </div>
              ))}
              {lowStock.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-400">
                  🎉 Todo el stock está en niveles correctos.
                </p>
              )}
            </div>
          </article>
        </div>
      </section>

      {/* Indicadores secundarios en una sola superficie */}
      <section className={`${CARD} grid divide-y divide-slate-200 dark:divide-slate-800 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x`}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex items-center gap-3.5 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base dark:bg-slate-800">
              {kpi.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{kpi.label}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{kpi.value}</p>
              <p className="truncate text-[10px] text-slate-400">{kpi.hint}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Detalle operativo */}
      <section className="grid gap-5 xl:grid-cols-[1.9fr_1fr]">
        <article className={`${CARD} p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Ventas de hoy</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Utilidad calculada con el costo de cada producto vendido
              </p>
            </div>
            <Link to="/facturas" className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Ver todas
            </Link>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 font-semibold">Hora</th>
                  <th className="py-2 font-semibold">Cliente</th>
                  <th className="py-2 text-center font-semibold">Ítems</th>
                  <th className="py-2 font-semibold">Pago</th>
                  <th className="py-2 text-right font-semibold">Total</th>
                  <th className="py-2 text-right font-semibold">Utilidad</th>
                </tr>
              </thead>
              <tbody>
                {todaySales.slice(0, 5).map((sale) => {
                  const items = sale.sale_items.reduce((sum, item) => sum + item.unit_quantity, 0)
                  const gain = saleProfit(sale)
                  return (
                    <tr key={sale.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="py-3 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(sale.created_at).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 text-[13px] font-medium text-slate-900 dark:text-white">
                        {sale.customers?.full_name ?? 'Mostrador'}
                      </td>
                      <td className="py-3 text-center text-[13px] text-slate-600 dark:text-slate-300">{items}</td>
                      <td className="py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {PAYMENT_METHOD_LABELS[sale.payment_method] ?? sale.payment_method}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[13px] font-semibold text-slate-900 dark:text-white">
                        {money(sale.total)}
                      </td>
                      <td
                        className={`py-3 text-right text-[13px] font-semibold ${
                          gain >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {money(gain)}
                      </td>
                    </tr>
                  )
                })}
                {todaySales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-400">
                      {salesQuery.isLoading ? 'Cargando ventas…' : 'Todavía no hay ventas registradas hoy.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className={`${CARD} p-5`}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Productos más rentables hoy
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Utilidad acumulada del día</p>

          <div className="mt-4 space-y-3.5">
            {topProducts.map((product) => (
              <div key={product.name} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-900 dark:text-white">
                      {product.name}
                    </p>
                    <p className="text-[10px] text-slate-400">{product.units} vendidas</p>
                  </div>
                  <span className="shrink-0 text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                    {money(product.profit)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${maxTopProfit > 0 ? Math.max((product.profit / maxTopProfit) * 100, 2) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">
                Sin ventas hoy: aún no hay utilidad por producto.
              </p>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}
