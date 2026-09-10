import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useReactToPrint } from 'react-to-print'
import { SectionCard } from '../../../components/ui/SectionCard'
import { useUiStore } from '../../../store/ui-store'
import { listSettings, createSetting, updateSetting } from '../../../services/api/settings'
import { Receipt } from '../../../components/Receipt'
import {
  type ReceiptConfig,
  RECEIPT_CONFIG_DEFAULTS,
} from '../../../hooks/useReceiptConfig'
import { usePrinter } from '../../../hooks/usePrinter'

// ─── General settings form ────────────────────────────────────────────────────
type GeneralFormValues = {
  branchName: string
  cashierName: string
  notifications: boolean
  autoPrint: boolean
  allowCashierPriceEdit: boolean
  theme: 'light' | 'dark'
}

// ─── Receipt config form (keys prefixed with receipt.) ───────────────────────
type ReceiptFormValues = ReceiptConfig

// ─── Mock sale for preview ────────────────────────────────────────────────────
const PREVIEW_SALE = {
  saleId: 'ABCD1234',
  date: new Date().toISOString(),
  customerName: 'Juan Pérez',
  items: [
    { name: 'Acetaminofén 500mg', quantity: 2, unitPrice: 3500, lineTotal: 7000 },
    { name: 'Ibuprofeno 400mg (Caja x10)', quantity: 1, unitPrice: 22000, lineTotal: 22000 },
  ],
  subtotal: 29000,
  tax: 0,
  discount: 0,
  total: 29000,
}

