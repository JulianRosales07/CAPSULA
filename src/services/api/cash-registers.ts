import { apiClient } from './client';
import type { PaymentMethod } from './sales';

export type CashRegister = {
  id: string;
  storeId: string;
  openedByUserId: string;
  openedByName: string | null;
  closedByUserId: string | null;
  closedByName: string | null;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  salesTotal: number | null;
  cashSalesTotal: number | null;
  salesCount: number | null;
  openingNote: string | null;
  closingNote: string | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
};

export type CurrentCashRegister = CashRegister & {
  salesTotalSoFar: number;
  cashSalesTotalSoFar: number;
  transferSalesTotalSoFar?: number;
  cardSalesTotalSoFar?: number;
  pendingSalesTotalSoFar?: number;
  salesCountSoFar: number;
  salesByPaymentMethodSoFar: Record<PaymentMethod, number>;
  /** Costo de lo vendido en el turno. null si no se pudo calcular */
  cogsTotalSoFar: number | null;
  /** Utilidad del turno = ventas − costo de lo vendido */
  profitTotalSoFar: number | null;
};

/** Turno cerrado, con la rentabilidad calculada del turno */
export type ClosedCashRegister = CashRegister & {
  cogsTotal: number | null;
  profitTotal: number | null;
  byPaymentMethod: Record<PaymentMethod, number>;
};

export async function getCurrentCashRegister(): Promise<CurrentCashRegister | null> {
  const { data } = await apiClient.get<{ success: boolean; data: CurrentCashRegister | null }>(
    '/cash-registers/current',
  );
  return data.data;
}

export async function listCashRegisterHistory(): Promise<CashRegister[]> {
  const { data } = await apiClient.get<{ success: boolean; data: CashRegister[] }>(
    '/cash-registers/history',
  );
  return data.data;
}

export async function openCashRegister(input: { openingAmount: number; note?: string }): Promise<CashRegister> {
  const { data } = await apiClient.post<{ success: boolean; data: CashRegister }>(
    '/cash-registers/open',
    input,
  );
  return data.data;
}

export async function closeCashRegister(input: {
  closingAmount: number;
  note?: string;
}): Promise<ClosedCashRegister> {
  const { data } = await apiClient.post<{ success: boolean; data: ClosedCashRegister }>(
    '/cash-registers/close',
    input,
  );
  return data.data;
}
