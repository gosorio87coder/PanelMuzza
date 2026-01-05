
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
  onReconfirm?: (bookingId: string, status: 'confirmed' | 'rejected' | null) => void; 
}

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string | React.ReactNode }> = ({ icon, label, value }) => (
    <div className="flex items-start space-x-3">
        <div className="mt-1 text-slate-400">{icon}</div>
        <div className="flex-1">
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <div className="text-base text-slate-800">{value}</div>
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
  const [creamPrice, setCreamPrice] = useState('20.00'); 
  
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
          setCreamPrice('20.00');
      }
  }, [booking]);

  if (!booking) return null;

  const isBlock = booking.serviceType === 'Bloqueo';
  const colors = SERVICE_TYPE_COLORS[booking.serviceType] || SERVICE_TYPE_COLORS.default;
  
  const formattedTime = (date: Date) => new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const formattedDate = (date: Date) => new Date(date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  const handleEdit = () => onEdit(booking);
  const handleDelete = () => onDelete(booking.id);
  const handleConfirmClick = () => { setIsConfirming(true); setStep(1); };
  const handleNextStep = () => { if (actualDuration <= 0) return; setStep(2); };

  const handleFinalize = () => {
      const mainAmount = parseFloat(remainingAmount) || 0;
      const cPrice = parseFloat(creamPrice) || 0;
      const payments: Payment[] = [];

      if (mainAmount > 0) payments.push({ method: paymentMethod, code: paymentCode, amount: mainAmount });
      if (addCream && cPrice > 0) payments.push({ method: paymentMethod, code: 'CREMA', amount: cPrice });

      let finalPaymentSale: Sale | undefined = undefined;

      if (payments.length > 0) {
          // ARREGLO CONTABLE: Usamos la fecha de la cita para el reporte financiero
          const saleDate = new Date(booking.startTime);
          
          finalPaymentSale = {
              id: `sale-close-${Date.now()}`,
              timestamp: saleDate, 
              client: booking.client,
              serviceType: booking.serviceType,
              procedure: booking.procedure,
              payments: payments,
              creamSold: addCream,
              comments: `Cierre Reserva #${booking.bookingCode || ''}${addCream ? ' + Venta Crema' : ''}`,
              bookingId: booking.id,
              transactionType: 'cierre'
          };
      }

      onConfirm(booking, actualDuration, finalPaymentSale);
      onClose();
  };
  
  const handleNoShow = () => { onNoShow(booking.id); onClose(); };

  const handleWhatsAppReminder = () => {
      if (!booking.client.phone || isBlock) return;
      let phone = booking.client.phone.replace(/\D/g, '');
      if (phone.length === 9) phone = '51' + phone;
      const firstName = booking.client.name.split(' ')[0];
      const dateStr = booking.startTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      const timeStr = booking.startTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const message = `Hola ${firstName}, te escribimos de Muzza ✨. Te recordamos tu cita de ${booking.procedure} para el ${dateStr} a las ${timeStr}. Por favor confírmanos tu asistencia. ¡Te esperamos!`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const CalendarIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>;
  const ClockIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>;
  const UserIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>;
  const TagIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
  const PaymentIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>;
  const CommentIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.08-3.242A8.92 8.92 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM4.75 9.25a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 01-.75-.75zm0 2.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className={`flex justify-between items-center p-5 rounded-t-2xl ${colors.bg}`}>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-white">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <h2 className={`text-xl font-bold ${colors.text}`}>{isBlock ? 'Horario Bloqueado' : (booking.bookingCode ? `Reserva #${booking.bookingCode}` : 'Detalle')}</h2>
              <p className={`text-xs ${colors.text} opacity-80 uppercase font-black`}>{booking.serviceType}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </header>
        
        {!isConfirming ? (
            <div className="overflow-y-auto flex-grow p-8 space-y-6">
                <div className="flex justify-between items-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${booking.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {booking.status === 'completed' ? 'Completada' : 'Programada'}
                    </span>
                    {booking.status === 'completed' && <span className="text-[10px] font-bold text-slate-400">REAL: {booking.actualDuration} MIN</span>}
                </div>

                <DetailRow icon={CalendarIcon} label="Fecha" value={formattedDate(booking.startTime)} />
                <DetailRow icon={ClockIcon} label="Horario" value={`${formattedTime(booking.startTime)} - ${formattedTime(booking.endTime)}`} />
                <DetailRow icon={TagIcon} label="Servicio" value={`${booking.procedure} (con ${booking.specialist})`} />
                
                {!isBlock && (
                    <DetailRow icon={UserIcon} label="Cliente" value={
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{booking.client.name}</span>
                            <span className="text-xs text-slate-500 font-mono">DNI: {booking.client.dni} • Cel: {booking.client.phone}</span>
                        </div>
                    } />
                )}

                {booking.downPayment && (
                    <DetailRow icon={PaymentIcon} label="Adelanto" value={
                        <span className="font-black text-green-600">S/ {booking.downPayment.amount.toFixed(2)} <span className="font-normal text-slate-400">({booking.downPayment.method})</span></span>
                    } />
                )}

                {!isBlock && booking.status === 'scheduled' && onReconfirm && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Reconfirmación</p>
                        <div className="flex gap-2">
                            <button onClick={() => onReconfirm(booking.id, 'confirmed')} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${booking.reconfirmationStatus === 'confirmed' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-600 border-green-200'}`}>✓ Confirmó</button>
                            <button onClick={() => onReconfirm(booking.id, 'rejected')} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${booking.reconfirmationStatus === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-slate-400 border-slate-200'}`}>✕ No asistirá</button>
                        </div>
                    </div>
                )}

                {booking.comments && (
                    <DetailRow icon={CommentIcon} label="Comentarios" value={<p className="text-sm italic text-slate-600">{booking.comments}</p>} />
                )}
            </div>
        ) : (
            <div className="overflow-y-auto flex-grow p-8 space-y-6 animate-fade-in">
                {step === 1 ? (
                    <div>
                        <h4 className="text-lg font-black text-slate-800 mb-4">Paso 1: ¿Cuánto tiempo duró?</h4>
                        <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100">
                            <div className="flex items-center">
                                <button onClick={() => setActualDuration(prev => Math.max(15, prev - 15))} className="w-12 h-12 bg-slate-200 rounded-xl font-black text-xl">-</button>
                                <input type="number" value={actualDuration} onChange={e => setActualDuration(Number(e.target.value))} className="flex-1 text-center text-3xl font-black bg-transparent" />
                                <button onClick={() => setActualDuration(prev => prev + 15)} className="w-12 h-12 bg-slate-200 rounded-xl font-black text-xl">+</button>
                            </div>
                            <p className="text-center text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">Minutos de atención real</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h4 className="text-lg font-black text-slate-800">Paso 2: Cobro Final</h4>
                        {booking.downPayment && <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs font-bold text-yellow-800 flex justify-between"><span>Adelanto pagado:</span> <span>S/ {booking.downPayment.amount.toFixed(2)}</span></div>}
                        
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto a Cobrar (S/)</label>
                            <input type="number" value={remainingAmount} onChange={e => setRemainingAmount(e.target.value)} className="w-full text-2xl font-black p-3 border-2 border-slate-100 rounded-xl focus:border-purple-500" placeholder="0.00" />
                        </div>
                        
                        <div className={`p-4 rounded-xl border-2 transition-all ${addCream ? 'bg-purple-50 border-purple-500' : 'bg-slate-50 border-slate-100'}`}>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={addCream} onChange={e => setAddCream(e.target.checked)} className="w-6 h-6 text-purple-600 rounded" />
                                <div><span className="font-black text-purple-800">¿Vender Crema / Adicional? 🍦</span><p className="text-[9px] font-bold text-purple-400 uppercase">Se suma al total para reportes</p></div>
                            </label>
                            {addCream && <input type="number" value={creamPrice} onChange={e => setCreamPrice(e.target.value)} className="w-full mt-3 p-2 border border-purple-200 rounded-lg font-black text-purple-700" />}
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medio de Pago</label>
                            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold">{PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                        </div>
                    </div>
                )}
            </div>
        )}
        
        <footer className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          {!isConfirming ? (
            <div className="flex flex-col gap-4">
              {booking.status === 'scheduled' && !isBlock && (
                <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2">
                   <button onClick={handleWhatsAppReminder} className="px-4 py-2 bg-white border border-slate-200 text-green-600 font-bold rounded-xl text-xs hover:bg-green-50">WhatsApp</button>
                   <button onClick={handleNoShow} className="px-4 py-2 bg-white border border-slate-200 text-slate-400 font-bold rounded-xl text-xs hover:bg-slate-100">No Vino</button>
                   <button onClick={handleConfirmClick} className="col-span-2 sm:col-span-1 px-6 py-2 bg-green-600 text-white font-black rounded-xl shadow-lg hover:bg-green-700 transition-transform active:scale-95">Confirmar Atención</button>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <button onClick={handleDelete} className="text-red-400 text-xs font-bold hover:underline">Eliminar {isBlock ? 'Bloqueo' : 'Reserva'}</button>
                <div className="flex gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 font-bold">Cerrar</button>
                    <button onClick={handleEdit} className="px-6 py-2 bg-purple-100 text-purple-700 font-black rounded-xl hover:bg-purple-200">Editar</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-between gap-3">
                <button onClick={() => step === 2 ? setStep(1) : setIsConfirming(false)} className="px-6 py-2 font-bold text-slate-400">Atrás</button>
                <button onClick={step === 1 ? handleNextStep : handleFinalize} className={`flex-1 py-3 font-black rounded-xl shadow-lg ${step === 1 ? 'bg-purple-600' : 'bg-green-600'} text-white`}>
                    {step === 1 ? 'Siguiente: Cobro' : 'Finalizar y Guardar'}
                </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default BookingDetailModal;