type Tab = 'general' | 'factura' | 'impresora'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const currentTheme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const [tab, setTab] = useState<Tab>('general')
  const printer = usePrinter()
  const testReceiptRef = useRef<HTMLDivElement>(null)

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: listSettings })
  const dbSettings = settingsQuery.data ?? []

  // ── Helper: persist a map of key→value to DB ──────────────────────────────
  const persistSettings = async (map: Record<string, string>) => {
    for (const [key, value] of Object.entries(map)) {
      const existing = dbSettings.find((s) => s.key === key)
      if (existing) {
        await updateSetting(key, value)
      } else {
        await createSetting(key, value, 'STRING', key)
      }
    }
  }

  // ─── General form ──────────────────────────────────────────────────────────
  const generalForm = useForm<GeneralFormValues>({
    defaultValues: {
      branchName: 'Droguería Principal',
      cashierName: 'Caja 1',
      notifications: true,
      autoPrint: true,
      theme: currentTheme,
    },
  })

  useEffect(() => {
    if (!dbSettings.length) return
    const get = (key: string) => dbSettings.find((s) => s.key === key)?.value
    generalForm.reset({
      branchName: get('branchName') ?? 'Droguería Principal',
      cashierName: get('cashierName') ?? 'Caja 1',
      notifications: get('notifications') !== 'false',
      autoPrint: get('autoPrint') !== 'false',
      allowCashierPriceEdit: get('allowCashierPriceEdit') === 'true',
      theme: (get('theme') as 'light' | 'dark') ?? currentTheme,
    })
  }, [dbSettings])

  const saveGeneralMutation = useMutation({
    mutationFn: async (v: GeneralFormValues) =>
      persistSettings({
        branchName: v.branchName,
        cashierName: v.cashierName,
        notifications: v.notifications ? 'true' : 'false',
        autoPrint: v.autoPrint ? 'true' : 'false',
        allowCashierPriceEdit: v.allowCashierPriceEdit ? 'true' : 'false',
        theme: v.theme,
      }),
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setTheme(v.theme)
      toast.success('Configuración general guardada')
    },
    onError: () => toast.error('Error al guardar'),
  })

  const autoPrintSetting = dbSettings.find((s) => s.key === 'autoPrint')?.value !== 'false'

  const toggleAutoPrintMutation = useMutation({
    mutationFn: async (nextVal: boolean) =>
      persistSettings({
        autoPrint: nextVal ? 'true' : 'false',
      }),
    onSuccess: (_, nextVal) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      generalForm.setValue('autoPrint', nextVal)
      toast.success(nextVal ? 'Impresión automática activada' : 'Impresión automática desactivada')
    },
    onError: () => toast.error('Error al cambiar configuración de impresión'),
  })

  // ─── Receipt form + live preview ──────────────────────────────────────────
  const receiptForm = useForm<ReceiptFormValues>({ defaultValues: RECEIPT_CONFIG_DEFAULTS })
  const [previewConfig, setPreviewConfig] = useState<ReceiptConfig>(RECEIPT_CONFIG_DEFAULTS)

  useEffect(() => {
    if (!dbSettings.length) return
    const get = (key: string) => dbSettings.find((s) => s.key === `receipt.${key}`)?.value
    const loaded: ReceiptConfig = {
      storeName: get('storeName') ?? RECEIPT_CONFIG_DEFAULTS.storeName,
      storeSlogan: get('storeSlogan') ?? RECEIPT_CONFIG_DEFAULTS.storeSlogan,
      storeNit: get('storeNit') ?? RECEIPT_CONFIG_DEFAULTS.storeNit,
      storeAddress: get('storeAddress') ?? RECEIPT_CONFIG_DEFAULTS.storeAddress,
      storePhone: get('storePhone') ?? RECEIPT_CONFIG_DEFAULTS.storePhone,
      footerMessage: get('footerMessage') ?? RECEIPT_CONFIG_DEFAULTS.footerMessage,
      footerNote: get('footerNote') ?? RECEIPT_CONFIG_DEFAULTS.footerNote,
      paperWidth: (get('paperWidth') as ReceiptConfig['paperWidth']) ?? RECEIPT_CONFIG_DEFAULTS.paperWidth,
      fontSize: (get('fontSize') as ReceiptConfig['fontSize']) ?? RECEIPT_CONFIG_DEFAULTS.fontSize,
      paddingH: (get('paddingH') as ReceiptConfig['paddingH']) ?? RECEIPT_CONFIG_DEFAULTS.paddingH,
      paddingV: (get('paddingV') as ReceiptConfig['paddingV']) ?? RECEIPT_CONFIG_DEFAULTS.paddingV,
      showSku: get('showSku') === 'true',
      showUnitPrice: get('showUnitPrice') !== 'false',
      showLineTotal: get('showLineTotal') !== 'false',
      separatorStyle: (get('separatorStyle') as ReceiptConfig['separatorStyle']) ?? RECEIPT_CONFIG_DEFAULTS.separatorStyle,
      autoPrint: (dbSettings.find((s) => s.key === 'autoPrint')?.value ?? get('autoPrint')) !== 'false',
    }
    receiptForm.reset(loaded)
    setPreviewConfig(loaded)
  }, [dbSettings])

  // Update preview whenever form changes
  const watchedReceipt = receiptForm.watch()
  useEffect(() => {
    setPreviewConfig((prev) => ({ ...prev, ...watchedReceipt }))
  }, [JSON.stringify(watchedReceipt)])

  const saveReceiptMutation = useMutation({
    mutationFn: async (v: ReceiptFormValues) => {
      const map: Record<string, string> = {}
      for (const [key, value] of Object.entries(v)) {
        map[`receipt.${key}`] = String(value)
      }
      return persistSettings(map)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Diseño de factura guardado')
    },
    onError: () => toast.error('Error al guardar el diseño'),
  })

  // ─── UI ───────────────────────────────────────────────────────────────────
  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition ${
      tab === t
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <button className={tabCls('general')} onClick={() => setTab('general')}>
          ⚙️ General
        </button>
        <button className={tabCls('factura')} onClick={() => setTab('factura')}>
          🧾 Diseño de Factura
        </button>
        <button className={tabCls('impresora')} onClick={() => setTab('impresora')}>
          🖨️ Impresora
        </button>
      </div>

      {/* ── General ── */}
      {tab === 'general' && (
        <SectionCard
          title="Configuración General"
          description="Preferencias operativas y visuales de la aplicación."
        >
          {settingsQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-slate-400">Cargando…</div>
          ) : (
            <form
              className="grid gap-5 md:grid-cols-2"
              onSubmit={generalForm.handleSubmit((v) => saveGeneralMutation.mutate(v))}
            >
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Sede / Sucursal
                </span>
                <input
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  {...generalForm.register('branchName')}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Caja principal
                </span>
                <input
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  {...generalForm.register('cashierName')}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Tema de Interfaz
                </span>
                <select
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  {...generalForm.register('theme')}
                >
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro</option>
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750 transition">
                <input type="checkbox" className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" {...generalForm.register('notifications')} />
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block">
                    Notificaciones
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Activar notificaciones de stock y ventas
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750 transition">
                <input type="checkbox" className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" {...generalForm.register('autoPrint')} />
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block">
                    Impresión automática
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Imprimir la factura automáticamente al cobrar en el POS
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750 transition md:col-span-2">
                <input type="checkbox" className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" {...generalForm.register('allowCashierPriceEdit')} />
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block">
                    Permitir a cajeros/vendedores modificar precio en ventas (POS)
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Permite que el personal operativo pueda modificar el precio de los productos en el ticket de venta. Si está desactivado, solo los administradores podrán cambiar precios o autorizar la modificación.
                  </span>
                </div>
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={saveGeneralMutation.isPending}
                  className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {saveGeneralMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          )}
        </SectionCard>
      )}

      {/* ── Diseño de Factura ── */}
      {tab === 'factura' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_auto]">
          {/* Form panel */}
          <form
            className="space-y-5"
            onSubmit={receiptForm.handleSubmit((v) => saveReceiptMutation.mutate(v))}
          >
            {/* ── Encabezado ── */}
            <SectionCard title="Encabezado" description="Información del establecimiento que aparece en la parte superior.">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="label-text">Nombre del Establecimiento</span>
                  <input className="setting-input" {...receiptForm.register('storeName')} />
                </label>
                <label className="block">
                  <span className="label-text">Slogan / Descripción</span>
                  <input className="setting-input" {...receiptForm.register('storeSlogan')} />
                </label>
                <label className="block">
                  <span className="label-text">NIT</span>
                  <input className="setting-input" {...receiptForm.register('storeNit')} />
                </label>
                <label className="block">
                  <span className="label-text">Teléfono</span>
                  <input className="setting-input" {...receiptForm.register('storePhone')} />
                </label>
                <label className="block md:col-span-2">
                  <span className="label-text">Dirección</span>
                  <input className="setting-input" {...receiptForm.register('storeAddress')} />
                </label>
              </div>
            </SectionCard>

            {/* ── Pie ── */}
            <SectionCard title="Pie de Factura" description="Mensajes que aparecen al final del ticket.">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="label-text">Mensaje principal</span>
                  <input className="setting-input" {...receiptForm.register('footerMessage')} />
                </label>
                <label className="block">
                  <span className="label-text">Nota secundaria</span>
                  <input className="setting-input" placeholder="Ej: No se aceptan devoluciones" {...receiptForm.register('footerNote')} />
                </label>
              </div>
            </SectionCard>

            {/* ── Layout ── */}
            <SectionCard title="Diseño y Tamaño" description="Ajusta el ancho del papel, fuente y espaciado.">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="label-text">Ancho del papel</span>
                  <select className="setting-input" {...receiptForm.register('paperWidth')}>
                    <option value="58mm">58 mm (mini)</option>
                    <option value="80mm">80 mm (estándar)</option>
                    <option value="A4">A4 (carta)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label-text">Tamaño de fuente</span>
                  <select className="setting-input" {...receiptForm.register('fontSize')}>
                    <option value="xs">Pequeña (10px)</option>
                    <option value="sm">Normal (12px)</option>
                    <option value="base">Grande (14px)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label-text">Estilo de separadores</span>
                  <select className="setting-input" {...receiptForm.register('separatorStyle')}>
                    <option value="solid">Línea sólida</option>
                    <option value="dashed">Línea punteada</option>
                    <option value="double">Línea doble</option>
                    <option value="none">Sin líneas</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label-text">Margen horizontal</span>
                  <select className="setting-input" {...receiptForm.register('paddingH')}>
                    <option value="tight">Compacto (4mm)</option>
                    <option value="normal">Normal (8mm)</option>
                    <option value="wide">Amplio (14mm)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label-text">Margen vertical</span>
                  <select className="setting-input" {...receiptForm.register('paddingV')}>
                    <option value="tight">Compacto (3mm)</option>
                    <option value="normal">Normal (6mm)</option>
                    <option value="wide">Amplio (10mm)</option>
                  </select>
                </label>
              </div>
            </SectionCard>

            {/* ── Columnas ── */}
            <SectionCard title="Columnas de la tabla" description="Elige qué columnas mostrar en los ítems de la factura.">
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input type="checkbox" className="size-4" {...receiptForm.register('showSku')} />
                  Mostrar código (SKU)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input type="checkbox" className="size-4" {...receiptForm.register('showUnitPrice')} />
                  Mostrar precio unitario
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input type="checkbox" className="size-4" {...receiptForm.register('showLineTotal')} />
                  Mostrar total por línea
                </label>
              </div>
            </SectionCard>

            <div>
              <button
                type="submit"
                disabled={saveReceiptMutation.isPending}
                className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saveReceiptMutation.isPending ? 'Guardando…' : '💾 Guardar diseño de factura'}
              </button>
            </div>
          </form>

          {/* Live preview panel */}
          <div className="sticky top-6 h-fit">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Vista previa en tiempo real
            </p>
            <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4 shadow-inner dark:border-slate-700 dark:bg-slate-900">
              <Receipt {...PREVIEW_SALE} config={previewConfig} />
            </div>
          </div>
        </div>
      )}

      {/* ── Impresora ── */}
      {tab === 'impresora' && (
        <PrinterTab
          printer={printer}
          testReceiptRef={testReceiptRef}
          previewConfig={previewConfig}
          autoPrintEnabled={autoPrintSetting}
          onToggleAutoPrint={() => toggleAutoPrintMutation.mutate(!autoPrintSetting)}
          isSavingAutoPrint={toggleAutoPrintMutation.isPending}
        />
      )}

      {/* Hidden receipt for test print */}
      <div style={{ display: 'none' }}>
        <Receipt ref={testReceiptRef} {...PREVIEW_SALE} config={previewConfig} />
      </div>

      {/* Inline styles shared by form inputs */}
      <style>{`
        .label-text { display: block; margin-bottom: 6px; font-size: 0.875rem; font-weight: 500; color: #475569; }
        .dark .label-text { color: #cbd5e1; }
        .setting-input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }
        .setting-input:focus { outline: none; border-color: #3b82f6; background: #fff; }
        .dark .setting-input { border-color: #334155; background: #1e293b; color: #f1f5f9; }
      `}</style>
    </div>
  )
}

