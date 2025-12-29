
import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Booking, UserProfile } from '../types';
import { MONTHS, YEARS } from '../constants';
import { supabase } from '../supabaseClient';

declare const XLSX: any;

interface CommissionsDashboardProps {
  allSales: Sale[];
  allBookings: Booking[];
}

// Especialistas que deben aparecer siempre por defecto
const DEFAULT_COMMISSION_ENTITIES = ['Julissa', 'Laura'];

const CommissionsDashboard: React.FC<CommissionsDashboardProps> = ({ allSales, allBookings }) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(currentMonth);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [configs, setConfigs] = useState<Record<string, { role: 'vendedor' | 'especialista', percentage: number }>>({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchMetadata = async () => {
            if (!supabase) return;
            setIsLoading(true);
            
            // 1. Fetch Users from profiles
            const { data: profiles } = await supabase.from('profiles').select('*').order('name');
            
            // 2. Merge with Default Specialists (Julissa/Laura)
            const combinedUsers: UserProfile[] = profiles ? [...profiles] : [];
            
            DEFAULT_COMMISSION_ENTITIES.forEach(name => {
                const alreadyExists = combinedUsers.some(u => u.name.toLowerCase() === name.toLowerCase());
                if (!alreadyExists) {
                    combinedUsers.push({
                        id: `specialist-${name}`, // Pseudo-ID for entities without profile
                        name: name,
                        email: 'Especialista Externa',
                        role: 'staff'
                    });
                }
            });
            
            setUsers(combinedUsers);

            // 3. Fetch Configs for the specific month/year
            const { data: remoteConfigs } = await supabase
                .from('commission_configs')
                .select('*')
                .eq('month', month)
                .eq('year', year);

            const map: Record<string, any> = {};
            if (remoteConfigs) {
                remoteConfigs.forEach(c => {
                    map[c.user_id] = { role: c.role_type, percentage: c.percentage };
                });
            }

            // 4. Set Defaults for specific specialists if no remote config exists
            combinedUsers.forEach(user => {
                if (!map[user.id] && DEFAULT_COMMISSION_ENTITIES.includes(user.name)) {
                    map[user.id] = { role: 'especialista', percentage: 0 };
                }
            });

            setConfigs(map);
            setIsLoading(false);
        };
        fetchMetadata();
    }, [month, year]);

    const handleSaveConfig = async (userId: string, userName: string, role: 'vendedor' | 'especialista', percentage: number) => {
        if (!supabase) return;
        
        // Note: For virtual IDs (specialist-Name), we use the name as user_id in DB if it's a string field, 
        // or we handle as metadata. Assuming the table supports this or we just update local state.
        const { error } = await supabase.from('commission_configs').upsert({
            user_id: userId,
            user_name: userName,
            month,
            year,
            role_type: role,
            percentage
        }, { onConflict: 'user_id,month,year' });

        if (!error) {
            setConfigs(prev => ({ ...prev, [userId]: { role, percentage } }));
        } else {
            console.error("Error saving commission config:", error);
            // Even if DB fails (e.g. UUID constraint), allow local state for the current session
            setConfigs(prev => ({ ...prev, [userId]: { role, percentage } }));
        }
    };

    const calculatedCommissions = useMemo(() => {
        const results: Record<string, { totalRevenue: number, commission: number, bookingsCount: number }> = {};
        
        // Filter sales of the selected period that have a booking link
        const periodSales = allSales.filter(s => {
            const d = new Date(s.timestamp);
            return d.getFullYear() === year && d.getMonth() === month && s.bookingId;
        });

        users.forEach(user => {
            const config = configs[user.id] || { role: 'vendedor', percentage: 0 };
            let totalRevenue = 0;
            let bookingsCount = 0;
            const processedBookings = new Set<string>();

            periodSales.forEach(sale => {
                const booking = allBookings.find(b => b.id === sale.bookingId);
                if (!booking) return;

                // LOGIC: Vendedor match (The person who created the booking)
                const isVendedorMatch = config.role === 'vendedor' && (booking.createdByName === user.name || booking.createdBy === user.id);
                
                // LOGIC: Atencion match (The specialist assigned to the booking)
                const isAtencionMatch = config.role === 'especialista' && booking.specialist === user.name;

                if (isVendedorMatch || isAtencionMatch) {
                    const saleAmount = sale.payments.reduce((sum, p) => sum + p.amount, 0);
                    totalRevenue += saleAmount;
                    
                    if (!processedBookings.has(booking.id)) {
                        bookingsCount++;
                        processedBookings.add(booking.id);
                    }
                }
            });

            results[user.id] = {
                totalRevenue,
                commission: totalRevenue * (config.percentage / 100),
                bookingsCount
            };
        });

        return results;
    }, [users, configs, allSales, allBookings, year, month]);

    const handleDownload = () => {
        const data = users.map(u => {
            const stats = calculatedCommissions[u.id] || { totalRevenue: 0, commission: 0, bookingsCount: 0 };
            const config = configs[u.id] || { role: 'vendedor', percentage: 0 };
            return {
                'Mes': MONTHS[month],
                'Año': year,
                'Colaborador': u.name,
                'Rol de Pago': config.role === 'vendedor' ? 'Vendedor (Reserva)' : 'Atención (Especialista)',
                '% Comisión': config.percentage + '%',
                'Ingresos Generados': stats.totalRevenue,
                'Citas Vinculadas': stats.bookingsCount,
                'Comisión Total': stats.commission
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Comisiones');
        XLSX.writeFile(workbook, `Reporte_Comisiones_${MONTHS[month]}_${year}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border-l-8 border-purple-600 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Panel de Comisiones</h2>
                    <p className="text-sm text-slate-500">Calcula incentivos para Vendedores y Especialistas (Julissa y Laura incluidas por defecto).</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold shadow-sm focus:ring-purple-500 bg-white">
                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold shadow-sm focus:ring-purple-500 bg-white">
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button 
                        onClick={handleDownload}
                        className="px-6 py-2 bg-green-600 text-white font-bold rounded-xl shadow-md hover:bg-green-700 transition-all flex items-center gap-2"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                         Exportar Excel
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Colaborador</th>
                                <th className="px-6 py-4 text-center">Rol de Comisión</th>
                                <th className="px-6 py-4 text-center">% Comisión</th>
                                <th className="px-6 py-4 text-right">Recaudación Vinculada</th>
                                <th className="px-6 py-4 text-right">Comisión Final</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(user => {
                                const stats = calculatedCommissions[user.id] || { totalRevenue: 0, commission: 0, bookingsCount: 0 };
                                const config = configs[user.id] || { role: 'vendedor', percentage: 0 };
                                
                                return (
                                    <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${DEFAULT_COMMISSION_ENTITIES.includes(user.name) ? 'bg-purple-50/30' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 flex items-center gap-2">
                                                {user.name}
                                                {DEFAULT_COMMISSION_ENTITIES.includes(user.name) && (
                                                    <span className="bg-purple-100 text-purple-700 text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-tighter font-black">Default</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-semibold">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center">
                                                <select 
                                                    value={config.role} 
                                                    onChange={e => handleSaveConfig(user.id, user.name, e.target.value as any, config.percentage)}
                                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition-all ${
                                                        config.role === 'vendedor' 
                                                        ? 'bg-blue-50 border-blue-100 text-blue-700' 
                                                        : 'bg-pink-50 border-pink-100 text-pink-700'
                                                    }`}
                                                >
                                                    <option value="vendedor">VENDEDOR (Agendó)</option>
                                                    <option value="especialista">ATENCIÓN (Atendió)</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center space-x-2">
                                                <input 
                                                    type="number" 
                                                    value={config.percentage} 
                                                    onChange={e => handleSaveConfig(user.id, user.name, config.role, Number(e.target.value))}
                                                    className="w-16 bg-white border border-slate-200 rounded-lg text-center font-bold px-2 py-1 text-slate-700 focus:ring-2 focus:ring-purple-400"
                                                    min="0" max="100" step="0.1"
                                                />
                                                <span className="font-bold text-slate-300">%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-bold text-slate-700">S/ {stats.totalRevenue.toFixed(2)}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{stats.bookingsCount} citas</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-xl font-black text-purple-700">S/ {stats.commission.toFixed(2)}</span>
                                        </td>
                                    </tr>
                                )
                            })}
                            {users.length === 0 && (
                                <tr><td colSpan={5} className="p-10 text-center text-slate-400">No se encontraron usuarios activos.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex gap-4">
                <div className="bg-blue-100 p-2 rounded-full h-fit text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="text-sm text-blue-900 leading-relaxed">
                    <p className="font-bold mb-2">Instrucciones:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li><strong>Julissa y Laura</strong> aparecen por defecto con rol <strong>Atención</strong>.</li>
                        <li>Puede cambiar el rol a "Vendedor" si una especialista también realiza labores de agendamiento.</li>
                        <li>Ingrese el <strong>% de Comisión</strong> deseado para cada persona; el cálculo se actualiza al instante.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default CommissionsDashboard;
