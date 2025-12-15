
import React, { useState, useMemo } from 'react';
import { Booking, DaySchedule } from '../types';
import { SERVICE_TYPE_COLORS } from '../constants';

type View = 'day' | '3day' | 'week' | 'month';

interface BookingCalendarProps {
  bookings: Booking[];
  view: View;
  onViewChange: (view: View) => void;
  onAddBooking: (date?: Date, specialist?: string) => void;
  onBookingClick: (booking: Booking) => void;
  allSpecialists: string[];
  visibleSpecialists: string[];
  onVisibleSpecialistsChange: React.Dispatch<React.SetStateAction<string[]>>;
  startHour: number;
  endHour: number;
  availableDays: number[];
  weeklySchedule: Record<number, DaySchedule>;
  onDownload?: () => void;
}

const SLOT_DURATION_MINUTES = 60;
const SLOT_HEIGHT_REM = 6; // h-24 tailwind class

const BookingCalendar: React.FC<BookingCalendarProps> = ({ 
    bookings, view, onViewChange, onAddBooking, onBookingClick,
    allSpecialists, visibleSpecialists, onVisibleSpecialistsChange,
    startHour, endHour, availableDays, weeklySchedule, onDownload
}) => {
  const [currentDate, setCurrentDate] = useState(() => {
      const d = new Date();
      d.setHours(0,0,0,0);
      return d;
  });

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const getWeek = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    startOfWeek.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek, i));
  };

  const getMonthGrid = (date: Date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDate = new Date(firstDayOfMonth);
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const grid: Date[][] = [];
    let week: Date[] = [];

    while (startDate <= lastDayOfMonth || week.length > 0) {
      for (let i = 0; i < 7; i++) {
        week.push(new Date(startDate));
        startDate.setDate(startDate.getDate() + 1);
      }
      grid.push(week);
      week = [];
      if (startDate.getMonth() !== month && grid.length >= 4) break;
    }
    return grid;
  };
  
  const handlePrev = () => {
    if (view === 'day') {
      setCurrentDate(addDays(currentDate, -1));
    } else if (view === '3day') {
      setCurrentDate(addDays(currentDate, -3));
    } else if (view === 'week') {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    if (view === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else if (view === '3day') {
      setCurrentDate(addDays(currentDate, 3));
    } else if (view === 'week') {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };
  
  const handleToday = () => {
      const d = new Date();
      d.setHours(0,0,0,0);
      setCurrentDate(d);
  }
  
  const { title, days } = useMemo(() => {
    const getDayISO = (date: Date) => date.getDay() === 0 ? 7 : date.getDay();
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    
    // Helper for short date format: "14 Dic"
    const formatShortDate = (d: Date) => {
        const day = d.getDate();
        const month = capitalize(d.toLocaleDateString('es-ES', { month: 'short' })).replace('.', '');
        return `${day} ${month}`;
    };

    switch (view) {
      case 'day': {
        // Updated to use 'short' weekday and remove dots (e.g. "dom." -> "Dom")
        let dayName = capitalize(currentDate.toLocaleDateString('es-ES', { weekday: 'short' }));
        dayName = dayName.replace('.', '');
        const shortDate = formatShortDate(currentDate);
        return {
          title: `${dayName} ${shortDate}, ${currentDate.getFullYear()}`,
          days: [{ date: currentDate, isCurrentMonth: true }],
        };
      }
      case '3day': {
        let threeDays = [];
        let date = new Date(currentDate);
        while(threeDays.length < 3) {
            const dayId = getDayISO(date);
            if(weeklySchedule[dayId]?.isOpen) {
                threeDays.push(date);
            }
            date = addDays(date, 1);
        }

        const startDay = threeDays[0];
        const endDay = threeDays[2];
        
        return {
          title: `${formatShortDate(startDay)} - ${formatShortDate(endDay)}, ${currentDate.getFullYear()}`,
          days: threeDays.map(d => ({ date: d, isCurrentMonth: true })),
        };
      }
      case 'week': {
        const weekDays = getWeek(currentDate).filter(d => weeklySchedule[getDayISO(d)]?.isOpen);
        const startDay = weekDays[0];
        const endDay = weekDays[weekDays.length - 1];
        
        return {
          title: `${formatShortDate(startDay)} - ${formatShortDate(endDay)}, ${currentDate.getFullYear()}`,
          days: weekDays.map(d => ({ date: d, isCurrentMonth: true })),
        };
      }
      case 'month':
      default: {
        const monthGrid = getMonthGrid(currentDate);
        return {
          title: capitalize(currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })),
          days: monthGrid.flat().map(d => ({ date: d, isCurrentMonth: d.getMonth() === currentDate.getMonth() })),
        };
      }
    }
  }, [currentDate, view, weeklySchedule]);
  
  const bookingsByDate = useMemo(() => {
    return bookings.reduce((acc, booking) => {
        // FIX: Use local date construction instead of toISOString() to prevent UTC shift
        const d = new Date(booking.startTime);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(booking);
        return acc;
    }, {} as Record<string, Booking[]>);
  }, [bookings]);
  
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
        slots.push(`${String(hour).padStart(2, '0')}:00`);
    }
    return slots;
  }, [startHour, endHour]);

  const handleSlotClick = (date: Date, time: string, specialist: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const newBookingDate = new Date(date);
    newBookingDate.setHours(hour, minute, 0, 0);
    onAddBooking(newBookingDate, specialist);
  }

  const handleSpecialistToggle = (specialistName: string) => {
    onVisibleSpecialistsChange(prev => 
        prev.includes(specialistName) 
        ? prev.filter(s => s !== specialistName) 
        : [...prev, specialistName]
    );
  };

  const getBookingStyles = (booking: Booking) => {
      const colors = SERVICE_TYPE_COLORS[booking.serviceType] || SERVICE_TYPE_COLORS.default;
      const isCompleted = booking.status === 'completed';
      const isNoShow = booking.status === 'noshow';
      
      let containerClass = `${colors.bg} ${colors.text}`;
      if (isNoShow) {
          containerClass = "bg-gray-200 text-gray-500 line-through border border-gray-300";
      } else if (isCompleted) {
          containerClass = `${colors.bg} ${colors.text} border border-green-500`;
      }

      return { containerClass, isCompleted, isNoShow };
  }

  const renderMonthView = () => {
      const weekDaysHeader = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
      return(
        <div className="grid grid-cols-7 border-t border-l border-slate-200">
            {weekDaysHeader.map(day => (
                <div key={day} className="text-center font-semibold text-xs text-slate-500 p-2 border-b border-r border-slate-200 bg-slate-50">
                    {day}
                </div>
            ))}
            {days.map(({ date, isCurrentMonth }, index) => {
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const dayBookings = bookingsByDate[dateKey] || [];
                const isToday = new Date().toDateString() === date.toDateString();
                const dayId = date.getDay() === 0 ? 7 : date.getDay();
                const isClosed = !weeklySchedule[dayId]?.isOpen;
                
                return (
                    <div 
                        key={index} 
                        className={`relative border-b border-r border-slate-200 h-24 sm:h-28 overflow-hidden group ${!isCurrentMonth || isClosed ? 'bg-slate-50' : 'bg-white'}`}
                    >
                        <div 
                            className="absolute inset-0 hover:bg-slate-50 cursor-pointer z-0"
                            onClick={() => onAddBooking(date)}
                        >
                            {!isClosed && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <div className="bg-purple-100 bg-opacity-80 p-2 rounded-full shadow-sm transform scale-75 group-hover:scale-100 transition-transform">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={`relative z-10 flex items-center justify-center m-1 h-6 w-6 text-xs font-semibold rounded-full pointer-events-none ${isToday ? 'bg-purple-600 text-white' : isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                            {date.getDate()}
                        </div>
                        <div className="px-1 space-y-0.5 relative z-10 pointer-events-none">
                           {dayBookings.slice(0, 2).map(booking => {
                                const { containerClass, isCompleted } = getBookingStyles(booking);
                                return (
                                    <div key={booking.id} onClick={(e) => { e.stopPropagation(); onBookingClick(booking); }} className={`p-0.5 rounded text-[10px] truncate ${containerClass} cursor-pointer flex items-center gap-1 pointer-events-auto`}>
                                        {isCompleted && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 text-green-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                        {booking.reconfirmationStatus === 'confirmed' && (
                                            <span className="text-blue-600 font-bold">✓</span>
                                        )}
                                        <span className="font-semibold truncate">{booking.client.name.split(' ')[0]}</span>
                                        <span className="ml-auto hidden sm:inline flex-shrink-0">{new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                )
                           })}
                           {dayBookings.length > 2 && <div className="text-[10px] text-slate-500 font-semibold mt-0.5">+{dayBookings.length - 2} más</div>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };
  
  const renderTimeGridView = () => {
    const specialistsToShow = visibleSpecialists;
    if(specialistsToShow.length === 0) {
        return <div className="text-center p-10 text-slate-500">Seleccione al menos una especialista para ver la agenda.</div>
    }

    // Dynamic width calculation for mobile responsiveness
    // 140px minimum per specialist column to ensure readability on mobile
    const minColumnWidth = 140; 
    const totalMinWidth = days.length * specialistsToShow.length * minColumnWidth;

    return (
        <div className="flex">
            {/* Time Gutter - Sticky or Fixed */}
            <div className="w-16 flex-shrink-0 text-right bg-white z-20">
                 <div className="sticky top-0 z-30 bg-white">
                    <div className="h-16 border-b border-slate-200"></div> {/* Day Header Spacer */}
                    {/* Specialist header spacer - must match height of specialist names */}
                    <div className="py-1 border-b border-r border-slate-200">
                        <span className="text-xs font-bold invisible">&nbsp;</span>
                    </div>
                 </div>
                 <div className="relative">
                    {timeSlots.map((time, index) => (
                        <div key={time} className={`h-24 pr-2 border-r border-slate-200 flex items-start justify-end pt-1 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                            <span className="text-xs text-slate-400 -mt-2">{time}</span>
                        </div>
                    ))}
                 </div>
            </div>
            {/* Main Calendar Grid - Scrollable */}
            <div className="flex-1 overflow-x-auto">
                <div 
                    className="grid" 
                    style={{ 
                        gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, 
                        minWidth: `${Math.max(totalMinWidth, 300)}px` // Ensure it doesn't collapse on mobile
                    }}
                >
                    {days.map(({ date }, index) => {
                        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        const dayBookings = bookingsByDate[dateKey] || [];
                        const isToday = new Date().toDateString() === date.toDateString();
                        const dayId = date.getDay() === 0 ? 7 : date.getDay();
                        const daySchedule = weeklySchedule[dayId];

                        return (
                            <div key={index} className="border-l border-slate-200">
                                <div className="sticky top-0 bg-white z-10">
                                    <div className="h-16 border-b border-slate-200 text-center">
                                        <p className="font-semibold text-slate-600 text-sm">{date.toLocaleDateString('es-ES', { weekday: 'short' })}</p>
                                        <p className={`text-2xl font-bold ${isToday ? 'text-purple-600' : 'text-slate-800'}`}>{date.getDate()}</p>
                                    </div>
                                    <div 
                                        className="grid"
                                        style={{ gridTemplateColumns: `repeat(${specialistsToShow.length}, minmax(0, 1fr))` }}
                                    >
                                        {specialistsToShow.map(specialist => (
                                            <div key={specialist} className="text-center text-xs font-bold text-slate-500 py-1 border-b border-r border-slate-200 truncate px-1" title={specialist}>
                                                {specialist}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div 
                                    className="grid"
                                    style={{ gridTemplateColumns: `repeat(${specialistsToShow.length}, minmax(0, 1fr))` }}
                                >
                                    {specialistsToShow.map(specialist => (
                                        <div key={specialist} className="relative border-r border-slate-200">
                                            {/* Time Slots for Clicks */}
                                            {timeSlots.map((time, timeIndex) => {
                                                const currentHour = parseInt(time.split(':')[0]);
                                                // Determine slot status based on day schedule
                                                let isClosed = false;
                                                let isLunch = false;

                                                if (daySchedule) {
                                                    if (!daySchedule.isOpen || currentHour < daySchedule.startHour || currentHour >= daySchedule.endHour) {
                                                        isClosed = true;
                                                    }
                                                    if (daySchedule.hasLunch && currentHour >= daySchedule.lunchStartHour && currentHour < daySchedule.lunchEndHour) {
                                                        isLunch = true;
                                                    }
                                                } else {
                                                    isClosed = true; // If no schedule found, assume closed
                                                }
                                                
                                                let bgColor = timeIndex % 2 === 0 ? 'bg-slate-50/50' : 'bg-white';
                                                if (isClosed) bgColor = 'bg-slate-200/40';
                                                if (isLunch) bgColor = 'bg-orange-50/70';

                                                return (
                                                    <div 
                                                        key={time} 
                                                        className={`h-24 border-t border-slate-100 ${bgColor} ${!isClosed ? 'hover:bg-purple-50 cursor-pointer group relative' : ''}`}
                                                        onClick={() => !isClosed && handleSlotClick(date, time, specialist)}
                                                        title={isLunch ? "Horario de Almuerzo" : isClosed ? "Cerrado" : ""}
                                                    >
                                                        {!isClosed && !isLunch && (
                                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {/* Bookings */}
                                            {dayBookings.filter(b => b.specialist === specialist).map(booking => {
                                                const startTime = new Date(booking.startTime);
                                                const endTime = new Date(booking.endTime);
                                                const startMinutes = (startTime.getHours() * 60 + startTime.getMinutes()) - (startHour * 60);
                                                const durationMinutes = (endTime.getTime() - startTime.getTime()) / 60000;
                                                
                                                const top = startMinutes * (SLOT_HEIGHT_REM / SLOT_DURATION_MINUTES);
                                                const height = durationMinutes * (SLOT_HEIGHT_REM / SLOT_DURATION_MINUTES);
                                                
                                                if (startTime.getHours() < startHour || startTime.getHours() >= endHour) return null;

                                                const { containerClass, isCompleted } = getBookingStyles(booking);

                                                return (
                                                    <div
                                                        key={booking.id}
                                                        onClick={() => onBookingClick(booking)}
                                                        className={`absolute left-1 right-1 p-2 rounded-lg shadow-sm overflow-hidden cursor-pointer ${containerClass}`}
                                                        style={{
                                                            top: `${top}rem`,
                                                            height: `${height}rem`,
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1 overflow-hidden">
                                                                {/* RECONFIRMATION ICON */}
                                                                {booking.reconfirmationStatus === 'confirmed' && (
                                                                    <span title="Reconfirmado" className="text-blue-600 font-extrabold flex-shrink-0">✓✓</span>
                                                                )}
                                                                {booking.reconfirmationStatus === 'rejected' && (
                                                                    <span title="No reconfirmado" className="text-red-500 font-bold flex-shrink-0">?</span>
                                                                )}
                                                                <p className="font-bold text-xs truncate">{booking.client.name}</p>
                                                            </div>
                                                            {isCompleted && (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-700 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] truncate">{booking.procedure}</p>
                                                        <p className="text-[10px] font-mono">{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                        {booking.comments && (
                                                            <p className="text-[10px] italic mt-1 pt-1 border-t border-current border-opacity-20 truncate" title={booking.comments}>
                                                                {booking.comments}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    )
  };

  const SpecialistToggle: React.FC<{ specialist: string }> = ({ specialist }) => {
    const isVisible = visibleSpecialists.includes(specialist);
    return (
         <label htmlFor={`toggle-${specialist}`} className="flex items-center cursor-pointer">
            <div className="relative">
                <input id={`toggle-${specialist}`} type="checkbox" className="sr-only" checked={isVisible} onChange={() => handleSpecialistToggle(specialist)} />
                <div className={`block ${isVisible ? 'bg-purple-600' : 'bg-gray-300'} w-10 h-6 rounded-full`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isVisible ? 'translate-x-4' : ''}`}></div>
            </div>
            <div className="ml-3 text-sm font-medium text-gray-700">{specialist}</div>
        </label>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 relative">
      <header className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 mb-6">
        <div className="flex items-center space-x-2">
            <button onClick={handlePrev} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            </button>
            <button onClick={handleNext} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </button>
            <button onClick={handleToday} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                Hoy
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 capitalize ml-2 sm:ml-4">{title}</h2>
        </div>
        <div className="flex items-center space-x-2 w-full xl:w-auto">
             <div className="flex-1 flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                {(['day', '3day', 'week', 'month'] as const).map(v => (
                    <button key={v} onClick={() => onViewChange(v)} className={`w-full px-3 py-1 text-sm font-semibold rounded-md ${view === v ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}>
                        {v === 'day' ? 'Día' : v === '3day' ? '3 Días' : v === 'week' ? 'Semana' : 'Mes'}
                    </button>
                ))}
            </div>
            
            {onDownload && (
                <button 
                    onClick={onDownload}
                    className="hidden sm:flex px-3 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 items-center justify-center space-x-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span className="hidden sm:inline">Excel</span>
                </button>
            )}

            {/* Hide on mobile, show on Desktop */}
            <button 
                onClick={() => onAddBooking()}
                className="hidden sm:flex px-3 py-2 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 items-center justify-center space-x-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                <span className="hidden sm:inline">Nueva Reserva</span>
            </button>
        </div>
      </header>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-6 mb-4 p-2 border-b border-slate-200">
        <span className="font-semibold text-sm text-slate-600 flex-shrink-0">Mostrar Agendas:</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
            {allSpecialists.map(s => <SpecialistToggle key={s} specialist={s} />)}
        </div>
      </div>

      {/* Unified View for Desktop and Mobile */}
      <div>
          {view === 'month' ? renderMonthView() : renderTimeGridView()}
      </div>

       {/* Floating Action Button (+) for New Booking */}
       <button
            onClick={() => onAddBooking()}
            className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 bg-purple-600 text-white rounded-full p-3 lg:p-4 shadow-2xl hover:bg-purple-700 transition-transform hover:scale-110 z-50 flex items-center justify-center border-4 border-white"
            title="Nueva Reserva"
            aria-label="Crear nueva reserva"
       >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 lg:h-10 lg:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
       </button>

    </div>
  );
};

export default BookingCalendar;
