import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import { DataTable } from '../../../components/ui/DataTable'
import { SectionCard } from '../../../components/ui/SectionCard'
import { listUsers, deleteUser, updateUser, type UserRecord } from '../../../services/api/users'
import { listSettings, updateSetting, createSetting } from '../../../services/api/settings'
import { UserFormModal } from '../components/UserFormModal'

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Activo', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  BLOCKED: { label: 'Bloqueado', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  DISABLED: { label: 'Deshabilitado', className: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  })

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: listSettings,
  })
  const dbSettings = settingsQuery.data ?? []
  const allowCashierPriceEdit = dbSettings.find((s) => s.key === 'allowCashierPriceEdit')?.value === 'true'

  const togglePriceAuthMutation = useMutation({
    mutationFn: async (nextVal: boolean) => {
      const existing = dbSettings.find((s) => s.key === 'allowCashierPriceEdit')
      if (existing) {
        await updateSetting('allowCashierPriceEdit', nextVal ? 'true' : 'false')
      } else {
        await createSetting('allowCashierPriceEdit', nextVal ? 'true' : 'false')
      }
      return nextVal
    },
    onSuccess: (nextVal) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      if (nextVal) {
        toast.success('Autorización concedida: los cajeros pueden modificar precios en POS')
      } else {
        toast.success('Autorización quitada: precios bloqueados para los cajeros')
      }
    },
    onError: () => toast.error('Error al actualizar la autorización'),
  })

  const users = usersQuery.data ?? []

  const stats = useMemo(() => {
    const total = users.length
    const active = users.filter((u) => u.status === 'ACTIVE').length
    const blocked = users.filter((u) => u.status === 'BLOCKED').length
    return { total, active, blocked }
  }, [users])

  /** Deshabilitar conserva el histórico (turnos de caja, ventas, compras) y quita el acceso */
  const disableMutation = useMutation({
    mutationFn: (userId: string) => updateUser(userId, { status: 'DISABLED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuario deshabilitado: ya no podrá iniciar sesión')
      setDeletingId(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Error al deshabilitar el usuario')
      setDeletingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuario eliminado correctamente')
      setDeletingId(null)
    },
    onError: (err: any, userId) => {
      const message = err?.response?.data?.message ?? 'Error al eliminar usuario'
      const hasHistory = (err?.response?.data?.errors ?? []).some(
        (e: any) => e?.code === 'USER_HAS_HISTORY',
      )

      // El usuario tiene operaciones registradas: se ofrece deshabilitarlo
      if (hasHistory && window.confirm(`${message}\n\n¿Deshabilitarlo ahora?`)) {
        disableMutation.mutate(userId)
        return
      }

      toast.error(message)
      setDeletingId(null)
    },
  })

  const handleDelete = (userId: string, userEmail: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar al usuario "${userEmail}"? Esta acción no se puede deshacer.`)) return
    setDeletingId(userId)
    deleteMutation.mutate(userId)
  }

  const handleDisable = (userId: string, userEmail: string) => {
    if (!window.confirm(`¿Deshabilitar a "${userEmail}"? No podrá iniciar sesión, pero se conserva su histórico.`)) return
    setDeletingId(userId)
    disableMutation.mutate(userId)
  }

  const columns = useMemo<ColumnDef<UserRecord>[]>(
    () => [
      {
        header: 'Nombre completo',
        accessorKey: 'fullName',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{row.original.fullName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.original.username}</p>
          </div>
        ),
      },
      { header: 'Correo electrónico', accessorKey: 'email' },
      {
        header: 'Rol',
        accessorKey: 'roleName',
        cell: ({ row }) => (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            {row.original.roleName ?? 'Sin rol'}
          </span>
        ),
      },
      {
        header: 'Establecimiento',
        accessorKey: 'storeName',
        cell: ({ row }) => (
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {row.original.storeName ?? 'Global (Super Admin)'}
          </span>
        ),
      },
      {
        header: 'Estado',
        accessorKey: 'status',
        cell: ({ row }) => {
          const badge = STATUS_BADGE[row.original.status] ?? STATUS_BADGE['DISABLED']
          return (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          )
        },
      },
      {
        header: 'Último acceso',
        accessorKey: 'lastLoginAt',
        cell: ({ row }) =>
          row.original.lastLoginAt
            ? new Date(row.original.lastLoginAt).toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : 'Nunca',
      },
      {
        header: 'Acciones',
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingUser(row.original)
                setModalOpen(true)
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Editar
            </button>
            {row.original.status !== 'DISABLED' && (
              <>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button
                  onClick={() => handleDisable(row.original.id, row.original.email)}
                  disabled={deletingId === row.original.id}
                  className="text-sm font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50 dark:text-amber-400"
                  title="Quita el acceso sin borrar el histórico"
                >
                  Deshabilitar
                </button>
              </>
            )}
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <button
              onClick={() => handleDelete(row.original.id, row.original.email)}
              disabled={deletingId === row.original.id}
              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
            >
              {deletingId === row.original.id ? 'Procesando...' : 'Eliminar'}
            </button>
          </div>
        ),
      },
    ],
    [deletingId],
  )

  const handleOpenCreate = () => {
    setEditingUser(null)
    setModalOpen(true)
  }

  const handleClose = () => {
    setModalOpen(false)
    setEditingUser(null)
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Gestión de Usuarios"
        description="Administra los usuarios del sistema y sus roles de acceso."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => togglePriceAuthMutation.mutate(!allowCashierPriceEdit)}
              disabled={togglePriceAuthMutation.isPending}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs sm:text-sm font-semibold transition border shadow-xs ${
                allowCashierPriceEdit
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300'
              }`}
              title="Dar o quitar autorización a los cajeros para modificar precios en el POS"
            >
              <span>{allowCashierPriceEdit ? '🔓' : '🔒'}</span>
              <span>
                {allowCashierPriceEdit
                  ? 'Precios en Caja: Autorizado'
                  : 'Precios en Caja: Bloqueado'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              + Nuevo usuario
            </button>
          </div>
        }
      >
        {/* Banner de control de autorización de precios */}
        <div className={`mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border p-4 transition ${
          allowCashierPriceEdit
            ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/40 dark:bg-emerald-950/20'
            : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
              allowCashierPriceEdit ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-slate-200 dark:bg-slate-700'
            }`}>
              {allowCashierPriceEdit ? '🔓' : '🔒'}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Autorización para modificar precios en el Punto de Venta (Cajeros)
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {allowCashierPriceEdit
                  ? 'Los cajeros y vendedores TIENEN autorización para modificar precios en el ticket de venta.'
                  : 'Los precios están BLOQUEADOS para cajeros y vendedores. Solo los administradores pueden modificarlos.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => togglePriceAuthMutation.mutate(!allowCashierPriceEdit)}
            disabled={togglePriceAuthMutation.isPending}
            className={`shrink-0 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition border shadow-xs ${
              allowCashierPriceEdit
                ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
                : 'bg-emerald-600 border-transparent text-white hover:bg-emerald-700'
            }`}
          >
            {togglePriceAuthMutation.isPending
              ? 'Actualizando…'
              : allowCashierPriceEdit
              ? 'Quitar autorización 🔒'
              : 'Dar autorización 🔓'}
          </button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total usuarios</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{stats.total}</p>
          </article>
          <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/50 dark:bg-emerald-500/10">
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Usuarios activos</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{stats.active}</p>
          </article>
          <article className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-500/10">
            <p className="text-sm text-amber-600 dark:text-amber-400">Bloqueados / Inactivos</p>
            <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-300">{stats.blocked}</p>
          </article>
        </div>

        {/* Table */}
        {usersQuery.isLoading ? (
          <div className="py-10 text-center text-sm text-slate-400">Cargando usuarios...</div>
        ) : usersQuery.isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">
            Error al cargar usuarios
          </div>
        ) : (
          <DataTable columns={columns} data={users} />
        )}
      </SectionCard>

      <UserFormModal open={modalOpen} user={editingUser} onClose={handleClose} />
    </div>
  )
}
