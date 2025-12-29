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
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                   <span>🍦</span> Detalle del Producto Adicional
                </h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="creamAmount" className="block text-sm font-medium text-slate-600 mb-1">Monto de la Crema (S/)</label>
                        <input
                            type="number"
                            id="creamAmount"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            min="0"
                            step="0.01"
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="Monto recaudado solo por crema"
                            autoFocus
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
    if (serviceType) {
      const procedures = PROCEDURES_BY_SERVICE[serviceType] || [];
      if (!saleToEdit) setProcedure(procedures.length > 0 ? procedures[0] : '');
    }
    // No reseteamos crema automáticamente aquí para permitir venderla con cualquier servicio
  }, [serviceType]);

  const handleCreamCheckboxChange = (checked: boolean) => {
    setAddCream(checked);
    if (checked) {
        setIsCreamModalOpen(true);
    } else if (creamPayment) {
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
      if(creamPayment) {
          currentTotal -= creamPayment.amount;
          setPayments(prev => prev.filter(p => p.code !== 'CREMA'));
      }
      setCreamPayment(newCreamPayment);
      setTotalAmount((currentTotal + numericAmount).toFixed(2));
      setPayments(prev => [...prev, { ...newCreamPayment, amount: String(newCreamPayment.amount) }]);
      setIsCreamModalOpen(false);
  };

  const handlePaymentChange = (index: number, field: keyof typeof payments[0], value: string) => {
    const newPayments = [...payments];
    if(newPayments[index].code === 'CREMA') return;
    (newPayments[index] as any)[field] = value;
    setPayments(newPayments);
  };

  const removePaymentMethod = (index: number) => {
    if (payments[index].code === 'CREMA') {
        handleCreamCheckboxChange(false);
        return;
    }
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
        <CreamPaymentModal isOpen={isCreamModalOpen} onClose={() => setIsCreamModalOpen(false)} onSave={handleSaveCreamPayment} />
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <header className="flex justify-between items-center p-6 border-b border-slate-200">
                <h2 className="text-2xl font-bold text-slate-800">{saleToEdit ? "Editar Venta" : "Registrar Nueva Venta"}</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </header>
            <div className="overflow-y-auto flex-grow p-6 space-y-6">
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                    <p className="text-sm font-semibold text-slate-700">Fecha de Registro</p>
                    <p className="text-base text-purple-700 font-mono">{currentTime.toLocaleString()}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                    <div className="sm:col-span-2"><h3 className="font-bold text-slate-800">Datos Cliente</h3></div>
                    <input type="text" placeholder="DNI (8 dígitos)" value={dni} onChange={e => setDni(e.target.value)} maxLength={8} className="px-3 py-2 border border-slate-300 rounded-md" />
                    <input type="text" placeholder="Nombre Completo" value={clientName} onChange={e => setClientName(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md" />
                    <input type="tel" placeholder="Celular" value={phone} onChange={e => setPhone(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md" />
                    <select value={source} onChange={e => setSource(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md">{SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select>

                    <div className="sm:col-span-2 mt-2"><h3 className="font-bold text-slate-800">Servicio</h3></div>
                    <select value={serviceType} onChange={e => setServiceType(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md">{SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    {serviceType !== 'Otro' && <select value={procedure} onChange={e => setProcedure(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md">{(PROCEDURES_BY_SERVICE[serviceType] || []).map(p => <option key={p} value={p}>{p}</option>)}</select>}
                    {(procedure === 'Otro' || serviceType === 'Otro') && <input type="text" placeholder="Especifique procedimiento" value={customProcedure} onChange={e => setCustomProcedure(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md" />}
                    
                    {/* Opción de crema disponible para TODOS los servicios */}
                    <div className="sm:col-span-2 bg-purple-50 p-4 rounded-xl flex items-center justify-between border-2 border-purple-100 shadow-inner">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" checked={addCream} onChange={e => handleCreamCheckboxChange(e.target.checked)} className="h-6 w-6 text-purple-600 rounded border-purple-300" />
                            <div>
                                <span className="font-black text-purple-800 text-lg">¿Añadir Crema / Adicional? 🍦</span>
                                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-tighter">Este monto se registra por separado para analítica</p>
                            </div>
                        </label>
                        {creamPayment && <span className="font-black text-xl text-purple-600 bg-white px-3 py-1 rounded-lg border border-purple-200">S/ {creamPayment.amount.toFixed(2)}</span>}
                    </div>

                    <div className="sm:col-span-2 mt-4 border-t pt-4">
                        <h3 className="font-bold text-slate-800 mb-2">Monto Total de Venta (S/):</h3>
                        <input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} className="w-full text-2xl font-black px-3 py-2 border border-slate-300 rounded-md text-slate-800" />
                    </div>

                    <div className="sm:col-span-2 space-y-3">
                        <p className="text-xs font-bold text-slate-500 uppercase">Medios de Pago</p>
                        {payments.map((p, i) => (
                            <div key={i} className={`grid grid-cols-1 sm:grid-cols-4 gap-2 items-center p-2 rounded-lg relative ${p.code === 'CREMA' ? 'bg-purple-100 border border-purple-200' : 'bg-slate-50'}`}>
                                <select value={p.method} onChange={e => handlePaymentChange(i, 'method', e.target.value)} disabled={p.code === 'CREMA'} className="px-2 py-1 border border-slate-300 rounded text-xs">{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select>
                                <input type="number" value={p.amount} onChange={e => handlePaymentChange(i, 'amount', e.target.value)} disabled={p.code === 'CREMA'} className="px-2 py-1 border border-slate-300 rounded text-xs font-bold" />
                                <input type="text" placeholder="Cod. Operación" value={p.code} onChange={e => handlePaymentChange(i, 'code', e.target.value)} disabled={p.code === 'CREMA'} className="px-2 py-1 border border-slate-300 rounded text-xs sm:col-span-2" />
                                <button type="button" onClick={() => removePaymentMethod(i)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 text-xs">&times;</button>
                            </div>
                        ))}
                        <button type="button" onClick={() => setPayments([...payments, { method: PAYMENT_METHODS[0], code: '', amount: '' }])} className="text-xs font-bold text-purple-600 hover:underline">+ Añadir medio de pago</button>
                    </div>
                </div>
            </div>
            <footer className="flex justify-end p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                <button onClick={onClose} className="px-6 py-2 mr-4 text-slate-700 font-semibold">Cancelar</button>
                <button onClick={handleSubmit} className="px-8 py-3 bg-purple-600 text-white font-black rounded-lg shadow-md hover:bg-purple-700 transition-transform active:scale-95">Guardar Venta</button>
            </footer>
        </div>
    </div>
  );
};

export default SalesForm;