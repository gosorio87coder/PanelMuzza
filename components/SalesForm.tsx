import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Payment } from '../types';
import { SOURCES, PAYMENT_METHODS, SERVICE_TYPES, PROCEDURES_BY_SERVICE } from '../constants';

interface SalesFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sale: Sale) => void;
  saleToEdit: Sale | null;
  allSales: Sale[];
}

const CreamPaymentModal = ({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (amount: string, method: string) => void }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState(PAYMENT_METHODS[0]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!amount || parseFloat(amount) <= 0) {
            alert('Por favor, ingrese un monto válido para la crema.');
            return;
        }
        onSave(amount, method);
        setAmount('');
        setMethod(PAYMENT_METHODS[0]);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-800 mb-4">Detalles de la Crema</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="creamAmount" className="block text-sm font-medium text-slate-600 mb-1">Monto (S/)</label>
                        <input
                            type="number"
                            id="creamAmount"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            min="0"
                            step="0.01"
                        />
                    </div>
                    <div>
                        <label htmlFor="creamPaymentMethod" className="block text-sm font-medium text-slate-600 mb-1">Medio de Pago</label>
                        <select
                            id="creamPaymentMethod"
                            value={method}
                            onChange={e => setMethod(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                        >
                            {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-transparent text-slate-700 font-semibold rounded-lg hover:bg-slate-100">Cancelar</button>
                    <button type="button" onClick={handleSave} className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700">Aceptar</button>
                </div>
            </div>
        </div>
    );
};


const SalesForm: React.FC<SalesFormProps> = ({ isOpen, onClose, onSave, saleToEdit, allSales }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [clientName, setClientName] = useState('');
  const [dni, setDni] = useState('');
  const [source, setSource] = useState(SOURCES[0]);
  const [phone, setPhone] = useState('');
  
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [procedure, setProcedure] = useState('');
  const [customProcedure, setCustomProcedure] = useState('');
  
  const [totalAmount, setTotalAmount] = useState('');
  // FIX: Changed the type of `payments` state to be an array of payment objects.
  const [payments, setPayments] = useState<(Omit<Payment, 'amount'> & { amount: string })[]>([{ method: PAYMENT_METHODS[0], code: '', amount: '' }]);
  
  const [comments, setComments] = useState('');
  const [addCream, setAddCream] = useState(false);
  const [isCreamModalOpen, setIsCreamModalOpen] = useState(false);
  const [creamPayment, setCreamPayment] = useState<Payment | null>(null);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setCurrentTime(new Date());
    setClientName('');
    setDni('');
    setSource(SOURCES[0]);
    setPhone('');
    setServiceType(SERVICE_TYPES[0]);
    setProcedure('');
    setCustomProcedure('');
    setTotalAmount('');
    setPayments([{ method: PAYMENT_METHODS[0], code: '', amount: '' }]);
    setComments('');
    setAddCream(false);
    setCreamPayment(null);
    setErrors({});
  };

  useEffect(() => {
    if (isOpen) {
        if (saleToEdit) {
            setCurrentTime(new Date(saleToEdit.timestamp));
            setClientName(saleToEdit.client.name);
            setDni(saleToEdit.client.dni);
            setPhone(saleToEdit.client.phone);
            setSource(saleToEdit.client.source);
            setServiceType(saleToEdit.serviceType);

            const proceduresForService = PROCEDURES_BY_SERVICE[saleToEdit.serviceType] || [];
            if (proceduresForService.includes(saleToEdit.procedure)) {
                setProcedure(saleToEdit.procedure);
                setCustomProcedure('');
            } else {
                setProcedure(serviceType === 'Otro' ? '' : 'Otro');
                setCustomProcedure(saleToEdit.procedure);
            }

            const total = saleToEdit.payments.reduce((sum, p) => sum + p.amount, 0);
            setTotalAmount(String(total.toFixed(2)));

            if (saleToEdit.creamSold) {
                setAddCream(true);
                const creamPay = saleToEdit.payments.find(p => p.code === 'CREMA');
                setCreamPayment(creamPay || null);
            } else {
                setAddCream(false);
                setCreamPayment(null);
            }

            setPayments(saleToEdit.payments.map(p => ({ ...p, amount: String(p.amount) })));
            setComments(saleToEdit.comments || '');
        } else {
            resetForm();
        }
    }
  }, [saleToEdit, isOpen]);


  useEffect(() => {
    if (isOpen && !saleToEdit) {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }
  }, [isOpen, saleToEdit]);

  useEffect(() => {
    if (serviceType) {
      const procedures = PROCEDURES_BY_SERVICE[serviceType] || [];
      // Only reset procedure if not in edit mode
      if (!saleToEdit) {
        setProcedure(procedures.length > 0 ? procedures[0] : '');
      }
    } else {
      if (!saleToEdit) {
        setProcedure('');
      }
    }
    if (serviceType !== 'Cejas') {
        handleCreamCheckboxChange(false);
    }
    if (!saleToEdit) {
        setCustomProcedure('');
    }
  }, [serviceType, saleToEdit]);

  useEffect(() => {
    if (dni.length === 8 && allSales.length > 0 && !saleToEdit) {
      const existingSale = [...allSales].reverse().find(sale => sale.client.dni === dni);
      if (existingSale) {
          setClientName(existingSale.client.name);
          setPhone(existingSale.client.phone);
          setSource(existingSale.client.source);
      }
    }
  }, [dni, allSales, saleToEdit]);
  
  const handleCreamCheckboxChange = (checked: boolean) => {
    setAddCream(checked);
    if (checked) {
        setIsCreamModalOpen(true);
    } else if (creamPayment) {
        // Remove cream payment from total and payments list
        const numericTotal = parseFloat(totalAmount) || 0;
        setTotalAmount((numericTotal - creamPayment.amount).toFixed(2));
        setPayments(prev => prev.filter(p => p.code !== 'CREMA'));
        setCreamPayment(null);
    }
  };
  
  const handleSaveCreamPayment = (amount: string, method: string) => {
      const numericAmount = parseFloat(amount);
      const newCreamPayment = { amount: numericAmount, method, code: 'CREMA' };
      
      let currentTotal = parseFloat(totalAmount) || 0;

      // Remove old cream payment if it exists
      if(creamPayment) {
          currentTotal -= creamPayment.amount;
          setPayments(prev => prev.filter(p => p.code !== 'CREMA'));
      }

      setCreamPayment(newCreamPayment);
      setTotalAmount((currentTotal + numericAmount).toFixed(2));
      setPayments(prev => [...prev, { ...newCreamPayment, amount: String(newCreamPayment.amount) }]);
      setIsCreamModalOpen(false);
  };
  
  const handleCloseCreamModal = () => {
    if (!creamPayment) {
        setAddCream(false); // Uncheck box if modal is cancelled without saving
    }
    setIsCreamModalOpen(false);
  }

  const paymentsSum = useMemo(() => {
    return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [payments]);

  const handlePaymentChange = (index: number, field: keyof typeof payments[0], value: string) => {
    const newPayments = [...payments];
    const paymentToUpdate = newPayments[index];
    
    // Prevent editing the special cream payment
    if(paymentToUpdate.code === 'CREMA') return;

    (paymentToUpdate as any)[field] = value;
    setPayments(newPayments);
  };

  const addPaymentMethod = () => {
    setPayments([...payments, { method: PAYMENT_METHODS[0], code: '', amount: '' }]);
  };

  const removePaymentMethod = (index: number) => {
    const paymentToRemove = payments[index];
    if (paymentToRemove.code === 'CREMA') {
        handleCreamCheckboxChange(false); // Use the dedicated function to remove cream
        return;
    }
    const newPayments = payments.filter((_, i) => i !== index);
    setPayments(newPayments);
  };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (dni.length !== 8 || !/^\d+$/.test(dni)) {
            newErrors.dni = 'El DNI debe tener 8 dígitos numéricos.';
        }
        if (!clientName.trim()) {
            newErrors.clientName = 'El nombre del cliente es requerido.';
        }
        if (!phone.trim()) {
            newErrors.phone = 'El celular es requerido.';
        }
        if (!totalAmount.trim() || parseFloat(totalAmount) <= 0) {
            newErrors.totalAmount = 'El monto total es requerido y debe ser mayor a 0.';
        }
        if ((procedure === 'Otro' || serviceType === 'Otro') && !customProcedure.trim()) {
            newErrors.customProcedure = 'Debe especificar el procedimiento.';
        }
        
        const numericTotalAmount = parseFloat(totalAmount) || 0;
        if (numericTotalAmount > 0 && Math.abs(paymentsSum - numericTotalAmount) > 0.01) {
            newErrors.payments = `La suma de los pagos (S/ ${paymentsSum.toFixed(2)}) no coincide con el Monto Total (S/ ${numericTotalAmount.toFixed(2)}).`;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
        return;
    }

    const finalProcedure = procedure === 'Otro' || serviceType === 'Otro' ? customProcedure : procedure;
    
    const saleData: Sale = {
      id: saleToEdit ? saleToEdit.id : `sale-${Date.now()}`,
      timestamp: saleToEdit ? new Date(saleToEdit.timestamp) : new Date(),
      client: { name: clientName, dni, phone, source },
      serviceType,
      procedure: finalProcedure,
      payments: payments.map(p => ({ ...p, amount: parseFloat(p.amount) || 0 })).filter(p => p.amount > 0),
      creamSold: addCream,
      comments,
    };
    onSave(saleData);
    onClose();
  };
  
  const procedures = PROCEDURES_BY_SERVICE[serviceType] || [];
  const modalTitle = saleToEdit ? "Editar Venta" : "Registrar Nueva Venta";
  const submitButtonText = saleToEdit ? "Guardar Cambios" : "Registrar Venta";
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <CreamPaymentModal isOpen={isCreamModalOpen} onClose={handleCloseCreamModal} onSave={handleSaveCreamPayment} />
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <header className="flex justify-between items-center p-6 border-b border-slate-200">
                <h2 id="modal-title" className="text-2xl font-bold text-slate-800">{modalTitle}</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar modal">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </header>
            <div className="overflow-y-auto flex-grow">
                <form id="sales-form-in-modal" onSubmit={handleSubmit} className="space-y-6 p-6">
                    <div className="p-3 bg-slate-50 rounded-lg text-center">
                        <p className="text-sm font-semibold text-slate-700">Fecha y Hora de Registro</p>
                        <p className="text-base text-purple-700 font-mono">{currentTime.toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                        <h3 className="text-lg font-semibold text-slate-800 sm:col-span-2">Datos del Cliente</h3>
                        <div>
                        <label htmlFor="dni" className="block text-sm font-medium text-slate-600 mb-1">DNI (8 dígitos)</label>
                        <input type="text" id="dni" value={dni} onChange={e => setDni(e.target.value)} maxLength={8} className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 ${!!saleToEdit ? 'bg-slate-100' : ''} ${errors.dni ? 'border-red-500' : 'border-slate-300'}`} disabled={!!saleToEdit} />
                         {errors.dni && <p className="text-red-500 text-xs mt-1">{errors.dni}</p>}
                        </div>
                        <div>
                        <label htmlFor="clientName" className="block text-sm font-medium text-slate-600 mb-1">Nombre del Cliente</label>
                        <input type="text" id="clientName" value={clientName} onChange={e => setClientName(e.target.value)} className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 ${errors.clientName ? 'border-red-500' : 'border-slate-300'}`} />
                         {errors.clientName && <p className="text-red-500 text-xs mt-1">{errors.clientName}</p>}
                        </div>
                        <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-slate-600 mb-1">Celular</label>
                        <input type="tel" id="phone" value={phone} onChange={e => setPhone(e.target.value)} className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 ${errors.phone ? 'border-red-500' : 'border-slate-300'}`} />
                         {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                        </div>
                        <div>
                        <label htmlFor="source" className="block text-sm font-medium text-slate-600 mb-1">Origen</label>
                        <select id="source" value={source} onChange={e => setSource(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        </div>

                        <h3 className="text-lg font-semibold text-slate-800 sm:col-span-2 mt-2">Detalles del Servicio</h3>
                        <div>
                        <label htmlFor="serviceType" className="block text-sm font-medium text-slate-600 mb-1">Tipo de Servicio</label>
                        <select id="serviceType" value={serviceType} onChange={e => setServiceType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                            {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        </div>
                        <div>
                            {serviceType !== 'Otro' && procedures.length > 0 && (
                                <>
                                <label htmlFor="procedure" className="block text-sm font-medium text-slate-600 mb-1">Procedimiento</label>
                                <select id="procedure" value={procedure} onChange={e => setProcedure(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                    {procedures.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                </>
                            )}
                            {(procedure === 'Otro' || serviceType === 'Otro') && (
                                <div className="mt-2">
                                    <label htmlFor="customProcedure" className="block text-sm font-medium text-slate-600 mb-1">Especifique Procedimiento</label>
                                    <input type="text" id="customProcedure" value={customProcedure} onChange={e => setCustomProcedure(e.target.value)} className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 ${errors.customProcedure ? 'border-red-500' : 'border-slate-300'}`} />
                                     {errors.customProcedure && <p className="text-red-500 text-xs mt-1">{errors.customProcedure}</p>}
                                </div>
                            )}
                        </div>
                        
                        {serviceType === 'Cejas' && (
                            <div className="sm:col-span-2 bg-slate-50 p-3 rounded-lg">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={addCream}
                                        onChange={e => handleCreamCheckboxChange(e.target.checked)}
                                        className="h-5 w-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="font-semibold text-slate-700">Añadir Crema Post-Cuidado</span>
                                </label>
                            </div>
                        )}


                        <div className="sm:col-span-2 mt-2 border-t pt-5">
                            <h3 className="text-lg font-semibold text-slate-800">Información de Pago</h3>
                        </div>

                        <div className="sm:col-span-2">
                            <label htmlFor="totalAmount" className="block text-sm font-medium text-slate-600 mb-1">Monto Total de Venta (S/)</label>
                            <input type="number" id="totalAmount" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} min="0" step="0.01" className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 ${errors.totalAmount ? 'border-red-500' : 'border-slate-300'}`} />
                             {errors.totalAmount && <p className="text-red-500 text-xs mt-1">{errors.totalAmount}</p>}
                        </div>

                        {payments.map((payment, index) => (
                          <React.Fragment key={index}>
                            <div className={`sm:col-span-2 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end p-3 rounded-lg relative ${payment.code === 'CREMA' ? 'bg-purple-50 border border-purple-200' : 'bg-slate-50'}`}>
                                <div className="sm:col-span-1">
                                    <label htmlFor={`paymentMethod-${index}`} className="block text-sm font-medium text-slate-600 mb-1">Medio de Pago {index + 1} {payment.code === 'CREMA' && '(Crema)'}</label>
                                    <select id={`paymentMethod-${index}`} value={payment.method} onChange={e => handlePaymentChange(index, 'method', e.target.value)} disabled={payment.code === 'CREMA'} className={`w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 ${payment.code === 'CREMA' ? 'bg-slate-200' : ''}`}>
                                        {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="sm:col-span-1">
                                    <label htmlFor={`amount-${index}`} className="block text-sm font-medium text-slate-600 mb-1">Monto (S/)</label>
                                    <input type="number" id={`amount-${index}`} value={payment.amount} onChange={e => handlePaymentChange(index, 'amount', e.target.value)} disabled={payment.code === 'CREMA'} min="0" step="0.01" className={`w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 ${payment.code === 'CREMA' ? 'bg-slate-200' : ''}`} required />
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor={`paymentCode-${index}`} className="block text-sm font-medium text-slate-600 mb-1">Código de Pago (Opcional)</label>
                                    <input type="text" id={`paymentCode-${index}`} value={payment.code} onChange={e => handlePaymentChange(index, 'code', e.target.value)} disabled={payment.code === 'CREMA'} className={`w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 ${payment.code === 'CREMA' ? 'bg-slate-200' : ''}`} />
                                </div>
                                
                                {/* Mobile Friendly Delete Button: Inside the box on small screens, absolute right on large */}
                                <button 
                                    type="button" 
                                    onClick={() => removePaymentMethod(index)} 
                                    className="absolute top-0 right-0 m-2 sm:-top-2 sm:-right-2 sm:m-0 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center hover:bg-red-600 shadow-sm z-10" 
                                    aria-label="Eliminar medio de pago"
                                >
                                    &times;
                                </button>
                                
                            </div>
                          </React.Fragment>
                        ))}
                         <div className="sm:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <button type="button" onClick={addPaymentMethod} className="text-sm font-semibold text-purple-600 hover:text-purple-800 flex items-center">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                Añadir Medio de Pago
                            </button>
                            <div className="text-right">
                                <span className="text-sm text-slate-600">Suma de Pagos: </span>
                                <span className={`font-bold text-lg ${errors.payments ? 'text-red-600' : 'text-green-600'}`}>
                                    S/ {paymentsSum.toFixed(2)}
                                </span>
                            </div>
                        </div>
                        {errors.payments && <p className="text-red-500 text-xs text-right sm:col-span-2">{errors.payments}</p>}

                        <div className="sm:col-span-2 mt-2">
                            <label htmlFor="comments" className="block text-sm font-medium text-slate-600 mb-1">Comentarios</label>
                            <textarea id="comments" value={comments} onChange={e => setComments(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" placeholder="Añadir notas o comentarios sobre la venta..."></textarea>
                        </div>
                    </div>
                </form>
            </div>
            <footer className="flex flex-col sm:flex-row justify-end p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl gap-4">
                <button type="button" onClick={onClose} className="w-full sm:w-auto px-6 py-2 bg-transparent text-slate-700 font-semibold rounded-lg hover:bg-slate-100 order-2 sm:order-1">
                    Cancelar
                </button>
                <button type="submit" form="sales-form-in-modal" className="w-full sm:w-auto px-8 py-3 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-transform transform hover:scale-105 order-1 sm:order-2">
                    {submitButtonText}
                </button>
            </footer>
        </div>
    </div>
  );
};

export default SalesForm;