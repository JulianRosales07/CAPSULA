import { useQuery } from '@tanstack/react-query'
import { listSettings } from '../services/api/settings'

export type ReceiptConfig = {
  // Encabezado
  storeName: string
  storeSlogan: string
  storeNit: string
  storeAddress: string
  storePhone: string
  // Pie
  footerMessage: string
  footerNote: string
  // Layout
  paperWidth: '58mm' | '80mm' | 'A4'
  fontSize: 'xs' | 'sm' | 'base'
  paddingH: 'tight' | 'normal' | 'wide'  // padding horizontal
  paddingV: 'tight' | 'normal' | 'wide'  // padding vertical
  // Columnas
  showSku: boolean
  showUnitPrice: boolean
  showLineTotal: boolean
  // Separadores
  separatorStyle: 'dashed' | 'solid' | 'double' | 'none'
  // Impresión automática
  autoPrint: boolean
}

export const RECEIPT_CONFIG_DEFAULTS: ReceiptConfig = {
  storeName: 'DROGUERÍA',
  storeSlogan: 'Sistema POS',
  storeNit: '123456789-0',
  storeAddress: '',
  storePhone: '',
  footerMessage: '¡Gracias por su compra!',
  footerNote: '',
  paperWidth: '80mm',
  fontSize: 'sm',
  paddingH: 'normal',
  paddingV: 'normal',
  showSku: false,
  showUnitPrice: true,
  showLineTotal: true,
  separatorStyle: 'solid',
  autoPrint: true,
}

const PADDING_H_MAP = { tight: '4mm', normal: '8mm', wide: '14mm' }
const PADDING_V_MAP = { tight: '3mm', normal: '6mm', wide: '10mm' }

export function getPaddingH(cfg: ReceiptConfig) {
  return PADDING_H_MAP[cfg.paddingH]
}

export function getPaddingV(cfg: ReceiptConfig) {
  return PADDING_V_MAP[cfg.paddingV]
}

/**
 * Reads receipt config keys from the backend settings table.
 * Falls back to defaults for any missing key.
 */
export function useReceiptConfig(): ReceiptConfig {
  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: listSettings,
    staleTime: 60_000,
  })

  function get(key: string): string | undefined {
    return settings.find((s) => s.key === key)?.value
  }

  return {
    storeName: get('receipt.storeName') ?? RECEIPT_CONFIG_DEFAULTS.storeName,
    storeSlogan: get('receipt.storeSlogan') ?? RECEIPT_CONFIG_DEFAULTS.storeSlogan,
    storeNit: get('receipt.storeNit') ?? RECEIPT_CONFIG_DEFAULTS.storeNit,
    storeAddress: get('receipt.storeAddress') ?? RECEIPT_CONFIG_DEFAULTS.storeAddress,
    storePhone: get('receipt.storePhone') ?? RECEIPT_CONFIG_DEFAULTS.storePhone,
    footerMessage: get('receipt.footerMessage') ?? RECEIPT_CONFIG_DEFAULTS.footerMessage,
    footerNote: get('receipt.footerNote') ?? RECEIPT_CONFIG_DEFAULTS.footerNote,
    paperWidth: (get('receipt.paperWidth') as ReceiptConfig['paperWidth']) ?? RECEIPT_CONFIG_DEFAULTS.paperWidth,
    fontSize: (get('receipt.fontSize') as ReceiptConfig['fontSize']) ?? RECEIPT_CONFIG_DEFAULTS.fontSize,
    paddingH: (get('receipt.paddingH') as ReceiptConfig['paddingH']) ?? RECEIPT_CONFIG_DEFAULTS.paddingH,
    paddingV: (get('receipt.paddingV') as ReceiptConfig['paddingV']) ?? RECEIPT_CONFIG_DEFAULTS.paddingV,
    showSku: get('receipt.showSku') === 'true' ? true : get('receipt.showSku') === 'false' ? false : RECEIPT_CONFIG_DEFAULTS.showSku,
    showUnitPrice: get('receipt.showUnitPrice') === 'false' ? false : RECEIPT_CONFIG_DEFAULTS.showUnitPrice,
    showLineTotal: get('receipt.showLineTotal') === 'false' ? false : RECEIPT_CONFIG_DEFAULTS.showLineTotal,
    separatorStyle: (get('receipt.separatorStyle') as ReceiptConfig['separatorStyle']) ?? RECEIPT_CONFIG_DEFAULTS.separatorStyle,
    autoPrint: (get('autoPrint') ?? get('receipt.autoPrint')) !== 'false',
  }
}
