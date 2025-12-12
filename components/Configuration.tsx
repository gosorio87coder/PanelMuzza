
import React, { useState } from 'react';
import { Specialist, DaySchedule } from '../types';

interface ConfigurationProps {
    specialists: Specialist[];
    setSpecialists: (specialists: Specialist[]) => Promise<void>; // Updated to async
    weeklySchedule: Record<number, DaySchedule>;
    setWeeklySchedule: (schedule: Record<number, DaySchedule>) => Promise<void>; // Updated to async
    salesGoals: Record<string, number>; // Key format "YYYY-MM"
    setSalesGoals: (goals: Record<string, number>) => Promise<void>; // Updated to async
    bookingGoals: Record<string, number>;
    setBookingGoals: (goals: Record<string, number>) => Promise<void>; // Updated to async
    clientGoals: Record<string, number>;
    setClientGoals: (goals: Record<string, number>) => Promise<void>; // Updated to async
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const GoalSetter = ({ 
    title, 
    description, 
    goals, 
    setGoals, 
    unitPrefix = '', 
    placeholder = 'Ej: 20000',
    color = 'purple'
}: { 
    title: string, 
    description: string, 
    goals: Record<string, number>, 
    setGoals: (goals: Record<string, number>) => Promise<void>,
    unitPrefix?: string,
    placeholder?: string,
    color?: string
}) => {
    const [year, setYear] = useState(2025);
    const [month, setMonth] = useState(11); // Default to Dec
    const [amount, setAmount] = useState('');

    const handleSetGoal = async () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val < 0) {
            alert("Por favor ingrese un monto válido.");
            return;
        }
        const key = `${year}-${month}`;
        // Call the async save function passed from App
        await setGoals({ ...goals, [key]: val });
        alert(`Meta actualizada para ${MONTHS[month]} ${year}`);
        setAmount('');
    };

    const sortedKeys = Object.keys(goals).sort((a, b) => {
        const [yearA, monthA] = a.split('-').map(Number);
        const [yearB, monthB] = b.split('-').map(Number);
        if (yearA !== yearB) return yearA - yearB;
        return monthA - monthB;
    });

    const yearOptions = Array.from({ length: 6 }, (_, i) => 2025 + i);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-slate-800 mb-4">{title}</h3>
            <p className="text-sm text-slate-500 mb-4">{description}</p>
            
            <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg">
                    <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Año</label>
                    <select 
                        value={year} 
                        onChange={e => setYear(Number(e.target.value))}
                        className={`w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-${color}-500 focus:border-${color}-500`}
                    >
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Mes</label>
                    <select 
                        value={month} 
                        onChange={e => setMonth(Number(e.target.value))}
                        className={`w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-${color}-500 focus:border-${color}-500`}
                    >
                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Meta</label>
                    <input 
                        type="number" 
                        value={amount} 
                        onChange={e => setAmount(e.target.value)}
                        placeholder={placeholder}
                        className={`w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-${color}-500 focus:border-${color}-500`}
                    />
                </div>
                <button 
                    onClick={handleSetGoal}
                    className={`w-full md:w-auto px-6 py-2 bg-${color}-600 text-white font-bold rounded-lg shadow-md hover:bg-${color}-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${color}-500`}
                >
                    Guardar
                </button>
            </div>
            
            <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-500 mb-2">Historial de Metas</h4>
                {sortedKeys.length === 0 ? (
                    <p className="text-slate-400 text-sm italic">No hay metas configuradas aún.</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {sortedKeys.map((key) => {
                                const [y, m] = key.split('-').map(Number);
                                const val = goals[key];
                                return (
                                    <div key={key} className={`p-3 rounded-lg border border-${color}-200 bg-${color}-50`}>
                                        <p className={`text-xs font-bold text-${color}-800 uppercase`}>{MONTHS[m]} {y}</p>
                                        <p className={`text-lg font-mono font-semibold text-${color}-900`}>
                                            {unitPrefix} {val}
                                        </p>
                                    </div>
                                )
                            })}
                    </div>
                )}
            </div>
        </div>
    );
};

