import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  downloadInventoryTemplate,
  parseInventoryFile,
  type ParseResult,
} from '../../../services/excel/inventoryTemplate'
import { importInventoryRows, type ImportSummary } from '../../../services/excel/importInventory'

type ImportInventoryModalProps = {
  open: boolean
  onClose: () => void
}

type Step = 'select' | 'preview' | 'importing' | 'done'

export function ImportInventoryModal({ open, onClose }: ImportInventoryModalProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('select')
  const [fileName, setFileName] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const resetState = () => {
    setStep('select')
    setFileName('')
    setParseResult(null)
    setProgress({ done: 0, total: 0 })
    setSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    try {
      const result = await parseInventoryFile(file)
      setParseResult(result)
      setStep('preview')
    } catch (error) {
      toast.error('No se pudo leer el archivo. Verifica que sea un Excel válido (.xlsx)')
    }
  }

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.rows.length === 0) return

    setProgress({ done: 0, total: parseResult.rows.length })
    setStep('importing')
    const result = await importInventoryRows(parseResult.rows, (done, total) =>
      setProgress({ done, total }),
    )
    setSummary(result)
    setStep('done')
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['categories'] })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-800">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
            Importar inventario desde Excel
          </h2>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {step === 'select' && (
            <div className="space-y-4 sm:space-y-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  1. Descarga la plantilla
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Incluye columnas de producto, categoría, costo, precio, stock y hasta 2
                  presentaciones adicionales (ej. Caja x10). Trae un ejemplo y una hoja de
                  instrucciones.
                </p>
                <button
                  type="button"
                  onClick={downloadInventoryTemplate}
                  className="mt-3 w-full sm:w-auto rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 text-center"
                >
                  ⬇️ Descargar plantilla (.xlsx)
                </button>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  2. Sube el archivo completado
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Se validará cada fila antes de importar. Podrás revisar errores antes de confirmar.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelected}
                  className="mt-3 block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300"
                />
              </div>
            </div>
          )}

          {step === 'preview' && parseResult && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Archivo: <span className="font-medium">{fileName}</span>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-500/10">
                  <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
                    {parseResult.rows.length}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Listos para importar</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-500/10">
                  <p className="text-2xl font-semibold text-red-700 dark:text-red-400">
                    {parseResult.errors.length}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">Filas con errores (se omiten)</p>
                </div>
              </div>

              {parseResult.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto overflow-x-auto rounded-lg border border-red-200 dark:border-red-800">
                  <table className="w-full min-w-[300px] text-sm">
                    <thead className="bg-red-50 dark:bg-red-500/10">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-red-700 dark:text-red-400">Fila</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-red-700 dark:text-red-400">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.errors.map((err, i) => (
                        <tr key={i} className="border-t border-red-100 dark:border-red-900">
                          <td className="px-3 py-1.5 text-red-700 dark:text-red-400">{err.rowNumber}</td>
                          <td className="px-3 py-1.5 text-red-600 dark:text-red-400">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {parseResult.rows.length > 0 && (
                <div className="max-h-48 overflow-y-auto overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">SKU</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Nombre</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Precio</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.rows.map((row) => (
                        <tr key={row.sku} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">{row.sku}</td>
                          <td className="px-3 py-1.5 text-slate-900 dark:text-white">{row.name}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600 dark:text-slate-300">
                            {row.price.toLocaleString('es-CO')}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-600 dark:text-slate-300">
                            {row.initialStock}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
              <div className="w-full max-w-xs space-y-2 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Importando {progress.done} de {progress.total} productos...
                </p>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-blue-600 transition-all duration-200"
                    style={{
                      width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}% completado
                </p>
              </div>
            </div>
          )}

          {step === 'done' && summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-500/10">
                  <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
                    {summary.created}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Productos nuevos</p>
                </div>
                {summary.updated > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-500/10">
                    <p className="text-2xl font-semibold text-blue-700 dark:text-blue-400">
                      {summary.updated}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Actualizados</p>
                  </div>
                )}
                {summary.failed > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-500/10">
                    <p className="text-2xl font-semibold text-red-700 dark:text-red-400">
                      {summary.failed}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">Fallaron</p>
                  </div>
                )}
              </div>

              {summary.failed > 0 && (
                <div className="max-h-40 overflow-y-auto overflow-x-auto rounded-lg border border-red-200 dark:border-red-800">
                  <table className="w-full min-w-[300px] text-sm">
                    <thead className="bg-red-50 dark:bg-red-500/10">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-red-700 dark:text-red-400">SKU</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-red-700 dark:text-red-400">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.outcomes
                        .filter((o) => o.status === 'error')
                        .map((o, i) => (
                          <tr key={i} className="border-t border-red-100 dark:border-red-900">
                            <td className="px-3 py-1.5 text-red-700 dark:text-red-400">{o.sku}</td>
                            <td className="px-3 py-1.5 text-red-600 dark:text-red-400">{o.message}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 border-t border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-800">
          {step === 'preview' && (
            <>
              <button
                onClick={resetState}
                className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 text-center"
              >
                Elegir otro archivo
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={parseResult?.rows.length === 0}
                className="w-full sm:w-auto rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 text-center"
              >
                Importar {parseResult?.rows.length ?? 0} productos
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              onClick={handleClose}
              className="w-full sm:w-auto rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 text-center"
            >
              Cerrar
            </button>
          )}

          {(step === 'select' || step === 'importing') && (
            <button
              onClick={handleClose}
              disabled={step === 'importing'}
              className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 text-center"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
