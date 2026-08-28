import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import {
  listReservations,
  createReservation,
  addReservationAdvance,
  cancelReservation,
  deleteReservation,
  type CourtReservation,
  type CreateReservationInput,
} from '../../../services/api/reservations';
import { listCustomers } from '../../../services/api/customers';
import { getCurrentCashRegister } from '../../../services/api/cash-registers';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../../../services/api/sales';
import { ReservationReceipt } from '../components/ReservationReceipt';
import { useReceiptConfig } from '../../../hooks/useReceiptConfig';

function money(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

function getLocalDateString(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const COMMON_COURTS = ['Cancha 1', 'Cancha 2'];

export function ReservationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const receiptConfig = useReceiptConfig();
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  // Filtros
  const [selectedFilter, setSelectedFilter] = useState<'TODAY' | 'TOMORROW' | 'WEEK' | 'ALL' | 'PENDING' | 'COMPLETED'>('TODAY');
  const [searchQuery, setSearchQuery] = useState('');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [advanceModalRes, setAdvanceModalRes] = useState<CourtReservation | null>(null);
  const [printModalRes, setPrintModalRes] = useState<CourtReservation | null>(null);

  // Queries
  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => listReservations(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: listCustomers,
  });

  const { data: currentRegister } = useQuery({
    queryKey: ['cash-register-current'],
    queryFn: getCurrentCashRegister,
  });
  const isRegisterOpen = Boolean(currentRegister);

  // Formulario de Nueva Reserva
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formSelectedCustomerId, setFormSelectedCustomerId] = useState<string | null>(null);
  const [formCourtName, setFormCourtName] = useState('Cancha 1');
  const [formDate, setFormDate] = useState(() => getLocalDateString());
  const [formStartTime, setFormStartTime] = useState('19:00');
  const [formEndTime, setFormEndTime] = useState('20:00');
  const [formTotalPrice, setFormTotalPrice] = useState('80000');
  const [formHasInitialAdvance, setFormHasInitialAdvance] = useState(true);
  const [formAdvanceAmount, setFormAdvanceAmount] = useState('30000');
  const [formAdvanceMethod, setFormAdvanceMethod] = useState<PaymentMethod>('CASH');
  const [formNotes, setFormNotes] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // Formulario de Abono Adicional
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>('CASH');
  const [advanceNotes, setAdvanceNotes] = useState('');

  // Mutaciones
  const createMutation = useMutation({
    mutationFn: createReservation,
    onSuccess: (newRes) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-pending'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register-current'] });
      toast.success('¡Reserva creada exitosamente!');
      setShowCreateModal(false);
      // Opcional abrir modal de impresión
      setPrintModalRes(newRes);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al crear la reserva');
    },
  });

  const advanceMutation = useMutation({
    mutationFn: (data: { reservationId: string; input: { amount: number; paymentMethod: string; notes?: string } }) =>
      addReservationAdvance(data.reservationId, data.input),
    onSuccess: (updatedRes) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-pending'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register-current'] });
      toast.success('¡Abono registrado en caja!');
      setAdvanceModalRes(null);
      setPrintModalRes(updatedRes);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar el abono');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-pending'] });
      toast.success('Reserva cancelada');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al cancelar');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReservation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-pending'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register-current'] });
      toast.success('Reserva eliminada correctamente');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al eliminar la reserva');
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: receiptPrintRef,
    documentTitle: `Reserva-${printModalRes?.id ? printModalRes.id.substring(0, 8) : 'Cancha'}`,
  });

  // Filtrado de reservas
  const filteredReservations = useMemo(() => {
    const todayStr = getLocalDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrow);

    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = getLocalDateString(weekEnd);

    return reservations.filter((r) => {
      // Filtro temporal / estado
      if (selectedFilter === 'TODAY' && r.reservationDate !== todayStr) return false;
      if (selectedFilter === 'TOMORROW' && r.reservationDate !== tomorrowStr) return false;
      if (selectedFilter === 'WEEK' && (r.reservationDate < todayStr || r.reservationDate > weekEndStr)) return false;
      if (selectedFilter === 'PENDING' && r.status !== 'PENDING') return false;
      if (selectedFilter === 'COMPLETED' && r.status !== 'COMPLETED') return false;

      // Filtro de búsqueda
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = r.customerName.toLowerCase().includes(query);
        const matchPhone = r.customerPhone?.toLowerCase().includes(query);
        const matchCourt = r.courtName.toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchCourt) return false;
      }

      return true;
    });
  }, [reservations, selectedFilter, searchQuery]);

  // Sugerencias de clientes
  const filteredCustomers = useMemo(() => {
    if (!formCustomerName.trim()) return [];
    const q = formCustomerName.toLowerCase();
    return customers.filter(
      (c) => c.fullName.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q) || c.document?.includes(q)
    ).slice(0, 5);
  }, [customers, formCustomerName]);

  const handleOpenCreateModal = () => {
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormSelectedCustomerId(null);
    setFormCourtName('Cancha 1');
    setFormDate(getLocalDateString());
    setFormStartTime('19:00');
    setFormEndTime('20:00');
    setFormTotalPrice('80000');
    setFormHasInitialAdvance(true);
    setFormAdvanceAmount('30000');
    setFormAdvanceMethod('CASH');
    setFormNotes('');
    setShowCreateModal(true);
  };

  const handleSaveNewReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      toast.error('Ingresa el nombre del cliente');
      return;
    }
    const total = parseFloat(formTotalPrice) || 0;
    if (total <= 0) {
      toast.error('El valor total debe ser mayor a cero');
      return;
    }

    let initialAdvance = null;
    if (formHasInitialAdvance) {
      const adv = parseFloat(formAdvanceAmount) || 0;
      if (adv > total) {
        toast.error('El abono no puede superar el total de la reserva');
        return;
      }
      if (adv > 0) {
        initialAdvance = {
          amount: adv,
          paymentMethod: formAdvanceMethod,
          notes: 'Abono inicial de reserva',
        };
      }
    }

    const payload: CreateReservationInput = {
      customerId: formSelectedCustomerId,
      customerName: formCustomerName.trim(),
      customerPhone: formCustomerPhone.trim() || undefined,
      courtName: formCourtName,
      reservationDate: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      totalPrice: total,
      notes: formNotes.trim() || undefined,
      initialAdvance,
    };

    createMutation.mutate(payload);
  };

  const handleOpenAdvanceModal = (res: CourtReservation) => {
    setAdvanceModalRes(res);
    setAdvanceAmount(String(res.pendingBalance));
    setAdvanceMethod('CASH');
    setAdvanceNotes('');
  };

  const handleSaveAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceModalRes) return;
    const amount = parseFloat(advanceAmount) || 0;
    if (amount <= 0) {
      toast.error('Ingresa un monto de abono válido');
      return;
    }
    if (amount > advanceModalRes.pendingBalance) {
      toast.error(`El monto no puede superar el saldo pendiente (${money(advanceModalRes.pendingBalance)})`);
      return;
    }

    advanceMutation.mutate({
      reservationId: advanceModalRes.id,
      input: {
        amount,
        paymentMethod: advanceMethod,
        notes: advanceNotes.trim() || undefined,
      },
    });
  };

  const handleLoadInPos = (res: CourtReservation) => {
    // Redirigir al POS y pasar la reserva en state
    navigate('/pos', { state: { loadReservation: res } });
  };

  const handleCancelReservation = (res: CourtReservation) => {
    if (confirm(`¿Estás seguro de cancelar la reserva de "${res.customerName}" para la ${res.courtName}?`)) {
      cancelMutation.mutate(res.id);
    }
  };

  const handleDeleteReservation = (res: CourtReservation) => {
    if (confirm(`¿Estás seguro de eliminar permanentemente la reserva de "${res.customerName}" para ${res.courtName}? Esta acción no se puede deshacer.`)) {
      deleteMutation.mutate(res.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>⚽</span> Reservas y Abonos de Canchas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Agenda partidos, registra anticipos en caja y liquida el saldo restante en el POS.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <span className="text-lg font-bold">+</span> Nueva Reserva
        </button>
      </div>

      {/* Barra de estado de caja */}
      {!isRegisterOpen && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <span>⚠️ La caja está cerrada. Los abonos recibidos en efectivo o transferencias se asociarán al próximo turno abierto.</span>
        </div>
      )}

      {/* Filtros y Buscador */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              ['TODAY', 'Hoy'],
              ['TOMORROW', 'Mañana'],
              ['WEEK', 'Próximos 7 días'],
              ['PENDING', 'Pendientes de pago'],
              ['COMPLETED', 'Completadas'],
              ['ALL', 'Todas'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedFilter === key
                  ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, teléfono o cancha..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Tabla de Reservas */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-slate-400">Cargando reservas...</div>
        ) : filteredReservations.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="text-4xl mb-2">📅</div>
            <p className="text-base font-medium">No se encontraron reservas</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? 'Prueba con otro término de búsqueda' : 'Crea una nueva reserva con el botón superior'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Fecha y Hora</th>
                  <th className="px-4 py-3">Cancha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Abonado</th>
                  <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReservations.map((res) => (
                  <tr
                    key={res.id}
                    className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-white capitalize">
                        {formatDate(res.reservationDate)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        ⏰ {res.startTime} – {res.endTime}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {res.courtName}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900 dark:text-white">{res.customerName}</div>
                      {res.customerPhone && (
                        <div className="text-xs text-slate-400">📞 {res.customerPhone}</div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right font-medium text-slate-900 dark:text-white whitespace-nowrap">
                      {money(res.totalPrice)}
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {res.totalAdvanced > 0 ? (
                        <div>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {money(res.totalAdvanced)}
                          </span>
                          <div className="text-[10px] text-slate-400">
                            {res.advances.length} abono(s)
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">$0</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {res.pendingBalance > 0 ? (
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {money(res.pendingBalance)}
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                          PAGADO
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {res.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          ✓ Jugada
                        </span>
                      ) : res.status === 'CANCELLED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          Cancelada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          ⏳ Pendiente
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {res.status === 'PENDING' && (
                          <>
                            {/* Botón Cargar al POS */}
                            <button
                              onClick={() => handleLoadInPos(res)}
                              title="Cargar y liquidar en el POS"
                              className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                            >
                              ⚽ POS
                            </button>

                            {/* Botón Abonar */}
                            {res.pendingBalance > 0 && (
                              <button
                                onClick={() => handleOpenAdvanceModal(res)}
                                title="Registrar nuevo abono"
                                className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                              >
                                💵 +Abono
                              </button>
                            )}
                          </>
                        )}

                        {/* Botón Imprimir Comprobante */}
                        <button
                          onClick={() => setPrintModalRes(res)}
                          title="Imprimir comprobante de reserva"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          🖨️
                        </button>

                        {/* Botón Cancelar */}
                        {res.status === 'PENDING' && (
                          <button
                            onClick={() => handleCancelReservation(res)}
                            title="Cancelar reserva"
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 dark:border-slate-700 dark:hover:bg-amber-950/40 dark:hover:text-amber-400"
                          >
                            ✕
                          </button>
                        )}

                        {/* Botón Eliminar Permanente */}
                        <button
                          onClick={() => handleDeleteReservation(res)}
                          disabled={deleteMutation.isPending}
                          title="Eliminar reserva permanentemente"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:bg-red-950/40 dark:hover:text-red-400 disabled:opacity-50"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== Modal Crear Reserva ===== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>⚽</span> Nueva Reserva de Cancha
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewReservation} className="space-y-4">
              {/* Cliente */}
              <div className="relative">
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nombre del Cliente o Equipo *
                </label>
                <input
                  type="text"
                  required
                  value={formCustomerName}
                  onChange={(e) => {
                    setFormCustomerName(e.target.value);
                    setFormSelectedCustomerId(null);
                    setShowCustomerSuggestions(true);
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  placeholder="Ej: Juan Pérez / Los Galácticos"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                {showCustomerSuggestions && filteredCustomers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                    {filteredCustomers.map((cust) => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => {
                          setFormCustomerName(cust.fullName);
                          setFormCustomerPhone(cust.phone || '');
                          setFormSelectedCustomerId(cust.id);
                          setShowCustomerSuggestions(false);
                        }}
                        className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-xs transition last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
                      >
                        <span className="font-semibold text-slate-900 dark:text-white">{cust.fullName}</span>
                        <span className="text-slate-400">{cust.phone || cust.document}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Teléfono */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Teléfono / WhatsApp (opcional)
                </label>
                <input
                  type="text"
                  value={formCustomerPhone}
                  onChange={(e) => setFormCustomerPhone(e.target.value)}
                  placeholder="Ej: 300 123 4567"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Cancha y Fecha */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Cancha *
                  </label>
                  <select
                    value={formCourtName}
                    onChange={(e) => setFormCourtName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {COMMON_COURTS.map((court) => (
                      <option key={court} value={court}>
                        {court}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Fecha del Partido *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Horario */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Hora Inicio *
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Hora Fin *
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Valor total */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Valor Total del Alquiler ($) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={formTotalPrice}
                  onChange={(e) => setFormTotalPrice(e.target.value)}
                  placeholder="80000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-bold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Sección de Abono Inicial */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <label className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formHasInitialAdvance}
                    onChange={(e) => setFormHasInitialAdvance(e.target.checked)}
                    className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Recibir abono / anticipo hoy</span>
                </label>

                {formHasInitialAdvance && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Monto del Abono ($)
                      </label>
                      <input
                        type="number"
                        value={formAdvanceAmount}
                        onChange={(e) => setFormAdvanceAmount(e.target.value)}
                        placeholder="30000"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Medio de Pago
                      </label>
                      <select
                        value={formAdvanceMethod}
                        onChange={(e) => setFormAdvanceMethod(e.target.value as PaymentMethod)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[])
                          .filter((m) => m !== 'PENDING')
                          .map((m) => (
                            <option key={m} value={m}>
                              {PAYMENT_METHOD_LABELS[m]}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Notas */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Notas / Observaciones
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ej: Balón incluido, petos verdes"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Botones */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Guardando...' : 'Crear Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal Registrar Abono Adicional ===== */}
      {advanceModalRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>💵</span> Registrar Abono a Reserva
              </h2>
              <button
                onClick={() => setAdvanceModalRes(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60 space-y-1">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-500">Cliente:</span>
                <span className="text-slate-900 dark:text-white">{advanceModalRes.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cancha:</span>
                <span className="text-slate-900 dark:text-white">{advanceModalRes.courtName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha partido:</span>
                <span className="text-slate-900 dark:text-white">{formatDate(advanceModalRes.reservationDate)} ({advanceModalRes.startTime})</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold dark:border-slate-700">
                <span className="text-slate-500">Saldo Pendiente:</span>
                <span className="text-amber-600 dark:text-amber-400 text-sm">{money(advanceModalRes.pendingBalance)}</span>
              </div>
            </div>

            <form onSubmit={handleSaveAdvance} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Monto a Abonar Hoy ($) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={advanceModalRes.pendingBalance}
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Medio de Pago *
                </label>
                <select
                  value={advanceMethod}
                  onChange={(e) => setAdvanceMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[])
                    .filter((m) => m !== 'PENDING')
                    .map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nota / Detalle
                </label>
                <input
                  type="text"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  placeholder="Ej: Abono adicional transferencia Nequi"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdvanceModalRes(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={advanceMutation.isPending}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {advanceMutation.isPending ? 'Registrando...' : 'Registrar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal Imprimir Comprobante ===== */}
      {printModalRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 overflow-hidden">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🖨️</span> Comprobante de Reserva
              </h2>
              <button
                onClick={() => setPrintModalRes(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-800 mb-4">
              <ReservationReceipt
                ref={receiptPrintRef}
                reservation={printModalRes}
                config={receiptConfig}
              />
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setPrintModalRes(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
