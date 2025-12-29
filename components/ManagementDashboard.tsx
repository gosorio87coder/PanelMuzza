
import React, { useState, useMemo } from 'react';
import { Sale, Booking, DaySchedule, Expense } from '../types';
import { SOURCES, CARD_METHODS } from '../constants';

interface ManagementDashboardProps {
  allSales: Sale[];
  allBookings: Booking[];
  salesGoals: Record<string, number>;
  bookingGoals: Record<string, number>;
  clientGoals: Record<string, number>;
  allSpecialists: string[];
  weeklySchedule: Record<number, DaySchedule>;
  configStartHour: number; 
  configEndHour: number;   
  configAvailableDays: number[]; 
  expenses: Expense[];
}

type Tab = 'occupancy' | 'sales_control' | 'financials';
type TimeRange = 'specific_month' | '3m' | '6m' | '1y';

const SOURCE_COLORS: Record<string, string> = {
    'FB': '#3b82f6', 
    'IG': '#ec4899', 
    'Tiktok': '#0f172a', 
    'Pauta': '#10b981', 
    'Recomendada': '#f59e0b', 
    'Otros': '#64748b', 
};

const ManagementDashboard: React.FC<ManagementDashboardProps> = ({ 
    allSales,
    allBookings, 
    allSpecialists,
    weeklySchedule,
    expenses,
    bookingGoals,
    clientGoals
}) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const [activeTab, setActiveTab] = useState<Tab>('sales_control');
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(currentMonth);
    const [timeRange, setTimeRange] = useState<TimeRange>('specific_month');
    const [selectedSpecialists, setSelectedSpecialists] = useState<string[]>(allSpecialists);

    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const YEARS = Array.from({length: 5}, (_, i) => currentYear - i);

    const handleSpecialistToggle = (spec: string) => {
        setSelectedSpecialists(prev => 
            prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
        );
    };

    const dashboardData = useMemo(() => {
        const now = new Date();
        let startDate = new Date(year, month, 1);
        let endDate = new Date(year, month + 1, 0, 23, 59, 59);

        if (timeRange === '3m') {
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 2);
            startDate.setDate(1);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
        } else if (timeRange === '6m') {
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 5);
            startDate.setDate(1);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
        } else if (timeRange === '1y') {
            startDate = new Date(now);
            startDate.setFullYear(now.getFullYear() - 1);
            startDate.setDate(1);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
        }

        const periodBookings = allBookings.filter(b => {
            const d = new Date(b.startTime);
            return d >= startDate && d <= endDate && b.serviceType !== 'Bloqueo' && b.status !== 'cancelled';
        });

        const trend: Record<string, number> = {};
        const isMonthly = timeRange === 'specific_month';
        
        if (isMonthly) {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) trend[String(i)] = 0;
            periodBookings.forEach(b => {
                const day = new Date(b.startTime).getDate();
                trend[String(day)] = (trend[String(day)] || 0) + 1;
            });
        } else {
            periodBookings.forEach(b => {
                const d = new Date(b.startTime);
                const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
                trend[key] = (trend[key] || 0) + 1;
            });
        }

        // --- ENHANCED STAFF PRODUCTIVITY BY TYPE (UPDATED TO BOOKER) ---
        const staffStats: Record<string, { total: number, nuevas: number, retoques: number, otros: number }> = {};
        periodBookings.forEach(b => {
            // CAMBIO CLAVE: Usamos createdByName (el que reserva) en lugar de specialist (el que atiende)
            const name = b.createdByName || 'Sistema'; 
            if (!staffStats[name]) staffStats[name] = { total: 0, nuevas: 0, retoques: 0, otros: 0 };
            
            staffStats[name].total++;
            const service = (b.serviceType || '').toLowerCase();
            const procedure = (b.procedure || '').toLowerCase();

            if (service === 'cejas') {
                if (procedure.includes('retoque')) {
                    staffStats[name].retoques++;
                } else {
                    staffStats[name].nuevas++;
                }
            } else {
                staffStats[name].otros++;
            }
        });
        const sortedStaff = Object.entries(staffStats).sort((a, b) => b[1].total - a[1].total);

        // --- NEW CLIENTS LOGIC ---
        const allCompletedBookings = allBookings.filter(b => b.status === 'completed' && b.serviceType !== 'Bloqueo');
        const firstBookingPerClient: Record<string, Date> = {};
        allCompletedBookings.forEach(b => {
            const dni = b.client.dni;
            const date = new Date(b.startTime);
            if (!firstBookingPerClient[dni] || date < firstBookingPerClient[dni]) {
                firstBookingPerClient[dni] = date;
            }
        });

        const newClientsInPeriod = Object.entries(firstBookingPerClient).filter(([dni, date]) => 
            date >= startDate && date <= endDate
        );

        const newClientsTrend: Record<string, number> = {};
        if (isMonthly) {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) newClientsTrend[String(i)] = 0;
            newClientsInPeriod.forEach(([dni, date]) => {
                const day = date.getDate();
                newClientsTrend[String(day)] = (newClientsTrend[String(day)] || 0) + 1;
            });
        } else {
            newClientsInPeriod.forEach(([dni, date]) => {
                const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
                newClientsTrend[key] = (newClientsTrend[key] || 0) + 1;
            });
        }

        const sourceStats: Record<string, number> = {};
        newClientsInPeriod.forEach(([dni, date]) => {
            const clientObj = allBookings.find(b => b.client.dni === dni)?.client;
            const src = clientObj?.source || 'Otros';
            sourceStats[src] = (sourceStats[src] || 0) + 1;
        });

        const evaluationClients = new Set(allBookings
            .filter(b => b.status === 'completed' && b.serviceType === 'Otro' && b.procedure === 'Evaluación')
            .map(b => b.client.dni)
        );
        const convertedClients = new Set(allBookings
            .filter(b => b.status === 'completed' && b.serviceType !== 'Bloqueo' && (b.serviceType !== 'Otro' || b.procedure !== 'Evaluación'))
            .filter(b => evaluationClients.has(b.client.dni))
            .map(b => b.client.dni)
        );
        const conversionRate = evaluationClients.size > 0 ? (convertedClients.size / evaluationClients.size) * 100 : 0;

        const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;

        // Goals Logic
        const goalKey = `${year}-${month}`;
        const currentBookingGoal = bookingGoals[goalKey] || 0;
        const currentClientGoal = clientGoals[goalKey] || 0;
        
        const bookingPerformance = currentBookingGoal > 0 ? (periodBookings.length / currentBookingGoal) * 100 : 0;
        const clientPerformance = currentClientGoal > 0 ? (newClientsInPeriod.length / currentClientGoal) * 100 : 0;

        return {
            totalBookings: periodBookings.length,
            avgPerDay: periodBookings.length / diffDays,
            trend,
            newClientsTrend,
            sortedStaff,
            newClientsCount: newClientsInPeriod.length,
            sourceStats: Object.entries(sourceStats).sort((a, b) => (b[1] as any) - (a[1] as any)),
            evaluationCount: evaluationClients.size,
            convertedCount: convertedClients.size,
            conversionRate,
            isMonthly,
            currentBookingGoal,
            currentClientGoal,
            bookingPerformance,
            clientPerformance
        };
    }, [allBookings, year, month, timeRange, bookingGoals, clientGoals]);

    const chartLabels = useMemo(() => {
        if (dashboardData.isMonthly) {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            return Array.from({length: daysInMonth}, (_, i) => String(i + 1));
        } else {
            const labels = [];
            const tempDate = new Date();
            const count = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;
            for(let i = count - 1; i >= 0; i--) {
                const d = new Date();
                d.setMonth(tempDate.getMonth() - i);
                labels.push(`${d.getMonth() + 1}/${d.getFullYear()}`);
            }
            return labels;
        }
    }, [year, month, timeRange, dashboardData.isMonthly]);

    const financialData = useMemo(() => {
        const fExpenses = expenses.filter(e => { const d = new Date(e.timestamp); return d.getFullYear() === year && d.getMonth() === month; });
        const fSales = allSales.filter(s => { const d = new Date(s.timestamp); return d.getFullYear() === year && d.getMonth() === month; });
        const totalManualExpenses = fExpenses.reduce((sum, e) => sum + e.amount, 0);
        let totalSalesRevenue = 0; let cardRevenue = 0;
        fSales.forEach(s => { s.payments.forEach(p => { totalSalesRevenue += p.amount; if (CARD_METHODS.includes(p.method)) cardRevenue += p.amount; }); });
        const posCommissions = cardRevenue * 0.041182;
        const totalExpenses = totalManualExpenses + posCommissions;
        return { totalSales: totalSalesRevenue, totalManualExpenses, posCommissions, totalExpenses, netProfit: totalSalesRevenue - totalExpenses };
    }, [expenses, allSales, year, month]);

    const capacityData = useMemo(() => {
        let totalCap = 0; let bookedH = 0;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dayId = date.getDay() === 0 ? 7 : date.getDay();
            const sch = weeklySchedule[dayId];
            if (sch?.isOpen) totalCap += ((sch.endHour - sch.startHour) - (sch.hasLunch ? (sch.lunchEndHour - sch.lunchStartHour) : 0)) * selectedSpecialists.length;
        }
        allBookings.filter(b => {
            const d = new Date(b.startTime);
            return d.getFullYear() === year && d.getMonth() === month && b.status !== 'cancelled' && selectedSpecialists.includes(b.specialist);
        }).forEach(b => {
            bookedH += b.status === 'completed' && b.actualDuration ? b.actualDuration / 60 : (b.endTime.getTime() - b.startTime.getTime()) / 3600000;
        });
        return { occupancyRate: totalCap > 0 ? (bookedH / totalCap) * 100 : 0, bookedH };
    }, [year, month, selectedSpecialists, weeklySchedule, allBookings]);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col sm:flex-row bg-slate-200 p-1 rounded-xl w-full sm:w-fit mb-4 overflow-x-auto gap-1">
                {(['sales_control', 'occupancy', 'financials'] as const).map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === t ? 'bg-white text-purple-700 shadow-md' : 'text-slate-600 hover:bg-slate-300'}`}>
                        {t === 'sales_control' ? 'Clientes y Reservas' : t === 'occupancy' ? 'Ocupación' : 'Resultado Operativos $'}
                    </button>
                ))}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                        {activeTab === 'sales_control' ? 'Control de Clientes y Reservas' : activeTab === 'occupancy' ? 'Análisis de Capacidad' : 'Resultados Financieros'}
                    </h2>
                </div>
                <div className="flex flex-wrap gap-2 items-center bg-slate-100 p-2 rounded-xl">
                    <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-white border-slate-300 rounded-lg text-sm font-bold text-slate-700 focus:ring-purple-500">
                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-white border-slate-300 rounded-lg text-sm font-bold text-slate-700 focus:ring-purple-500">
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                        {(['specific_month', '3m', '6m', '1y'] as const).map(r => (
                            <button key={r} onClick={() => setTimeRange(r)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${timeRange === r ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500'}`}>
                                {r === 'specific_month' ? 'MES' : r.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {activeTab === 'sales_control' && (
                <div className="space-y-6">
                    {/* Metas del Equipo Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 flex flex-col">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cumplimiento de Metas</h3>
                                <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded">Periodo Actual</span>
                            </div>
                            <div className="space-y-10">
                                {/* Booking Goal Bar */}
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">Meta de Reservas Totales</p>
                                            <p className="text-xs text-slate-500">{dashboardData.totalBookings} logradas / {dashboardData.currentBookingGoal} meta</p>
                                        </div>
                                        <p className="text-2xl font-black text-purple-600">{dashboardData.bookingPerformance.toFixed(0)}%</p>
                                    </div>
                                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${dashboardData.bookingPerformance >= 100 ? 'bg-green-500' : 'bg-purple-600'}`}
                                            style={{ width: `${Math.min(dashboardData.bookingPerformance, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                                {/* Client Goal Bar */}
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">Meta de Clientes Nuevos</p>
                                            <p className="text-xs text-slate-500">{dashboardData.newClientsCount} nuevos / {dashboardData.currentClientGoal} meta</p>
                                        </div>
                                        <p className="text-2xl font-black text-emerald-600">{dashboardData.clientPerformance.toFixed(0)}%</p>
                                    </div>
                                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${dashboardData.clientPerformance >= 100 ? 'bg-green-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${Math.min(dashboardData.clientPerformance, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tendencia Chart */}
                        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                                Tendencia de Generación
                            </h3>
                            <div className="h-56 flex items-end justify-between gap-1 sm:gap-2">
                                {chartLabels.map(label => {
                                    const val = dashboardData.trend[label] || 0;
                                    const maxVal = Math.max(...(Object.values(dashboardData.trend) as number[]), 4);
                                    const height = (val / maxVal) * 100;
                                    return (
                                        <div key={label} className="flex-1 group relative flex flex-col items-center h-full justify-end">
                                            {val > 0 && (
                                                <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2 rounded-md font-bold z-10 whitespace-nowrap">
                                                    {val} citas
                                                </div>
                                            )}
                                            <div 
                                                className={`w-full max-w-[24px] rounded-t-md transition-all duration-500 ${val > 0 ? 'bg-blue-500 group-hover:bg-blue-600 shadow-md' : 'bg-slate-100'}`} 
                                                style={{ height: `${val > 0 ? Math.max(height, 8) : 0}%` }}
                                            ></div>
                                            <span className="text-[9px] mt-2 text-slate-500 font-bold whitespace-nowrap">{label}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Productividad del Personal Desglosada (POR USUARIO QUE RESERVA) */}
                    <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold">
                                        Σ
                                    </div>
                                    Productividad por Agendador (Reserva)
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold ml-11 uppercase">Performance basado en quién genera la cita</p>
                            </div>
                            <div className="flex gap-4 text-[10px] font-bold uppercase">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-600"></span> Cejas Nuevas</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-400"></span> Retoques</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300"></span> Otros</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-8">
                            {dashboardData.sortedStaff.map(([user, data], idx) => {
                                const stats = data as { total: number, nuevas: number, retoques: number, otros: number };
                                const maxTotal = (dashboardData.sortedStaff[0][1] as any).total || 1;
                                
                                // Percentages for stacked bar
                                const nuevasPct = (stats.nuevas / stats.total) * 100;
                                const retoquesPct = (stats.retoques / stats.total) * 100;
                                const otrosPct = (stats.otros / stats.total) * 100;

                                // Width relative to the leader
                                const relativeWidth = (stats.total / maxTotal) * 100;

                                return (
                                    <div key={user} className="group">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-4">
                                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-white shadow-sm' : 'bg-slate-800 text-white'}`}>0{idx + 1}</span>
                                                <div>
                                                    <span className="text-base font-bold text-slate-800 block leading-tight">{user}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                        {stats.nuevas} Nuevas • {stats.retoques} Retoques • {stats.otros} Otros
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black text-indigo-600 block leading-tight">{stats.total}</span>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase">Agendadas</span>
                                            </div>
                                        </div>
                                        
                                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200 flex shadow-inner" style={{ width: `${Math.max(relativeWidth, 10)}%` }}>
                                            <div 
                                                className="h-full bg-indigo-600 transition-all duration-1000" 
                                                style={{ width: `${nuevasPct}%` }}
                                                title={`Nuevas: ${stats.nuevas}`}
                                            ></div>
                                            <div 
                                                className="h-full bg-purple-400 transition-all duration-1000" 
                                                style={{ width: `${retoquesPct}%` }}
                                                title={`Retoques: ${stats.retoques}`}
                                            ></div>
                                            <div 
                                                className="h-full bg-slate-300 transition-all duration-1000" 
                                                style={{ width: `${otrosPct}%` }}
                                                title={`Otros: ${stats.otros}`}
                                            ></div>
                                        </div>
                                    </div>
                                )
                            })}
                            {dashboardData.sortedStaff.length === 0 && <p className="text-center py-10 text-slate-400 italic">No hay actividad registrada.</p>}
                        </div>
                    </div>

                    {/* Row 3: New Clients KPI & Trend */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white p-8 rounded-2xl shadow-lg border-l-[8px] border-emerald-500 flex flex-col justify-between hover:scale-[1.01] transition-transform">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Clientes Nuevos Únicos</p>
                                <p className="text-6xl font-bold text-slate-800 mt-2">{dashboardData.newClientsCount}</p>
                            </div>
                        </div>
                        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                Adquisición de Clientes
                            </h3>
                            <div className="h-56 flex items-end justify-between gap-1 sm:gap-2">
                                {chartLabels.map(label => {
                                    const val = dashboardData.newClientsTrend[label] || 0;
                                    const maxVal = Math.max(...(Object.values(dashboardData.newClientsTrend) as number[]), 3);
                                    const height = (val / maxVal) * 100;
                                    return (
                                        <div key={label} className="flex-1 group relative flex flex-col items-center h-full justify-end">
                                            {val > 0 && (
                                                <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2 rounded-md font-bold z-10 whitespace-nowrap">
                                                    {val} nuevos
                                                </div>
                                            )}
                                            <div 
                                                className={`w-full max-w-[24px] rounded-t-md transition-all duration-500 ${val > 0 ? 'bg-emerald-500 group-hover:bg-emerald-600 shadow-md' : 'bg-slate-100'}`} 
                                                style={{ height: `${val > 0 ? Math.max(height, 8) : 0}%` }}
                                            ></div>
                                            <span className="text-[9px] mt-2 text-slate-500 font-bold whitespace-nowrap">{label}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-10">Origen de Clientes Nuevos</h3>
                            <div className="flex flex-col sm:flex-row items-center justify-around gap-8">
                                <div className="relative w-44 h-44">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                                        {(() => {
                                            let currentOffset = 0;
                                            const total = dashboardData.newClientsCount || 1;
                                            return (dashboardData.sourceStats as any[]).map(([src, count]) => {
                                                const percentage = (count / total) * 100;
                                                const strokeDasharray = `${percentage} ${100 - percentage}`;
                                                const strokeDashoffset = -currentOffset;
                                                currentOffset += percentage;
                                                return <circle key={src} cx="50" cy="50" r="40" fill="none" stroke={SOURCE_COLORS[src] || '#8b5cf6'} strokeWidth="15" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} pathLength="100" style={{ transition: 'all 1s ease' }} />;
                                            });
                                        })()}
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-4xl font-bold text-slate-800">{dashboardData.newClientsCount}</span>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 flex-1 w-full max-w-[200px]">
                                    {(dashboardData.sourceStats as any[]).map(([src, count]) => {
                                        const pct = (count / (dashboardData.newClientsCount || 1) * 100).toFixed(0);
                                        return (
                                            <div key={src} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS[src] || '#8b5cf6' }}></div>
                                                    <span className="text-xs font-bold text-slate-600">{src}</span>
                                                </div>
                                                <span className="text-xs font-bold text-slate-800">{count} <span className="text-[9px] text-slate-400">({pct}%)</span></span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-2xl shadow-lg border-t-8 border-purple-600 border-x border-b border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-2">Conversión de Evaluaciones</h3>
                            <p className="text-xs text-slate-500 mb-10">Clientes que pasaron de evaluación a servicio pagado</p>
                            <div className="flex flex-col sm:flex-row items-center gap-12">
                                <div className="relative w-40 h-40 flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="50%" cy="50%" r="40%" stroke="#f1f5f9" strokeWidth="10" fill="none" />
                                        <circle cx="50%" cy="50%" r="40%" stroke="#8b5cf6" strokeWidth="15" fill="none" strokeDasharray="100 100" strokeDashoffset={100 - dashboardData.conversionRate} pathLength="100" strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
                                    </svg>
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-4xl font-bold text-slate-800">{dashboardData.conversionRate.toFixed(0)}%</span>
                                        <span className="text-[8px] font-bold text-purple-600 uppercase mt-1">Éxito</span>
                                    </div>
                                </div>
                                <div className="space-y-6 flex-1 w-full">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Evaluaciones</span>
                                            <span className="text-lg font-bold text-slate-800">{dashboardData.evaluationCount}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-slate-400 w-full"></div>
                                        </div>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Vueltas</span>
                                            <span className="text-lg font-bold text-purple-700">{dashboardData.convertedCount}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-purple-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-purple-600 shadow-sm" style={{ width: `${dashboardData.conversionRate}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'occupancy' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 flex flex-col sm:flex-row items-center gap-6">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex-shrink-0">Especialistas:</h3>
                        <div className="flex flex-wrap gap-2">
                            {allSpecialists.map(spec => (
                                <button key={spec} onClick={() => handleSpecialistToggle(spec)} className={`px-5 py-2 rounded-xl text-xs font-bold border transition-all ${selectedSpecialists.includes(spec) ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}>
                                    {spec}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-10 rounded-2xl shadow-lg border border-slate-200 flex flex-col items-center justify-center text-center">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Ocupación Global</h3>
                            <div className="text-7xl font-bold text-purple-600 leading-none">{capacityData.occupancyRate.toFixed(0)}%</div>
                            <p className="text-sm font-bold text-slate-500 mt-8 bg-slate-100 px-6 py-2 rounded-full border border-slate-200">{capacityData.bookedH.toFixed(1)} h facturadas</p>
                        </div>

                        <div className="md:col-span-2 bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-8">Uso de Capacidad Individual</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                {allSpecialists.filter(s => selectedSpecialists.includes(s)).map(spec => {
                                    const specB = allBookings.filter(b => b.specialist === spec && b.status !== 'cancelled' && new Date(b.startTime).getFullYear() === year && new Date(b.startTime).getMonth() === month);
                                    const hours = specB.reduce((sum, b) => sum + (b.status === 'completed' && b.actualDuration ? b.actualDuration/60 : (b.endTime.getTime()-b.startTime.getTime())/3600000), 0);
                                    const percentage = Math.min((hours / 160) * 100, 100);
                                    return (
                                        <div key={spec} className="p-6 rounded-2xl bg-slate-50/50 border border-slate-200 hover:bg-white transition-all group">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="font-bold text-slate-800 text-lg">{spec}</span>
                                                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">{hours.toFixed(1)}h</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-200 shadow-inner">
                                                <div className="h-full bg-purple-600 transition-all duration-1000 shadow-sm" style={{ width: `${percentage}%` }}></div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-3 tracking-widest">{percentage.toFixed(0)}% ocupación</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'financials' && (
                <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-200 max-w-2xl mx-auto relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-purple-600"></div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-10 uppercase tracking-tight text-center">Estado de Resultados Operativos</h3>
                    <div className="space-y-6">
                        <div className="flex justify-between p-6 bg-emerald-50 rounded-2xl border border-emerald-100 items-center">
                            <span className="font-bold text-emerald-800 uppercase text-xs tracking-widest">Ventas Totales Brutas</span>
                            <span className="font-bold text-emerald-700 text-3xl">S/ {financialData.totalSales.toFixed(2)}</span>
                        </div>
                        <div className="px-6 py-4 space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gastos Operativos</span>
                                <span className="font-bold text-slate-800">S/ {financialData.totalManualExpenses.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Comisiones Pasarela (4.12%)</span>
                                </div>
                                <span className="font-bold text-red-600">S/ {financialData.posCommissions.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="pt-4 border-t-2 border-slate-50">
                            <div className="flex justify-between p-6 bg-red-50 rounded-2xl border border-red-100 mb-8 items-center">
                                <span className="font-bold text-red-800 uppercase text-xs tracking-widest">Egresos Reales</span>
                                <span className="font-bold text-red-700 text-2xl">S/ {financialData.totalExpenses.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between p-10 bg-slate-900 text-white rounded-3xl shadow-2xl items-center">
                                <div className="flex flex-col">
                                    <span className="font-bold text-lg uppercase tracking-widest text-purple-400">Utilidad Neta</span>
                                    <span className="text-[10px] font-bold opacity-40 mt-1 uppercase">Resultado de Gestión</span>
                                </div>
                                <span className="text-5xl font-bold text-purple-400 tracking-tighter">S/ {financialData.netProfit.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagementDashboard;
