import { Outlet, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUiStore } from '../store/ui-store'
import { useStoreContext } from '../hooks/useStoreContext'
import { getDashboardSummary } from '../services/api/dashboard'
import CapsulaLogos from '../assets/Capsulas.png'
import { Sidebar, type NavGroup, type NavItem } from './Sidebar'
import {
  BagIcon,
  BoxIcon,
  BuildingIcon,
  CalendarIcon,
  CartIcon,
  CashIcon,
  ChartIcon,
  GearIcon,
  HomeIcon,
  MenuIcon,
  ReceiptIcon,
  SparkleIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
} from '../components/icons'
import {
  OPERATOR_ROLES,
  SUPER_ADMIN_ROLE,
  effectivePermissions,
} from '../shared/utils/permissions'
import { openSupportWhatsApp } from '../shared/utils/supportContact'

const superAdminGroups: NavGroup[] = [
  {
    title: 'Administración',
    items: [
      { label: 'Establecimientos', path: '/droguerias', icon: BuildingIcon },
      { label: 'Usuarios', path: '/usuarios', icon: UsersIcon },
    ],
  },
]

const businessGroups: NavGroup[] = [
  {
    title: 'General',
    items: [{ label: 'Dashboard', path: '/dashboard', icon: HomeIcon }],
  },
  {
    title: 'Operación',
    items: [
      { label: 'Punto de venta', path: '/pos', icon: CartIcon },
      { label: 'Reservas', path: '/reservas', icon: CalendarIcon },
      { label: 'Facturas', path: '/facturas', icon: ReceiptIcon },
      { label: 'Caja', path: '/caja', icon: CashIcon },
      { label: 'Inventario', path: '/inventario', icon: BoxIcon, badgeKey: 'lowStock' },
      { label: 'Compras', path: '/compras', icon: BagIcon },
    ],
  },
  {
    title: 'Contactos',
    items: [
      { label: 'Clientes', path: '/clientes', icon: UserIcon },
      { label: 'Proveedores', path: '/proveedores', icon: TruckIcon },
    ],
  },
  {
    title: 'Administración',
    items: [{ label: 'Usuarios', path: '/usuarios', icon: UsersIcon }],
  },
  {
    title: 'Otros',
    items: [
      { label: 'Contabilidad', path: '/contabilidad', icon: ChartIcon },
      { label: 'Reportes', path: '/reportes', icon: ChartIcon },
      { label: 'Suscripción', path: '/suscripcion', icon: SparkleIcon },
      { label: 'Configuración', path: '/configuracion', icon: GearIcon },
    ],
  },
]

const cashierGroups: NavGroup[] = [
  {
    title: 'Operación',
    items: [
      { label: 'Punto de venta', path: '/pos', icon: CartIcon },
      { label: 'Reservas', path: '/reservas', icon: CalendarIcon },
      { label: 'Facturas', path: '/facturas', icon: ReceiptIcon },
      { label: 'Caja', path: '/caja', icon: CashIcon },
    ],
  },
  {
    title: 'Otros',
    items: [
      { label: 'Reportes', path: '/reportes', icon: ChartIcon },
      { label: 'Configuración', path: '/configuracion', icon: GearIcon },
    ],
  },
]

