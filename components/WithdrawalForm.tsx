
import React, { useState } from 'react';
import { Withdrawal } from '../types';

interface WithdrawalFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (withdrawal: Withdrawal) => void;
}

const WithdrawalForm: React.FC<WithdrawalFormProps> = ({ isOpen, onClose, onSave }) => {
    const [amount, setAmount] = useState('');
    const [personInCharge, setPersonInCharge] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const resetForm = () => {
        setAmount('');
        setPersonInCharge('');
        setNotes('');
        setError('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError('Por favor, ingrese un monto válido.');
            return;
        }
        if (!personInCharge.trim()) {
            setError('Por favor, ingrese la persona encargada.');
            return;
        }
        
        const newWithdrawal: Withdrawal = {
            id: `wd-${Date.now()}`,
            timestamp: new Date(),
            amount: numericAmount,
            personInCharge: personInCharge.trim(),
            notes: notes.trim(),
        };

        onSave(newWithdrawal);
        onClose();
    };
    
    const handleClose = () => {
        resetForm();
        onClose();
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={handleClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <header className="flex justify-between items-center p-6 border-b border-slate-200">
                        <h2 className="text-2xl font-bold text-slate-800">Registrar Retiro de Caja</h2>
                        <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar modal">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </header>
                    <div className="p-8 space-y-6">
                        <div>
                            <label htmlFor="withdrawalAmount" className="block text-sm font-medium text-slate-600 mb-1">Monto a Retirar (S/)</label>
                            <input
                                type="number"
                                id="withdrawalAmount"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                min="0.01"
                                step="0.01"
                                required
                                onWheel={(e) => e.currentTarget.blur()}
                            />
                        </div>
                        <div>
                            <label htmlFor="personInCharge" className="block text-sm font-medium text-slate-600 mb-1">Persona Encargada</label>
                            <input
                                type="text"
                                id="personInCharge"
                                value={personInCharge}
                                onChange={e => setPersonInCharge(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="withdrawalNotes" className="block text-sm font-medium text-slate-600 mb-1">Observaciones (Opcional)</label>
                            <textarea
                                id="withdrawalNotes"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Ej: Compra de insumos, pago de servicios, etc."
                            ></textarea>
                        </div>
                         {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
                    </div>
                    <footer className="flex flex-col sm:flex-row justify-end p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl gap-4">
                        <button type="button" onClick={handleClose} className="w-full sm:w-auto px-6 py-2 bg-transparent text-slate-700 font-semibold rounded-lg hover:bg-slate-100 order-2 sm:order-1">
                            Cancelar
                        </button>
                        <button type="submit" className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform transform hover:scale-105 order-1 sm:order-2">
                            Registrar Retiro
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default WithdrawalForm;