// ─── Printer Tab Component ────────────────────────────────────────────────────
type PrinterTabProps = {
  printer: ReturnType<typeof usePrinter>
  testReceiptRef: React.RefObject<HTMLDivElement | null>
  previewConfig: ReceiptConfig
  autoPrintEnabled?: boolean
  onToggleAutoPrint?: () => void
  isSavingAutoPrint?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  disconnected: 'bg-slate-200 text-slate-600',
  connecting:   'bg-amber-100 text-amber-700',
  connected:    'bg-emerald-100 text-emerald-700',
  error:        'bg-red-100 text-red-700',
  printing:     'bg-blue-100 text-blue-700',
}
const STATUS_LABELS: Record<string, string> = {
  disconnected: '● Sin conexión',
  connecting:   '◌ Conectando…',
  connected:    '● Conectado',
  error:        '✕ Error',
  printing:     '◌ Imprimiendo…',
}

function PrinterTab({
  printer,
  testReceiptRef,
  previewConfig,
  autoPrintEnabled = true,
  onToggleAutoPrint,
  isSavingAutoPrint = false,
}: PrinterTabProps) {
  const handleBrowserPrint = useReactToPrint({
    contentRef: testReceiptRef,
    documentTitle: 'Test-Impresion-POS',
    onAfterPrint: () => toast.success('Impresión de prueba enviada'),
  })

  const handleUsbTestPrint = async () => {
    try {
      const data = {
        storeName: previewConfig.storeName,
        storeSlogan: previewConfig.storeSlogan,
        storeNit: previewConfig.storeNit,
        storeAddress: previewConfig.storeAddress,
        storePhone: previewConfig.storePhone,
        saleId: 'TEST0001',
        date: new Date().toISOString(),
        customerName: 'Cliente Prueba',
        items: [
          { name: 'Acetaminofén 500mg', quantity: 2, unitPrice: 3500, lineTotal: 7000 },
          { name: 'Ibuprofeno 400mg Caja x10', quantity: 1, unitPrice: 22000, lineTotal: 22000 },
        ],
        subtotal: 29000,
        tax: 0,
        discount: 0,
        total: 29000,
        footerMessage: previewConfig.footerMessage,
        footerNote: previewConfig.footerNote,
        charsPerLine: previewConfig.paperWidth === '58mm' ? 32 : 48,
      }
      await printer.printUsb(data)
      toast.success('Impresión de prueba enviada por USB')
    } catch (err: any) {
      toast.error(err.message ?? 'Error al imprimir')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Automatización e Impresión Automática ── */}
      <SectionCard
        title="Automatización de Impresión"
        description="Configura si el sistema debe imprimir la factura inmediatamente al cobrar."
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="space-y-0.5">
            <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              ⚡ Imprimir ticket automáticamente al cobrar
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Al confirmar y guardar una venta en el módulo POS, se enviará el ticket directamente a la impresora sin requerir confirmación manual.
            </p>
          </div>
          {onToggleAutoPrint && (
            <button
              type="button"
              role="switch"
              aria-checked={autoPrintEnabled}
              disabled={isSavingAutoPrint}
              onClick={onToggleAutoPrint}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                autoPrintEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  autoPrintEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          )}
        </div>
      </SectionCard>

      {/* ── Modo de impresión ── */}
      <SectionCard title="Modo de Impresión" description="Elige cómo se enviará la factura a la impresora.">
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => printer.setMode('browser')}
            className={`flex flex-col gap-2 rounded-xl border-2 p-5 text-left transition ${
              printer.mode === 'browser'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
            }`}
          >
            <span className="text-2xl">🌐</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">Impresión por navegador</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Usa el diálogo de impresión de Chrome/Edge. Compatible con cualquier impresora
              instalada en Windows. Recomendado para impresoras de red o USB genéricas.
            </span>
          </button>

          <button
            type="button"
            onClick={() => printer.setMode('usb')}
            className={`flex flex-col gap-2 rounded-xl border-2 p-5 text-left transition ${
              printer.mode === 'usb'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
            }`}
          >
            <span className="text-2xl">🔌</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">Impresión directa USB (ESC/POS)</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Envía comandos ESC/POS directo a la impresora térmica sin diálogo. Compatible con
              Epson, Bixolon, Sewoo y genéricas. Requiere Chrome/Edge y conexión USB.
            </span>
            {!printer.usbSupported && (
              <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                ⚠ Web USB no disponible en este navegador
              </span>
            )}
          </button>
        </div>
      </SectionCard>

      {/* ── Conexión USB ── */}
      {printer.mode === 'usb' && (
        <SectionCard title="Conexión USB" description="Vincula la impresora térmica USB directamente con el navegador.">
          <div className="flex flex-wrap items-center gap-4">
            {/* Status badge */}
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
              STATUS_COLORS[printer.status] ?? 'bg-slate-100 text-slate-600'
            }`}>
              {STATUS_LABELS[printer.status] ?? printer.status}
            </span>

            {printer.deviceName && (
              <span className="text-sm text-slate-600 dark:text-slate-300">{printer.deviceName}</span>
            )}

            {printer.status !== 'connected' ? (
              <button
                type="button"
                disabled={!printer.usbSupported || printer.status === 'connecting'}
                onClick={printer.connectUsb}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                🔌 Conectar impresora USB
              </button>
            ) : (
              <button
                type="button"
                onClick={printer.disconnect}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Desconectar
              </button>
            )}

            {printer.status === 'connected' && (
              <button
                type="button"
                onClick={handleUsbTestPrint}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
              >
                🧾 Imprimir ticket de prueba
              </button>
            )}
          </div>

          {printer.error && (
            <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {printer.error}
            </p>
          )}

          {/* Instructions */}
          <details className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              ¿Cómo conectar la impresora USB?
            </summary>
            <ol className="space-y-2 p-4 text-sm text-slate-600 dark:text-slate-400">
              <li>1. Conecta la impresora térmica al PC con el cable USB.</li>
              <li>2. Abre esta página en <strong>Chrome o Edge</strong> (versión 89 o superior).</li>
              <li>3. Haz clic en <strong>Conectar impresora USB</strong>.</li>
              <li>4. Selecciona tu impresora en el diálogo del navegador.</li>
              <li>5. Usa <strong>Imprimir ticket de prueba</strong> para verificar la conexión.</li>
              <li className="text-amber-600">⚠ La conexión USB se restablece automáticamente en cada sesión.</li>
            </ol>
          </details>
        </SectionCard>
      )}

      {/* ── Impresión por navegador ── */}
      {printer.mode === 'browser' && (
        <SectionCard title="Configuración del Navegador" description="Guía para dejar la impresora térmica como predeterminada en Windows.">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => handleBrowserPrint()}
              className="rounded-md bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              🖨️ Imprimir ticket de prueba
            </button>

            <details className="rounded-lg border border-slate-200 dark:border-slate-700">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                ¿Cómo configurar la impresora en Windows para papel de 58/80 mm?
              </summary>
              <ol className="space-y-2 p-4 text-sm text-slate-600 dark:text-slate-400">
                <li>1. Abre <strong>Panel de Control → Dispositivos e Impresoras</strong>.</li>
                <li>2. Clic derecho en tu impresora térmica → <strong>Preferencias de impresión</strong>.</li>
                <li>3. En la pestaña <em>Papel</em>, selecciona o crea un tamaño personalizado:<br />
                  &nbsp;&nbsp;• <strong>58 mm</strong>: 58 × 297 mm &nbsp;|&nbsp; <strong>80 mm</strong>: 80 × 297 mm.
                </li>
                <li>4. Guarda los cambios y <strong>configura esa impresora como predeterminada</strong>.</li>
                <li>5. Al imprimir desde el POS, selecciona <em>Sin márgenes</em> en el diálogo de Chrome.</li>
              </ol>
            </details>

            <details className="rounded-lg border border-slate-200 dark:border-slate-700">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                Configurar Chrome para imprimir sin diálogo (kiosk print)
              </summary>
              <div className="space-y-2 p-4 text-sm text-slate-600 dark:text-slate-400">
                <p>Para que Chrome imprima automáticamente sin mostrar el diálogo:</p>
                <ol className="space-y-1">
                  <li>1. Crea un acceso directo a Chrome con este parámetro:</li>
                  <li>
                    <code className="block rounded bg-slate-100 px-3 py-1 font-mono text-xs dark:bg-slate-800">
                      chrome.exe --kiosk-printing
                    </code>
                  </li>
                  <li>2. Usa ese acceso directo para abrir el POS.</li>
                  <li>3. El sistema imprimirá automáticamente al hacer clic en <em>Cobrar</em>.</li>
                </ol>
              </div>
            </details>
          </div>
        </SectionCard>
      )}

      {/* ── Compatibilidad ── */}
      <SectionCard title="Impresoras Compatibles" description="Modelos verificados con impresión directa USB (ESC/POS).">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { brand: 'Epson', models: 'TM-T20, TM-T82, TM-T88 series' },
            { brand: 'Bixolon', models: 'SRP-350, SRP-370, SRP-500' },
            { brand: 'Sam4s / Sewoo', models: 'LK-T300, LK-T312' },
            { brand: 'Star Micronics', models: 'TSP100, TSP650 series' },
            { brand: 'Genéricas', models: 'POS-58, POS-80, XP-80C' },
            { brand: 'Navegador', models: 'Cualquier impresora instalada en Windows' },
          ].map((p) => (
            <div key={p.brand} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{p.brand}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{p.models}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