export function AppShell() {
  const location = useLocation()
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen)
  const user = useUiStore((state) => state.user)

  const isSuperAdmin = user?.role === SUPER_ADMIN_ROLE
  const isOperator = user?.role ? OPERATOR_ROLES.includes(user.role) : false
  const { storeTerm, hasReservations } = useStoreContext()
  const baseGroups = isSuperAdmin ? superAdminGroups : isOperator ? cashierGroups : businessGroups

  const groups = useMemo(() => {
    const permissions = effectivePermissions(user)
    const canSeeReservas = isSuperAdmin || hasReservations

    if (isSuperAdmin || !permissions) {
      if (canSeeReservas) return baseGroups
      return baseGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => item.path !== '/reservas'),
        }))
        .filter((group) => group.items.length > 0)
    }

    const allowedSet = new Set(permissions)
    return baseGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => allowedSet.has(item.path) && (item.path !== '/reservas' || canSeeReservas),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [baseGroups, isSuperAdmin, user, hasReservations])

  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    enabled: !isSuperAdmin && !isOperator,
  })

  const badgeValues: Partial<Record<NonNullable<NavItem['badgeKey']>, number>> = {
    lowStock: summary?.lowStock?.length ?? 0,
  }

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const activeLabel = useMemo(
    () =>
      allItems.find((item) => location.pathname.startsWith(item.path))?.label ??
      (isSuperAdmin ? 'Droguerías' : isOperator ? 'Punto de venta' : 'Dashboard'),
    [location.pathname, allItems, isSuperAdmin, isOperator],
  )

  const isPos = location.pathname.startsWith('/pos')

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#eef3f9] text-slate-900 dark:bg-[#090d16] dark:text-white flex p-2 sm:p-3 lg:p-4 gap-3 lg:gap-4">
      {/* 1. Sidebar de Escritorio (Desktop Floating Island) */}
      <div className="hidden lg:flex shrink-0 h-full">
        <Sidebar
          groups={groups}
          badgeValues={badgeValues}
          user={user}
          isSuperAdmin={isSuperAdmin}
          isOperator={isOperator}
          storeTerm={storeTerm}
        />
      </div>

      {/* 2. Sidebar Móvil (Drawer deslizable con backdrop) */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop desenfocado */}
        <div
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
        {/* Panel lateral flotante en móvil */}
        <div
          className={`relative h-full max-w-[290px] p-3 transition-transform duration-300 ease-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar
            groups={groups}
            badgeValues={badgeValues}
            user={user}
            isSuperAdmin={isSuperAdmin}
            isOperator={isOperator}
            storeTerm={storeTerm}
            isMobile={true}
            onCloseMobile={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      {/* 3. Área de Contenido Principal (Surface card) */}
      <div className="relative flex flex-1 min-w-0 flex-col overflow-hidden rounded-[26px] border border-white/80 bg-white/90 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90 backdrop-blur-xl">
        {/* Banner de prueba vencida o próxima a vencer */}
        {!isSuperAdmin && user?.isTrialExpired ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-red-900 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-200 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm z-30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">⚠️</span>
              <span className="leading-tight">
                <strong>Período de prueba finalizado:</strong> La aplicación está en <u>modo solo lectura</u> (no es posible registrar ventas ni compras).
              </span>
            </div>
            <button
              type="button"
              onClick={() => openSupportWhatsApp(user?.storeName, user?.fullName, 'reactivar el sistema y plan')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition shrink-0"
            >
              <span>💬 Contactar a Soporte</span>
            </button>
          </div>
        ) : !isSuperAdmin && user?.subscriptionStatus === 'TRIAL' && (user?.daysRemaining ?? 99) <= 3 ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs z-30 shrink-0">
            <span>
              ⏳ Te quedan <strong>{user?.daysRemaining} {user?.daysRemaining === 1 ? 'día' : 'días'}</strong> de prueba gratuita.
            </span>
            <button
              type="button"
              onClick={() => openSupportWhatsApp(user?.storeName, user?.fullName, 'activar el plan')}
              className="font-semibold underline hover:text-amber-700 dark:hover:text-amber-300"
            >
              Contactar Soporte →
            </button>
          </div>
        ) : null}

        {/* Cabecera superior */}
        {!isPos ? (
          <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-md md:px-6 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 lg:hidden transition"
                  onClick={toggleSidebar}
                  title="Abrir menú"
                >
                  <MenuIcon className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2.5">
                  <img src={CapsulaLogos} alt="Cápsula" className="h-7 w-7 object-contain lg:hidden" />
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-800 dark:text-white">
                    {activeLabel}
                  </h2>
                </div>
              </div>

              {/* Badge de suscripción y tienda */}
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block text-xs font-medium text-slate-400 dark:text-slate-500">
                  {user?.storeName || (isSuperAdmin ? 'Super Administrador' : storeTerm)}
                </span>
                {!isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    {user?.isTrialExpired ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-500/20 dark:text-red-300">
                        🔴 Modo Solo Lectura
                      </span>
                    ) : user?.subscriptionStatus === 'TRIAL' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-[#2b66ff] dark:bg-blue-500/10 dark:text-blue-300">
                        ⏳ Prueba ({user.daysRemaining ?? 0}d)
                      </span>
                    ) : user?.subscriptionStatus === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        💎 Plan Activo
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </header>
        ) : (
          <button
            type="button"
            className="absolute left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/90 p-1.5 shadow-md backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90 text-slate-600 dark:text-slate-200 lg:hidden transition"
            onClick={toggleSidebar}
            title="Abrir menú"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        )}

        {/* Contenido de la página */}
        <main className={isPos ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto px-4 py-5 md:px-6'}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