const Configuration: React.FC<ConfigurationProps> = ({
    specialists, setSpecialists,
    weeklySchedule, setWeeklySchedule,
    salesGoals, setSalesGoals,
    bookingGoals, setBookingGoals,
    clientGoals, setClientGoals
}) => {
    const [newSpecialistName, setNewSpecialistName] = useState('');

    const handleAddSpecialist = async () => {
        const trimmedName = newSpecialistName.trim();
        if (trimmedName && !specialists.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
            const newSpecialist: Specialist = { name: trimmedName, active: true };
            await setSpecialists([...specialists, newSpecialist]);
            setNewSpecialistName('');
        }
    };

    const handleToggleSpecialistActive = async (specialistName: string) => {
        await setSpecialists(
            specialists.map(s => 
                s.name === specialistName ? { ...s, active: !s.active } : s
            )
        );
    };

    const handleScheduleChange = async (dayId: number, field: keyof DaySchedule, value: any) => {
        await setWeeklySchedule({
            ...weeklySchedule,
            [dayId]: {
                ...weeklySchedule[dayId],
                [field]: value
            }
        });
    };

    const hourOptions = Array.from({ length: 24 }, (_, i) => i);
    const sortedDays = (Object.values(weeklySchedule) as DaySchedule[]).sort((a, b) => a.dayId - b.dayId);

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-slate-800">Configuración del Panel</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Financial Goals */}
                <div className="lg:col-span-2">
                    <GoalSetter 
                        title="Meta Financiera de Ventas" 
                        description="Defina la meta de ingresos (S/) por mes."
                        goals={salesGoals}
                        setGoals={setSalesGoals}
                        unitPrefix="S/"
                        placeholder="Ej: 15000"
                        color="purple"
                    />
                </div>

                {/* Booking Goals */}
                <div className="lg:col-span-1">
                    <GoalSetter 
                        title="Meta de Cantidad de Reservas" 
                        description="Defina el número objetivo de citas por mes."
                        goals={bookingGoals}
                        setGoals={setBookingGoals}
                        placeholder="Ej: 150"
                        color="blue"
                    />
                </div>

                {/* Client Goals */}
                <div className="lg:col-span-1">
                    <GoalSetter 
                        title="Meta de Nuevos Clientes" 
                        description="Defina el objetivo de clientes nuevos únicos por mes."
                        goals={clientGoals}
                        setGoals={setClientGoals}
                        placeholder="Ej: 30"
                        color="green"
                    />
                </div>
            </div>

            {/* Manage Specialists */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Gestionar Especialistas</h3>
                <div className="space-y-3 mb-4">
                    {specialists.map(s => (
                        <div key={s.name} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className={`font-medium ${s.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{s.name}</span>
                            <label htmlFor={`toggle-active-${s.name}`} className="flex items-center cursor-pointer">
                                <span className={`text-sm font-semibold mr-3 ${s.active ? 'text-green-600' : 'text-slate-500'}`}>{s.active ? 'Activo' : 'Inactivo'}</span>
                                <div className="relative">
                                    <input 
                                        id={`toggle-active-${s.name}`} 
                                        type="checkbox" 
                                        className="sr-only" 
                                        checked={s.active} 
                                        onChange={() => handleToggleSpecialistActive(s.name)} 
                                    />
                                    <div className={`block ${s.active ? 'bg-purple-600' : 'bg-gray-300'} w-10 h-6 rounded-full`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${s.active ? 'translate-x-4' : ''}`}></div>
                                </div>
                            </label>
                        </div>
                    ))}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                    <input
                        type="text"
                        value={newSpecialistName}
                        onChange={(e) => setNewSpecialistName(e.target.value)}
                        placeholder="Nombre de la nueva especialista"
                        className="flex-grow px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                    />
                    <button onClick={handleAddSpecialist} className="px-5 py-2 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700">
                        Añadir
                    </button>
                </div>
            </div>

            {/* Weekly Schedule Settings */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Horario Semanal de Agenda</h3>
                <div className="space-y-4">
                    {sortedDays.map(day => (
                        <div key={day.dayId} className={`border rounded-lg p-4 ${day.isOpen ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center justify-between md:justify-start min-w-[140px]">
                                    <span className={`font-bold ${day.isOpen ? 'text-slate-800' : 'text-slate-400'}`}>{day.name}</span>
                                    <label className="relative inline-flex items-center cursor-pointer md:ml-3">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={day.isOpen} 
                                            onChange={e => handleScheduleChange(day.dayId, 'isOpen', e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                    </label>
                                </div>

                                {day.isOpen && (
                                    <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-500">De:</span>
                                            <select 
                                                value={day.startHour} 
                                                onChange={e => handleScheduleChange(day.dayId, 'startHour', Number(e.target.value))}
                                                className="px-2 py-1 border border-slate-300 rounded text-sm"
                                            >
                                                {hourOptions.map(h => <option key={h} value={h}>{h}:00</option>)}
                                            </select>
                                            <span className="text-sm text-slate-500">A:</span>
                                            <select 
                                                value={day.endHour} 
                                                onChange={e => handleScheduleChange(day.dayId, 'endHour', Number(e.target.value))}
                                                className="px-2 py-1 border border-slate-300 rounded text-sm"
                                            >
                                                {hourOptions.map(h => <option key={h} value={h}>{h}:00</option>)}
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-2 sm:ml-4 sm:border-l sm:pl-4 border-slate-200 w-full sm:w-auto">
                                            <label className="flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={day.hasLunch} 
                                                    onChange={e => handleScheduleChange(day.dayId, 'hasLunch', e.target.checked)}
                                                    className="h-4 w-4 text-orange-500 focus:ring-orange-400 border-gray-300 rounded"
                                                />
                                                <span className="ml-2 text-sm font-medium text-slate-600">Almuerzo</span>
                                            </label>
                                            
                                            {day.hasLunch && (
                                                <div className="flex items-center gap-1 ml-auto sm:ml-2 animate-fade-in">
                                                    <select 
                                                        value={day.lunchStartHour} 
                                                        onChange={e => handleScheduleChange(day.dayId, 'lunchStartHour', Number(e.target.value))}
                                                        className="px-2 py-1 border border-orange-200 rounded text-sm bg-orange-50 text-orange-800"
                                                    >
                                                        {hourOptions.map(h => <option key={h} value={h}>{h}:00</option>)}
                                                    </select>
                                                    <span className="text-slate-400">-</span>
                                                    <select 
                                                        value={day.lunchEndHour} 
                                                        onChange={e => handleScheduleChange(day.dayId, 'lunchEndHour', Number(e.target.value))}
                                                        className="px-2 py-1 border border-orange-200 rounded text-sm bg-orange-50 text-orange-800"
                                                    >
                                                        {hourOptions.map(h => <option key={h} value={h}>{h}:00</option>)}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {!day.isOpen && <span className="text-sm text-slate-400 italic flex-1 text-right md:text-left">Cerrado</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Configuration;
