
import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Booking, FollowUpTracking, FollowUpState, FollowUpStatus, Client, UserRole } from '../types';
import { MONTHS } from '../constants';

declare const XLSX: any;

interface FollowUpDashboardProps {
    sales: Sale[];
    bookings: Booking[];
    tracking: FollowUpTracking;
    onUpdateTracking: (saleId: string, newState: FollowUpState) => void;
    onBookAppointment: (client: Client) => void;
    onArchiveClient: (saleId: string) => void;
    onBulkArchive: (saleIds: string[]) => void;
    currentUserRole: UserRole;
}

// Moved outside to prevent re-declaration on render
const StatusBadge = ({ status }: { status: FollowUpStatus }) => {
    const colors: Record<string, string> = {
        'PENDIENTE': 'bg-red-100 text-red-800',
        'CONTACTADO': 'bg-yellow-100 text-yellow-800',
        'AGENDADO': 'bg-green-100 text-green-800',
        'PERDIDO': 'bg-gray-100 text-gray-800'
    };
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${colors[status] || 'bg-gray-100'}`}>
            {status}
        </span>
    );
};

const MetricCard = ({ title, value, subtext, color }: { title: string, value: string, subtext: string, color: string }) => {
    return (
        <div className={`bg-white p-4 rounded-xl shadow border-l-4 border-${color}-500 flex flex-col justify-between`}>
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
            </div>
            <div className="mt-3">
                <div className={`text-3xl font-bold text-${color}-700`}>{value}</div>
                <p className="text-xs text-slate-500 mt-1">{subtext}</p>
            </div>
        </div>
    );
};

const FollowUpDashboard: React.FC<FollowUpDashboardProps> = ({ sales, bookings, tracking, onUpdateTracking, onBookAppointment, onArchiveClient, onBulkArchive, currentUserRole }) => {
    // Add 'ARCHIVADOS' to filter types
    const [activeFilter, setActiveFilter] = useState<'TODOS' | FollowUpStatus | 'REACTIVACION' | 'ARCHIVADOS'>('TODOS');
    
    // NEW: Date Filters
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<number>(-1); // -1 = All

    // NEW: Service Type Filter
    const [serviceTypeFilter, setServiceTypeFilter] = useState<'TODOS' | 'CEJAS' | 'LASER'>('TODOS');

    // NEW: Search State
    const [searchTerm, setSearchTerm] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editNotes, setEditNotes] = useState('');

    // NEW: Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Generate Years for filter (History support from 2022)
    const filterYears = Array.from({ length: currentYear - 2022 + 2 }, (_, i) => currentYear + 1 - i); // [2026, 2025, ... 2022]

    // Reset selection when filters change to avoid accidental actions on hidden items
    useEffect(() => {
        setSelectedIds(new Set());
    }, [activeFilter, selectedYear, selectedMonth, serviceTypeFilter, searchTerm]);

    const eligibleClients = useMemo(() => {
        // Helper to check if a record is from Bulk Upload
        const isBulkUpload = (source: string, comments?: string) => {
            const src = (source || '').toLowerCase();
            const cmt = (comments || '').toLowerCase();
            return src.includes('carga masiva') || cmt.includes('carga masiva') || cmt.includes('carga histórica');
        };

        // Source 1: Completed Bookings (The Source of Truth for new system)
        const bookingEvents = bookings
            .filter(b => b.status === 'completed')
            .filter(b => !isBulkUpload(b.client.source, b.comments)) // EXCLUDE BULK UPLOAD
            .map(b => ({
                id: b.id, // Use booking ID for tracking if available
                timestamp: new Date(b.startTime),
                client: b.client,
                serviceType: b.serviceType,
                procedure: b.procedure,
                bookingCode: b.bookingCode, // Included for search
                isLegacy: false
            }));

        // Source 2: Legacy Sales or Direct Sales (Not linked to bookings)
        // Filter out 'Adelantos' to avoid duplicates, keep 'Cierre' or null/regular sales
        const legacySalesEvents = sales
            .filter(s => !s.bookingId && s.transactionType !== 'adelanto')
            .filter(s => !isBulkUpload(s.client.source, s.comments)) // EXCLUDE BULK UPLOAD
            .map(s => ({
                id: s.id,
                timestamp: new Date(s.timestamp),
                client: s.client,
                serviceType: s.serviceType,
                procedure: s.procedure,
                bookingCode: undefined,
                isLegacy: true
            }));

        const allEvents = [...bookingEvents, ...legacySalesEvents];

        // Filter Logic:
        // 1. 'First Time' Eyebrow service (Service Type 'Cejas' AND Procedure is NOT 'Retoque')
        // 2. OR Laser Service (Service Type 'Remoción')
        return allEvents.filter(event => {
            const serviceType = (event.serviceType || '').toLowerCase();
            const procedure = (event.procedure || '').toLowerCase();
            
            const isCejasFirstTime = serviceType === 'cejas' && !procedure.includes('retoque');
            const isLaser = serviceType === 'remoción'; 

            return isCejasFirstTime || isLaser;
        }).map(event => {
            const eventDate = event.timestamp;
            const serviceType = (event.serviceType || '').toLowerCase();
            
            // Default target date is +40 days
            const targetDate = new Date(eventDate);
            targetDate.setDate(targetDate.getDate() + 40); 

            // Check for future booking (Return logic)
            const futureBooking = bookings.find(b => {
                const bService = (b.serviceType || '').toLowerCase();
                const bTime = new Date(b.startTime);
                
                // Must be AFTER the event date (add buffer of 1 day to avoid matching same day)
                if (bTime <= new Date(eventDate.getTime() + 86400000)) return false;
                // Same client
                if (b.client.dni !== event.client.dni) return false;

                if (serviceType === 'remoción') {
                    // Laser clients can return for Laser OR Cejas
                    return bService === 'remoción' || bService === 'cejas';
                } else {
                    // Cejas clients return for Cejas
                    return bService === 'cejas';
                }
            });

            // Determine Status
            let status: FollowUpStatus = 'PENDIENTE';
            // Use the event ID (booking ID or Sale ID) for tracking status
            const trackingData = tracking[event.id];

            if (futureBooking) {
                status = 'AGENDADO';
            } else if (trackingData?.status) {
                status = trackingData.status;
            }

            return {
                id: event.id,
                client: event.client,
                serviceType: event.serviceType,
                procedure: event.procedure,
                bookingCode: event.bookingCode,
                eventDate,
                targetDate,
                status,
                trackingData,
                hasFutureBooking: !!futureBooking,
                isLaser: serviceType === 'remoción'
            };
        }).sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
    }, [sales, bookings, tracking]);

    // Calculate Retention KPIs based on 40 Days
    const retentionStats = useMemo(() => {
        const now = new Date();
        const stats = {
            eligibleBase: 0, // Total clients who passed 40 days
            returnedCount: 0,
            pendingCount: 0
        };

        eligibleClients.forEach(client => {
            const daysSinceService = Math.floor((now.getTime() - client.eventDate.getTime()) / (1000 * 60 * 60 * 24));
            
            // Only count metrics for clients who have passed the 40-day mark
            if (daysSinceService >= 40) {
                stats.eligibleBase++;
                
                const hasReturned = client.hasFutureBooking || client.status === 'AGENDADO';
                if (hasReturned) {
                    stats.returnedCount++;
                } else {
                    stats.pendingCount++;
                }
            }
        });

        return stats;
    }, [eligibleClients]);

    const filteredList = useMemo(() => {
        const now = new Date();
        
        return eligibleClients.filter(item => {
            // 0. Search Filter
            if (searchTerm.trim()) {
                const lowerSearch = searchTerm.toLowerCase();
                const matchName = item.client.name.toLowerCase().includes(lowerSearch);
                const matchDni = item.client.dni.includes(lowerSearch);
                const matchPhone = item.client.phone.includes(lowerSearch);
                const matchCode = item.bookingCode?.toLowerCase().includes(lowerSearch);
                
                if (!matchName && !matchDni && !matchPhone && !matchCode) return false;
            }

            // 1. Time Filters (Year & Month)
            const itemDate = item.eventDate;
            const matchYear = itemDate.getFullYear() === selectedYear;
            const matchMonth = selectedMonth === -1 || itemDate.getMonth() === selectedMonth;

            if (!matchYear || !matchMonth) return false;

            // 2. Service Type Filter
            if (serviceTypeFilter === 'CEJAS' && item.isLaser) return false;
            if (serviceTypeFilter === 'LASER' && !item.isLaser) return false;

            // 3. Status & Tab Filters
            const isArchived = item.trackingData?.archived;

            // If viewing Archives, ONLY show archived
            if (activeFilter === 'ARCHIVADOS') {
                return isArchived;
            }

            // For ALL other views, HIDE archived items
            if (isArchived) {
                return false;
            }

            // Reactivation Logic
            if (activeFilter === 'REACTIVACION') {
                const daysSinceService = Math.floor((now.getTime() - item.eventDate.getTime()) / (1000 * 60 * 60 * 24));
                return daysSinceService > 330;
            }

            // Standard Filters
            if (activeFilter === 'TODOS') return true;
            return item.status === activeFilter;
        });
    }, [eligibleClients, activeFilter, selectedYear, selectedMonth, serviceTypeFilter, searchTerm]);

    const handleStatusChange = (saleId: string, newStatus: FollowUpStatus) => {
        const currentTracking = tracking[saleId] || { status: 'PENDIENTE' };
        onUpdateTracking(saleId, { ...currentTracking, status: newStatus });
    };

    const handleNotesSave = (saleId: string) => {
        const currentTracking = tracking[saleId] || { status: 'PENDIENTE' };
        onUpdateTracking(saleId, { ...currentTracking, notes: editNotes });
        setEditingId(null);
    };

    const startEditing = (saleId: string, currentNotes?: string) => {
        setEditingId(saleId);
        setEditNotes(currentNotes || '');
    };

    const handleArchiveClick = (saleId: string) => {
        if (window.confirm('¿Desea archivar este cliente? Desaparecerá de la lista de seguimiento activo.')) {
            onArchiveClient(saleId);
        }
    };

    const getWhatsAppLink = (phone: string, name: string, type: 'retoque' | 'anual', isLaser: boolean) => {
        const firstName = name.split(' ')[0];
        let message = '';
        
        if (type === 'anual') {
             message = `Hola ${firstName}, te escribimos de Muzza ✨. Hace un año nos visitaste. Es un buen momento para renovar tu mirada o evaluar tu progreso. ¿Te gustaría agendar una cita?`;
        } else {
             if (isLaser) {
                 message = `Hola ${firstName}, te escribimos de Muzza ✨. Han pasado unas semanas desde tu sesión de láser. Es importante la constancia para ver resultados, o si prefieres, podemos evaluar el diseño de tus cejas. ¿Te agendamos una cita?`;
             } else {
                 message = `Hola ${firstName}, te escribimos de Muzza ✨. Han pasado 30 días desde tu diseño de cejas y es el momento ideal para tu retoque. ¿Te gustaría agendar una cita para mantenerlas perfectas?`;
             }
        }
        
        return `https://wa.me/51${phone}?text=${encodeURIComponent(message)}`;
    };

    const handleWhatsAppClick = (phone: string, name: string, saleId: string, currentStatus: FollowUpStatus, hasFutureBooking: boolean, isLaser: boolean) => {
        const type = activeFilter === 'REACTIVACION' ? 'anual' : 'retoque';
        // Open WhatsApp
        window.open(getWhatsAppLink(phone, name, type, isLaser), '_blank');

        // Automatically update status to CONTACTADO if it is currently PENDIENTE and not booked
        if (currentStatus === 'PENDIENTE' && !hasFutureBooking) {
            handleStatusChange(saleId, 'CONTACTADO');
        }
    };

    // Bulk Actions Handlers
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = new Set(filteredList.map(item => item.id));
            setSelectedIds(allIds);
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (saleId: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(saleId)) {
            newSet.delete(saleId);
        } else {
            newSet.add(saleId);
        }
        setSelectedIds(newSet);
    };

    const executeBulkArchive = () => {
        if (selectedIds.size === 0) return;
        if (window.confirm(`¿Está seguro que desea archivar ${selectedIds.size} clientes seleccionados?`)) {
            onBulkArchive(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    const handleDownload = () => {
        const dataToExport = filteredList.map(({id, client, serviceType, procedure, eventDate, targetDate, status, trackingData}) => ({
            'ID Evento': id,
            'Fecha Atención': eventDate.toLocaleDateString('es-ES'),
            'Cliente': client.name,
            'DNI': client.dni,
            'Celular': client.phone,
            'Servicio': serviceType,
            'Procedimiento': procedure,
            'Fecha Sugerida': targetDate.toLocaleDateString('es-ES'),
            'Estado': status,
            'Notas': trackingData?.notes || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Seguimiento');
        
        const objectMaxLength = Object.keys(dataToExport[0] || {}).map(key => ({
            wch: Math.max(...dataToExport.map(row => (row[key as keyof typeof row] || '').toString().length), key.length) + 2
        }));
        worksheet['!cols'] = objectMaxLength;

        XLSX.writeFile(workbook, `Seguimiento_${activeFilter}_${selectedYear}_${selectedMonth === -1 ? 'Todo' : MONTHS[selectedMonth]}.xlsx`);
    }

    // Calculations for Display
    const returnRate = retentionStats.eligibleBase > 0 
        ? ((retentionStats.returnedCount / retentionStats.eligibleBase) * 100).toFixed(1) + '%' 
        : '0%';
    const pendingRate = retentionStats.eligibleBase > 0
        ? ((retentionStats.pendingCount / retentionStats.eligibleBase) * 100).toFixed(1) + '%'
        : '0%';

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Seguimiento de Retoques y Láser</h2>

            {/* KPIs Grid - UPDATED to 40 Days */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard 
                    title="Base Elegible (40+ días)" 
                    value={String(retentionStats.eligibleBase)} 
                    subtext="Clientes atendidos hace más de 40 días" 
                    color="blue"
                />
                <MetricCard 
                    title="Tasa de Retorno" 
                    value={returnRate} 
                    subtext={`${retentionStats.returnedCount} clientes volvieron (Láser o Cejas)`} 
                    color="green"
                />
                <MetricCard 
                    title="Oportunidad (Pendientes)" 
                    value={pendingRate} 
                    subtext={`${retentionStats.pendingCount} clientes aún no regresan`} 
                    color="yellow"
                />
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                
                {/* Header Filter Section */}
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Listado de Clientes</h3>
                            <p className="text-sm text-slate-500">
                                {activeFilter === 'REACTIVACION' 
                                    ? 'Clientes antiguos (hace ~12 meses) candidatos para nuevo servicio.' 
                                    : activeFilter === 'ARCHIVADOS'
                                    ? 'Clientes ocultos de la vista principal.'
                                    : 'Clientes de Cejas (1ra vez) y Láser pendientes de seguimiento.'}
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                            {/* NEW: Search Bar */}
                            <input 
                                type="text"
                                placeholder="Buscar DNI, Cel, Nombre o Código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-purple-500 focus:border-purple-500 bg-white w-full sm:w-64 shadow-sm"
                            />

                            {/* Check Admin Role for Bulk Archive */}
                            {currentUserRole === 'admin' && selectedIds.size > 0 && activeFilter !== 'ARCHIVADOS' && (
                                <button
                                    onClick={executeBulkArchive}
                                    className="px-4 py-2 bg-slate-600 text-white font-bold rounded-lg shadow-md hover:bg-slate-700 flex items-center justify-center space-x-2 mr-2 animate-fade-in"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                    <span>Archivar ({selectedIds.size})</span>
                                </button>
                            )}

                            {/* Service Type Filter */}
                            <select 
                                value={serviceTypeFilter} 
                                onChange={(e) => setServiceTypeFilter(e.target.value as 'TODOS' | 'CEJAS' | 'LASER')}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-purple-500 focus:border-purple-500 bg-white"
                            >
                                <option value="TODOS">Todos los Servicios</option>
                                <option value="CEJAS">Solo Cejas</option>
                                <option value="LASER">Solo Láser</option>
                            </select>

                            {/* Year Filter */}
                            <select 
                                value={selectedYear} 
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-purple-500 focus:border-purple-500 bg-white"
                            >
                                {filterYears.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>

                            {/* Month Filter */}
                            <select 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-purple-500 focus:border-purple-500 bg-white"
                            >
                                <option value={-1}>Todos los meses</option>
                                {MONTHS.map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>

                            <button 
                                onClick={handleDownload}
                                className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center space-x-2 whitespace-nowrap"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                <span className="hidden sm:inline">Descargar</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full">
                        {(['TODOS', 'PENDIENTE', 'CONTACTADO', 'AGENDADO', 'PERDIDO', 'REACTIVACION', 'ARCHIVADOS'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter)}
                                className={`px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all whitespace-nowrap 
                                    ${activeFilter === filter ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'} 
                                    ${filter === 'REACTIVACION' ? 'text-purple-600' : ''}
                                    ${filter === 'ARCHIVADOS' ? 'text-slate-400' : ''}
                                `}
                            >
                                {filter === 'REACTIVACION' ? 'React. 12 Meses' : filter.charAt(0) + filter.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input 
                                        type="checkbox" 
                                        onChange={handleSelectAll} 
                                        checked={filteredList.length > 0 && selectedIds.size === filteredList.length}
                                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                                    />
                                </th>
                                <th className="px-4 py-3">Fecha Atención</th>
                                <th className="px-4 py-3">Cliente</th>
                                <th className="px-4 py-3">Servicio Original</th>
                                <th className="px-4 py-3">Acciones Rápidas</th>
                                <th className="px-4 py-3">
                                    {activeFilter === 'REACTIVACION' ? 'Fecha Estimada' : 'Fecha Sugerida'}
                                </th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3">Notas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredList.map(({ id, client, serviceType, procedure, eventDate, targetDate, status, trackingData, hasFutureBooking, isLaser, bookingCode }) => {
                                const daysUntilTarget = Math.ceil((targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                const isOverdue = daysUntilTarget < 0;
                                const isSelected = selectedIds.has(id);
                                
                                return (
                                    <tr key={id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-purple-50' : ''}`}>
                                        <td className="px-4 py-3">
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={() => handleSelectRow(id)}
                                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {eventDate.toLocaleDateString('es-ES')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-slate-800">{client.name}</div>
                                            <div className="text-xs text-slate-500">DNI: {client.dni} {bookingCode && <span className="ml-2 text-purple-600 font-mono font-bold">#{bookingCode}</span>}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isLaser ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-800'}`}>
                                                {serviceType}
                                            </span>
                                            <div className="text-xs text-slate-400 mt-1">{procedure}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                 <button 
                                                    onClick={() => handleWhatsAppClick(client.phone, client.name, id, status, hasFutureBooking, isLaser)}
                                                    className="inline-flex items-center px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-full hover:bg-green-600 transition-transform hover:scale-105"
                                                    title="Enviar WhatsApp"
                                                 >
                                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                                                    <span className="hidden xl:inline">{client.phone}</span>
                                                    <span className="xl:hidden">WS</span>
                                                 </button>
                                                 
                                                 {!hasFutureBooking && (
                                                     <button
                                                        onClick={() => onBookAppointment(client)}
                                                        className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-full hover:bg-purple-700 transition-transform hover:scale-105"
                                                        title="Agendar Retoque"
                                                     >
                                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 xl:mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                         </svg>
                                                         <span className="hidden xl:inline">Agendar</span>
                                                     </button>
                                                 )}

                                                 {/* Check Admin Role for Single Archive */}
                                                 {currentUserRole === 'admin' && activeFilter !== 'ARCHIVADOS' && (
                                                     <button
                                                        onClick={() => handleArchiveClick(id)}
                                                        className="inline-flex items-center px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-full hover:bg-slate-300 transition-transform hover:scale-105"
                                                        title="Archivar (Ocultar)"
                                                     >
                                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                                         </svg>
                                                     </button>
                                                 )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className={`font-mono ${isOverdue && activeFilter !== 'REACTIVACION' && activeFilter !== 'ARCHIVADOS' ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                                {targetDate.toLocaleDateString('es-ES')}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {activeFilter === 'REACTIVACION' 
                                                    ? 'Hace ~12 meses'
                                                    : (isOverdue ? `${Math.abs(daysUntilTarget)} días tarde` : `Faltan ${daysUntilTarget} días`)
                                                }
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={status} />
                                            {/* Manual overrides available only if not automatically booked */}
                                            {!hasFutureBooking && (
                                                <select
                                                    value={status}
                                                    onChange={(e) => handleStatusChange(id, e.target.value as FollowUpStatus)}
                                                    className="block w-full mt-1 text-xs border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                                >
                                                    <option value="PENDIENTE">Pendiente</option>
                                                    <option value="CONTACTADO">Contactado</option>
                                                    <option value="PERDIDO">Perdido</option>
                                                </select>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {editingId === id ? (
                                                <div className="flex flex-col gap-2">
                                                    <textarea
                                                        value={editNotes}
                                                        onChange={(e) => setEditNotes(e.target.value)}
                                                        className="w-full text-xs border rounded p-1"
                                                        rows={2}
                                                        placeholder="Escriba una nota..."
                                                    />
                                                    <button onClick={() => handleNotesSave(id)} className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700">Guardar</button>
                                                </div>
                                            ) : (
                                                <div className="group relative cursor-pointer" onClick={() => startEditing(id, trackingData?.notes)}>
                                                    <p className="text-xs text-slate-600 italic truncate max-w-[150px]">
                                                        {trackingData?.notes || "Añadir nota..."}
                                                    </p>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 absolute -right-3 top-0 text-slate-400 opacity-0 group-hover:opacity-100" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {filteredList.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            {activeFilter === 'REACTIVACION' 
                                ? 'No hay clientes para reactivación anual en este periodo.' 
                                : activeFilter === 'ARCHIVADOS'
                                ? 'No hay clientes archivados en este periodo.'
                                : 'No se encontraron clientes en este periodo.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FollowUpDashboard;
