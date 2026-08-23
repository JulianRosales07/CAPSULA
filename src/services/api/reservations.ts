import { apiClient } from './client';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type ReservationAdvance = {
  id: string;
  storeId: string;
  reservationId: string;
  userId: string;
  userName?: string | null;
  cashRegisterId?: string | null;
  amount: number;
  paymentMethod: string;
  notes?: string | null;
  createdAt: string;
};

export type CourtReservation = {
  id: string;
  storeId: string;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  courtName: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: ReservationStatus;
  notes?: string | null;
  saleId?: string | null;
  createdByUserId: string;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  advances: ReservationAdvance[];
  totalAdvanced: number;
  pendingBalance: number;
};

export type CreateReservationInput = {
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  courtName: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  notes?: string | null;
  initialAdvance?: {
    amount: number;
    paymentMethod: string;
    notes?: string | null;
  } | null;
};

export type AddAdvanceInput = {
  amount: number;
  paymentMethod: string;
  notes?: string | null;
};

export async function listReservations(params?: {
  date?: string;
  status?: string;
  search?: string;
}): Promise<CourtReservation[]> {
  const response = await apiClient.get('/reservations', { params });
  return response.data.data;
}

export async function getReservation(id: string): Promise<CourtReservation> {
  const response = await apiClient.get(`/reservations/${id}`);
  return response.data.data;
}

export async function createReservation(input: CreateReservationInput): Promise<CourtReservation> {
  const response = await apiClient.post('/reservations', input);
  return response.data.data;
}

export async function addReservationAdvance(
  reservationId: string,
  input: AddAdvanceInput
): Promise<CourtReservation> {
  const response = await apiClient.post(`/reservations/${reservationId}/advances`, input);
  return response.data.data;
}

export async function completeReservation(
  reservationId: string,
  saleId: string
): Promise<CourtReservation> {
  const response = await apiClient.patch(`/reservations/${reservationId}/complete`, { saleId });
  return response.data.data;
}

export async function cancelReservation(reservationId: string): Promise<{ success: boolean }> {
  const response = await apiClient.patch(`/reservations/${reservationId}/cancel`);
  return response.data.data;
}

export async function deleteReservation(reservationId: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete(`/reservations/${reservationId}`);
  return response.data.data;
}
