import { apiClient } from './client';

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'PENDING' | 'OTHER';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  PENDING: 'Pendiente de pago (Fiado)',
  OTHER: 'Otro',
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  CASH: '💵',
  CARD: '💳',
  TRANSFER: '🏦',
  PENDING: '⏳',
  OTHER: '🔄',
};

export type SaleItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
  unitFactor?: number;
  unitLabel?: string;
  productUnitId?: string;
  customName?: string;
};

export type CreateSaleInput = {
  customerId?: string;
  customerName?: string;   // Nombre libre (se guarda en notes si no hay customerId)
  notes?: string;
  tax?: number;
  discount?: number;
  paymentMethod?: PaymentMethod;
  paymentMethod2?: PaymentMethod | null;
  amountPaid1?: number | null;
  amountPaid2?: number | null;
  items: SaleItem[];
};

export type Sale = {
  id: string;
  customer_id: string | null;
  user_id: string;
  notes: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: string;
  payment_method: PaymentMethod;
  payment_method_2?: PaymentMethod | null;
  amount_paid_1?: number | null;
  amount_paid_2?: number | null;
  created_at: string;
  customers?: { full_name: string } | null;
  users?: { full_name: string } | null;
  sale_items: Array<{
    id: string;
    product_id: string;
    custom_name?: string | null;
    quantity: number;
    unit_price: number;
    /** Costo unitario (unidad base) congelado al vender. Permite calcular la utilidad de la venta */
    unit_cost?: number;
    line_total: number;
    unit_label: string;
    unit_factor: number;
    unit_quantity: number;
    products: { name: string };
  }>;
};

export async function createSale(input: CreateSaleInput): Promise<Sale> {
  const { data } = await apiClient.post<{ success: boolean; data: Sale }>('/sales', input);
  return data.data;
}

export async function listSales(userId?: string): Promise<Sale[]> {
  const { data } = await apiClient.get<{ success: boolean; data: Sale[] }>('/sales', {
    params: userId ? { userId } : undefined,
  });
  return data.data;
}

export type ReturnItemInput = {
  saleItemId: string;
  unitQuantity: number;
};

export type CreateReturnInput = {
  notes: string;
  items: ReturnItemInput[];
};

export type SaleReturnItem = {
  id: string;
  sale_item_id: string;
  product_id: string;
  quantity: number;
  unit_quantity: number;
  unit_price: number;
  line_total: number;
  products?: { name: string };
};

export type SaleReturn = {
  id: string;
  sale_id: string;
  user_id: string;
  store_id: string;
  notes: string;
  total_refund: number;
  created_at: string;
  users?: { full_name: string } | null;
  sale_return_items: SaleReturnItem[];
};

export async function createSaleReturn(saleId: string, input: CreateReturnInput): Promise<SaleReturn> {
  const { data } = await apiClient.post<{ success: boolean; data: SaleReturn }>(`/sales/${saleId}/returns`, input);
  return data.data;
}

export async function listSaleReturns(saleId: string): Promise<SaleReturn[]> {
  const { data } = await apiClient.get<{ success: boolean; data: SaleReturn[] }>(`/sales/${saleId}/returns`);
  return data.data;
}

export type PayPendingSaleInput = {
  paymentMethod: PaymentMethod;
  note?: string;
};

export async function payPendingSale(saleId: string, input: PayPendingSaleInput): Promise<Sale> {
  const { data } = await apiClient.patch<{ success: boolean; data: Sale }>(`/sales/${saleId}/pay`, input);
  return data.data;
}

