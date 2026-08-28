import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SectionCard } from '../../../components/ui/SectionCard'
import { listSales, PAYMENT_METHOD_LABELS, type PaymentMethod } from '../../../services/api/sales'
import { listPurchases, listOutstandingBySupplier } from '../../../services/api/purchases'
import { getCurrentCashRegister, listCashRegisterHistory } from '../../../services/api/cash-registers'

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

type RangePreset = 'today' | 'week' | 'month' | 'custom'

export function AccountingPage() {
  const today = useMemo(() => new Date(), [])
  const [preset, setPreset] = useState<RangePreset>('month')
  const [customFrom, setCustomFrom] = useState(toDateInputValue(today))
  const [customTo, setCustomTo] = useState(toDateInputValue(today))

  const { from, to } = useMemo(() => {
    const now = new Date()
    if (preset === 'today') {
      return { from: new Date(`${toDateInputValue(now)}T00:00:00`), to: new Date(`${toDateInputValue(now)}T23:59:59`) }
    }
    if (preset === 'week') {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { from: start, to: now }
    }
    if (preset === 'month') {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { from: start, to: now }
    }
    return { from: new Date(`${customFrom}T00:00:00`), to: new Date(`${customTo}T23:59:59`) }
  }, [preset, customFrom, customTo])

  const salesQuery = useQuery({ queryKey: ['sales'], queryFn: () => listSales() })
  const purchasesQuery = useQuery({ queryKey: ['purchases'], queryFn: listPurchases })
  const outstandingQuery = useQuery({ queryKey: ['outstanding-by-supplier'], queryFn: listOutstandingBySupplier })
  const currentRegisterQuery = useQuery({ queryKey: ['cash-register-current'], queryFn: getCurrentCashRegister })
  const registerHistoryQuery = useQuery({ queryKey: ['cash-register-history'], queryFn: listCashRegisterHistory })

  const sales = salesQuery.data ?? []
  const purchases = purchasesQuery.data ?? []
  const outstanding = outstandingQuery.data ?? []

  const filteredSales = useMemo(
    () =>
      sales.filter((s) => {
        const created = new Date(s.created_at)
        return created >= from && created <= to
      }),
    [sales, from, to],
  )

  const filteredPurchases = useMemo(
    () =>
      purchases.filter((p) => {
        const created = new Date(p.created_at)
        return created >= from && created <= to
      }),
    [purchases, from, to],
  )

  // ===== Ventas (Ingresos) desglosadas por método de pago =====
  const salesByMethod = useMemo(() => {
    const map = new Map<PaymentMethod, { count: number; total: number }>()
    for (const method of Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]) {
      map.set(method, { count: 0, total: 0 })
    }
    for (const sale of filteredSales) {
      if (sale.payment_method_2) {
        const entry1 = map.get(sale.payment_method) ?? { count: 0, total: 0 }
        entry1.count += 1
        entry1.total += Number(sale.amount_paid_1 ?? (sale.total - (sale.amount_paid_2 || 0)))
        map.set(sale.payment_method, entry1)

        const entry2 = map.get(sale.payment_method_2) ?? { count: 0, total: 0 }
        entry2.count += 1
        entry2.total += Number(sale.amount_paid_2 ?? 0)
        map.set(sale.payment_method_2, entry2)
      } else {
        const entry = map.get(sale.payment_method) ?? { count: 0, total: 0 }
        entry.count += 1
        entry.total += sale.total
        map.set(sale.payment_method, entry)
      }
    }
    return map
  }, [filteredSales])

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0)
  const totalExpenses = filteredPurchases.reduce((sum, p) => sum + p.total, 0)
  const grossBalance = totalRevenue - totalExpenses

  // ===== Egresos (Compras/Proveedores) =====
  const totalOutstanding = outstanding.reduce((sum, o) => sum + o.balance, 0)

  // ===== Caja =====
  const currentRegister = currentRegisterQuery.data
  const lastClosedRegister = (registerHistoryQuery.data ?? []).find((r) => r.status === 'CLOSED')

  const isLoading =
    salesQuery.isLoading || purchasesQuery.isLoading || outstandingQuery.isLoading || currentRegisterQuery.isLoading

  return (
    <div className="space-y-6">
      <SectionCard
        title="Contabilidad básica"
        description="Vista consolidada de Caja, Ventas y Proveedores para el periodo seleccionado."
        action={
          <div className="flex items-end gap-2">
            <div className="flex gap-1">
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
                  onClick={() => setPreset(opt.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    preset === opt.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </>
            )}
          </div>
        }
      >
        {isLoading ? (
          <div className="py-10 text-center text-sm text-slate-400">Cargando datos contables…</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/50 dark:bg-emerald-500/10">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Ingresos (ventas)</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                {money(totalRevenue)}
              </p>
              <p className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-400/80">{filteredSales.length} venta(s)</p>
            </article>
            <article className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-500/10">
              <p className="text-sm text-red-600 dark:text-red-400">Egresos (compras)</p>
              <p className="mt-2 text-2xl font-semibold text-red-700 dark:text-red-300">{money(totalExpenses)}</p>
              <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/80">{filteredPurchases.length} compra(s)</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
              <p className="text-sm text-slate-500 dark:text-slate-400">Balance del periodo</p>
              <p
                className={`mt-2 text-2xl font-semibold ${
                  grossBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {money(grossBalance)}
              </p>
              <p className="mt-1 text-xs text-slate-400">Ingresos − Egresos</p>
            </article>
            <article className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-500/10">
              <p className="text-sm text-amber-600 dark:text-amber-400">Cuentas por pagar</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-300">
                {money(totalOutstanding)}
              </p>
              <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">
                {outstanding.length} proveedor(es) con saldo
              </p>
            </article>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ===== CAJA ===== */}
        <SectionCard title="Caja" description="Estado actual y último cierre registrado.">
          {currentRegisterQuery.isLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">Cargando estado de caja…</div>
          ) : currentRegister ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800/50 dark:bg-emerald-500/10">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Caja abierta</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  Desde {formatDateTime(currentRegister.openedAt)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-slate-500 dark:text-slate-400">Apertura</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                    {money(currentRegister.openingAmount)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-slate-500 dark:text-slate-400">Ventas en efectivo (turno)</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                    {money(currentRegister.cashSalesTotalSoFar ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-slate-700">
              No hay caja abierta en este momento.
            </div>
          )}

          {lastClosedRegister && (
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Último cierre</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-slate-500 dark:text-slate-400">Efectivo esperado</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                    {money(lastClosedRegister.expectedAmount ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-slate-500 dark:text-slate-400">Diferencia</p>
                  <p
                    className={`mt-1 font-semibold ${
                      (lastClosedRegister.difference ?? 0) === 0
                        ? 'text-slate-900 dark:text-white'
                        : (lastClosedRegister.difference ?? 0) > 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                    }`}
                  >
                    {money(lastClosedRegister.difference ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ===== VENTAS por método de pago ===== */}
        <SectionCard title="Ventas por método de pago" description="Desglose de ingresos del periodo seleccionado.">
          {salesQuery.isLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">Cargando ventas…</div>
          ) : filteredSales.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-slate-700">
              No hay ventas en el periodo seleccionado.
            </div>
          ) : (
            <div className="space-y-2">
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => {
                const entry = salesByMethod.get(method) ?? { count: 0, total: 0 }
                const pct = totalRevenue > 0 ? (entry.total / totalRevenue) * 100 : 0
                return (
                  <div key={method} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {PAYMENT_METHOD_LABELS[method]}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">{money(entry.total)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {entry.count} venta(s) · {pct.toFixed(0)}%
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* ===== PROVEEDORES: cuentas por pagar ===== */}
        <SectionCard
          title="Proveedores — Cuentas por pagar"
          description="Saldo pendiente por proveedor (compras sin pagar en su totalidad)."
        >
          {outstandingQuery.isLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">Cargando saldos…</div>
          ) : outstanding.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-slate-700">
              No hay saldos pendientes con proveedores. 🎉
            </div>
          ) : (
            <div className="space-y-2">
              {outstanding.map((o) => (
                <div
                  key={o.supplierId}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-500/10"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{o.supplierName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {o.purchaseCount} compra(s) con saldo
                    </p>
                  </div>
                  <span className="text-base font-semibold text-amber-700 dark:text-amber-300">
                    {money(o.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ===== EGRESOS: compras del periodo ===== */}
        <SectionCard title="Compras del periodo" description="Egresos registrados por entradas de mercancía.">
          {purchasesQuery.isLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">Cargando compras…</div>
          ) : filteredPurchases.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-slate-700">
              No hay compras registradas en el periodo seleccionado.
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {filteredPurchases
                .slice()
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {purchase.suppliers?.business_name || 'Proveedor desconocido'}
                      </p>
                      <p className="text-xs text-slate-400">{formatDateTime(purchase.created_at)}</p>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white">{money(purchase.total)}</span>
                  </div>
                ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
