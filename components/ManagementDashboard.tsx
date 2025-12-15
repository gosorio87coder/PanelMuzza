
import React, { useState, useMemo } from 'react';
import { Sale, Booking, DaySchedule, Expense } from '../types';
import { SOURCES } from '../constants';

interface ManagementDashboardProps {
  allSales: Sale[];
  allBookings: Booking[];
  salesGoals: Record<string, number>; // Key "YYYY-MM"
  bookingGoals: Record<string, number>;
  clientGoals: Record<string, number>;
  allSpecialists: string[];
  weeklySchedule: Record<number, DaySchedule>;
  configStartHour: number; // Retained for chart axes range
  configEndHour: number;   // Retained for chart axes range
  configAvailableDays: number[]; // Retained for legacy checks if needed
  expenses: Expense[];
}

type Tab = 'occupancy' | 'sales_control' | 'financials';
type TimeRange = 'specific_month' | '3m' | '6m' | '1y' | '2y';

// Colors for the pie chart segments corresponding to sources
const SOURCE_COLORS: Record<string, string> = {
    'FB': '#1877F2',       // Blue
    'IG': '#E1306C',       // Pink/Magenta
    'Tiktok': '#000000',   // Black
    'Pauta': '#10B981',    // Emerald Green
    'Recomendada': '#F59E0B', // Amber
    'Otros': '#9CA3AF',    // Gray
};

const getColor = (source: string) => SOURCE_COLORS[source] || '#6B7280';

