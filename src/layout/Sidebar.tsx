import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useMemo, useState, type ReactElement } from 'react'
import toast from 'react-hot-toast'
import { useUiStore, type AuthUser } from '../store/ui-store'
import { openSupportWhatsApp } from '../shared/utils/supportContact'
import CapsulaLogos from '../assets/Capsulas.png'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LogOutIcon,
  MessageCircleIcon,
  MinusIcon,
  MoonIcon,
  PlusIcon,
  StarSparkleIcon,
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

  const isCollapsed = !isMobile && sidebarCollapsed

  // Manejar grupos abiertos/cerrados estilo acordeón minimalista
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }))
  }

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

  const displayName = user?.fullName || 'Usuario'
  const firstName = displayName.split(' ')[0] || displayName

  // Acción principal según rol
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
      subtitle: 'Ir al Punto de Venta',
      path: '/pos',
    }
  }, [isSuperAdmin])


  return (
    <aside
      className={`relative flex flex-col select-none transition-all duration-300 ease-in-out ${
        isCollapsed
          ? 'w-[74px] px-2.5 py-4'
          : 'w-[280px] p-4'
      } h-full rounded-[34px] border border-slate-200/80 bg-[#f4f4f7] shadow-[0_12px_36px_rgba(0,0,0,0.04)] dark:border-zinc-800/80 dark:bg-[#141517] dark:shadow-[0_12px_36px_rgba(0,0,0,0.35)]`}
    >
      {/* ─────────────────── VISTA COLAPSADA (Micro Sidebar / Pill Strip) ─────────────────── */}
      {isCollapsed ? (
        <div className="flex h-full flex-col items-center justify-between">
          {/* Top: Sparkle & Cápsula Logo */}
          <div className="flex flex-col items-center gap-3 w-full">
            {/* Sparkle icon trigger */}
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              title="Expandir menú"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-800 shadow-sm hover:scale-105 active:scale-95 transition-all dark:bg-zinc-800 dark:text-zinc-100"
            >
              <StarSparkleIcon className="h-5 w-5" />
            </button>

            {/* Cápsula Logo Avatar */}
            <div
              className="group relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl bg-white p-1.5 shadow-sm hover:ring-2 hover:ring-blue-500/30 transition-all dark:bg-zinc-800"
              title={`${user?.storeName || 'Cápsula'} - ${displayName}`}
              onClick={toggleSidebarCollapsed}
            >
              <img src={CapsulaLogos} alt="Cápsula" className="h-full w-full object-contain" />
              <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-800" />
            </div>
          </div>

          {/* Center: Vertical Navigation Icons Strip */}
          <div className="flex flex-1 flex-col items-center gap-2.5 overflow-y-auto overflow-x-hidden py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full">
            {groups.map((group, gIdx) => {
              return (
                <div key={group.title} className="flex flex-col items-center gap-2 w-full">
                  {gIdx > 0 && <div className="h-[1px] w-6 bg-slate-300/70 dark:bg-zinc-800 my-1" />}
                  {group.items.map((item) => {
                    const isActive = location.pathname.startsWith(item.path)
                    const Icon = item.icon
                    const badge = item.badgeKey ? badgeValues[item.badgeKey] : undefined

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={handleItemClick}
                        title={item.label}
                        className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 ${
                          isActive
                            ? 'bg-white text-slate-900 shadow-[0_4px_16px_rgba(0,0,0,0.08)] scale-105 dark:bg-zinc-800 dark:text-white'
                            : 'text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'
                        }`}
                      >
                        <Icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${isActive ? 'stroke-[2.2]' : ''}`} />
                        {badge && badge > 0 ? (
                          <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 ring-2 ring-[#f4f4f7] dark:ring-[#141517]" />
                        ) : null}
                      </NavLink>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Bottom: Quick Tools & POS FAB */}
          <div className="flex flex-col items-center gap-2.5 pt-2 w-full">
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-black/5 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white transition"
            >
              {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                navigate(primaryAction.path)
                handleItemClick()
              }}
              title={primaryAction.title}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#18181b] text-white shadow-md hover:scale-105 active:scale-95 transition-all dark:bg-white dark:text-zinc-950"
            >
              <PlusIcon className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      ) : (
        /* ─────────────────── VISTA EXPANDIDA (Diseño Moderno Exacto) ─────────────────── */
        <div className="flex h-full flex-col justify-between overflow-hidden">
          {/* Top Header: Sparkle + Menu & Close / Collapse Toggle */}
          <div className="flex items-center justify-between pb-3 px-1">
            <div className="flex items-center gap-2">
              <StarSparkleIcon className="h-5 w-5 text-slate-900 dark:text-white" />
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Menu
              </h2>
            </div>

            {isMobile ? (
              <button
                type="button"
                onClick={onCloseMobile}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-slate-500 hover:bg-white hover:text-slate-800 shadow-sm dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white transition"
                title="Cerrar menú"
              >
                <XIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                title="Colapsar menú"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-slate-400 hover:bg-white hover:text-slate-800 shadow-sm dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white transition"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* User & Store Card con Logo Cápsula */}
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] dark:bg-zinc-800/80 border border-slate-200/50 dark:border-zinc-700/50">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4f4f7] p-1 dark:bg-zinc-700">
              <img src={CapsulaLogos} alt="Cápsula" className="h-full w-full object-contain" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-800" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-zinc-400">
                <span>Buen día</span>
                <span>👋</span>
              </p>
              <p className="truncate text-xs font-bold text-slate-800 dark:text-white" title={displayName}>
                {firstName} {displayName.split(' ')[1] ? `${displayName.split(' ')[1][0]}.` : ''}
              </p>
            </div>

            <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              {isSuperAdmin ? 'Admin' : isOperator ? 'Cajero' : 'Pro'}
            </span>
          </div>

          {/* Scrollable Navigation Sections with Minimalist Hierarchy */}
          <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groups.map((group) => {
              const isGroupCollapsed = collapsedGroups[group.title] ?? false
              const hasMultipleItems = group.items.length > 1

              // Si es un grupo individual con 1 solo item (ej: Dashboard)
              if (!hasMultipleItems) {
                const item = group.items[0]
                const isActive = location.pathname.startsWith(item.path)
                const Icon = item.icon
                const badge = item.badgeKey ? badgeValues[item.badgeKey] : undefined

                return (
                  <div key={group.title} className="w-full">
                    <NavLink
                      to={item.path}
                      onClick={handleItemClick}
                      className={`group flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? 'bg-[#18181b] text-white shadow-sm dark:bg-white dark:text-zinc-950'
                          : 'text-slate-700 hover:bg-black/5 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white dark:text-zinc-950' : 'text-slate-500 dark:text-zinc-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {badge && badge > 0 ? (
                        <span
                          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                            isActive
                              ? 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white'
                              : 'bg-[#18181b] text-white dark:bg-white dark:text-zinc-900'
                          }`}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </NavLink>
                  </div>
                )
              }

              // Si es un grupo con múltiples sub-elementos (Operación, Contactos, Otros/Ajustes)
              return (
                <div key={group.title} className="w-full space-y-1">
                  {/* Encabezado del Grupo estilo Categoría / Carpeta */}
                  <div
                    onClick={() => toggleGroup(group.title)}
                    className="flex cursor-pointer items-center justify-between px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{group.title}</span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        ({group.items.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                      {isGroupCollapsed ? (
                        <PlusIcon className="h-3 w-3" />
                      ) : (
                        <MinusIcon className="h-3 w-3" />
                      )}
                    </div>
                  </div>

                  {/* Lista de Items con árbol de conexión vertical */}
                  {!isGroupCollapsed && (
                    <div className="relative pl-3 space-y-1">
                      {/* Línea vertical del árbol */}
                      <div className="absolute left-1.5 top-1 bottom-1 w-[1.5px] bg-slate-300/80 dark:bg-zinc-700/70" />

                      {group.items.map((item) => {
                        const isActive = location.pathname.startsWith(item.path)
                        const Icon = item.icon
                        const badge = item.badgeKey ? badgeValues[item.badgeKey] : undefined

                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={handleItemClick}
                            className={`group relative flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all duration-150 ${
                              isActive
                                ? 'bg-white text-slate-900 font-bold shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:bg-zinc-800 dark:text-white'
                                : 'text-slate-600 font-medium hover:bg-black/5 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon
                                className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-105 ${
                                  isActive
                                    ? 'text-slate-900 dark:text-white stroke-[2.2]'
                                    : 'text-slate-400 dark:text-zinc-500'
                                }`}
                              />
                              <span className="truncate">{item.label}</span>
                            </div>

                            {badge && badge > 0 ? (
                              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm">
                                {badge}
                              </span>
                            ) : isActive ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-[#18181b] dark:bg-white" />
                            ) : null}
                          </NavLink>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bottom Section: Action Dock & Quick Action Button */}
          <div className="mt-3 pt-2 space-y-2 border-t border-slate-200/60 dark:border-zinc-800/80">
            {/* Quick Utility Dock (WhatsApp, Theme, Logout) */}
            <div className="flex items-center justify-between rounded-2xl bg-white p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] dark:bg-zinc-800/80 border border-slate-200/50 dark:border-zinc-700/50">
              <button
                type="button"
                title="Soporte Técnico WhatsApp"
                onClick={() => openSupportWhatsApp(user?.storeName, user?.fullName, 'consulta técnica')}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:text-zinc-400 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400 transition"
              >
                <MessageCircleIcon className="h-4 w-4" />
              </button>

              <button
                type="button"
                title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-amber-50 hover:text-amber-500 dark:text-zinc-400 dark:hover:bg-amber-500/20 dark:hover:text-amber-300 transition"
              >
                {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              </button>

              <button
                type="button"
                title="Cerrar sesión"
                onClick={handleLogout}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-400 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 transition"
              >
                <LogOutIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Primary Action Button (Nueva Venta / Establecimientos) */}
            <button
              type="button"
              onClick={() => {
                navigate(primaryAction.path)
                handleItemClick()
              }}
              className="group flex w-full items-center justify-between rounded-2xl bg-[#18181b] px-4 py-3 text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] hover:bg-black active:scale-[0.98] transition-all dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 dark:bg-black/10">
                  <PlusIcon className="h-4 w-4 stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold leading-tight">{primaryAction.title}</p>
                  <p className="text-[10px] text-white/70 dark:text-zinc-600 leading-tight">
                    {primaryAction.subtitle}
                  </p>
                </div>
              </div>
              <ChevronRightIcon className="h-4 w-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
