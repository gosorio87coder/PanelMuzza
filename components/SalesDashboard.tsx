import React, { useState, useMemo } from 'react';
import { Sale, Booking } from '../types';
import { MONTHS, YEARS, SERVICE_TYPES, PROCEDURES_BY_SERVICE } from '../constants';

declare const XLSX: any;

interface SalesDashboardProps {
  sales: Sale[];
  bookings: Booking[];
  onAddDirectSale: () => void;
  onBulkLoad: () => void;
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (id: string) => void;
}

const SalesDashboard: React.FC<SalesDashboardProps> = ({ sales, bookings, onAddDirectSale, onBulkLoad, onEditSale, onDeleteSale }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [serviceFilter, setServiceFilter] = useState('Todos los Servicios');
  const [creamFilter, setCreamFilter] = useState<'Todos' | 'SI' | 'NO'>('Todos');

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const d = new Date(s.timestamp);
      const matchMonth = selectedMonth === -1 || d.getMonth() === selectedMonth;
      const matchYear = d.getFullYear() === selectedYear;
      const matchService = serviceFilter === 'Todos los Servicios' || s.serviceType === serviceFilter;
      const matchCream = creamFilter === 'Todos' || (creamFilter === 'SI' ? s.creamSold : !s.creamSold);
      return matchMonth && matchYear && matchService && matchCream;
    });
  }, [sales, selectedMonth, selectedYear, serviceFilter, creamFilter]);

  const stats = useMemo(() => {
    let total = 0;
    let creamRevenue = 0;
    let transactions = filteredSales.length;
    
    filteredSales.forEach(s => {
      s.payments.forEach(p => {
        total += p.amount;
        if (p.code === 'CREMA') {
          creamRevenue += p.amount;
        }
      });
    });

    return { 
      total, 
      creamRevenue, 
      serviceRevenue: total - creamRevenue,
      transactions 
    };
  }, [filteredSales]);

  const handleDownload = () => {
    const data = filteredSales.map(s => {
      const total = s.payments.reduce((sum, p) => sum + p.amount, 0);
      const creamPay = s.payments.find(p => p.code === 'CREMA')?.amount || 0;
      return {
        Fecha: new Date(s.timestamp).toLocaleString('es-ES'),
        Tipo: (s.transactionType || 'VENTA').toUpperCase(),
        Cliente: s.client.name,
        DNI: s.client.dni,
        Servicio: s.serviceType,
        Procedimiento: s.procedure,
        Monto_Total: total,
        Monto_Servicio: total - creamPay,
        Monto_Crema: creamPay,
        Metodos: s.payments.map(p => p.method).join(', ')
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, `Ventas_Muzza_${MONTHS[selectedMonth] || 'Anual'}_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">
          Registro de Transacciones <span className="text-slate-400 font-normal ml-2">({MONTHS[selectedMonth] || 'Año'}, {selectedYear})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={onAddDirectSale} className="bg-purple-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-purple-700 flex items-center gap-2 transition-transform active:scale-95">
            + Venta Directa
          </button>
          <button onClick={handleDownload} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-green-700 transition-transform active:scale-95">
            Descargar Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-xl shadow-inner">S/</div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recaudación Total</p>
            <p className="text-2xl font-black text-slate-800">S/ {stats.total.toFixed(2)}</p>
          </div>
          <div className="absolute top-0 right-0 w-2 h-full bg-green-500 opacity-20"></div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 shadow-inner">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12z"/></svg>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Venta de Cremas (Add-ons)</p>
            <p className="text-2xl font-black text-purple-700">S/ {stats.creamRevenue.toFixed(2)}</p>
          </div>
          <div className="absolute top-0 right-0 w-2 h-full bg-purple-500 opacity-20"></div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shadow-inner">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Neto de Servicios</p>
            <p className="text-2xl font-black text-slate-800">S/ {stats.serviceRevenue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center">
        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="border-none bg-slate-50 rounded-lg px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-purple-500">
           <option value={-1}>Todo el año</option>
           {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="border-none bg-slate-50 rounded-lg px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-purple-500">
           {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="h-6 w-[1px] bg-slate-200 hidden md:block"></div>
        <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} className="border-none bg-slate-50 rounded-lg px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-purple-500">
           <option>Todos los Servicios</option>
           {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">¿Llevó Crema?:</span>
          {(['Todos', 'SI', 'NO'] as const).map(f => (
            <label key={f} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
              <input type="radio" checked={creamFilter === f} onChange={() => setCreamFilter(f)} className="text-purple-600" /> {f}
            </label>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-5">Fecha</th>
                <th className="px-6 py-5">Cliente</th>
                <th className="px-6 py-5">Servicio</th>
                <th className="px-6 py-5 text-right">Monto Total</th>
                <th className="px-6 py-5 text-center">Extras</th>
                <th className="px-6 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map(s => {
                const total = s.payments.reduce((sum, p) => sum + p.amount, 0);
                const creamPay = s.payments.find(p => p.code === 'CREMA');
                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                        <p className="text-[11px] font-bold text-slate-500 uppercase">{new Date(s.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800 text-sm">{s.client.name}</p>
                      <p className="text-[10px] text-slate-400">DNI: {s.client.dni}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-700 text-xs">{s.serviceType}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{s.procedure}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-slate-800">S/ {total.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {creamPay ? (
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-[10px] font-black uppercase">
                          🍦 S/ {creamPay.amount.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => onEditSale(s)} className="text-slate-400 hover:text-purple-600 transition-colors">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                         </button>
                         <button onClick={() => onDeleteSale(s.id)} className="text-slate-400 hover:text-red-600 transition-colors">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                         </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;