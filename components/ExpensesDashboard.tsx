
import React, { useState, useMemo } from 'react';
import { Expense } from '../types';

declare const XLSX: any;

interface ExpensesDashboardProps {
    expenses: Expense[];
    onAddExpense: (expense: Expense) => Promise<void>; // Async
    onDeleteExpense: (id: string) => Promise<void>; // Async
    expenseCategories: Record<string, string[]>;
    onUpdateCategories: (categories: Record<string, string[]>) => Promise<void>; // Async
}

const ExpensesDashboard: React.FC<ExpensesDashboardProps> = ({ 
    expenses, 
    onAddExpense, 
    onDeleteExpense,
    expenseCategories,
    onUpdateCategories
}) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    const [activeTab, setActiveTab] = useState<'register' | 'config'>('register');
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(currentMonth);

    // Form State
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState(Object.keys(expenseCategories)[0] || '');
    const [subcategory, setSubcategory] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Category Config State
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newSubcategoryName, setNewSubcategoryName] = useState('');
    const [targetCategoryForSub, setTargetCategoryForSub] = useState(Object.keys(expenseCategories)[0] || '');

    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const YEARS = Array.from({length: 5}, (_, i) => currentYear - i);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const d = new Date(e.timestamp);
            return d.getFullYear() === year && d.getMonth() === month;
        }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [expenses, year, month]);

    const totalExpenses = useMemo(() => {
        return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    }, [filteredExpenses]);

    const expensesByCategory = useMemo(() => {
        const grouped: Record<string, number> = {};
        filteredExpenses.forEach(e => {
            grouped[e.category] = (grouped[e.category] || 0) + e.amount;
        });
        return grouped;
    }, [filteredExpenses]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || parseFloat(amount) <= 0) {
            alert("Ingrese un monto válido");
            return;
        }
        if (!category) {
            alert("Seleccione una partida (categoría)");
            return;
        }

        const newExpense: Expense = {
            id: `exp-temp-${Date.now()}`, // Temporary ID, backend generates real one
            timestamp: new Date(date + 'T12:00:00'), // midday to avoid timezone shifts
            amount: parseFloat(amount),
            category,
            subcategory,
            description
        };

        await onAddExpense(newExpense);
        
        // Reset form
        setAmount('');
        setDescription('');
    };

    const handleAddCategory = async () => {
        if(!newCategoryName.trim()) return;
        if(expenseCategories[newCategoryName]) {
            alert("Esta partida ya existe.");
            return;
        }
        await onUpdateCategories({
            ...expenseCategories,
            [newCategoryName]: []
        });
        setNewCategoryName('');
    };

    const handleAddSubcategory = async () => {
        if(!newSubcategoryName.trim() || !targetCategoryForSub) return;
        const currentSubs = expenseCategories[targetCategoryForSub] || [];
        if(currentSubs.includes(newSubcategoryName)) return;

        await onUpdateCategories({
            ...expenseCategories,
            [targetCategoryForSub]: [...currentSubs, newSubcategoryName]
        });
        setNewSubcategoryName('');
    };

    const handleDownload = () => {
        const dataToExport = filteredExpenses.map(e => ({
            'Fecha': new Date(e.timestamp).toLocaleDateString('es-ES'),
            'Categoría': e.category,
            'Subcategoría': e.subcategory,
            'Descripción': e.description,
            'Monto': e.amount
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Gastos');
        
        const objectMaxLength = Object.keys(dataToExport[0] || {}).map(key => ({
            wch: Math.max(...dataToExport.map(row => (row[key as keyof typeof row] || '').toString().length), key.length) + 2
        }));
        worksheet['!cols'] = objectMaxLength;

        XLSX.writeFile(workbook, `Gastos_${MONTHS[month]}_${year}.xlsx`);
    }

    return (
        <div className="space-y-6">
            {/* Header with Month/Year Filter */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-lg gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Control de Gastos</h2>
                <div className="flex gap-2">
                    <button 
                        onClick={handleDownload}
                        className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center space-x-2 mr-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        <span>Descargar Reporte</span>
                    </button>
                    <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 border border-slate-300 rounded-lg">
                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border border-slate-300 rounded-lg">
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex space-x-1 bg-slate-200 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('register')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'register' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}
                >
                    Registro & Reporte
                </button>
                <button
                    onClick={() => setActiveTab('config')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}
                >
                    Configurar Partidas
                </button>
            </div>

            {activeTab === 'register' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Form */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-lg">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">Registrar Nuevo Gasto</h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Partida (Categoría)</label>
                                    <select value={category} onChange={e => { setCategory(e.target.value); setSubcategory(''); }} className="w-full border-slate-300 rounded-md shadow-sm">
                                        {Object.keys(expenseCategories).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Detalle (Subcategoría)</label>
                                    <select value={subcategory} onChange={e => setSubcategory(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm" disabled={!category}>
                                        <option value="">Seleccione...</option>
                                        {(expenseCategories[category] || []).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto (S/)</label>
                                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm" placeholder="0.00" step="0.01" min="0" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción (Opcional)</label>
                                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full border-slate-300 rounded-md shadow-sm" placeholder="Ej: Pago de luz del mes" />
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors">
                                    Guardar Gasto
                                </button>
                            </form>
                        </div>

                        {/* Mini Summary Card */}
                        <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg">
                            <p className="text-sm font-medium opacity-80">Total Gastos ({MONTHS[month]})</p>
                            <p className="text-3xl font-bold mt-2">S/ {totalExpenses.toFixed(2)}</p>
                        </div>
                    </div>

                    {/* List & Summary */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Summary by Category */}
                        <div className="bg-white p-6 rounded-xl shadow-lg">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">Resumen por Partidas</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {Object.entries(expensesByCategory).map(([cat, total]) => (
                                    <div key={cat} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-xs font-bold text-slate-500 uppercase">{cat}</p>
                                        <p className="text-lg font-mono font-semibold text-slate-800">S/ {(total as number).toFixed(2)}</p>
                                    </div>
                                ))}
                                {Object.keys(expensesByCategory).length === 0 && <p className="text-slate-400 text-sm italic">Sin gastos registrados.</p>}
                            </div>
                        </div>

                        {/* Expenses Table */}
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-700">Detalle de Movimientos</h3>
                            </div>
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Fecha</th>
                                            <th className="px-4 py-3">Partida</th>
                                            <th className="px-4 py-3">Detalle</th>
                                            <th className="px-4 py-3">Desc.</th>
                                            <th className="px-4 py-3 text-right">Monto</th>
                                            <th className="px-4 py-3 text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredExpenses.map(exp => (
                                            <tr key={exp.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 whitespace-nowrap">{new Date(exp.timestamp).toLocaleDateString('es-ES')}</td>
                                                <td className="px-4 py-3 font-medium text-slate-800">{exp.category}</td>
                                                <td className="px-4 py-3 text-slate-600">{exp.subcategory}</td>
                                                <td className="px-4 py-3 text-slate-500 italic truncate max-w-[150px]">{exp.description}</td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-red-600">S/ {exp.amount.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => onDeleteExpense(exp.id)} className="text-slate-400 hover:text-red-500">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredExpenses.length === 0 && (
                                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay gastos en este periodo.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'config' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h3 className="text-lg font-bold text-slate-700 mb-4">Añadir Nueva Partida (Categoría)</h3>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newCategoryName} 
                                onChange={e => setNewCategoryName(e.target.value)}
                                placeholder="Nombre de la Partida"
                                className="flex-1 border-slate-300 rounded-md"
                            />
                            <button onClick={handleAddCategory} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Añadir</button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {Object.keys(expenseCategories).map(cat => (
                                <span key={cat} className="px-3 py-1 bg-slate-100 rounded-full text-sm font-medium text-slate-700">{cat}</span>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h3 className="text-lg font-bold text-slate-700 mb-4">Añadir Detalle (Subcategoría)</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Seleccionar Partida</label>
                                <select 
                                    value={targetCategoryForSub} 
                                    onChange={e => setTargetCategoryForSub(e.target.value)}
                                    className="w-full border-slate-300 rounded-md"
                                >
                                    {Object.keys(expenseCategories).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newSubcategoryName} 
                                    onChange={e => setNewSubcategoryName(e.target.value)}
                                    placeholder="Nombre del Detalle"
                                    className="flex-1 border-slate-300 rounded-md"
                                />
                                <button onClick={handleAddSubcategory} className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700">Añadir</button>
                            </div>
                            <div className="mt-4">
                                <p className="text-sm font-semibold mb-2">Detalles actuales para {targetCategoryForSub}:</p>
                                <div className="flex flex-wrap gap-2">
                                    {(expenseCategories[targetCategoryForSub] || []).map(sub => (
                                        <span key={sub} className="px-3 py-1 bg-green-50 border border-green-200 rounded-full text-sm text-green-800">{sub}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpensesDashboard;