const ManagementDashboard: React.FC<ManagementDashboardProps> = ({ 
    allSales,
    allBookings, 
    allSpecialists,
    weeklySchedule,
    configStartHour,
    configEndHour,
    bookingGoals,
    clientGoals,
    expenses
}) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // General State - Default is sales_control
    const [activeTab, setActiveTab] = useState<Tab>('sales_control');
    
    // Shared Date Filter State
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(currentMonth);
    
    // Occupancy State
    const [selectedSpecialists, setSelectedSpecialists] = useState<string[]>(allSpecialists);
    // Detailed Occupancy Filters
    const [selectedWeek, setSelectedWeek] = useState<number>(0); // 0 = All
    const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(0); // 0 = All, 1=Mon...7=Sun

    // Sales Control State
    const [salesTimeRange, setSalesTimeRange] = useState<TimeRange>('specific_month');
    const [filterSource, setFilterSource] = useState<string>('all');

    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const YEARS = Array.from({length: 5}, (_, i) => currentYear - i);
    const DAYS_OF_WEEK = [
        { id: 1, name: 'Lunes' },
        { id: 2, name: 'Martes' },
        { id: 3, name: 'Miércoles' },
        { id: 4, name: 'Jueves' },
        { id: 5, name: 'Viernes' },
        { id: 6, name: 'Sábado' },
        { id: 7, name: 'Domingo' },
    ];

    // --- OCCUPANCY LOGIC (Uses startTime: when the appointment IS) ---

    const filteredOccupancyBookings = useMemo(() => {
        return allBookings.filter(b => {
            const d = new Date(b.startTime);
            const matchesYearMonth = d.getFullYear() === year && d.getMonth() === month;
            const matchesSpecialist = selectedSpecialists.includes(b.specialist);
            
            // Week Filter (1-7, 8-14, etc.)
            const dayOfMonth = d.getDate();
            const weekNum = Math.ceil(dayOfMonth / 7);
            const matchesWeek = selectedWeek === 0 || weekNum === selectedWeek;

            // Day of Week Filter (1=Mon ... 7=Sun)
            const dayId = d.getDay() === 0 ? 7 : d.getDay();
            const matchesDay = selectedDayOfWeek === 0 || dayId === selectedDayOfWeek;

            return matchesYearMonth && matchesSpecialist && matchesWeek && matchesDay;
        });
    }, [allBookings, year, month, selectedSpecialists, selectedWeek, selectedDayOfWeek]);

    const getBookingDurationHours = (b: Booking) => {
        if (b.status === 'completed' && b.actualDuration) {
            return b.actualDuration / 60;
        }
        return (b.endTime.getTime() - b.startTime.getTime()) / (1000 * 60 * 60);
    };

    const calculateTotalCapacityHours = () => {
        let totalCapacity = 0;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
            // Apply Filters to Capacity Calculation
            const weekNum = Math.ceil(d / 7);
            if (selectedWeek > 0 && weekNum !== selectedWeek) continue;

            const date = new Date(year, month, d);
            const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
            
            if (selectedDayOfWeek > 0 && dayOfWeek !== selectedDayOfWeek) continue;

            const schedule = weeklySchedule[dayOfWeek];

            if (schedule && schedule.isOpen) {
                const totalHours = Math.max(0, schedule.endHour - schedule.startHour);
                const lunchHours = schedule.hasLunch ? Math.max(0, schedule.lunchEndHour - schedule.lunchStartHour) : 0;
                const operationalHours = Math.max(0, totalHours - lunchHours);
                totalCapacity += operationalHours;
            }
        }
        return totalCapacity;
    };

    const capacityData = useMemo(() => {
        const monthlyCapacityPerSpecialist = calculateTotalCapacityHours();
        const totalHoursAvailable = monthlyCapacityPerSpecialist * selectedSpecialists.length;
        
        let totalHoursBooked = 0;
        filteredOccupancyBookings.forEach(b => {
            if(b.status !== 'cancelled') {
                 totalHoursBooked += getBookingDurationHours(b);
            }
        });
        
        const noShowCount = filteredOccupancyBookings.filter(b => b.status === 'noshow').length;
        const totalAppointments = filteredOccupancyBookings.length;
        const noShowRate = totalAppointments > 0 ? (noShowCount / totalAppointments) * 100 : 0;

        return {
            totalHoursAvailable,
            totalHoursBooked,
            occupancyRate: totalHoursAvailable > 0 ? (totalHoursBooked / totalHoursAvailable) * 100 : 0,
            noShowRate,
            noShowCount
        };
    }, [year, month, selectedSpecialists, weeklySchedule, filteredOccupancyBookings, selectedWeek, selectedDayOfWeek]);

    const occupancyBySpecialist = useMemo(() => {
        const monthlyCapacityPerSpecialist = calculateTotalCapacityHours();

        const data = selectedSpecialists.map(spec => {
            const specBookings = filteredOccupancyBookings.filter(b => b.specialist === spec);
            const hoursBooked = specBookings.reduce((sum, b) => {
                 if(b.status === 'cancelled') return sum;
                 return sum + getBookingDurationHours(b);
            }, 0);
            
            return {
                name: spec,
                hoursBooked,
                percentage: monthlyCapacityPerSpecialist > 0 ? (hoursBooked / monthlyCapacityPerSpecialist) * 100 : 0
            };
        });
        return data;
    }, [filteredOccupancyBookings, selectedSpecialists, year, month, weeklySchedule, selectedWeek, selectedDayOfWeek]);

    const hourlyDemand = useMemo(() => {
        const start = Math.floor(configStartHour);
        const end = Math.floor(configEndHour);
        const range = Math.max(0, end - start);
        if (range <= 0) return [];
        const hourCounts = Array(Math.floor(range)).fill(0);
        
        filteredOccupancyBookings.forEach(b => {
             if(b.status === 'cancelled') return;
            const dStart = new Date(b.startTime);
            const dEnd = new Date(b.endTime);
            if(isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) return;
            const bookingStartVal = dStart.getHours() + dStart.getMinutes()/60;
            const bookingEndVal = dEnd.getHours() + dEnd.getMinutes()/60;
            for (let h = start; h < end; h++) {
                const slotStart = h;
                const slotEnd = h + 1;
                if (bookingStartVal < slotEnd && bookingEndVal > slotStart) {
                    const index = h - start;
                    if (index >= 0 && index < hourCounts.length) {
                        hourCounts[index]++;
                    }
                }
            }
        });
        return hourCounts;
    }, [filteredOccupancyBookings, configStartHour, configEndHour]);

    const maxHourlyDemand = Math.max(...hourlyDemand, 1);

    const handleSpecialistToggle = (spec: string) => {
        setSelectedSpecialists(prev => 
            prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
        );
    };

    // --- SALES CONTROL LOGIC ---

    const getRangeParams = () => {
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date();
        let numMonths = 1;

        if (salesTimeRange === 'specific_month') {
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0); // Last day of month
            endDate.setHours(23, 59, 59, 999);
            numMonths = 1;
        } else {
            // Ranges relative to NOW
            endDate = now;
            startDate = new Date(now);
            if (salesTimeRange === '3m') { startDate.setMonth(now.getMonth() - 2); startDate.setDate(1); numMonths = 3; }
            if (salesTimeRange === '6m') { startDate.setMonth(now.getMonth() - 5); startDate.setDate(1); numMonths = 6; }
            if (salesTimeRange === '1y') { startDate.setFullYear(now.getFullYear() - 1); startDate.setMonth(now.getMonth() + 1); startDate.setDate(1); numMonths = 12; }
            if (salesTimeRange === '2y') { startDate.setFullYear(now.getFullYear() - 2); startDate.setMonth(now.getMonth() + 1); startDate.setDate(1); numMonths = 24; }
        }
        
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const numDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

        return { startDate, endDate, numMonths, numDays };
    };

    const salesControlData = useMemo(() => {
        const { startDate, endDate, numMonths, numDays } = getRangeParams();
        
        // 1. Filter Bookings Generation (Uses createdAt: when the booking was MADE)
        const relevantBookings = allBookings.filter(b => {
            const d = b.createdAt ? new Date(b.createdAt) : new Date(b.startTime); // Fallback to startTime if old data lacks createdAt
            const matchesDate = d >= startDate && d <= endDate && b.status !== 'cancelled';
            const matchesSource = filterSource === 'all' || b.client.source === filterSource;
            return matchesDate && matchesSource;
        });

        const totalBookings = relevantBookings.length;

        // Group bookings for trend chart (Booking Generation)
        const isMonthlyView = salesTimeRange !== 'specific_month';
        const trendData: Record<string, number> = {};
        
        relevantBookings.forEach(b => {
            const d = b.createdAt ? new Date(b.createdAt) : new Date(b.startTime);
            let key = '';
            if (isMonthlyView) {
                key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
            } else {
                key = String(d.getDate()); // Day number
            }
            trendData[key] = (trendData[key] || 0) + 1;
        });

        // 2. New Clients Logic (Uses Service Date: startTime/timestamp, NOT createdAt)
        // AND ONLY if service is COMPLETED (Booking confirmed)
        // EXCLUDE Down Payments (Señas) -> Wait for the booking completion.
        const clientFirstCompletedVisit: Record<string, { time: number, source: string }> = {};
        
        // Check Sales (Sales are considered completed transactions, BUT exclude booking deposits)
        allSales.forEach(s => {
            // Heuristic: If it's a down payment for a booking, ignore it for acquisition. 
            // We want to count when the service is actually DELIVERED (Booking Completed).
            if (s.comments && s.comments.includes('Seña para reserva')) {
                return;
            }

            const dni = s.client.dni;
            const time = new Date(s.timestamp).getTime();
            const source = s.client.source || 'Otros';
            if (!clientFirstCompletedVisit[dni] || time < clientFirstCompletedVisit[dni].time) {
                clientFirstCompletedVisit[dni] = { time, source };
            }
        });
        
        // Check Bookings (ONLY status === 'completed')
        allBookings.forEach(b => {
            if (b.status === 'completed') {
                const dni = b.client.dni;
                // Use SERVICE DATE (startTime), not creation date
                const time = new Date(b.startTime).getTime(); 
                const source = b.client.source || 'Otros';
                if (!clientFirstCompletedVisit[dni] || time < clientFirstCompletedVisit[dni].time) {
                    clientFirstCompletedVisit[dni] = { time, source };
                }
            }
        });

        let newClientsCount = 0;
        const newClientTrend: Record<string, number> = {};
        const newClientsBySource: Record<string, number> = {};

        // Count if first COMPLETED visit falls in range AND matches filter source
        Object.values(clientFirstCompletedVisit).forEach(({ time, source }) => {
            const d = new Date(time);
            if (d >= startDate && d <= endDate) {
                if (filterSource === 'all' || source === filterSource) {
                    newClientsCount++;
                    let key = '';
                    if (isMonthlyView) {
                        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    } else {
                        key = String(d.getDate());
                    }
                    newClientTrend[key] = (newClientTrend[key] || 0) + 1;
                    
                    // Aggregate Source Distribution
                    newClientsBySource[source] = (newClientsBySource[source] || 0) + 1;
                }
            }
        });

        // Goals
        const goalKey = `${year}-${month}`;
        const currentBookingGoal = bookingGoals[goalKey] || 0;
        const currentClientGoal = clientGoals[goalKey] || 0;

        return {
            totalBookings,
            trendData,
            newClientsCount,
            newClientTrend,
            newClientsBySource, // Include source data
            isMonthlyView,
            currentBookingGoal,
            currentClientGoal,
            avgBookingsDay: totalBookings / numDays,
            avgBookingsMonth: totalBookings / numMonths,
            avgClientsDay: newClientsCount / numDays,
            avgClientsMonth: newClientsCount / numMonths
        };

    }, [allBookings, allSales, salesTimeRange, bookingGoals, clientGoals, year, month, filterSource]);

    // --- FINANCIAL & CONVERSION LOGIC ---
    const financialData = useMemo(() => {
        // Filter by Year/Month
        const filteredExpenses = expenses.filter(e => {
            const d = new Date(e.timestamp);
            return d.getFullYear() === year && d.getMonth() === month;
        });
        
        const filteredSales = allSales.filter(s => {
            const d = new Date(s.timestamp);
            return d.getFullYear() === year && d.getMonth() === month;
        });

        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalSales = filteredSales.reduce((sum, s) => {
            const saleTotal = s.payments.reduce((pSum, p) => pSum + p.amount, 0);
            return sum + saleTotal;
        }, 0);

        const netProfit = totalSales - totalExpenses;
        const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

        // UPDATED: Evaluation (formerly DG) Conversion
        // 1. Find all "Evaluación" appointments (Specialist = 'D.G.' or 'Evaluación')
        // Using Set to count unique clients
        const evalClients = new Set<string>();
        allBookings.forEach(b => {
            const isEval = b.specialist === 'D.G.' || b.specialist === 'Evaluación' || b.specialist === 'Evaluacion';
            // Count COMPLETED evaluations as the base denominator (those who received the evaluation)
            if (isEval && b.status === 'completed') {
                evalClients.add(b.client.dni);
            }
        });

        // 2. Check if they returned for a PAID service (Not Evaluation/D.G.)
        let convertedCount = 0;
        evalClients.forEach(dni => {
            const hasPaidBooking = allBookings.some(b => 
                b.client.dni === dni && 
                b.specialist !== 'D.G.' && 
                b.specialist !== 'Evaluación' &&
                b.specialist !== 'Evaluacion' &&
                b.status !== 'cancelled'
            );
            if (hasPaidBooking) convertedCount++;
        });

        const evalConversionRate = evalClients.size > 0 ? (convertedCount / evalClients.size) * 100 : 0;

        return {
            totalSales,
            totalExpenses,
            netProfit,
            profitMargin,
            evalTotal: evalClients.size,
            evalConverted: convertedCount,
            evalConversionRate
        };
    }, [expenses, allSales, allBookings, year, month]);


    // Chart Helpers
    const chartLabels = useMemo(() => {
        const { startDate, endDate } = getRangeParams();
        const labels = [];
        
        if (salesControlData.isMonthlyView) {
            let curr = new Date(startDate);
            // Ensure we start at the beginning of the month for the loop
            curr.setDate(1);
            while (curr <= endDate) {
                const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
                labels.push({ key, label: MONTHS[curr.getMonth()].substring(0, 3) });
                curr.setMonth(curr.getMonth() + 1);
            }
        } else {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for(let i=1; i<=daysInMonth; i++) {
                labels.push({ key: String(i), label: String(i) });
            }
        }
        return labels;
    }, [salesControlData.isMonthlyView, salesTimeRange, year, month]);

    // Pie Chart Logic
    const pieChartData = useMemo(() => {
        const segments = Object.entries(salesControlData.newClientsBySource).map(([source, count]) => ({
            source,
            count: Number(count),
            color: getColor(source)
        })).sort((a, b) => b.count - a.count);

        const total = segments.reduce((sum, item) => sum + item.count, 0);
        let currentAngle = 0;
        const gradientParts = segments.map(item => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0;
            const start = currentAngle;
            const end = currentAngle + percentage;
            currentAngle = end;
            return `${item.color} ${start}% ${end}%`;
        });

        const background = total > 0 ? `conic-gradient(${gradientParts.join(', ')})` : '#f3f4f6';

        return { segments, total, background };
    }, [salesControlData.newClientsBySource]);


    return (
        <div className="space-y-8">
            {/* Tabs - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-1 bg-slate-200 p-1 rounded-xl w-full sm:w-fit mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('sales_control')}
                    className={`w-full sm:w-auto justify-center px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap ${
                        activeTab === 'sales_control' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                    }`}
                >
                    Clientes y Reservas
                </button>
                <button
                    onClick={() => setActiveTab('occupancy')}
                    className={`w-full sm:w-auto justify-center px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap ${
                        activeTab === 'occupancy' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                    }`}
                >
                    Ocupación
                </button>
                <button
                    onClick={() => setActiveTab('financials')}
                    className={`w-full sm:w-auto justify-center px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap ${
                        activeTab === 'financials' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                    }`}
                >
                    Resultado Operativos $
                </button>
            </div>

            {activeTab === 'sales_control' && (
                <>
                    {/* Filters Header */}
                    <div className="bg-white p-4 rounded-xl shadow-lg flex flex-col xl:flex-row justify-between items-center gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                            <h2 className="text-2xl font-bold text-slate-800 whitespace-nowrap text-center sm:text-left">Control de Clientes y Reservas</h2>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full sm:w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                </select>
                                <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full sm:w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                            <select 
                                value={filterSource} 
                                onChange={e => setFilterSource(e.target.value)} 
                                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-purple-500 focus:border-purple-500 bg-white"
                            >
                                <option value="all">Todos los Orígenes</option>
                                {SOURCES.map(src => <option key={src} value={src}>{src}</option>)}
                            </select>

                            <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
                                {(['specific_month', '3m', '6m', '1y', '2y'] as const).map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setSalesTimeRange(range)}
                                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                                            salesTimeRange === range 
                                            ? 'bg-white text-purple-700 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        {range === 'specific_month' ? 'Mes Específico' : range.replace('m', ' Meses').replace('y', ' Años').replace('1 Años', '1 Año')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bookings Analysis */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* KPI: Total Bookings */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500 flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Total Reservas Generadas</h3>
                                <p className="text-4xl font-bold text-slate-800 mb-2">{salesControlData.totalBookings}</p>
                                <div className="flex gap-4 text-xs text-slate-500 mb-4">
                                    <div>
                                        <span className="font-semibold block text-slate-700">{salesControlData.avgBookingsMonth.toFixed(1)}</span>
                                        <span>Prom. Mes</span>
                                    </div>
                                    <div>
                                        <span className="font-semibold block text-slate-700">{salesControlData.avgBookingsDay.toFixed(1)}</span>
                                        <span>Prom. Día</span>
                                    </div>
                                </div>
                            </div>
                            
                            {salesTimeRange === 'specific_month' && salesControlData.currentBookingGoal > 0 && filterSource === 'all' && (
                                <div>
                                    <div className="flex justify-between text-xs font-semibold mb-1">
                                        <span className="text-blue-600">
                                            {Math.min(100, (salesControlData.totalBookings / salesControlData.currentBookingGoal) * 100).toFixed(0)}% de la meta
                                        </span>
                                        <span className="text-slate-400">Meta: {salesControlData.currentBookingGoal}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div 
                                            className="h-full rounded-full bg-blue-500" 
                                            style={{ width: `${Math.min(100, (salesControlData.totalBookings / salesControlData.currentBookingGoal) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Chart: Booking Trends */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">
                                Tendencia de Generación de Reservas 
                                <span className="text-sm font-normal text-slate-500 ml-2">({salesControlData.isMonthlyView ? 'Por Mes' : 'Por Día'})</span>
                            </h3>
                            {/* Updated CSS for better scroll and visibility */}
                            <div 
                                key={`booking-trend-${salesControlData.totalBookings}-${salesTimeRange}-${year}-${month}-${filterSource}`}
                                className="h-40 flex items-end justify-start gap-2 overflow-x-auto px-2 pb-2 relative"
                            >
                                 {/* Background Grid Lines for Scale Context */}
                                 <div className="absolute inset-0 flex flex-col justify-between pointer-events-none px-2 pb-6">
                                    <div className="border-t border-slate-100 w-full h-0 relative"><span className="absolute -top-3 right-0 text-[9px] text-slate-300">Max</span></div>
                                    <div className="border-t border-slate-100 w-full h-0"></div>
                                    <div className="border-t border-slate-100 w-full h-0"></div>
                                </div>

                                {chartLabels.map(({ key, label }) => {
                                    const val = salesControlData.trendData[key] || 0;
                                    // Use explicit Max from data for scaling, fallback to 10
                                    const maxDataVal = Math.max(...(Object.values(salesControlData.trendData) as number[]), 0);
                                    const yAxisMax = maxDataVal === 0 ? 10 : maxDataVal;
                                    const heightPercent = (val / yAxisMax) * 100;
                                    
                                    return (
                                        <div key={key} className="w-8 flex-shrink-0 flex flex-col items-center group relative z-10 justify-end h-full">
                                            {/* Show value directly if > 0 */}
                                            {val > 0 && (
                                                <span className="text-[10px] font-bold text-slate-600 mb-1 animate-fade-in">{val}</span>
                                            )}
                                            <div 
                                                className="w-full bg-blue-400 rounded-t opacity-80 hover:opacity-100 transition-all duration-500 relative"
                                                style={{ height: `${Math.max(heightPercent, 2)}%`, minHeight: val > 0 ? '4px' : '0' }}
                                            >
                                                {/* Tooltip */}
                                                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20 pointer-events-none">
                                                    {label}: {val}
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-1 truncate w-full text-center">{label}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* New Clients Analysis */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* KPI: New Clients */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500 flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Clientes Nuevos Únicos</h3>
                                <p className="text-4xl font-bold text-slate-800 mb-2">{salesControlData.newClientsCount}</p>
                                <div className="flex gap-4 text-xs text-slate-500 mb-4">
                                    <div>
                                        <span className="font-semibold block text-slate-700">{salesControlData.avgClientsMonth.toFixed(1)}</span>
                                        <span>Prom. Mes</span>
                                    </div>
                                    <div>
                                        <span className="font-semibold block text-slate-700">{salesControlData.avgClientsDay.toFixed(1)}</span>
                                        <span>Prom. Día</span>
                                    </div>
                                </div>
                            </div>
                            
                            {salesTimeRange === 'specific_month' && salesControlData.currentClientGoal > 0 && filterSource === 'all' && (
                                <div>
                                    <div className="flex justify-between text-xs font-semibold mb-1">
                                        <span className="text-green-600">
                                            {Math.min(100, (salesControlData.newClientsCount / salesControlData.currentClientGoal) * 100).toFixed(0)}% de la meta
                                        </span>
                                        <span className="text-slate-400">Meta: {salesControlData.currentClientGoal}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div 
                                            className="h-full rounded-full bg-green-500" 
                                            style={{ width: `${Math.min(100, (salesControlData.newClientsCount / salesControlData.currentClientGoal) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Chart: New Clients Trends */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">
                                Adquisición de Clientes 
                                <span className="text-sm font-normal text-slate-500 ml-2">({salesControlData.isMonthlyView ? 'Por Mes' : 'Por Día'})</span>
                            </h3>
                            {/* Added KEY to force re-render on data change */}
                            <div 
                                key={`client-trend-${salesControlData.newClientsCount}-${salesTimeRange}-${year}-${month}-${filterSource}`}
                                className="h-40 flex items-end justify-start gap-2 overflow-x-auto px-2 pb-2 relative"
                            >
                                 {/* Background Grid Lines */}
                                 <div className="absolute inset-0 flex flex-col justify-between pointer-events-none px-2 pb-6">
                                    <div className="border-t border-slate-100 w-full h-0 relative"><span className="absolute -top-3 right-0 text-[9px] text-slate-300">Max</span></div>
                                    <div className="border-t border-slate-100 w-full h-0"></div>
                                    <div className="border-t border-slate-100 w-full h-0"></div>
                                </div>

                                {chartLabels.map(({ key, label }) => {
                                    const val = salesControlData.newClientTrend[key] || 0;
                                    const maxDataVal = Math.max(...(Object.values(salesControlData.newClientTrend) as number[]), 0);
                                    const yAxisMax = maxDataVal === 0 ? 10 : maxDataVal;
                                    const heightPercent = (val / yAxisMax) * 100;
                                    
                                    return (
                                        <div key={key} className="w-8 flex-shrink-0 flex flex-col items-center group relative z-10 justify-end h-full">
                                            {/* Show value directly if > 0 */}
                                            {val > 0 && (
                                                <span className="text-[10px] font-bold text-slate-600 mb-1 animate-fade-in">{val}</span>
                                            )}
                                            <div 
                                                className="w-full bg-green-400 rounded-t opacity-80 hover:opacity-100 transition-all duration-500 relative"
                                                style={{ height: `${Math.max(heightPercent, 2)}%`, minHeight: val > 0 ? '4px' : '0' }}
                                            >
                                                {/* Tooltip */}
                                                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20 pointer-events-none">
                                                    {label}: {val}
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-1 truncate w-full text-center">{label}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Source Distribution & Eval Conversion Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        {/* Source Distribution Pie Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-lg">
                            <h3 className="text-lg font-bold text-slate-800 mb-6">Distribución de Clientes Nuevos por Origen</h3>
                            <div className="flex flex-col sm:flex-row items-center justify-around gap-8">
                                {/* Donut Chart Visual */}
                                <div 
                                    className="relative w-48 h-48 rounded-full shadow-sm" 
                                    style={{ background: pieChartData.background }}
                                >
                                    <div className="absolute inset-0 m-8 bg-white rounded-full flex items-center justify-center shadow-inner">
                                        <div className="text-center">
                                            <span className="text-2xl font-bold text-slate-700 block">{pieChartData.total}</span>
                                            <span className="text-xs text-slate-400">Total</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Legend */}
                                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                    {pieChartData.segments.map(item => (
                                        <div key={item.source} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                            <span className="text-sm font-medium text-slate-600">{item.source}</span>
                                            <span className="text-sm font-bold text-slate-800">({item.count})</span>
                                            <span className="text-xs text-slate-400">({pieChartData.total > 0 ? ((item.count/pieChartData.total)*100).toFixed(0) : 0}%)</span>
                                        </div>
                                    ))}
                                    {pieChartData.total === 0 && <p className="text-slate-400 text-sm col-span-2 italic">Sin datos para mostrar.</p>}
                                </div>
                            </div>
                        </div>

                        {/* Evaluation Conversion Card */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-purple-500">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Conversión de Evaluaciones</h3>
                            <p className="text-sm text-slate-500 mb-6">Porcentaje de clientes que tuvieron una cita de "Evaluación" (antes D.G.) completada y regresaron para un servicio pagado.</p>
                            
                            <div className="flex items-center justify-around">
                                <div className="relative w-32 h-32 flex items-center justify-center">
                                    <svg className="transform -rotate-90 w-32 h-32">
                                        <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                                        <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={377} strokeDashoffset={377 - (377 * financialData.evalConversionRate) / 100} className="text-purple-600 transition-all duration-1000" />
                                    </svg>
                                    <span className="absolute text-xl font-bold text-slate-800">{financialData.evalConversionRate.toFixed(0)}%</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                                        <span className="text-sm text-slate-600">Evaluaciones Completadas: <strong>{financialData.evalTotal}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                                        <span className="text-sm text-slate-600">Convirtieron: <strong>{financialData.evalConverted}</strong></span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 p-3 bg-purple-50 rounded-lg text-xs text-purple-800">
                                <strong>Nota:</strong> Se cuenta como "conversión" si el cliente tiene una cita posterior con otro especialista que no sea Evaluación/D.G.
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'occupancy' && (
                <>
                    {/* Header & Global Filter (Year) */}
                    <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col lg:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-bold text-slate-800">Ocupación & Eficiencia</h2>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-4 justify-center">
                            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            
                            <select value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} className="px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                <option value={0}>Todas las Semanas</option>
                                <option value={1}>Semana 1 (1-7)</option>
                                <option value={2}>Semana 2 (8-14)</option>
                                <option value={3}>Semana 3 (15-21)</option>
                                <option value={4}>Semana 4 (22-28)</option>
                                <option value={5}>Semana 5 (29+)</option>
                            </select>

                            <select value={selectedDayOfWeek} onChange={e => setSelectedDayOfWeek(Number(e.target.value))} className="px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                <option value={0}>Todos los Días</option>
                                {DAYS_OF_WEEK.map(day => <option key={day.id} value={day.id}>{day.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Specialist Filter */}
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">Filtrar/Agrupar Especialistas</h3>
                        <div className="flex flex-wrap gap-3">
                            {allSpecialists.map(spec => (
                                <button
                                    key={spec}
                                    onClick={() => handleSpecialistToggle(spec)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                        selectedSpecialists.includes(spec)
                                        ? 'bg-purple-100 border-purple-500 text-purple-800'
                                        : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    {spec}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* KPI Card: Occupancy */}
                        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col justify-center items-center">
                            <h3 className="text-slate-500 font-semibold mb-2">Ocupación Global</h3>
                            <div className="relative flex items-center justify-center h-32 w-32">
                                    <svg className="transform -rotate-90 w-32 h-32">
                                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={377} strokeDashoffset={377 - (377 * capacityData.occupancyRate) / 100} className="text-purple-600 transition-all duration-1000" />
                                </svg>
                                <span className="absolute text-2xl font-bold text-slate-800">{capacityData.occupancyRate.toFixed(0)}%</span>
                            </div>
                            <div className="text-center mt-4 text-sm text-slate-500">
                                <p>{capacityData.totalHoursBooked.toFixed(1)} hrs ocupadas</p>
                            </div>
                        </div>

                        {/* KPI Card: No Show */}
                        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col justify-center items-center">
                                <h3 className="text-slate-500 font-semibold mb-2">Tasa de Ausentismo (No Show)</h3>
                                <div className="relative flex items-center justify-center h-32 w-32">
                                    <svg className="transform -rotate-90 w-32 h-32">
                                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={377} strokeDashoffset={377 - (377 * capacityData.noShowRate) / 100} className="text-gray-500 transition-all duration-1000" />
                                </svg>
                                <span className="absolute text-2xl font-bold text-slate-700">{capacityData.noShowRate.toFixed(1)}%</span>
                            </div>
                                <div className="text-center mt-4 text-sm text-slate-500">
                                <p>{capacityData.noShowCount} clientes no vinieron</p>
                            </div>
                        </div>

                        {/* Occupancy by Specialist Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-lg md:col-span-2">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Ocupación por Especialista</h3>
                            <div className="space-y-4">
                                {occupancyBySpecialist.map((data) => (
                                    <div key={data.name} className="relative">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold text-slate-700">{data.name}</span>
                                            <span className="text-slate-500">{data.percentage.toFixed(1)}% ({data.hoursBooked.toFixed(1)} hrs)</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                                            <div 
                                                className="h-full rounded-full bg-purple-500" 
                                                style={{ width: `${data.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                                {occupancyBySpecialist.length === 0 && <p className="text-slate-400 text-sm">Seleccione especialistas para ver la comparativa.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Hourly Heatmap / Demand Chart */}
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                            <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Demanda por Hora</h3>
                            <p className="text-sm text-slate-500">Identifique las horas más solicitadas y los horarios vacíos en el periodo seleccionado.</p>
                            </div>
                            
                            <div className="h-64 flex items-end justify-start gap-1 px-2">
                            {hourlyDemand.map((count, index) => {
                                const hour = Math.floor(configStartHour) + index;
                                const heightPercent = (count / maxHourlyDemand) * 100;
                                let barColor = 'bg-green-400'; 
                                if (heightPercent > 40) barColor = 'bg-yellow-400'; 
                                if (heightPercent > 75) barColor = 'bg-red-400'; 
                                const isLunchHour = hour === 13;
                                
                                return (
                                    <div key={hour} className="flex-1 flex flex-col items-center group relative min-w-[20px]">
                                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 transition-opacity">
                                            {hour}:00 - {count} reservas totales
                                        </div>
                                        <div 
                                            className={`w-full mx-0.5 rounded-t-md transition-all duration-500 ${barColor} opacity-80 hover:opacity-100 z-10`}
                                            style={{ height: `${Math.max(heightPercent, 5)}%` }}
                                        ></div>
                                        <span className={`text-xs font-mono mt-2 ${isLunchHour ? 'text-orange-600 font-bold' : 'text-slate-500'}`}>{hour}</span>
                                    </div>
                                )
                            })}
                            </div>
                    </div>
                </>
            )}

            {activeTab === 'financials' && (
                <>
                    <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                        <h2 className="text-2xl font-bold text-slate-800">Resultado Operativos $</h2>
                        <div className="flex gap-2">
                            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Financial P&L Card */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-blue-500 max-w-4xl mx-auto">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Estado de Resultados (Aprox.)</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                                <span className="text-green-800 font-semibold">Total Ingresos (Ventas)</span>
                                <span className="text-xl font-bold text-green-700">S/ {financialData.totalSales.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                                <span className="text-red-800 font-semibold">Total Gastos Operativos</span>
                                <span className="text-xl font-bold text-red-700">- S/ {financialData.totalExpenses.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-slate-200 my-2"></div>
                            <div className="flex justify-between items-center p-4 bg-slate-800 text-white rounded-xl shadow-md">
                                <span className="font-bold">Utilidad Neta Estimada</span>
                                <div className="text-right">
                                    <span className={`text-2xl font-bold block ${financialData.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        S/ {financialData.netProfit.toFixed(2)}
                                    </span>
                                    <span className="text-xs opacity-70">Margen: {financialData.profitMargin.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ManagementDashboard;
