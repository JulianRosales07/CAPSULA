import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useMemo, type ReactElement } from 'react'
import toast from 'react-hot-toast'
import { useUiStore, type AuthUser } from '../store/ui-store'
import { openSupportWhatsApp } from '../shared/utils/supportContact'
import CapsulaLogos from '../assets/Capsulas.png'
import {
  ChevronLeftIcon,
  GearIcon,
  GridIcon,
  LogOutIcon,
  MessageCircleIcon,
  MoonIcon,
  PlusIcon,
  SlidersIcon,
  SunIcon,
  XIcon,
} from '../components/icons'

export type NavItem = {
  label: string
  path: string
  icon: (props: { className?: string }) => ReactElement
  badgeKey?: 'lowStock'
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

interface SidebarProps {
  groups: NavGroup[]
  badgeValues: Partial<Record<string, number>>
  user: AuthUser | null
  isSuperAdmin: boolean
  isOperator: boolean
  storeTerm?: string
  isMobile?: boolean
  onCloseMobile?: () => void
}

export function Sidebar({
  groups,
  badgeValues,
  user,
  isSuperAdmin,
  isOperator,
  isMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useUiStore((state) => state.theme)
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebarCollapsed = useUiStore((state) => state.toggleSidebarCollapsed)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const logout = useUiStore((state) => state.logout)

  // En móvil nunca se colapsa en modo micro-sidebar
  const isCollapsed = !isMobile && sidebarCollapsed

  const handleLogout = () => {
    logout()
    toast.success('Sesión cerrada')
    window.location.href = '/login'
  }

  const handleItemClick = () => {
    if (isMobile && onCloseMobile) {
      onCloseMobile()
    }
  }

  // Nombre a mostrar
  const displayName = user?.fullName || 'Usuario'
  const firstName = displayName.split(' ')[0] || displayName

  // Dividir los grupos de navegación:
  // Grupo 1: General & Operación básica (Dashboard, POS, Reservas, Facturas, Caja, etc.)
  // Grupo 2: Módulos operativos / Servicios (Inventario, Compras, Clientes, Proveedores)
  // Grupo 3: Administración & Otros (Contabilidad, Reportes, Configuración, Suscripción)
  const { primaryItems, serviceItems, settingItems } = useMemo(() => {
    const all = groups.flatMap((g) => g.items)

    if (isSuperAdmin) {
      return {
        primaryItems: all,
        serviceItems: [] as NavItem[],
        settingItems: [] as NavItem[],
      }
    }

    if (isOperator) {
      const primaryPaths = ['/pos', '/reservas', '/facturas', '/caja']
      const primary = all.filter((i) => primaryPaths.includes(i.path))
      const settings = all.filter((i) => ['/reportes', '/configuracion'].includes(i.path))
      return {
        primaryItems: primary.length ? primary : all,
        serviceItems: [] as NavItem[],
        settingItems: settings,
      }
    }

    // Negocio Estándar
    const primaryPaths = ['/dashboard', '/pos', '/reservas', '/facturas', '/caja']
    const servicePaths = ['/inventario', '/compras', '/clientes', '/proveedores', '/usuarios']
    const settingPaths = ['/contabilidad', '/reportes', '/suscripcion', '/configuracion']

    const primary = all.filter((i) => primaryPaths.includes(i.path))
    const services = all.filter((i) => servicePaths.includes(i.path))
    const settings = all.filter((i) => settingPaths.includes(i.path))

    return {
      primaryItems: primary.length > 0 ? primary : all.slice(0, 5),
      serviceItems: services,
      settingItems: settings,
    }
  }, [groups, isSuperAdmin, isOperator])

  // Determinar acción principal del botón inferior
  const primaryAction = useMemo(() => {
    if (isSuperAdmin) {
      return {
        title: 'Establecimientos',
        subtitle: 'Administrar droguerías',
        path: '/droguerias',
      }
    }
    return {
      title: 'Nueva Venta',
      subtitle: 'Ir al Punto de Venta (POS)',
      path: '/pos',
    }
  }, [isSuperAdmin])

  return (
    <aside
      className={`relative flex flex-col select-none transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-[72px] px-2.5 py-3.5' : 'w-[268px] p-3.5'
      } h-full rounded-[28px] border border-white/70 bg-white/75 shadow-[0_20px_50px_rgba(0,0,0,0.06)] backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]`}
    >
      {/* 1. Header: macOS Traffic Lights & Expand/Collapse Toggle */}
      {isCollapsed ? (
        <div
          onClick={toggleSidebarCollapsed}
          title="Expandir menú"
          className="group flex cursor-pointer flex-col items-center justify-center pt-1 pb-2 transition"
        >
          <div className="flex items-center gap-1.5 py-1">
            <span className="h-2 w-2 rounded-full bg-[#ff5f56] shadow-sm shadow-red-500/20" />
            <span className="h-2 w-2 rounded-full bg-[#ffbd2e] shadow-sm shadow-amber-500/20" />
            <span className="h-2 w-2 rounded-full bg-[#27c93f] shadow-sm shadow-emerald-500/20" />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-1 pt-1 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] shadow-sm shadow-red-500/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] shadow-sm shadow-amber-500/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f] shadow-sm shadow-emerald-500/20" />
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition"
              title="Cerrar menú"
            >
              <XIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              title="Colapsar menú"
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 2. User Profile Header with Cápsula Logo */}
      <div className={`mt-1.5 mb-3 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-1'}`}>
        <div
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 p-[2px] shadow-sm cursor-pointer hover:scale-105 transition-transform"
          title={`${user?.storeName || 'Cápsula'} - ${displayName} (${user?.role || ''})${isCollapsed ? ' - Clic para expandir' : ''}`}
          onClick={() => isCollapsed && toggleSidebarCollapsed()}
        >
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-1 dark:bg-slate-900">
            <img src={CapsulaLogos} alt="Cápsula" className="h-full w-full object-contain" />
          </div>
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
        </div>

        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              <span>Buen día</span>
              <span className="text-amber-500">👋</span>
            </p>
            <p className="truncate text-sm font-bold tracking-tight text-slate-800 dark:text-white" title={displayName}>
              {firstName} {displayName.split(' ')[1] ? `${displayName.split(' ')[1][0]}.` : ''}
            </p>
          </div>
        )}
      </div>

      {/* 3. Contenedor con Scroll Limpio (Sin barra de scroll visible) */}
      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* Sección: Menu Principal */}
        {primaryItems.length > 0 && (
          <div className="flex flex-col items-center w-full">
            {!isCollapsed ? (
              <div className="flex w-full items-center justify-between px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                <span>Menu: {primaryItems.length}</span>
                <SlidersIcon className="h-3 w-3 opacity-60" />
              </div>
            ) : (
              <div className="pb-1 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                <span>Menu: {primaryItems.length}</span>
              </div>
            )}

            <div className={`space-y-1 w-full ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
              {primaryItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path)
                const Icon = item.icon
                const badge = item.badgeKey ? badgeValues[item.badgeKey] : undefined

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={handleItemClick}
                    title={item.label}
                    className={`group relative flex items-center ${
                      isCollapsed
                        ? 'h-11 w-11 justify-center rounded-2xl'
                        : 'h-10 w-full justify-between px-3 rounded-2xl'
                    } transition-all duration-200 ${
                      isActive
                        ? 'bg-[#2b66ff] text-white shadow-md shadow-blue-500/25 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white font-medium'
                    }`}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} min-w-0`}>
                      <Icon
                        className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      />
                      {!isCollapsed && <span className="truncate text-xs">{item.label}</span>}
                    </div>

                    {!isCollapsed && badge ? (
                      <span
                        className={`ml-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                          isActive ? 'bg-white text-[#2b66ff]' : 'bg-rose-500 text-white'
                        }`}
                      >
                        {badge}
                      </span>
                    ) : null}

                    {isCollapsed && badge ? (
                      <span className="absolute 0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm">
                        {badge}
                      </span>
                    ) : null}
                  </NavLink>
                )
              })}
            </div>
          </div>
        )}

        {/* Sección: Servicios / Operación (Tarjeta interna) */}
        {serviceItems.length > 0 && (
          <div className="flex flex-col items-center w-full">
            {!isCollapsed ? (
              <div className="flex w-full items-center justify-between px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                <span>Servicios: {serviceItems.length}</span>
                <GridIcon className="h-3 w-3 opacity-60" />
              </div>
            ) : (
              <div className="pb-1 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                <span>Servicios: {serviceItems.length}</span>
              </div>
            )}

            <div
              className={`border border-slate-100 bg-white/90 shadow-sm dark:border-slate-800/80 dark:bg-slate-800/60 ${
                isCollapsed
                  ? 'w-11 rounded-2xl p-1 flex flex-col items-center gap-1'
                  : 'w-full rounded-2xl p-1.5 space-y-0.5'
              }`}
            >
              {serviceItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path)
                const Icon = item.icon
                const badge = item.badgeKey ? badgeValues[item.badgeKey] : undefined

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={handleItemClick}
                    title={item.label}
                    className={`group flex items-center ${
                      isCollapsed
                        ? 'h-9 w-9 justify-center rounded-xl'
                        : 'h-8.5 w-full justify-between px-2.5 rounded-xl'
                    } text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-50 text-[#2b66ff] dark:bg-blue-500/15 dark:text-blue-300 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-white'
                    }`}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'} min-w-0`}>
                      <div
                        className={`flex ${isCollapsed ? 'h-7 w-7' : 'h-6 w-6'} shrink-0 items-center justify-center rounded-lg ${
                          isActive
                            ? 'bg-[#2b66ff] text-white'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300 group-hover:bg-blue-50 group-hover:text-[#2b66ff] dark:group-hover:bg-blue-500/20'
                        } transition`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      {!isCollapsed && <span className="truncate text-xs">{item.label}</span>}
                    </div>

                    {!isCollapsed && badge ? (
                      <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
                        {badge}
                      </span>
                    ) : null}
                  </NavLink>
                )
              })}
            </div>
          </div>
        )}

        {/* Sección: Ajustes & Dock Toolbar */}
        <div className="flex flex-col items-center w-full">
          {!isCollapsed ? (
            <div className="flex w-full items-center justify-between px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              <span>Ajustes: {settingItems.length + 3}</span>
              <GearIcon className="h-3 w-3 opacity-60" />
            </div>
          ) : (
            <div className="pb-1 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              <span>Ajustes</span>
            </div>
          )}

          <div
            className={`border border-slate-100 bg-white/90 shadow-sm dark:border-slate-800/80 dark:bg-slate-800/60 ${
              isCollapsed
                ? 'w-11 rounded-2xl p-1 flex flex-col items-center gap-1'
                : 'w-full rounded-2xl p-1.5 flex items-center justify-around'
            }`}
          >
            {/* Quick Links de Configuración / Reportes si existen */}
            {settingItems.slice(0, 2).map((item) => {
              const isActive = location.pathname.startsWith(item.path)
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleItemClick}
                  title={item.label}
                  className={`flex ${isCollapsed ? 'h-8 w-8' : 'h-8 w-8'} items-center justify-center rounded-xl transition ${
                    isActive
                      ? 'bg-blue-50 text-[#2b66ff] dark:bg-blue-500/20 dark:text-blue-300'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </NavLink>
              )
            })}

            {/* Botón Soporte WhatsApp */}
            <button
              type="button"
              title="Soporte Técnico"
              onClick={() => openSupportWhatsApp(user?.storeName, user?.fullName, 'consulta técnica')}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400 transition"
            >
              <MessageCircleIcon className="h-4 w-4" />
            </button>

            {/* Toggle Tema Claro / Oscuro */}
            <button
              type="button"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-amber-50 hover:text-amber-500 dark:hover:bg-amber-500/20 dark:hover:text-amber-300 transition"
            >
              {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>

            {/* Cerrar Sesión */}
            <button
              type="button"
              title="Cerrar sesión"
              onClick={handleLogout}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 transition"
            >
              <LogOutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bottom Action Card / Floating Action Button */}
      <div className="mt-3 pt-1 flex justify-center w-full">
        {!isCollapsed ? (
          <div
            onClick={() => {
              navigate(primaryAction.path)
              handleItemClick()
            }}
            className="group relative flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white/90 p-3 text-center shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-800/80 dark:hover:border-blue-600"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2b66ff] text-white shadow-md shadow-blue-500/30 transition-transform group-hover:scale-110">
              <PlusIcon className="h-4.5 w-4.5 stroke-[2.5]" />
            </div>
            <p className="mt-2 text-xs font-bold text-slate-800 dark:text-white">
              {primaryAction.title}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-[#2b66ff] transition-colors">
              {primaryAction.subtitle}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              navigate(primaryAction.path)
              handleItemClick()
            }}
            title={primaryAction.title}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2b66ff] text-white shadow-lg shadow-blue-500/35 transition-transform hover:scale-110 active:scale-95"
          >
            <PlusIcon className="h-5 w-5 stroke-[2.5]" />
          </button>
        )}
      </div>
    </aside>
  )
}
