
import React, { useState, useEffect, useMemo } from 'react';
import { Booking, Sale, DaySchedule, Client } from '../types';
import { SERVICE_TYPES, PROCEDURES_BY_SERVICE, SERVICE_DURATIONS, PAYMENT_METHODS, SOURCES } from '../constants';

interface BookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (booking: Booking, downPaymentSale?: Sale) => void;
  existingBookings: Booking[];
  allSales: Sale[]; // Added to allow searching clients from sales history
  initialDate: Date | null;
  specialists: string[];
  bookingToEdit: Booking | null;
  startHour: number;
  endHour: number;
  weeklySchedule?: Record<number, DaySchedule>; // Optional for now to avoid breaking if not passed immediately
  prefillData?: { client: Client, serviceType: string, procedure: string } | null;
  initialSpecialist?: string;
  initialServiceType?: string;
}

const BookingForm: React.FC<BookingFormProps> = ({ 
    isOpen, onClose, onSave, existingBookings, allSales, initialDate, specialists, bookingToEdit, 
    startHour, endHour, weeklySchedule, prefillData, initialSpecialist, initialServiceType
}) => {
  // Mode State: 'client' or 'block'
  const [mode, setMode] = useState<'client' | 'block'>('client');

  const [specialist, setSpecialist] = useState(specialists[0] || '');
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [procedure, setProcedure] = useState('');
  const [customProcedure, setCustomProcedure] = useState('');
  
  // New state for Block Reason (mapped to procedure internally)
  const [blockReason, setBlockReason] = useState('');
  
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [endTime, setEndTime] = useState('');
  
  const [clientName, setClientName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState(SOURCES[0]);
  const [comments, setComments] = useState('');

  const [conflict, setConflict] = useState<Booking | null>(null);
  const [allowOverlap, setAllowOverlap] = useState(false);

  const [registerDownPayment, setRegisterDownPayment] = useState(false);
  const [downPaymentAmount, setDownPaymentAmount] = useState('');
  const [downPaymentMethod, setDownPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [downPaymentCode, setDownPaymentCode] = useState('');

  // Helper to format date as YYYY-MM-DD using Local Time
  const formatDateLocal = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };
  
  const resetForm = () => {
      setMode('client');
      setSpecialist(initialSpecialist || specialists[0] || '');
      setServiceType(initialServiceType || SERVICE_TYPES[0]);
      setProcedure('');
      setCustomProcedure('');
      setBlockReason('');
      
      const initialDateTime = initialDate || new Date();
      setStartDate(formatDateLocal(initialDateTime));
      
      const initialMinutes = initialDateTime.getMinutes();
      const roundedMinutes = initialMinutes < 30 ? '00' : '30';
      setStartTime(`${String(initialDateTime.getHours()).padStart(2, '0')}:${roundedMinutes}`);

      setClientName('');
      setDni('');
      setPhone('');
      setSource(SOURCES[0]);
      setComments('');
      setConflict(null);
      setAllowOverlap(false);
      setRegisterDownPayment(false);
      setDownPaymentAmount('');
      setDownPaymentMethod(PAYMENT_METHODS[0]);
      setDownPaymentCode('');
  }

  useEffect(() => {
    if (isOpen) {
        if(bookingToEdit) {
            setSpecialist(bookingToEdit.specialist);
            
            // Detect if it is a block
            if (bookingToEdit.serviceType === 'Bloqueo') {
                setMode('block');
                setBlockReason(bookingToEdit.procedure);
                setServiceType(SERVICE_TYPES[0]); // Reset standard service type just in case
            } else {
                setMode('client');
                setServiceType(bookingToEdit.serviceType);
                const proceduresForService = PROCEDURES_BY_SERVICE[bookingToEdit.serviceType] || [];
                if (proceduresForService.includes(bookingToEdit.procedure)) {
                    setProcedure(bookingToEdit.procedure);
                    setCustomProcedure('');
                } else {
                    setProcedure(serviceType === 'Otro' ? '' : 'Otro');
                    setCustomProcedure(bookingToEdit.procedure);
                }
            }
            
            const start = new Date(bookingToEdit.startTime);
            const end = new Date(bookingToEdit.endTime);
            const durationInMinutes = (end.getTime() - start.getTime()) / 60000;
            setDuration(String(durationInMinutes));

            setStartDate(formatDateLocal(start));
            setStartTime(start.toTimeString().substring(0, 5));

            setClientName(bookingToEdit.client.name);
            setDni(bookingToEdit.client.dni);
            setPhone(bookingToEdit.client.phone);
            setSource(bookingToEdit.client.source || SOURCES[0]);
            setComments(bookingToEdit.comments || '');

            if(bookingToEdit.downPayment){
                setRegisterDownPayment(true);
                setDownPaymentAmount(String(bookingToEdit.downPayment.amount));
                setDownPaymentMethod(bookingToEdit.downPayment.method);
                setDownPaymentCode(bookingToEdit.downPayment.code || '');
            } else {
                setRegisterDownPayment(false);
                setDownPaymentAmount('');
                setDownPaymentMethod(PAYMENT_METHODS[0]);
                setDownPaymentCode('');
            }

        } else if (prefillData) {
            // Apply prefill data (e.g. from Follow Up)
            resetForm();
            setMode('client');
            setClientName(prefillData.client.name);
            setDni(prefillData.client.dni);
            setPhone(prefillData.client.phone);
            setSource(prefillData.client.source || SOURCES[0]);
            
            setServiceType(prefillData.serviceType);
            setProcedure(prefillData.procedure);
            
            // Auto calc duration based on procedure
            const newDuration = SERVICE_DURATIONS[prefillData.procedure] || SERVICE_DURATIONS[prefillData.serviceType] || 60;
            setDuration(String(newDuration));
        } else {
            resetForm();
        }
    }
  }, [isOpen, initialDate, specialists, bookingToEdit, prefillData, initialSpecialist, initialServiceType]);

  useEffect(() => {
    if (mode === 'client') {
        if (serviceType) {
          const procedures = PROCEDURES_BY_SERVICE[serviceType] || [];
          const defaultProcedure = procedures.length > 0 ? procedures[0] : '';
          if (!bookingToEdit && !prefillData) { 
            setProcedure(defaultProcedure);
            const defaultDuration = SERVICE_DURATIONS[defaultProcedure] || SERVICE_DURATIONS[serviceType] || 60;
            setDuration(String(defaultDuration));
          }
        } else if (!bookingToEdit) {
          setProcedure('');
        }
        if (!bookingToEdit) {
          setCustomProcedure('');
        }
    }
  }, [serviceType, bookingToEdit, prefillData, mode]);
  
   useEffect(() => {
    if (mode === 'client' && procedure && !bookingToEdit && !prefillData) { 
      const newDuration = SERVICE_DURATIONS[procedure] || SERVICE_DURATIONS[serviceType] || 60;
      setDuration(String(newDuration));
    }
  }, [procedure, bookingToEdit, prefillData, mode]);

  useEffect(() => {
    if (startDate && startTime && duration) {
      // SAFE DATE PARSING
      const [year, month, day] = startDate.split('-').map(Number);
      const [hours, minutes] = startTime.split(':').map(Number);
      
      const startDateTime = new Date(year, month - 1, day, hours, minutes);

      if(isNaN(startDateTime.getTime())) return;

      const durationMinutes = parseInt(duration, 10) || 0;
      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
      setEndTime(endDateTime.toTimeString().substring(0, 5));

      // Check for conflicts
      const newBookingStart = startDateTime.getTime();
      const newBookingEnd = endDateTime.getTime();
      
      const conflictingBooking = existingBookings.find(b => {
        // Exclude the booking currently being edited
        if (bookingToEdit && b.id === bookingToEdit.id) return false; 

        if (b.specialist !== specialist) return false;
        const existingStart = new Date(b.startTime).getTime();
        const existingEnd = new Date(b.endTime).getTime();
        return (newBookingStart < existingEnd && newBookingEnd > existingStart);
      });
      setConflict(conflictingBooking || null);
      if (!conflictingBooking) {
          setAllowOverlap(false);
      }
    }
  }, [startDate, startTime, duration, specialist, existingBookings, bookingToEdit]);
  
  // Client Auto-Complete Logic
  useEffect(() => {
      if (mode === 'client' && !bookingToEdit && !prefillData && dni.length === 8) {
          const foundSale = allSales.find(s => s.client.dni === dni);
          if (foundSale) {
              setClientName(foundSale.client.name);
              setPhone(foundSale.client.phone);
              setSource(foundSale.client.source || SOURCES[0]);
              return;
          }
          const foundBooking = existingBookings.find(b => b.client.dni === dni);
          if (foundBooking) {
              setClientName(foundBooking.client.name);
              setPhone(foundBooking.client.phone);
              setSource(foundBooking.client.source || SOURCES[0]);
          }
      }
  }, [dni, bookingToEdit, prefillData, allSales, existingBookings, mode]);
  
  const timeOptions = useMemo(() => {
      let minStart = startHour;
      let maxEnd = endHour;

      if (weeklySchedule && startDate) {
          const [y, m, d] = startDate.split('-').map(Number);
          const date = new Date(y, m - 1, d);

          if(!isNaN(date.getTime())) {
               const dayId = date.getDay() === 0 ? 7 : date.getDay();
               const schedule = weeklySchedule[dayId];
               if (schedule && schedule.isOpen) {
                   minStart = schedule.startHour;
                   maxEnd = schedule.endHour;
               }
          }
      }

      const options = [];
      for (let h = minStart; h < maxEnd; h++) {
          options.push(`${String(h).padStart(2, '0')}:00`);
          options.push(`${String(h).padStart(2, '0')}:30`);
      }
      return options;
  }, [startHour, endHour, weeklySchedule, startDate]);

  const handleDurationChange = (amount: number) => {
    setDuration(prev => {
        const currentDuration = parseInt(prev, 10) || 0;
        const newDuration = Math.max(15, currentDuration + amount); 
        return String(newDuration);
    });
  };

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (conflict && !allowOverlap) {
        alert('Hay un conflicto de horario. Marque "OK con traslape" para continuar.');
        return;
    }
    
    // Validation based on mode
    if (mode === 'client') {
        if (dni.length !== 8 || !/^\d+$/.test(dni)) {
            alert('El DNI debe tener 8 dígitos numéricos.');
            return;
        }
        if (!clientName || !phone) {
            alert('Por favor, complete los datos del cliente.');
            return;
        }
    } else {
        if (!blockReason.trim()) {
            alert('Por favor, indique el motivo del bloqueo.');
            return;
        }
    }

    if (!duration || parseInt(duration, 10) <= 0) {
        alert('La duración debe ser un número positivo.');
        return;
    }

    // SAFE DATE CONSTRUCTION
    const [year, month, day] = startDate.split('-').map(Number);
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDateTime = new Date(year, month - 1, day, hours, minutes);
    const endDateTime = new Date(startDateTime.getTime() + parseInt(duration, 10) * 60000);
    
    // Determine Service & Procedure & Client based on mode
    let finalServiceType, finalProcedure, finalClient;

    if (mode === 'client') {
        finalServiceType = serviceType;
        finalProcedure = procedure === 'Otro' || serviceType === 'Otro' ? customProcedure : procedure;
        finalClient = { name: clientName, dni, phone, source };
    } else {
        finalServiceType = 'Bloqueo';
        finalProcedure = blockReason;
        // Dummy client for blocks to satisfy database requirements
        finalClient = { 
            name: 'BLOQUEO', 
            dni: 'BLOCK-' + Date.now().toString().slice(-4), 
            phone: '000000000', 
            source: 'Sistema' 
        };
    }
    
    const newBooking: Booking = {
        id: bookingToEdit ? bookingToEdit.id : `booking-${Date.now()}`,
        specialist,
        serviceType: finalServiceType,
        procedure: finalProcedure,
        startTime: startDateTime,
        endTime: endDateTime,
        client: finalClient,
        comments: comments.trim(),
        createdAt: bookingToEdit ? bookingToEdit.createdAt : new Date(), 
        status: bookingToEdit?.status,
        actualDuration: bookingToEdit?.actualDuration, 
        bookingCode: bookingToEdit?.bookingCode 
    };
    
    let downPaymentSale: Sale | undefined = undefined;
    if (mode === 'client' && registerDownPayment) {
        if (!downPaymentAmount || parseFloat(downPaymentAmount) <= 0) {
            alert('Por favor, ingrese un monto válido para el pago a cuenta.');
            return;
        }
        const payment: Sale['payments'][0] = {
            method: downPaymentMethod,
            code: downPaymentCode,
            amount: parseFloat(downPaymentAmount)
        };
        newBooking.downPayment = payment; 
        
        const alreadyHasPayment = bookingToEdit && bookingToEdit.downPayment;

        if (!alreadyHasPayment) {
            downPaymentSale = {
                id: `sale-${Date.now()}`,
                timestamp: new Date(), 
                client: { name: clientName, dni, phone, source: source || 'Reserva' },
                serviceType: finalServiceType,
                procedure: finalProcedure,
                payments: [payment], 
                comments: `Seña para reserva del ${startDate} ${startTime}` 
            };
        }
    }

    onSave(newBooking, downPaymentSale);
  };
  
  const procedures = PROCEDURES_BY_SERVICE[serviceType] || [];
  const isSubmitDisabled = !!conflict && !allowOverlap;
  const modalTitle = bookingToEdit ? (mode === 'block' ? "Editar Bloqueo" : "Editar Reserva") : (mode === 'block' ? "Bloquear Horario" : "Registrar Nueva Reserva");
  const submitButtonText = bookingToEdit ? "Guardar Cambios" : (mode === 'block' ? "Bloquear Horario" : "Registrar Reserva");
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <header className="flex flex-col border-b border-slate-200">
                <div className="flex justify-between items-center p-6 pb-2">
                    <h2 className="text-2xl font-bold text-slate-800">{modalTitle}</h2>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                {/* Mode Tabs */}
                <div className="flex px-6 space-x-1">
                    <button 
                        type="button"
                        onClick={() => setMode('client')} 
                        className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border-t border-l border-r border-transparent -mb-[1px] ${mode === 'client' ? 'bg-white border-slate-200 text-purple-600' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}
                    >
                        Cita Cliente
                    </button>
                    <button 
                        type="button"
                        onClick={() => setMode('block')} 
                        className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border-t border-l border-r border-transparent -mb-[1px] flex items-center ${mode === 'block' ? 'bg-white border-slate-200 text-gray-700' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Bloqueo / Otro
                    </button>
                </div>
            </header>

            <div className="overflow-y-auto flex-grow bg-slate-50/50">
                <form id="booking-form-in-modal" onSubmit={handleSubmit} className="space-y-8 p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                    <h3 className="text-xl font-semibold text-slate-800 sm:col-span-2 lg:col-span-3">Detalles de Agenda</h3>
                    
                    {bookingToEdit && bookingToEdit.bookingCode && (
                        <div className="sm:col-span-2 lg:col-span-3 bg-purple-50 border border-purple-200 p-3 rounded-lg flex items-center">
                            <span className="font-bold text-purple-800 mr-2">Código de Reserva:</span>
                            <span className="font-mono text-lg text-purple-900">{bookingToEdit.bookingCode}</span>
                        </div>
                    )}

                    <div>
                      <label htmlFor="specialist" className="block text-sm font-medium text-slate-600 mb-1">Especialista</label>
                      <select id="specialist" value={specialist} onChange={e => setSpecialist(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                        {specialists.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    {mode === 'client' ? (
                        <>
                            <div>
                            <label htmlFor="serviceTypeBooking" className="block text-sm font-medium text-slate-600 mb-1">Tipo de Servicio</label>
                            <select id="serviceTypeBooking" value={serviceType} onChange={e => setServiceType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            </div>
                            <div>
                                {serviceType !== 'Otro' && procedures.length > 0 && (
                                    <>
                                    <label htmlFor="procedureBooking" className="block text-sm font-medium text-slate-600 mb-1">Procedimiento</label>
                                    <select id="procedureBooking" value={procedure} onChange={e => setProcedure(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                        {procedures.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    </>
                                )}
                                {(procedure === 'Otro' || serviceType === 'Otro') && (
                                    <div className="mt-2">
                                        <label htmlFor="customProcedureBooking" className="block text-sm font-medium text-slate-600 mb-1">Especifique Procedimiento</label>
                                        <input type="text" id="customProcedureBooking" value={customProcedure} onChange={e => setCustomProcedure(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" required />
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="sm:col-span-2">
                            <label htmlFor="blockReason" className="block text-sm font-medium text-slate-600 mb-1">Motivo del Bloqueo</label>
                            <input 
                                type="text" 
                                id="blockReason" 
                                value={blockReason} 
                                onChange={e => setBlockReason(e.target.value)} 
                                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-gray-500 focus:border-gray-500" 
                                placeholder="Ej: Grabaciones, Almuerzo, Personal..."
                                required
                            />
                        </div>
                    )}

                    <div>
                      <label htmlFor="startDate" className="block text-sm font-medium text-slate-600 mb-1">Fecha</label>
                      <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" />
                    </div>
                    <div>
                      <label htmlFor="startTime" className="block text-sm font-medium text-slate-600 mb-1">Hora Inicio</label>
                      <select id="startTime" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                         {timeOptions.map(time => <option key={time} value={time}>{time}</option>)}
                      </select>
                    </div>
                    <div>
                        <label htmlFor="duration" className="block text-sm font-medium text-slate-600 mb-1">Duración (min)</label>
                        <div className="relative flex items-center">
                            <button type="button" onClick={() => handleDurationChange(-15)} className="absolute left-0 px-3 py-2 text-lg font-bold text-slate-600 bg-slate-200 rounded-l-md hover:bg-slate-300 h-full z-10">-</button>
                            <input 
                                type="number" 
                                id="duration" 
                                value={duration} 
                                onChange={e => setDuration(e.target.value)} 
                                min="15" 
                                step="15" 
                                className="w-full px-12 py-2 text-center border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" 
                            />
                            <button type="button" onClick={() => handleDurationChange(15)} className="absolute right-0 px-3 py-2 text-lg font-bold text-slate-600 bg-slate-200 rounded-r-md hover:bg-slate-300 h-full z-10">+</button>
                        </div>
                    </div>
                    
                    <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Hora de Fin (Estimada)</label>
                        <input type="time" value={endTime} className="w-full sm:w-1/3 px-3 py-2 border border-slate-300 rounded-md bg-slate-100" readOnly />
                    </div>

                    {conflict && (
                        <div className="sm:col-span-2 lg:col-span-3 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                            <p className="font-bold">¡Alerta de Traslape!</p>
                            <p>Este horario se cruza con <span className="font-semibold">{conflict.client.name === 'BLOQUEO' ? conflict.procedure : conflict.client.name}</span>.</p>
                            <div className="mt-2">
                                <label className="inline-flex items-center">
                                    <input type="checkbox" checked={allowOverlap} onChange={e => setAllowOverlap(e.target.checked)} className="form-checkbox h-5 w-5 text-red-600 rounded focus:ring-red-500" />
                                    <span className="ml-2">OK con traslape</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {mode === 'client' && (
                        <>
                            <h3 className="text-xl font-semibold text-slate-800 sm:col-span-2 lg:col-span-3 mt-4">Datos del Cliente</h3>
                            <div>
                                <label htmlFor="dniBooking" className="block text-sm font-medium text-slate-600 mb-1">DNI (8 dígitos)</label>
                                <input type="text" id="dniBooking" value={dni} onChange={e => setDni(e.target.value)} maxLength={8} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" required />
                            </div>
                            <div>
                            <label htmlFor="clientNameBooking" className="block text-sm font-medium text-slate-600 mb-1">Nombre del Cliente</label>
                            <input type="text" id="clientNameBooking" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" required />
                            </div>
                            <div>
                            <label htmlFor="phoneBooking" className="block text-sm font-medium text-slate-600 mb-1">Celular</label>
                            <input type="tel" id="phoneBooking" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" required />
                            </div>
                            <div>
                                <label htmlFor="sourceBooking" className="block text-sm font-medium text-slate-600 mb-1">Origen</label>
                                <select id="sourceBooking" value={source} onChange={e => setSource(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                    
                    <div className="sm:col-span-2 lg:col-span-3">
                        <label htmlFor="bookingComments" className="block text-sm font-medium text-slate-600 mb-1">Comentarios (Opcional)</label>
                        <textarea 
                            id="bookingComments"
                            value={comments}
                            onChange={e => setComments(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            placeholder={mode === 'block' ? "Detalles adicionales del bloqueo..." : "Añadir notas sobre la reserva..."}
                        ></textarea>
                    </div>

                    {mode === 'client' && (
                        <>
                            <div className="sm:col-span-2 lg:col-span-3 mt-4">
                                <label className="inline-flex items-center">
                                    <input type="checkbox" checked={registerDownPayment} onChange={e => setRegisterDownPayment(e.target.checked)} className="form-checkbox h-5 w-5 text-purple-600 rounded focus:ring-purple-500" />
                                    <span className="ml-3 text-lg font-medium text-slate-700">Registrar pago a cuenta</span>
                                </label>
                            </div>

                            {registerDownPayment && (
                                <>
                                    <div className="lg:col-start-1">
                                        <label htmlFor="downPaymentAmount" className="block text-sm font-medium text-slate-600 mb-1">Monto (S/)</label>
                                        <input type="number" id="downPaymentAmount" value={downPaymentAmount} onChange={e => setDownPaymentAmount(e.target.value)} min="0" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" required />
                                    </div>
                                    <div>
                                        <label htmlFor="downPaymentMethod" className="block text-sm font-medium text-slate-600 mb-1">Medio de Pago</label>
                                        <select id="downPaymentMethod" value={downPaymentMethod} onChange={e => setDownPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                            {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="downPaymentCode" className="block text-sm font-medium text-slate-600 mb-1">Código de Pago (Opcional)</label>
                                        <input type="text" id="downPaymentCode" value={downPaymentCode} onChange={e => setDownPaymentCode(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" />
                                    </div>
                                </>
                            )}
                        </>
                    )}
                  </div>
                </form>
            </div>
            <footer className="flex justify-end p-6 border-t border-slate-200 bg-white rounded-b-2xl">
                 <button type="button" onClick={onClose} className="px-6 py-2 mr-4 bg-transparent text-slate-700 font-semibold rounded-lg hover:bg-slate-100">
                    Cancelar
                </button>
                <button 
                    type="button" 
                    onClick={handleSubmit} 
                    disabled={isSubmitDisabled} 
                    className={`px-8 py-3 font-bold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${isSubmitDisabled ? 'bg-slate-400 cursor-not-allowed' : mode === 'block' ? 'bg-gray-700 text-white hover:bg-gray-800' : 'bg-purple-600 text-white hover:bg-purple-700 transform hover:scale-105'}`}
                >
                  {submitButtonText}
                </button>
            </footer>
        </div>
    </div>
  );
};

export default BookingForm;
