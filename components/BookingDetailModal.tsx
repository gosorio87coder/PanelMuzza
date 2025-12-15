
import React, { useState, useEffect } from 'react';
import { Booking, Sale, Payment } from '../types';
import { SERVICE_TYPE_COLORS, PAYMENT_METHODS } from '../constants';

interface BookingDetailModalProps {
  booking: Booking | null;
  onClose: () => void;
  onEdit: (booking: Booking) => void;
  onDelete: (bookingId: string) => void;
  onConfirm: (booking: Booking, actualDuration: number, finalPayment?: Sale) => void;
  onNoShow: (bookingId: string) => void;
  onReconfirm?: (bookingId: string, status: 'confirmed' | 'rejected' | null) => void; // New Prop
}

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string | React.ReactNode }> = ({ icon, label, value }) => (
    <div className="flex items-start space-x-3">
        <div className="mt-1 text-slate-400">{icon}</div>
        <div className="flex-1">
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="text-base text-slate-800">{value}</p>
        </div>
    </div>
);

const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ booking, onClose, onEdit, onDelete, onConfirm, onNoShow, onReconfirm }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1 = Duration, 2 = Payment
  
  // Step 1 State
  const [actualDuration, setActualDuration] = useState<number>(60);
  
  // Step 2 State
  const [remainingAmount, setRemainingAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [paymentCode, setPaymentCode] = useState('');
  const [addCream, setAddCream] = useState(false);
  
  useEffect(() => {
      if (booking) {
          setIsConfirming(false);
          setStep(1);
          const duration = (booking.endTime.getTime() - booking.startTime.getTime()) / 60000;
          setActualDuration(booking.actualDuration || duration);
          setRemainingAmount('');
          setPaymentMethod(PAYMENT_METHODS[0]);
          setPaymentCode('');
          setAddCream(false);
      }
  }, [booking]);

  if (!booking) return null;

  const isBlock = booking.serviceType === 'Bloqueo';
  const colors = SERVICE_TYPE_COLORS[booking.serviceType] || SERVICE_TYPE_COLORS.default;
  
  const formattedTime = (date: Date) => new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const formattedDate = (date: Date) => new Date(date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  const handleEdit = () => {
    onEdit(booking);
  };
  
  const handleDelete = () => {
    onDelete(booking.id);
  };
  
  const handleConfirmClick = () => {
      setIsConfirming(true);
      setStep(1);
  };
  
  const handleNextStep = () => {
      if (actualDuration <= 0) {
          alert("Duración inválida");
          return;
      }
      setStep(2);
  };

  const handleFinalize = () => {
      const amount = parseFloat(remainingAmount);
      
      let finalPaymentSale: Sale | undefined = undefined;

      if (!isNaN(amount) && amount > 0) {
          const payments: Payment[] = [{
              method: paymentMethod,
              code: paymentCode,
              amount: amount
          }];

          finalPaymentSale = {
              id: `sale-close-${Date.now()}`,
              timestamp: new Date(),
              client: booking.client,
              serviceType: booking.serviceType,
              procedure: booking.procedure,
              payments: payments,
              creamSold: addCream,
              comments: `Cierre Reserva #${booking.bookingCode || ''}`,
              bookingId: booking.id,
              transactionType: 'cierre'
          };
      }

      onConfirm(booking, actualDuration, finalPaymentSale);
      onClose();
  };
  
  const handleNoShow = () => {
      onNoShow(booking.id);
      onClose();
  };

  const handleWhatsAppReminder = () => {
      if (!booking.client.phone || isBlock) return;
      let phone = booking.client.phone.replace(/\D/g, '');
      if (phone.length === 9) phone = '51' + phone;
      const firstName = booking.client.name.split(' ')[0];
      const dateStr = booking.startTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      const timeStr = booking.startTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const message = `Hola ${firstName}, te escribimos de Muzza ✨. Te recordamos tu cita de ${booking.procedure} para el ${dateStr} a las ${timeStr}. Por favor confírmanos tu asistencia. ¡Te esperamos!`;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const CalendarIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>;
  const ClockIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>;
  const UserIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>;
  const TagIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
  const PaymentIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>;
  const CommentIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.08-3.242A8.92 8.92 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM4.75 9.25a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 01-.75-.75zm0 2.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>;
  
  const getStatusBadge = () => {
      switch(booking.status) {
          case 'completed': return <span className="px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide bg-green-100 text-green-800">Completada</span>;
          case 'noshow': return <span className="px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide bg-gray-200 text-gray-600 line-through">No Vino</span>;
          case 'cancelled': return <span className="px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide bg-red-100 text-red-800">Cancelada</span>;
          default: return <span className="px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide bg-yellow-100 text-yellow-800">Programada</span>;
      }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className={`flex justify-between items-center p-5 rounded-t-2xl ${colors.bg}`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full bg-white`}>
                {isBlock ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                )}
            </div>
            <div>
              <h2 className={`text-xl font-bold ${colors.text}`}>
                  {isBlock ? 'Horario Bloqueado' : (booking.bookingCode ? `Reserva #${booking.bookingCode}` : 'Detalle de la Reserva')}
              </h2>
              <p className={`text-sm ${colors.text} opacity-80`}>{booking.serviceType}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar modal">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        
        {/* Main Content */}
        {!isConfirming ? (
            <div className="overflow-y-auto flex-grow p-8 space-y-6">
                {!isBlock && (
                    <div className="flex justify-between items-center">
                        {getStatusBadge()}
                        {booking.status === 'completed' && <span className="text-xs text-slate-500">Duración Real: {booking.actualDuration} min</span>}
                    </div>
                )}

                <DetailRow icon={CalendarIcon} label="Fecha" value={formattedDate(booking.startTime)} />
                <DetailRow icon={ClockIcon} label="Horario" value={`${formattedTime(booking.startTime)} - ${formattedTime(booking.endTime)}`} />
                <DetailRow icon={TagIcon} label={isBlock ? "Motivo" : "Servicio"} value={`${booking.procedure} ${isBlock ? '' : `(con ${booking.specialist})`}`} />
                
                {isBlock ? (
                    <DetailRow icon={UserIcon} label="Responsable" value={booking.specialist} />
                ) : (
                    <DetailRow icon={UserIcon} label="Cliente" value={
                        <div className="flex flex-col">
                            <span className="font-semibold">{booking.client.name}</span>
                            <span className="text-sm text-slate-500">DNI: {booking.client.dni}</span>
                            <span className="text-sm text-slate-500">Cel: {booking.client.phone}</span>
                        </div>
                    } />
                )}

                {booking.downPayment && (
                    <DetailRow icon={PaymentIcon} label="Pago a Cuenta (Adelanto)" value={
                        <span className="font-semibold text-green-600">
                            S/ {booking.downPayment.amount.toFixed(2)}
                            <span className="text-sm font-normal text-slate-500 ml-2">({booking.downPayment.method})</span>
                        </span>
                    } />
                )}

                {/* RECONFIRMATION SECTION (Hide for Blocks) */}
                {!isBlock && booking.status === 'scheduled' && onReconfirm && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-700">Estado de Reconfirmación</h4>
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                                booking.reconfirmationStatus === 'confirmed' ? 'bg-green-100 text-green-700' :
                                booking.reconfirmationStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-gray-200 text-gray-500'
                            }`}>
                                {booking.reconfirmationStatus === 'confirmed' ? 'RECONFIRMADO' :
                                 booking.reconfirmationStatus === 'rejected' ? 'NO ASISTIRÁ / DUDOSO' :
                                 'PENDIENTE'}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => onReconfirm(booking.id, 'confirmed')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${
                                    booking.reconfirmationStatus === 'confirmed' 
                                    ? 'bg-green-600 text-white border-green-600' 
                                    : 'bg-white text-green-600 border-green-200 hover:bg-green-50'
                                }`}
                            >
                                ✓ Confirmó
                            </button>
                            <button 
                                onClick={() => onReconfirm(booking.id, 'rejected')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${
                                    booking.reconfirmationStatus === 'rejected' 
                                    ? 'bg-red-600 text-white border-red-600' 
                                    : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                }`}
                            >
                                ✕ Negativo
                            </button>
                            {booking.reconfirmationStatus && (
                                <button 
                                    onClick={() => onReconfirm(booking.id, null)}
                                    className="px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                    title="Resetear estado"
                                >
                                    ↺
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {booking.comments && (
                    <DetailRow icon={CommentIcon} label="Comentarios" value={
                        <p className="text-base text-slate-800 whitespace-pre-wrap">{booking.comments}</p>
                    } />
                )}
            </div>
        ) : (
            // CONFIRMATION FLOW (Only accessible for non-blocks)
            <div className="overflow-y-auto flex-grow p-8 space-y-6">
                {step === 1 && (
                    <div className="animate-fade-in">
                        <h4 className="text-lg font-bold text-slate-800 mb-4 text-center">Paso 1: Confirmar Tiempo</h4>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                            <label className="block text-sm font-medium text-slate-600 mb-1">Duración Real (minutos)</label>
                            <div className="flex items-center">
                                <button onClick={() => setActualDuration(prev => Math.max(15, prev - 15))} className="px-3 py-2 bg-slate-200 rounded-l-md font-bold text-slate-600">-</button>
                                <input 
                                    type="number" 
                                    value={actualDuration} 
                                    onChange={e => setActualDuration(Number(e.target.value))}
                                    className="w-full px-3 py-2 border-y border-slate-300 text-center font-bold text-lg"
                                    min="1"
                                    onWheel={(e) => e.currentTarget.blur()}
                                />
                                <button onClick={() => setActualDuration(prev => prev + 15)} className="px-3 py-2 bg-slate-200 rounded-r-md font-bold text-slate-600">+</button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 text-center">Ajuste si la atención duró más o menos.</p>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-fade-in">
                        <h4 className="text-lg font-bold text-slate-800 mb-4 text-center">Paso 2: Cierre de Pago</h4>
                        
                        {booking.downPayment && (
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-4 flex justify-between items-center">
                                <span className="text-sm text-yellow-800 font-semibold">Adelanto ya pagado:</span>
                                <span className="font-bold text-yellow-900">S/ {booking.downPayment.amount.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Monto Restante a Pagar (S/)</label>
                                <input 
                                    type="number" 
                                    value={remainingAmount} 
                                    onChange={e => setRemainingAmount(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 text-lg font-bold text-slate-800"
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    onWheel={(e) => e.currentTarget.blur()}
                                />
                                <p className="text-xs text-slate-400 mt-1">Si es 0, no se generará transacción adicional.</p>
                            </div>
                            
                            {parseFloat(remainingAmount) > 0 && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Medio de Pago</label>
                                        <select 
                                            value={paymentMethod} 
                                            onChange={e => setPaymentMethod(e.target.value)} 
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm"
                                        >
                                            {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Código Operación (Opcional)</label>
                                        <input 
                                            type="text" 
                                            value={paymentCode} 
                                            onChange={e => setPaymentCode(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm"
                                        />
                                    </div>
                                </>
                            )}

                            {booking.serviceType === 'Cejas' && (
                                <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={addCream}
                                            onChange={e => setAddCream(e.target.checked)}
                                            className="h-5 w-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                        />
                                        <span className="font-semibold text-purple-800 text-sm">¿Llevó Crema Post-Cuidado?</span>
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}
        
        <footer className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          {!isConfirming ? (
            <div className="flex flex-col gap-5">
              {/* Workflow Actions - Only for Scheduled and NON-BLOCK */}
              {!isBlock && booking.status === 'scheduled' && (
                <div className="grid grid-cols-2 sm:flex sm:justify-end gap-3 w-full">
                   <button 
                       type="button" 
                       onClick={handleWhatsAppReminder} 
                       className="col-span-1 px-4 py-2 bg-green-50 text-green-700 border border-green-200 font-bold rounded-xl hover:bg-green-100 flex items-center justify-center gap-2 transition-colors shadow-sm"
                       title="Enviar WhatsApp"
                   >
                       <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                       <span className="hidden sm:inline">WhatsApp</span>
                       <span className="sm:hidden">WS</span>
                   </button>

                   <button 
                       type="button" 
                       onClick={handleNoShow} 
                       className="col-span-1 px-4 py-2 bg-slate-100 text-slate-600 border border-slate-200 font-bold rounded-xl hover:bg-slate-200 flex items-center justify-center gap-2 transition-colors shadow-sm"
                   >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                       <span>No Vino</span>
                   </button>

                   <button 
                       type="button" 
                       onClick={handleConfirmClick} 
                       className="col-span-2 sm:col-span-1 px-6 py-2 bg-green-600 text-white font-bold rounded-xl shadow-md hover:bg-green-700 flex items-center justify-center gap-2 transition-all transform hover:scale-105"
                   >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                       <span>Confirmar Atención</span>
                   </button>
                </div>
              )}

              {/* Separator if actions were shown */}
              {!isBlock && booking.status === 'scheduled' && <hr className="border-slate-200" />}

              {/* Admin Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                <button type="button" onClick={handleDelete} className="text-red-500 font-medium hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors text-sm w-full sm:w-auto">
                    {isBlock ? 'Eliminar Bloqueo' : 'Eliminar Reserva'}
                </button>

                <div className="flex w-full sm:w-auto gap-3">
                     <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-5 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">
                        Cerrar
                    </button>
                    <button type="button" onClick={handleEdit} className="flex-1 sm:flex-none px-5 py-2 bg-purple-600 text-white font-bold rounded-xl shadow-md hover:bg-purple-700 transition-colors">
                        Editar
                    </button>
                </div>
              </div>
            </div>
          ) : (
              // Actions for Confirmation Flow (Step 1 and 2)
              // Note: Confirmation flow is never triggered for Blocks because button is hidden
              <div className="flex justify-between w-full gap-4">
                  {step === 2 && (
                      <button onClick={() => setStep(1)} className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50">
                          Atrás
                      </button>
                  )}
                  {step === 1 && (
                      <button onClick={() => setIsConfirming(false)} className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50">
                          Cancelar
                      </button>
                  )}
                  
                  {step === 1 ? (
                      <button onClick={handleNextStep} className="flex-1 px-6 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-md">
                          Siguiente: Pago
                      </button>
                  ) : (
                      <button onClick={handleFinalize} className="flex-1 px-6 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md">
                          Finalizar y Guardar
                      </button>
                  )}
              </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default BookingDetailModal;
