/**
 * Permisos por página (users.permissions). Centralizado aquí para que el guard
 * de rutas (App.tsx), el menú (AppShell) y el formulario de usuarios usen
 * exactamente la misma lista y las mismas reglas.
 */

export const SUPER_ADMIN_ROLE = 'Super Administrador'
export const PHARMACY_ADMIN_ROLE = 'Administrador de Drogueria'
export const STORE_ADMIN_ROLE = 'Administrador de Tienda'
export const LEGACY_ADMIN_ROLE = 'Administrador'

export const CASHIER_ROLE = 'Cajero'
export const SELLER_ROLE = 'Vendedor'

/** Roles administrativos del sistema */
export const ADMIN_ROLES = [
  SUPER_ADMIN_ROLE,
  PHARMACY_ADMIN_ROLE,
  STORE_ADMIN_ROLE,
  LEGACY_ADMIN_ROLE,
]

/** Roles de operación (caja/venta) */
export const OPERATOR_ROLES = [CASHIER_ROLE, SELLER_ROLE]

/** Verifica si un usuario tiene rol administrativo */
export function isAdminUser(user: { role?: string } | null | undefined): boolean {
  if (!user?.role) return false
  return ADMIN_ROLES.includes(user.role)
}

/** Páginas que se pueden asignar a un usuario */
export const ALL_PAGES = [
  { key: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { key: '/pos', label: 'Punto de venta', icon: '🛒' },
  { key: '/reservas', label: 'Reservas', icon: '⚽' },
  { key: '/caja', label: 'Caja', icon: '💵' },
  { key: '/facturas', label: 'Facturas', icon: '📄' },
  { key: '/inventario', label: 'Inventario', icon: '📦' },
  { key: '/clientes', label: 'Clientes', icon: '👤' },
  { key: '/proveedores', label: 'Proveedores', icon: '🚚' },
  { key: '/compras', label: 'Compras', icon: '🛍️' },
  { key: '/contabilidad', label: 'Contabilidad', icon: '📊' },
  { key: '/reportes', label: 'Reportes', icon: '📈' },
  { key: '/configuracion', label: 'Configuración', icon: '⚙️' },
  { key: '/usuarios', label: 'Usuarios', icon: '👥' },
  { key: '/suscripcion', label: 'Suscripción', icon: '✨' },
] as const

/**
 * Páginas que siempre puede ver un rol administrativo, aunque su arreglo de
 * permisos guardado en base de datos no las incluya (se agregaron después de
 * que el usuario fue creado).
 */
const IMPLICIT_ADMIN_PAGES = ['/dashboard', '/suscripcion', '/reservas']

export const ADMIN_DEFAULT_PAGES = ALL_PAGES.map((p) => p.key as string)

export const OPERATOR_DEFAULT_PAGES = ['/pos', '/reservas', '/facturas', '/caja', '/reportes', '/configuracion']

/** Rutas permitidas a los roles de operación cuando no tienen permisos explícitos */
export const OPERATOR_ALLOWED_PATHS = OPERATOR_DEFAULT_PAGES

type PermissionUser = {
  role?: string
  permissions?: string[] | null
} | null

const isOperator = (user: PermissionUser) => Boolean(user?.role && OPERATOR_ROLES.includes(user.role))

/**
 * Permisos efectivos de un usuario administrador.
 *
 * Páginas como el Dashboard o Suscripción no existían en la lista de páginas
 * asignables, así que los usuarios creados antes quedaron con un arreglo de
 * permisos sin ellas y el guard los expulsaba. Para los roles administrativos
 * esas páginas se consideran siempre permitidas; a los roles de operación se
 * les sigue respetando la lista tal cual.
 */
export function effectivePermissions(user: PermissionUser): string[] | null {
  const permissions = user?.permissions
  if (!permissions || permissions.length === 0) return null
  if (isOperator(user)) return permissions

  const missing = IMPLICIT_ADMIN_PAGES.filter((page) => !permissions.includes(page))
  return missing.length > 0 ? [...missing, ...permissions] : permissions
}

/** ¿El usuario puede entrar a esta ruta? */
export function canAccessPath(user: PermissionUser, pathname: string): boolean {
  const permissions = effectivePermissions(user)
  if (!permissions) return true
  return permissions.includes(pathname)
}

/** Ruta a la que enviar al usuario cuando la actual no está permitida */
export function fallbackPathFor(user: PermissionUser): string {
  const permissions = effectivePermissions(user)
  return permissions?.[0] ?? (isOperator(user) ? '/pos' : '/dashboard')
}
