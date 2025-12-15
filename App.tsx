
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient'; // Import Supabase Client
import { Sale, Booking, Withdrawal, Specialist, DaySchedule, FollowUpTracking, FollowUpState, Client, Expense, UserRole, UserProfile } from './types';
import SalesForm from './components/SalesForm';
import BookingForm from './components/BookingForm';
import BulkUploadModal from './components/BulkUploadModal';
import ClientHistoryModal from './components/ClientHistoryModal';
import WithdrawalForm from './components/WithdrawalForm';
import BookingCalendar from './components/BookingCalendar';
import Configuration from './components/Configuration';
import BookingDetailModal from './components/BookingDetailModal';
import ManagementDashboard from './components/ManagementDashboard';
import FollowUpDashboard from './components/FollowUpDashboard';
import ExpensesDashboard from './components/ExpensesDashboard';
import Login from './components/Login';
import { SERVICE_TYPES, PROCEDURES_BY_SERVICE, CASH_METHODS, DIGITAL_METHODS, CARD_METHODS, DEFAULT_EXPENSE_CATEGORIES, MONTHS, YEARS, SERVICE_TYPE_COLORS } from './constants';

// Declare XLSX from the script loaded in index.html
declare const XLSX: any;

type View = 'home' | 'sales' | 'bookings' | 'cashControl' | 'configuration' | 'management' | 'followUp' | 'expenses';
type BookingView = 'day' | '3day' | 'week' | 'month';
type BookingDisplayMode = 'calendar' | 'list'; // NEW: Toggle between calendar and list

// NEW: Custom Modal for Factory Reset
const ResetConfirmationModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void }> = ({ isOpen, onClose, onConfirm }) => {
    const [confirmText, setConfirmText] = useState('');
    
    if (!isOpen) return null;

    const isMatch = confirmText === 'RESET';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[70] p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-4 border-red-600" onClick={e => e.stopPropagation()}>
                <div className="p-6 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                        <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">¿Restablecimiento de Fábrica?</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Esta acción es <strong>IRREVERSIBLE</strong>. Se eliminarán permanentemente:
                        <ul className="list-disc list-inside mt-2 text-left px-4 font-mono text-xs text-red-700 bg-red-50 py-2 rounded">
                            <li>Todas las Ventas</li>
                            <li>Todas las Reservas</li>
                            <li>Todos los Clientes</li>
                            <li>Todos los Gastos</li>
                            <li>Historial de Seguimiento</li>
                        </ul>
                    </p>
                    
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-700 mb-2">
                            Escribe la palabra <span className="text-red-600 font-mono text-base">RESET</span> para confirmar:
                        </label>
                        <input 
                            type="text" 
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg text-center font-bold text-xl uppercase tracking-widest focus:border-red-500 focus:ring-red-500"
                            placeholder="RESET"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={() => { if(isMatch) { onConfirm(); onClose(); } }}
                            disabled={!isMatch}
                            className={`flex-1 px-4 py-3 font-bold rounded-xl transition-all shadow-lg ${
                                isMatch 
                                ? 'bg-red-600 text-white hover:bg-red-700 transform hover:scale-105' 
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            BORRAR TODO
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // --- APP STATE ---
  const [isLoading, setIsLoading] = useState(false); // Data loading

  // Main Data State
  const [sales, setSales] = useState<Sale[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [followUpTracking, setFollowUpTracking] = useState<FollowUpTracking>({});
  
  // Expense Configuration State
  const [expenseCategories, setExpenseCategories] = useState<Record<string, string[]>>(DEFAULT_EXPENSE_CATEGORIES);

  // App Navigation & Modal State
  const [activeView, setActiveView] = useState<View>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  // NEW: Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Editing & History State
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [historyClientDni, setHistoryClientDni] = useState<string | null>(null);
  
  // Booking Context State
  const [initialBookingDate, setInitialBookingDate] = useState<Date | null>(null);
  const [initialBookingSpecialist, setInitialBookingSpecialist] = useState<string>('');
  const [initialBookingService, setInitialBookingService] = useState<string>('');
  
  // Booking Prefill State (For booking from FollowUp)
  const [bookingPrefill, setBookingPrefill] = useState<{ client: Client, serviceType: string, procedure: string } | null>(null);

  // Sales Filter State
  const [displayedMonth, setDisplayedMonth] = useState<number>(new Date().getMonth());
  const [displayedYear, setDisplayedYear] = useState<number>(new Date().getFullYear());
  const [filterService, setFilterService] = useState<string[]>([]);
  const [filterProcedure, setFilterProcedure] = useState<string[]>([]);
  const [filterCream, setFilterCream] = useState<string>('all');
  const [serviceFilterOpen, setServiceFilterOpen] = useState(false);
  const [procedureFilterOpen, setProcedureFilterOpen] = useState(false);

  // Booking State
  const [bookingView, setBookingView] = useState<BookingView>('3day');
  const [bookingDisplayMode, setBookingDisplayMode] = useState<BookingDisplayMode>('calendar'); // NEW
  const [bookingSearchTerm, setBookingSearchTerm] = useState(''); // NEW
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null); 
  
  // --- Configuration State ---
  const [configSpecialists, setConfigSpecialists] = useState<Specialist[]>([]);
  
  const [weeklySchedule, setWeeklySchedule] = useState<Record<number, DaySchedule>>({
    1: { dayId: 1, name: 'Lunes', isOpen: true, startHour: 9, endHour: 18, hasLunch: true, lunchStartHour: 13, lunchEndHour: 14 },
    2: { dayId: 2, name: 'Martes', isOpen: true, startHour: 9, endHour: 18, hasLunch: true, lunchStartHour: 13, lunchEndHour: 14 },
    3: { dayId: 3, name: 'Miércoles', isOpen: true, startHour: 9, endHour: 18, hasLunch: true, lunchStartHour: 13, lunchEndHour: 14 },
    4: { dayId: 4, name: 'Jueves', isOpen: true, startHour: 9, endHour: 18, hasLunch: true, lunchStartHour: 13, lunchEndHour: 14 },
    5: { dayId: 5, name: 'Viernes', isOpen: true, startHour: 9, endHour: 18, hasLunch: true, lunchStartHour: 13, lunchEndHour: 14 },
    6: { dayId: 6, name: 'Sábado', isOpen: true, startHour: 9, endHour: 14, hasLunch: false, lunchStartHour: 13, lunchEndHour: 14 },
    7: { dayId: 7, name: 'Domingo', isOpen: false, startHour: 9, endHour: 18, hasLunch: false, lunchStartHour: 13, lunchEndHour: 14 },
  });

  const [configSalesGoals, setConfigSalesGoals] = useState<Record<string, number>>({});
  const [configBookingGoals, setConfigBookingGoals] = useState<Record<string, number>>({});
  const [configClientGoals, setConfigClientGoals] = useState<Record<string, number>>({});
  
  // --- AUTH CHECK ---
  useEffect(() => {
      const client = supabase;
      if (!client) {
          setIsLoadingAuth(false);
          return;
      }

      // Check active session
      client.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          if (session) fetchUserProfile(session.user.id);
          else setIsLoadingAuth(false);
      });

      // Listen for auth changes
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
          setSession(session);
          if (session) fetchUserProfile(session.user.id);
          else {
              setUserProfile(null);
              setIsLoadingAuth(false);
          }
      });

      return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
      const client = supabase;
      if (!client) return;
      try {
          const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (data) {
              setUserProfile(data);
          } else {
              // Fallback if profile trigger failed
              setUserProfile({ id: userId, email: '', name: 'Usuario', role: 'staff' });
          }
      } catch (error) {
          console.error("Error fetching profile:", error);
      } finally {
          setIsLoadingAuth(false);
      }
  };

  const handleLogout = async () => {
      const client = supabase;
      if(client) await client.auth.signOut();
  }

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    if (!session) return; // Don't fetch if not logged in

    setIsLoading(true);
    try {
        const client = supabase;
        if (!client) {
            setIsLoading(false);
            return;
        }

        // 1. Specialists
        const { data: specs } = await client.from('specialists').select('*').order('name');
        if (specs) setConfigSpecialists(specs);

        // 2. Weekly Schedule
        const { data: schedule } = await client.from('weekly_schedule').select('*');
        if (schedule && schedule.length > 0) {
            const scheduleMap: Record<number, DaySchedule> = {};
            schedule.forEach((d: any) => {
                scheduleMap[d.day_id] = {
                    dayId: d.day_id,
                    name: d.name,
                    isOpen: d.is_open,
                    startHour: d.start_hour,
                    endHour: d.end_hour,
                    hasLunch: d.has_lunch,
                    lunchStartHour: d.lunch_start_hour,
                    lunchEndHour: d.lunch_end_hour
                };
            });
            setWeeklySchedule(scheduleMap);
        }

        // 3. Goals
        const { data: goals } = await client.from('goals').select('*');
        if (goals) {
            const sGoals: Record<string, number> = {};
            const bGoals: Record<string, number> = {};
            const cGoals: Record<string, number> = {};
            goals.forEach((g: any) => {
                const key = `${g.year}-${g.month}`;
                sGoals[key] = g.sales_goal;
                bGoals[key] = g.booking_goal;
                cGoals[key] = g.client_goal;
            });
            setConfigSalesGoals(sGoals);
            setConfigBookingGoals(bGoals);
            setConfigClientGoals(cGoals);
        }
        
        // 4. Expense Categories
        const { data: expCats } = await client.from('expense_categories').select('*');
        if (expCats) {
            const catMap: Record<string, string[]> = {};
            expCats.forEach((c: any) => {
                catMap[c.category_name] = c.subcategories || [];
            });
            setExpenseCategories(catMap);
        }

        // 5. Sales (with Clients & Profiles)
        const { data: salesData } = await client
            .from('sales')
            .select('*, client:clients(*), creator:profiles(name)')
            .order('timestamp', { ascending: false });
        
        if (salesData) {
            const mappedSales: Sale[] = salesData.map((s: any) => ({
                id: s.id,
                timestamp: new Date(s.timestamp),
                client: {
                    name: s.client?.name || 'Desconocido',
                    dni: s.client?.dni || '',
                    phone: s.client?.phone || '',
                    source: s.client?.source || ''
                },
                serviceType: s.service_type,
                procedure: s.procedure_name,
                payments: s.payments || [],
                creamSold: s.cream_sold,
                comments: s.comments,
                createdBy: s.created_by,
                createdByName: s.creator?.name,
                // NEW FIELDS
                bookingId: s.booking_id,
                transactionType: s.transaction_type
            }));
            setSales(mappedSales);
        }

        // 6. Bookings (with Clients & Profiles)
        const { data: bookingsData } = await client
            .from('bookings')
            .select('*, client:clients(*), creator:profiles(name)')
            .order('start_time', { ascending: true });

        if (bookingsData) {
            const mappedBookings: Booking[] = bookingsData.map((b: any) => ({
                id: b.id,
                bookingCode: b.booking_code, // NEW FIELD
                specialist: b.specialist,
                serviceType: b.service_type,
                procedure: b.procedure_name,
                startTime: new Date(b.start_time),
                endTime: new Date(b.end_time),
                client: {
                     name: b.client?.name || 'Desconocido',
                     dni: b.client?.dni || '',
                     phone: b.client?.phone || '',
                     source: b.client?.source || ''
                },
                status: b.status,
                actualDuration: b.actual_duration,
                downPayment: b.down_payment,
                reconfirmationStatus: b.reconfirmation_status, // NEW
                comments: b.comments,
                createdAt: new Date(b.created_at),
                createdBy: b.created_by,
                createdByName: b.creator?.name
            }));
            setBookings(mappedBookings);
        }

        // 7. Expenses
        const { data: expensesData } = await client.from('expenses').select('*').order('timestamp', { ascending: false });
        if (expensesData) {
            setExpenses(expensesData.map((e: any) => ({
                id: e.id,
                timestamp: new Date(e.timestamp),
                category: e.category,
                subcategory: e.subcategory,
                amount: e.amount,
                description: e.description,
                createdBy: e.created_by
            })));
        }

        // 8. Withdrawals
        const { data: wData } = await client.from('withdrawals').select('*').order('timestamp', { ascending: false });
        if (wData) {
            setWithdrawals(wData.map((w: any) => ({
                id: w.id,
                timestamp: new Date(w.timestamp),
                amount: w.amount,
                personInCharge: w.person_in_charge,
                notes: w.notes,
                createdBy: w.created_by
            })));
        }

        // 9. Follow Up Tracking
        const { data: trackingData } = await client.from('follow_up_tracking').select('*');
        if (trackingData) {
            const trackMap: FollowUpTracking = {};
            trackingData.forEach((t: any) => {
                trackMap[t.sale_id] = {
                    status: t.status,
                    notes: t.notes,
                    lastContactDate: t.last_contact_date ? new Date(t.last_contact_date) : undefined,
                    archived: t.archived
                };
            });
            setFollowUpTracking(trackMap);
        }

    } catch (error) {
        console.error("Error fetching data:", error);
    } finally {
        setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchData();
  }, [fetchData, session]);


  // Helper: Upsert Client
  const upsertClient = async (clientData: Client): Promise<string | null> => {
      try {
          const client = supabase;
          if (!client) return null;
          const { data: existing } = await client.from('clients').select('id').eq('dni', clientData.dni).single();
          if (existing) {
              return existing.id;
          } else {
              const { data: newClient, error } = await client.from('clients').insert({
                  dni: clientData.dni,
                  name: clientData.name,
                  phone: clientData.phone,
                  source: clientData.source
              }).select('id').single();
              if (error) throw error;
              return newClient ? newClient.id : null;
          }
      } catch (e) {
          console.error("Error saving client:", e);
          return null;
      }
  };

  const activeDays = useMemo(() => {
    return (Object.values(weeklySchedule) as DaySchedule[]).filter(d => d.isOpen).map(d => d.dayId);
  }, [weeklySchedule]);

  const { globalStartHour, globalEndHour } = useMemo(() => {
      const openDays = (Object.values(weeklySchedule) as DaySchedule[]).filter(d => d.isOpen);
      if (openDays.length === 0) return { globalStartHour: 9, globalEndHour: 18 };
      const minStart = Math.min(...openDays.map(d => d.startHour));
      const maxEnd = Math.max(...openDays.map(d => d.endHour));
      return { globalStartHour: minStart, globalEndHour: maxEnd };
  }, [weeklySchedule]);


  const activeSpecialists = useMemo(() => 
    configSpecialists.filter(s => s.active).map(s => s.name), 
    [configSpecialists]
  );
  
  const [visibleSpecialists, setVisibleSpecialists] = useState<string[]>([]);

  useEffect(() => {
    if (visibleSpecialists.length === 0 && activeSpecialists.length > 0) {
        setVisibleSpecialists(activeSpecialists);
    }
  }, [activeSpecialists]);


  const serviceFilterRef = useRef<HTMLDivElement>(null);
  const procedureFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (serviceFilterRef.current && !serviceFilterRef.current.contains(event.target as Node)) {
            setServiceFilterOpen(false);
        }
        if (procedureFilterRef.current && !procedureFilterRef.current.contains(event.target as Node)) {
            setProcedureFilterOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // --- CRUD OPERATIONS ---

  const addSale = async (sale: Sale) => {
    const client = supabase;
    if (!client || !session) return;
    const clientId = await upsertClient(sale.client);
    if (!clientId) return;

    const { data, error } = await client.from('sales').insert({
        client_id: clientId,
        timestamp: sale.timestamp.toISOString(),
        service_type: sale.serviceType,
        procedure_name: sale.procedure,
        payments: sale.payments,
        cream_sold: sale.creamSold,
        comments: sale.comments,
        created_by: session.user.id,
        // NEW
        booking_id: sale.bookingId,
        transaction_type: sale.transactionType
    }).select('id').single();

    if (error) {
        console.error(error);
        alert('Error al guardar transacción.');
    } else if (data) {
        const newSaleWithId = { ...sale, id: data.id, createdBy: session.user.id, createdByName: userProfile?.name };
        setSales(prev => [newSaleWithId, ...prev]);
        alert('Transacción registrada con éxito!');
        if(!sale.bookingId) { // Only track unrelated sales automatically, booking sales are tracked via booking status
             setFollowUpTracking(prev => ({ ...prev, [data.id]: { status: 'PENDIENTE' } }));
        }
    }
  };

  const updateSale = async (updatedSale: Sale) => {
    const client = supabase;
    if (!client) return;
    const { error } = await client.from('sales').update({
        service_type: updatedSale.serviceType,
        procedure_name: updatedSale.procedure,
        payments: updatedSale.payments,
        cream_sold: updatedSale.creamSold,
        comments: updatedSale.comments,
        transaction_type: updatedSale.transactionType
    }).eq('id', updatedSale.id);

    if (error) {
        console.error(error);
        alert('Error al actualizar venta.');
    } else {
        setSales(prev => prev.map(s => (s.id === updatedSale.id ? updatedSale : s)));
        alert('Venta actualizada con éxito!');
    }
  };

  const deleteSale = async (saleId: string) => {
      const client = supabase;
      if (!client) return;
      if (userProfile?.role !== 'admin') {
          alert('Solo los administradores pueden eliminar ventas.');
          return;
      }
      if (window.confirm('¿Estás seguro de que deseas eliminar esta venta? Esta acción no se puede deshacer.')) {
          const { error } = await client.from('sales').delete().eq('id', saleId);
          if (error) {
              console.error(error);
              alert('Error al eliminar venta.');
          } else {
              setSales(prev => prev.filter(s => s.id !== saleId));
          }
      }
  };
  
  const addBulkSales = async (newSales: Sale[]) => {
      // (Simplified for brevity, logic remains similar but adds new fields if available)
      const client = supabase;
      if (!client || !session) return;
      setIsLoading(true);
      try {
          for (const sale of newSales) {
              const clientId = await upsertClient(sale.client);
              if (clientId) {
                  await client.from('sales').insert({
                      client_id: clientId,
                      timestamp: sale.timestamp.toISOString(),
                      service_type: sale.serviceType,
                      procedure_name: sale.procedure,
                      payments: sale.payments,
                      cream_sold: sale.creamSold,
                      comments: 'Carga Masiva',
                      created_by: session.user.id
                  });
              }
          }
          await fetchData();
          alert("Carga masiva completada.");
      } catch (e) {
          console.error(e);
          alert("Error en carga masiva.");
      } finally {
          setIsLoading(false);
      }
  };

  const addBulkBookings = async (newBookings: Booking[]) => {
      const client = supabase;
      if (!client || !session) return;
      setIsLoading(true);
      try {
          for (const booking of newBookings) {
              const clientId = await upsertClient(booking.client);
              if (clientId) {
                  await client.from('bookings').insert({
                      client_id: clientId,
                      start_time: booking.startTime.toISOString(),
                      end_time: booking.endTime.toISOString(),
                      specialist: booking.specialist,
                      service_type: booking.serviceType,
                      procedure_name: booking.procedure,
                      status: 'completed',
                      comments: 'Carga Masiva',
                      created_by: session.user.id,
                      booking_code: Math.floor(100000 + Math.random() * 900000).toString() // Generate random code
                  });
              }
          }
          await fetchData();
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };
  
  // NEW: HANDLE BULK DELETE (ADMIN ONLY)
  const handleBulkDelete = async () => {
      const client = supabase;
      if (!client || userProfile?.role !== 'admin') return;
      
      setIsLoading(true);
      try {
          // 1. Delete Sales tagged as 'Carga Masiva'
          const { error: salesError, count: salesCount } = await client
              .from('sales')
              .delete({ count: 'exact' })
              .ilike('comments', '%Carga Masiva%');
          
          if (salesError) throw salesError;

          // 2. Delete Bookings tagged as 'Carga Masiva' OR 'Generado desde carga histórica'
          const { error: bookingsError, count: bookingsCount } = await client
              .from('bookings')
              .delete({ count: 'exact' })
              .or('comments.ilike.%Carga Masiva%,comments.ilike.%Generado desde carga histórica%');

          if (bookingsError) throw bookingsError;

          await fetchData();
          alert(`Limpieza completada.\nSe eliminaron:\n- ${salesCount} Ventas\n- ${bookingsCount} Reservas\n\n(Los clientes se mantuvieron intactos)`);

      } catch (e: any) {
          console.error(e);
          alert(`Error al eliminar carga masiva: ${e.message}`);
      } finally {
          setIsLoading(false);
      }
  };
  
  // NEW: EXECUTE FACTORY RESET
  const executeFactoryReset = async () => {
      const client = supabase;
      if (!client || userProfile?.role !== 'admin') return;

      setIsLoading(true);
      try {
          console.log("Starting Factory Reset...");

          // 1. Follow Up Tracking
          const { error: err1 } = await client.from('follow_up_tracking').delete().neq('sale_id', '00000000-0000-0000-0000-000000000000'); 
          if(err1) throw new Error(`Error borrando Seguimiento: ${err1.message}`);

          // 2. Sales
          const { error: err2 } = await client.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if(err2) throw new Error(`Error borrando Ventas: ${err2.message}`);

          // 3. Bookings
          const { error: err3 } = await client.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if(err3) throw new Error(`Error borrando Reservas: ${err3.message}`);

          // 4. Expenses
          const { error: err4 } = await client.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if(err4) console.error("Error borrando gastos (no crítico):", err4);

          // 5. Withdrawals
          const { error: err5 } = await client.from('withdrawals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if(err5) console.error("Error borrando retiros (no crítico):", err5);

          // 6. Clients
          const { error: err6 } = await client.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if(err6) throw new Error(`Error borrando Clientes: ${err6.message}`);

          // Refresh Local State
          await fetchData();
          
          alert('✅ SISTEMA RESTABLECIDO CORRECTAMENTE.\n\nLa base de datos está vacía.');

      } catch (e: any) {
          console.error(e);
          alert(`❌ Error durante el reseteo: ${e.message}\n\nVerifique la consola para más detalles.`);
      } finally {
          setIsLoading(false);
      }
  };

  // Generate Booking Code: Format MMYY-XXX (Sequential)
  const generateBookingCode = (date: Date): string => {
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yy = String(date.getFullYear()).slice(-2);
      const prefix = `${mm}${yy}`;

      // Find existing bookings with this prefix
      const existingCodes = bookings
          .filter(b => b.bookingCode && b.bookingCode.startsWith(prefix + '-'))
          .map(b => {
              const parts = b.bookingCode!.split('-');
              return parseInt(parts[1], 10);
          })
          .filter(n => !isNaN(n));

      const maxSequence = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;
      const nextSequence = maxSequence + 1;

      return `${prefix}-${String(nextSequence).padStart(3, '0')}`;
  };

  const addBooking = async (booking: Booking, downPaymentSale?: Sale) => {
    const client = supabase;
    if (!client || !session) return;
    const clientId = await upsertClient(booking.client);
    if (!clientId) return;

    // Generate Code based on Booking Date (Appointment Date)
    const code = generateBookingCode(booking.startTime);

    const { data: bookingData, error: bookingError } = await client.from('bookings').insert({
        client_id: clientId,
        start_time: booking.startTime.toISOString(),
        end_time: booking.endTime.toISOString(),
        specialist: booking.specialist,
        service_type: booking.serviceType,
        procedure_name: booking.procedure,
        status: 'scheduled',
        comments: booking.comments,
        down_payment: booking.downPayment,
        created_by: session.user.id,
        booking_code: code // Save code
    }).select('id').single();

    if (bookingError) {
        console.error(bookingError);
        alert('Error al crear reserva.');
        return;
    }

    if (bookingData) {
        const newBooking = { 
            ...booking, 
            id: bookingData.id, 
            bookingCode: code,
            status: 'scheduled' as const,
            createdBy: session.user.id,
            createdByName: userProfile?.name
        };
        setBookings(prev => [...prev, newBooking].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()));

        // Link Sale to Booking
        if (downPaymentSale) {
            const saleWithLink = { 
                ...downPaymentSale, 
                bookingId: bookingData.id, 
                transactionType: 'adelanto' as const,
                comments: `Adelanto Reserva #${code} - ${downPaymentSale.comments || ''}`
            };
            await addSale(saleWithLink);
        } else {
            alert(`Reserva registrada con éxito! Código: ${code}`);
        }
    }
  };
  
  const updateBooking = async (updatedBooking: Booking, downPaymentSale?: Sale) => {
      const client = supabase;
      if (!client) return;
      const { error } = await client.from('bookings').update({
          start_time: updatedBooking.startTime.toISOString(),
          end_time: updatedBooking.endTime.toISOString(),
          specialist: updatedBooking.specialist,
          service_type: updatedBooking.serviceType,
          procedure_name: updatedBooking.procedure,
          status: updatedBooking.status,
          actual_duration: updatedBooking.actualDuration,
          comments: updatedBooking.comments,
          down_payment: updatedBooking.downPayment
      }).eq('id', updatedBooking.id);

      if (error) {
          console.error(error);
          alert('Error al actualizar reserva.');
      } else {
          setBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b).sort((a, b) => a.startTime.getTime() - b.startTime.getTime()));
          if (downPaymentSale) {
             const saleWithLink = { 
                ...downPaymentSale, 
                bookingId: updatedBooking.id, 
                transactionType: 'adelanto' as const,
                comments: `Adelanto Reserva #${updatedBooking.bookingCode || ''} - ${downPaymentSale.comments || ''}`
             };
             await addSale(saleWithLink);
          } else {
             alert('Reserva actualizada con éxito!');
          }
      }
  };
  
  // NEW: Update Reconfirmation Status (WITH OPTIMISTIC UI FIX)
  const updateBookingReconfirmation = async (bookingId: string, status: 'confirmed' | 'rejected' | null) => {
      const client = supabase;
      if (!client) return;
      
      const nextStatus = status || undefined; // Convert null to undefined for state

      // 1. Update the Main List
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, reconfirmationStatus: nextStatus } : b));
      
      // 2. Update the Currently Open Modal (Fixes "button not working" visual bug)
      if (viewingBooking && viewingBooking.id === bookingId) {
          setViewingBooking(prev => prev ? { ...prev, reconfirmationStatus: nextStatus } : null);
      }

      // 3. Persist to DB
      const { error } = await client.from('bookings').update({
          reconfirmation_status: status
      }).eq('id', bookingId);

      if (error) {
          console.error("Error DB Reconfirm:", error);
          alert('Error al guardar en base de datos. Verifique que la columna "reconfirmation_status" exista en la tabla "bookings".');
      }
  };

  const confirmBooking = async (booking: Booking, actualDuration: number, finalPayment?: Sale) => {
      const client = supabase;
      if (!client) return;
      
      const { error } = await client.from('bookings').update({
          status: 'completed',
          actual_duration: actualDuration
      }).eq('id', booking.id);

      if (error) {
           console.error(error);
           alert('Error al confirmar reserva.');
      } else {
          setBookings(prev => prev.map(b => {
            if (b.id === booking.id) {
                return { ...b, status: 'completed', actualDuration: actualDuration };
            }
            return b;
          }));

          if (finalPayment) {
              await addSale(finalPayment);
          } else {
              alert('Atención confirmada correctamente.');
          }
      }
  };
  
  const markBookingAsNoShow = async (bookingId: string) => {
      const client = supabase;
      if (!client) return;
      if(window.confirm('¿Estás seguro de marcar esta reserva como "No Vino"?')) {
        const { error } = await client.from('bookings').update({
            status: 'noshow'
        }).eq('id', bookingId);
        
        if (error) {
             console.error(error);
        } else {
            setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'noshow' } : b));
        }
      }
  };

  const deleteBooking = async (bookingId: string) => {
      const client = supabase;
      if (!client) return;

      // 1. Check for linked payments (Sales) in local state
      // We look for sales that point to this booking ID
      const linkedSales = sales.filter(s => s.bookingId === bookingId);
      const hasPayments = linkedSales.length > 0;

      // 2. Permission Check
      if (hasPayments) {
          if (userProfile?.role !== 'admin') {
              alert('ACCESO DENEGADO.\n\nEsta reserva tiene pagos vinculados. Para mantener la integridad de la caja, no puede eliminarla.\n\nPor favor, marque la reserva como "No Vino" o Reprográmela.');
              return;
          } else {
              // Admin Override Prompt
              const confirmed = window.confirm('ADVERTENCIA DE ADMINISTRADOR:\n\nEsta reserva tiene pagos vinculados. Eliminarla dejará los pagos "huérfanos" (sin cita asociada) pero se mantendrán en caja.\n\n¿Desea desvincular los pagos y eliminar la reserva de todos modos?');
              if (!confirmed) return;
          }
      } else {
          // Standard confirmation for bookings without payments
          if (!window.confirm('¿Estás seguro de que deseas eliminar esta reserva?')) return;
      }
      
      setIsLoading(true);
      try {
          if (hasPayments) {
              // Admin override: Unlink sales first
               const { error: unlinkError } = await client
                .from('sales')
                .update({ booking_id: null }) 
                .eq('booking_id', bookingId);
            
                if (unlinkError) console.warn("Error desvinculando ventas", unlinkError);
          }

          // Delete the booking
          const { error } = await client.from('bookings').delete().eq('id', bookingId);
          if (error) {
               console.error(error);
               alert(`Error al eliminar reserva: ${error.message}`);
          } else {
               setBookings(prev => prev.filter(b => b.id !== bookingId));
               // Update local sales state if we unlinked
               if (hasPayments) {
                   setSales(prev => prev.map(s => s.bookingId === bookingId ? { ...s, bookingId: undefined } : s));
               }
               alert('Reserva eliminada correctamente.');
          }
      } catch (e: any) {
          console.error(e);
          alert(`Error inesperado: ${e.message}`);
      } finally {
          setIsLoading(false);
      }
  };

  const addWithdrawal = async (withdrawal: Withdrawal) => {
    const client = supabase;
    if (!client || !session) return;
    const { data, error } = await client.from('withdrawals').insert({
        amount: withdrawal.amount,
        person_in_charge: withdrawal.personInCharge,
        notes: withdrawal.notes,
        timestamp: withdrawal.timestamp.toISOString(),
        created_by: session.user.id
    }).select('id').single();

    if (error) {
        console.error(error);
        alert('Error al guardar retiro.');
    } else if (data) {
        setWithdrawals(prev => [...prev, { ...withdrawal, id: data.id }]);
        alert('Retiro registrado con éxito!');
    }
  };

  const addExpense = async (expense: Expense) => {
      const client = supabase;
      if (!client || !session) return;
      const { data, error } = await client.from('expenses').insert({
          category: expense.category,
          subcategory: expense.subcategory,
          amount: expense.amount,
          description: expense.description,
          timestamp: expense.timestamp.toISOString(),
          created_by: session.user.id
      }).select('id').single();

      if (error) {
          console.error(error);
          alert('Error al guardar gasto.');
      } else if (data) {
          setExpenses(prev => [...prev, { ...expense, id: data.id }]);
          alert('Gasto registrado con éxito!');
      }
  };

  const deleteExpense = async (id: string) => {
      const client = supabase;
      if (!client) return;
      if(window.confirm("¿Seguro que desea eliminar este gasto?")) {
          const { error } = await client.from('expenses').delete().eq('id', id);
          if (error) {
              console.error(error);
          } else {
              setExpenses(prev => prev.filter(e => e.id !== id));
          }
      }
  };
  
  const handleUpdateFollowUp = async (saleId: string, newState: FollowUpState) => {
      const client = supabase;
      if (!client) return;
      const { error } = await client.from('follow_up_tracking').upsert({
          sale_id: saleId,
          status: newState.status,
          notes: newState.notes,
          archived: newState.archived,
      });

      if (error) {
          console.error(error);
      } else {
          setFollowUpTracking(prev => ({ ...prev, [saleId]: newState }));
      }
  };

  const handleArchiveClient = async (saleId: string) => {
      const newState = { ...(followUpTracking[saleId] || { status: 'PENDIENTE' }), archived: true };
      await handleUpdateFollowUp(saleId, newState);
  };

  const handleBulkArchive = async (saleIds: string[]) => {
      const client = supabase;
      if (!client) return;
      const updates = saleIds.map(id => ({
          sale_id: id,
          status: followUpTracking[id]?.status || 'PENDIENTE',
          archived: true
      }));
      
      const { error } = await client.from('follow_up_tracking').upsert(updates);
      if (error) {
          console.error(error);
      } else {
           setFollowUpTracking(prev => {
              const newTracking = { ...prev };
              saleIds.forEach(id => {
                  newTracking[id] = { ...(newTracking[id] || { status: 'PENDIENTE' }), archived: true };
              });
              return newTracking;
          });
          alert(`${saleIds.length} clientes archivados.`);
      }
  };
  
  // Configuration Handlers
  const saveSpecialistsToDB = async (newSpecialists: Specialist[]) => {
      const client = supabase;
      if (!client) return;
      const { error } = await client.from('specialists').upsert(newSpecialists.map(s => ({
          name: s.name,
          active: s.active
      })), { onConflict: 'name' });
      
      if (!error) setConfigSpecialists(newSpecialists);
  };

  const saveScheduleToDB = async (newSchedule: Record<number, DaySchedule>) => {
      const client = supabase;
      if (!client) return;
      const updates = Object.values(newSchedule).map(d => ({
          day_id: d.dayId,
          name: d.name,
          is_open: d.isOpen,
          start_hour: d.startHour,
          end_hour: d.endHour,
          has_lunch: d.hasLunch,
          lunch_start_hour: d.lunchStartHour,
          lunch_end_hour: d.lunchEndHour
      }));
      const { error } = await client.from('weekly_schedule').upsert(updates);
      if (!error) setWeeklySchedule(newSchedule);
  };

  const saveGoalsToDB = async (goals: Record<string, number>, type: 'sales' | 'booking' | 'client') => {
      const client = supabase;
      if (!client) return;
      const rows = Object.entries(goals).map(([key, val]) => {
          const [y, m] = key.split('-');
          return { year: parseInt(y), month: parseInt(m), val };
      });

      for (const r of rows) {
          const { data: existing } = await client.from('goals').select('id').eq('year', r.year).eq('month', r.month).single();
          const updateObj: any = {};
          if (type === 'sales') updateObj.sales_goal = r.val;
          if (type === 'booking') updateObj.booking_goal = r.val;
          if (type === 'client') updateObj.client_goal = r.val;

          if (existing) {
              await client.from('goals').update(updateObj).eq('id', existing.id);
          } else {
              await client.from('goals').insert({ year: r.year, month: r.month, ...updateObj });
          }
      }
      if (type === 'sales') setConfigSalesGoals(goals);
      if (type === 'booking') setConfigBookingGoals(goals);
      if (type === 'client') setConfigClientGoals(goals);
  };
  
  const updateExpenseCategories = async (newCats: Record<string, string[]>) => {
      const client = supabase;
      if (!client) return;
      for (const [catName, subs] of Object.entries(newCats)) {
           await client.from('expense_categories').upsert({
               category_name: catName,
               subcategories: subs
           }, { onConflict: 'category_name' });
      }
      setExpenseCategories(newCats);
  };


  const handleEditClick = (sale: Sale) => {
    setEditingSale(sale);
    setIsSalesModalOpen(true);
  };

  const handleSaveSale = (sale: Sale) => {
    if (editingSale) {
      updateSale(sale);
    } else {
      addSale(sale);
      setActiveView('sales'); // Auto switch to sales list after adding
    }
  };
  
   const handleSaveBooking = (booking: Booking, downPaymentSale?: Sale) => {
    if (editingBooking) {
        updateBooking(booking, downPaymentSale);
    } else {
        addBooking(booking, downPaymentSale);
        setActiveView('bookings'); // Auto switch to calendar
    }
    setIsBookingModalOpen(false);
    setEditingBooking(null);
    setBookingPrefill(null); 
  };

  const handleCloseSalesModal = () => {
    setIsSalesModalOpen(false);
    setEditingSale(null);
  };
  
   const handleCloseBookingModal = () => {
    setIsBookingModalOpen(false);
    setEditingBooking(null);
    setBookingPrefill(null); 
    setInitialBookingSpecialist('');
    setInitialBookingService('');
  };
  
  const handleOpenHistoryModal = (dni: string) => {
    setHistoryClientDni(dni);
  };

  const handleCloseHistoryModal = () => {
    setHistoryClientDni(null);
  };

  const handleOpenBookingModal = (date?: Date, specialist?: string) => {
    setEditingBooking(null);
    setInitialBookingDate(date || null);
    
    if (specialist) {
        setInitialBookingSpecialist(specialist);
        if (specialist === 'Laura') {
            setInitialBookingService('Remoción');
        } else if (specialist === 'Julissa') {
             setInitialBookingService('Cejas');
        } else if (specialist === 'D.G.' || specialist === 'Evaluación') {
            setInitialBookingService('Otro');
        } else {
            setInitialBookingService('');
        }
    } else {
        setInitialBookingSpecialist('');
        setInitialBookingService('');
    }

    setIsBookingModalOpen(true);
  }

  const handleBookFromFollowUp = (client: Client) => {
      setBookingPrefill({
          client,
          serviceType: 'Cejas',
          procedure: 'Retoque'
      });
      setIsBookingModalOpen(true);
  };
  
  const handleBookingClick = (booking: Booking) => {
    setViewingBooking(booking);
  };
  
  const handleEditBookingClick = (booking: Booking) => {
    setViewingBooking(null); 
    setEditingBooking(booking);
    setIsBookingModalOpen(true);
  };
  
  // NEW: Updated Confirm Logic to support financial closing
  const handleConfirmBookingClick = (booking: Booking, duration: number) => {
      // In the new flow, the modal handles the logic and passes data back here?
      // Actually, to keep it simple, BookingDetailModal will pass the data
      // For now, this signature needs to support the final sale
      setViewingBooking(null);
      // Logic handled inside BookingDetailModal but final save triggers confirmBooking
      // We will update this function signature in the component prop
  }
  
  // Actually confirm booking with payment
  const executeBookingConfirmation = (booking: Booking, duration: number, finalPayment?: Sale) => {
      setViewingBooking(null);
      confirmBooking(booking, duration, finalPayment);
  };

  const handleDeleteBookingClick = (bookingId: string) => {
    setViewingBooking(null);
    deleteBooking(bookingId);
  };
  
  const handleNoShowBookingClick = (bookingId: string) => {
      setViewingBooking(null);
      markBookingAsNoShow(bookingId);
  }

  const filteredSales = useMemo(() => {
    return sales
      .filter(sale => {
        const saleDate = new Date(sale.timestamp);
        const yearMatches = saleDate.getFullYear() === displayedYear;
        if (!yearMatches) return false;
        if (displayedMonth !== -1 && saleDate.getMonth() !== displayedMonth) {
          return false;
        }
        if (filterService.length > 0 && !filterService.includes(sale.serviceType)) return false;
        if (filterProcedure.length > 0 && !filterProcedure.includes(sale.procedure)) return false;
        if (filterCream === 'yes' && !sale.creamSold) return false;
        if (filterCream === 'no' && sale.creamSold) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sales, displayedMonth, displayedYear, filterService, filterProcedure, filterCream]);
  
  // NEW: Sales filtered ONLY by date for Cash Control (ignores service/procedure filters)
  const dateFilteredSales = useMemo(() => {
    return sales
      .filter(sale => {
        const saleDate = new Date(sale.timestamp);
        const yearMatches = saleDate.getFullYear() === displayedYear;
        if (!yearMatches) return false;
        if (displayedMonth !== -1 && saleDate.getMonth() !== displayedMonth) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sales, displayedMonth, displayedYear]);

  const filteredWithdrawals = useMemo(() => {
    return withdrawals
      .filter(w => {
        const wDate = new Date(w.timestamp);
        const yearMatches = wDate.getFullYear() === displayedYear;
        if (!yearMatches) return false;
        if (displayedMonth !== -1 && wDate.getMonth() !== displayedMonth) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [withdrawals, displayedMonth, displayedYear]);

  const salesStats = useMemo(() => {
    let totalSales = 0;
    let totalPhysical = 0; 
    let totalDigital = 0;
    let totalCard = 0;
    
    // Counter for transactions
    let countAdelantos = 0;
    let countCierres = 0;

    filteredSales.forEach(sale => {
        if (sale.transactionType === 'adelanto') countAdelantos++;
        else if (sale.transactionType === 'cierre') countCierres++;

        sale.payments.forEach(payment => {
            const amount = payment.amount;
            totalSales += amount;
            if (CASH_METHODS.includes(payment.method)) {
                totalPhysical += amount;
            } else if (DIGITAL_METHODS.includes(payment.method)) {
                totalDigital += amount;
            } else if (CARD_METHODS.includes(payment.method)) {
                totalCard += amount;
            }
        });
    });
    
    const cardPercentage = totalSales > 0 ? (totalCard / totalSales) * 100 : 0;
    const totalTransactions = filteredSales.length;

    return { 
        totalSales, 
        totalTransactions, 
        totalPhysical, 
        totalDigital, 
        totalCard, 
        cardPercentage,
        countAdelantos,
        countCierres
    };
  }, [filteredSales]);

  // NEW: Booking Stats for Header (New Clients, Unique Clients)
  const bookingStats = useMemo(() => {
      // Filter COMPLETED bookings in range
      const periodBookings = bookings.filter(b => {
          if (b.status !== 'completed') return false;
          const date = new Date(b.startTime); // Use Service Date
          const matchYear = date.getFullYear() === displayedYear;
          const matchMonth = displayedMonth === -1 || date.getMonth() === displayedMonth;
          return matchYear && matchMonth;
      });

      const uniqueClients = new Set(periodBookings.map(b => b.client.dni)).size;
      
      // New Clients Logic (First completed visit ever)
      const periodStartDate = displayedMonth === -1 
        ? new Date(displayedYear, 0, 1)
        : new Date(displayedYear, displayedMonth, 1);
      
      let newClientsCount = 0;
      const processedDNIs = new Set();

      periodBookings.forEach(b => {
          if (processedDNIs.has(b.client.dni)) return; // Count each client only once per period
          processedDNIs.add(b.client.dni);

          // Check if they had any COMPLETED booking before this period
          const hasHistory = bookings.some(pastB => 
              pastB.client.dni === b.client.dni && 
              pastB.status === 'completed' &&
              new Date(pastB.startTime) < periodStartDate
          );
          
          if (!hasHistory) newClientsCount++;
      });

      return { uniqueClients, newClientsCount };
  }, [bookings, displayedYear, displayedMonth]);

  const cashControlStats = useMemo(() => {
      // Recalculate cash in based on dateFilteredSales to avoid issues with service filters
      let totalCashIn = 0;
      dateFilteredSales.forEach(sale => {
          sale.payments.forEach(p => {
              if (CASH_METHODS.includes(p.method)) {
                  totalCashIn += p.amount;
              }
          });
      });

      const totalWithdrawals = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);
      const currentBalance = totalCashIn - totalWithdrawals;
      return { totalCashIn, totalWithdrawals, currentBalance };
  }, [dateFilteredSales, filteredWithdrawals]);

  const cashTransactions = useMemo(() => {
      // Use dateFilteredSales here as well
      const incomeTransactions = dateFilteredSales.flatMap(sale =>
          sale.payments
              .filter(p => CASH_METHODS.includes(p.method)) 
              .map(p => ({
                  id: `sale-${sale.id}-${p.method}`,
                  type: 'income' as const,
                  timestamp: new Date(sale.timestamp),
                  description: `Venta: ${sale.serviceType} (${sale.client.name})`,
                  amount: p.amount,
              }))
      );

      const withdrawalTransactions = filteredWithdrawals.map(w => ({
          id: w.id,
          type: 'withdrawal' as const,
          timestamp: new Date(w.timestamp),
          description: `Retiro: ${w.personInCharge} (${w.notes || 'Sin observaciones'})`,
          amount: w.amount,
      }));

      const allTransactions = [...incomeTransactions, ...withdrawalTransactions]
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      let runningBalance = 0;
      // Calculate running balance from oldest to newest, then reverse for display
      const transactionsSortedByDate = [...allTransactions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const transactionsWithBalance = transactionsSortedByDate.map(tx => {
          if (tx.type === 'income') {
              runningBalance += tx.amount;
          } else {
              runningBalance -= tx.amount;
          }
          return { ...tx, balance: runningBalance };
      });

      return transactionsWithBalance.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [dateFilteredSales, filteredWithdrawals]);


  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDisplayedMonth(parseInt(e.target.value, 10));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDisplayedYear(parseInt(e.target.value, 10));
  };
  
  const handleServiceFilterToggle = (serviceToToggle: string) => {
    setFilterService(prev => {
        const newSelection = prev.includes(serviceToToggle)
            ? prev.filter(s => s !== serviceToToggle)
            : [...prev, serviceToToggle];
        setFilterProcedure([]);
        return newSelection;
    });
  };

  const handleProcedureFilterToggle = (procedureToToggle: string) => {
      setFilterProcedure(prev => 
          prev.includes(procedureToToggle)
              ? prev.filter(p => p !== procedureToToggle)
              : [...prev, procedureToToggle]
      );
  };

  const handleCreamFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterCream(e.target.value);
  };
  
  const availableProcedures = useMemo(() => {
    if (filterService.length === 0) {
        const allProcedures = Object.values(PROCEDURES_BY_SERVICE).flat();
        return [...new Set(allProcedures)];
    }
    const allProcedures = filterService.flatMap(s => PROCEDURES_BY_SERVICE[s] || []);
    return [...new Set(allProcedures)]; 
  }, [filterService]);

  const getSelectionText = (selectedItems: string[], defaultText: string) => {
      if (selectedItems.length === 0) return defaultText;
      if (selectedItems.length === 1) return selectedItems[0];
      return `${selectedItems.length} seleccionados`;
  };
  
  const filteredBookings = useMemo(() => {
    // 1. Filter by Specialist Visibility
    let result = bookings.filter(b => visibleSpecialists.includes(b.specialist));
    
    // 2. Filter by Search Term (List Mode Only)
    if (bookingDisplayMode === 'list' && bookingSearchTerm) {
        const lowerTerm = bookingSearchTerm.toLowerCase();
        result = result.filter(b => 
            (b.bookingCode && b.bookingCode.toLowerCase().includes(lowerTerm)) ||
            (b.client.dni && b.client.dni.includes(lowerTerm)) ||
            (b.client.name && b.client.name.toLowerCase().includes(lowerTerm))
        );
        // In list mode search, we usually want to see all relevant history, not just future/current
        return result.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    }

    return result;
  }, [bookings, visibleSpecialists, bookingDisplayMode, bookingSearchTerm]);


  const displayedPeriodText = useMemo(() => {
    if (displayedMonth === -1) {
      return `Año ${displayedYear}`;
    }
    const monthName = MONTHS[displayedMonth];
    return `${monthName}, ${displayedYear}`;
  }, [displayedMonth, displayedYear]);
  
    const handleDownloadExcel = () => {
    const dataToExport = filteredSales.map(sale => {
      const totalAmount = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      const paymentMethods = sale.payments.map(p => `${p.method}: S/ ${p.amount.toFixed(2)}`).join('; ');
      
      return {
        'Fecha': new Date(sale.timestamp).toLocaleString('es-ES'),
        'Tipo': sale.transactionType ? sale.transactionType.toUpperCase() : 'VENTA',
        'Cod. Reserva': sale.bookingId ? (getBookingCode(sale.bookingId) || 'LINKED') : '-', // Lookup code
        'Registrado Por': sale.createdByName || 'Desconocido',
        'Cliente': sale.client.name,
        'DNI': sale.client.dni,
        'Servicio': sale.serviceType,
        'Procedimiento': sale.procedure,
        'Monto Total': totalAmount,
        'Medios de Pago': paymentMethods,
        'Comentarios': sale.comments || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transacciones');

    const fileName = `Transacciones_${displayedPeriodText.replace(', ', '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleDownloadBookings = () => {
    const dataToExport = filteredBookings.map(b => ({
      'Cod. Reserva': b.bookingCode || b.id,
      'Fecha': b.startTime.toLocaleDateString('es-ES'),
      'Hora': b.startTime.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}),
      'Especialista': b.specialist,
      'Servicio': b.serviceType,
      'Procedimiento': b.procedure,
      'Cliente': b.client.name,
      'DNI': b.client.dni,
      'Estado': b.status,
      'Comentarios': b.comments || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reservas');
    XLSX.writeFile(workbook, `Reservas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadCashControl = () => {
      const dataToExport = cashTransactions.map(tx => ({
          'Fecha': tx.timestamp.toLocaleString('es-ES'),
          'Descripción': tx.description,
          'Tipo': tx.type === 'income' ? 'Ingreso' : 'Retiro',
          'Monto': tx.amount,
          'Saldo': tx.balance
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Caja');
      XLSX.writeFile(workbook, `Caja_${displayedPeriodText.replace(', ', '_')}.xlsx`);
  }


  const handleViewChange = (view: View) => {
    setActiveView(view);
    setIsSidebarOpen(false); // Close sidebar on navigation
  }
  
  // Helper to find booking code by ID
  const getBookingCode = (bookingId: string) => {
      const booking = bookings.find(b => b.id === bookingId);
      return booking ? booking.bookingCode : null;
  }
  
  const getBookingById = (bookingId: string) => {
      return bookings.find(b => b.id === bookingId);
  }

  const SideBarButton: React.FC<{view: View, label: string, icon: React.ReactElement}> = ({ view, label, icon }) => (
    <button
      onClick={() => handleViewChange(view)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors duration-200 ${
        activeView === view 
          ? 'bg-purple-600 text-white shadow-lg' 
          : 'text-slate-600 hover:bg-purple-100 hover:text-purple-800'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  
  const HomeIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
  const SalesIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01m0 12v1a2 2 0 002 2h2a2 2 0 00-2-2h-2.003A2 2 0 0112 13v-1m-4.003 4H12" /></svg>;
  const BookingsIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
  const CashControlIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
  const ConfigIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  const ManagementIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
  const FollowUpIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 17l4 4 4-4m-4-5v9" /></svg>;
  const ExpenseIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;

  const viewTitles: Record<View, string> = {
    home: 'Inicio',
    sales: 'Ventas (Transacciones)',
    bookings: 'Reservas',
    cashControl: 'Control de Caja',
    configuration: 'Configuración',
    management: 'Control de Gestión',
    followUp: 'Seguimiento',
    expenses: 'Control de Gastos'
  };

  // If loading Auth, show spinner
  if (isLoadingAuth) {
      return (
          <div className="h-screen w-screen flex items-center justify-center bg-slate-100">
              <div className="text-center">
                  <svg className="animate-spin h-10 w-10 text-purple-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-slate-600 font-semibold">Cargando...</p>
              </div>
          </div>
      );
  }

  // If not logged in, show Login Screen
  if (!session) {
      return <Login />;
  }

  if (!supabase) {
      return (
          <div className="h-screen w-screen flex items-center justify-center bg-slate-100">
              <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
                  <h2 className="text-xl font-bold text-slate-800 mb-2">Error de Configuración</h2>
                  <p className="text-slate-600">No se ha podido conectar a Supabase.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="h-screen bg-slate-100 text-slate-800 flex flex-col lg:flex-row">
       {/* Mobile Sidebar Overlay */}
       {isSidebarOpen && (
          <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
          ></div>
       )}
       {/* Sidebar */}
        <aside className={`fixed top-0 left-0 w-64 bg-white h-full p-4 shadow-lg flex-shrink-0 flex flex-col z-30 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:h-screen lg:shadow-md`}>
          <div className="text-center mb-10 mt-4">
             <h1 className="text-3xl font-bold text-purple-800 cursor-pointer" onClick={() => setActiveView('home')}>Muzza</h1>
             <p className="text-slate-500 text-sm">Panel de Gestión</p>
          </div>
          <nav className="flex-grow space-y-2">
            <SideBarButton view="home" label="Inicio" icon={HomeIcon} />
            <SideBarButton view="bookings" label="Reservas" icon={BookingsIcon} />
            <SideBarButton view="sales" label="Ventas" icon={SalesIcon} />
            <SideBarButton view="cashControl" label="Control de Caja" icon={CashControlIcon} />
            <SideBarButton view="followUp" label="Seguimiento" icon={FollowUpIcon} />
            
            {/* Admin Only Views */}
            {userProfile?.role === 'admin' && (
                <>
                    <SideBarButton view="management" label="Control de Gestión" icon={ManagementIcon} />
                    <SideBarButton view="expenses" label="Control de Gastos" icon={ExpenseIcon} />
                    <SideBarButton view="configuration" label="Configuración" icon={ConfigIcon} />
                </>
            )}
          </nav>

          {/* User Profile Info */}
          <div className="mt-auto pt-4 border-t border-slate-200">
              <div className="flex items-center mb-4">
                  <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold mr-3">
                      {userProfile?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                      <p className="text-sm font-bold text-slate-800">{userProfile?.name || 'Usuario'}</p>
                      <p className="text-xs text-slate-500 capitalize">{userProfile?.role || 'Staff'}</p>
                  </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full py-2 px-4 rounded-md text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors border border-slate-200"
              >
                  Cerrar Sesión
              </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile Header */}
            <header className="lg:hidden flex justify-between items-center p-4 bg-white shadow-md sticky top-0 z-10">
                <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <h2 className="text-xl font-bold text-purple-800">{viewTitles[activeView]}</h2>
                <div className="w-6"></div>
            </header>

            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeView === 'home' && (
              <div className="max-w-4xl mx-auto space-y-8">
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg">
                      <h2 className="text-3xl font-bold mb-2">¡Hola, {userProfile?.name?.split(' ')[0] || 'Usuario'}! 👋</h2>
                      <p className="opacity-90">Resumen del día de hoy.</p>
                      
                      {/* UPDATED: Bookings by Specialist Today */}
                      <div className="mt-6">
                          <h3 className="text-sm uppercase font-bold opacity-80 mb-2">Citas para Hoy ({new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })})</h3>
                          <div className="flex flex-wrap gap-4">
                              {activeSpecialists.map(spec => {
                                  const count = bookings.filter(b => {
                                      const d = new Date(b.startTime);
                                      const now = new Date();
                                      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && b.specialist === spec;
                                  }).length;
                                  return (
                                      <div key={spec} className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center space-x-2">
                                          <span className="font-semibold">{spec}:</span>
                                          <span className="text-xl font-bold">{count}</span>
                                      </div>
                                  )
                              })}
                          </div>
                      </div>
                  </div>

                  <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-4">Acciones Rápidas</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* New Booking Card */}
                          <div 
                              onClick={() => { setEditingBooking(null); setIsBookingModalOpen(true); }}
                              className="bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition-all cursor-pointer group border-l-8 border-purple-500 flex flex-col justify-between h-48"
                          >
                              <div>
                                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  </div>
                                  <h3 className="text-xl font-bold text-slate-800 group-hover:text-purple-600 transition-colors">Registrar Reserva</h3>
                                  <p className="text-slate-500 mt-2 text-sm">Agendar una nueva cita (genera código).</p>
                              </div>
                              <div className="flex justify-end">
                                  <span className="text-purple-600 font-bold text-sm flex items-center">
                                      Comenzar <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                  </span>
                              </div>
                          </div>

                          {/* New Sale Card (Producto) */}
                          <div 
                              onClick={() => { setEditingSale(null); setIsSalesModalOpen(true); }}
                              className="bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition-all cursor-pointer group border-l-8 border-green-500 flex flex-col justify-between h-48"
                          >
                              <div>
                                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01m0 12v1a2 2 0 002 2h2a2 2 0 00-2-2h-2.003A2 2 0 0112 13v-1m-4.003 4H12" /></svg>
                                  </div>
                                  <h3 className="text-xl font-bold text-slate-800 group-hover:text-green-600 transition-colors">Venta Directa</h3>
                                  <p className="text-slate-500 mt-2 text-sm">Registrar venta de producto sin cita.</p>
                              </div>
                              <div className="flex justify-end">
                                  <span className="text-green-600 font-bold text-sm flex items-center">
                                      Comenzar <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                  </span>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {activeView === 'bookings' && (
              <>
                {/* NEW HEADER FOR BOOKINGS: Client Stats */}
                <div className="bg-white p-4 rounded-xl shadow-lg mb-6 flex flex-col md:flex-row justify-between gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                        <div className="flex items-center space-x-4 border-r border-slate-100 pr-4">
                            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-semibold">Clientes Únicos</p>
                                <p className="text-2xl font-bold text-slate-800">{bookingStats.uniqueClients}</p>
                                <p className="text-xs text-slate-400">En {displayedPeriodText}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="p-3 rounded-full bg-green-100 text-green-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-semibold">Nuevos Clientes</p>
                                <p className="text-2xl font-bold text-slate-800">{bookingStats.newClientsCount}</p>
                                <p className="text-xs text-slate-400">Primera visita en {displayedPeriodText}</p>
                            </div>
                        </div>
                    </div>
                    {/* View Toggle */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg self-start md:self-center">
                        <button
                            onClick={() => setBookingDisplayMode('calendar')}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${bookingDisplayMode === 'calendar' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Calendario
                        </button>
                        <button
                            onClick={() => setBookingDisplayMode('list')}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${bookingDisplayMode === 'list' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Lista
                        </button>
                    </div>
                </div>

                {bookingDisplayMode === 'calendar' ? (
                    <BookingCalendar
                        bookings={filteredBookings}
                        view={bookingView}
                        onViewChange={setBookingView}
                        onAddBooking={handleOpenBookingModal}
                        onBookingClick={handleBookingClick}
                        allSpecialists={activeSpecialists}
                        visibleSpecialists={visibleSpecialists}
                        onVisibleSpecialistsChange={setVisibleSpecialists}
                        startHour={globalStartHour}
                        endHour={globalEndHour}
                        availableDays={activeDays}
                        weeklySchedule={weeklySchedule}
                        onDownload={handleDownloadBookings}
                    />
                ) : (
                    /* LIST VIEW COMPONENT */
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                            <h3 className="text-lg font-bold text-slate-800">Listado de Reservas</h3>
                            <div className="relative w-full sm:w-64">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    placeholder="Buscar por DNI o Código..."
                                    value={bookingSearchTerm}
                                    onChange={(e) => setBookingSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Hora</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3">Servicio</th>
                                        <th className="px-4 py-3">Especialista</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredBookings.map((b) => (
                                        <tr key={b.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-mono font-bold text-purple-700">{b.bookingCode}</td>
                                            <td className="px-4 py-3">{b.startTime.toLocaleDateString('es-ES')}</td>
                                            <td className="px-4 py-3">{b.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-800">{b.client.name}</div>
                                                <div className="text-xs text-slate-400">{b.client.dni}</div>
                                            </td>
                                            <td className="px-4 py-3">{b.serviceType} <span className="text-xs text-slate-400 block">{b.procedure}</span></td>
                                            <td className="px-4 py-3">{b.specialist}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase 
                                                    ${b.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                                      b.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                      b.status === 'noshow' ? 'bg-gray-200 text-gray-600 line-through' :
                                                      'bg-yellow-100 text-yellow-800'}`}>
                                                    {b.status === 'completed' ? 'Completada' : 
                                                     b.status === 'cancelled' ? 'Cancelada' : 
                                                     b.status === 'noshow' ? 'No Vino' : 'Programada'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleBookingClick(b)} className="text-purple-600 hover:text-purple-800 font-bold hover:underline">
                                                    Ver
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredBookings.length === 0 && (
                                        <tr><td colSpan={8} className="p-8 text-center text-slate-400">No se encontraron reservas.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
              </>
          )}
          {activeView === 'sales' && (
            <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-lg">
                <div className="flex justify-between items-start flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
                    Registro de Transacciones
                    <span className="block sm:inline text-base sm:text-lg font-normal text-slate-500 sm:ml-2 capitalize">
                      ({displayedPeriodText})
                    </span>
                  </h2>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => { setEditingSale(null); setIsSalesModalOpen(true); }}
                        className="flex-1 sm:flex-none px-3 py-2.5 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-transform transform hover:scale-105 flex items-center justify-center space-x-2"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                          <span className="hidden sm:inline">Venta Directa</span>
                      </button>
                       <button 
                        onClick={() => setIsBulkUploadModalOpen(true)}
                        className="flex-1 sm:flex-none px-3 py-2.5 bg-sky-600 text-white font-bold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-transform transform hover:scale-105 flex items-center justify-center space-x-2"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <span className="hidden sm:inline">Carga Histórica</span>
                       </button>
                        <button 
                        onClick={handleDownloadExcel}
                        className="flex-1 sm:flex-none px-3 py-2.5 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform transform hover:scale-105 flex items-center justify-center space-x-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            <span className="hidden sm:inline">Descargar Excel</span>
                        </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {/* Stat Cards */}
                <div className="bg-white p-5 rounded-xl shadow-lg flex items-center space-x-4">
                    <div className="p-3 rounded-full bg-green-100 text-green-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg></div>
                    <div className="flex-1">
                        <p className="text-sm text-slate-500 font-semibold">Venta Total</p>
                        <p className="text-2xl font-bold text-slate-800">S/ {salesStats.totalSales.toFixed(2)}</p>
                         <div className="text-[10px] text-slate-500 mt-1 grid grid-cols-2 gap-x-2">
                            <span>Cash: S/ {salesStats.totalPhysical.toFixed(2)}</span>
                            <span>Digital: S/ {salesStats.totalDigital.toFixed(2)}</span>
                            <span>Tarjeta: S/ {salesStats.totalCard.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                 <div className="bg-white p-5 rounded-xl shadow-lg flex items-center space-x-4">
                    <div className="p-3 rounded-full bg-blue-100 text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
                    <div>
                        <p className="text-sm text-slate-500 font-semibold"># Transacciones</p>
                        <p className="text-3xl font-bold text-slate-800">{salesStats.totalTransactions}</p>
                    </div>
                </div>
                 <div className="bg-white p-5 rounded-xl shadow-lg flex items-center space-x-4">
                    <div className="p-3 rounded-full bg-purple-100 text-purple-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                    <div>
                        <p className="text-sm text-slate-500 font-semibold">Tipos</p>
                        <div className="text-sm text-slate-700">
                            <span className="font-bold">{salesStats.countAdelantos}</span> Adelantos
                        </div>
                        <div className="text-sm text-slate-700">
                            <span className="font-bold">{salesStats.countCierres}</span> Cierres
                        </div>
                    </div>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white p-4 rounded-xl shadow-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {/* Period Filters */}
                    <select value={displayedMonth} onChange={handleMonthChange} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                        <option value={-1}>Todos los Meses</option>
                        {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
                    </select>
                    <select value={displayedYear} onChange={handleYearChange} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                        {YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>

                    {/* Service/Procedure Filters */}
                     <div className="relative" ref={serviceFilterRef}>
                        <button onClick={() => setServiceFilterOpen(prev => !prev)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-left flex justify-between items-center">
                            <span>{getSelectionText(filterService, "Todos los Servicios")}</span>
                             <svg className={`h-5 w-5 text-slate-400 transition-transform ${serviceFilterOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                        {serviceFilterOpen && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                                {SERVICE_TYPES.map(service => (
                                    <label key={service} className="flex items-center space-x-3 p-2 hover:bg-slate-50 cursor-pointer">
                                        <input type="checkbox" checked={filterService.includes(service)} onChange={() => handleServiceFilterToggle(service)} className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"/>
                                        <span>{service}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                     <div className="relative" ref={procedureFilterRef}>
                        <button onClick={() => setProcedureFilterOpen(prev => !prev)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-left flex justify-between items-center">
                            <span>{getSelectionText(filterProcedure, "Todos los Procedimientos")}</span>
                             <svg className={`h-5 w-5 text-slate-400 transition-transform ${procedureFilterOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                        {procedureFilterOpen && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                                {availableProcedures.map(proc => (
                                    <label key={proc} className="flex items-center space-x-3 p-2 hover:bg-slate-50 cursor-pointer">
                                        <input type="checkbox" checked={filterProcedure.includes(proc)} onChange={() => handleProcedureFilterToggle(proc)} className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"/>
                                        <span>{proc}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                     {/* Cream Filter */}
                    <div className="bg-slate-50 p-2 rounded-lg flex items-center justify-around">
                        <span className="text-sm font-semibold text-slate-600 mr-2">Crema:</span>
                        <div className="flex items-center space-x-3">
                            <label className="text-sm"><input type="radio" name="cream" value="all" checked={filterCream === 'all'} onChange={handleCreamFilterChange} className="mr-1"/>Todos</label>
                            <label className="text-sm"><input type="radio" name="cream" value="yes" checked={filterCream === 'yes'} onChange={handleCreamFilterChange} className="mr-1"/>SI</label>
                            <label className="text-sm"><input type="radio" name="cream" value="no" checked={filterCream === 'no'} onChange={handleCreamFilterChange} className="mr-1"/>NO</label>
                        </div>
                    </div>
                </div>
              </div>
              
              {/* Sales Table (Desktop) */}
              <div className="hidden lg:block bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Fecha', 'Tipo', 'Cod.', 'Cliente', 'DNI', 'Servicio', 'Monto', 'Pago', 'Acciones'].map(header => (
                          <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredSales.map(sale => {
                        const totalAmount = sale.payments.reduce((sum, p) => sum + p.amount, 0);
                        const paymentMethods = sale.payments.map(p => p.method).join(', ');
                        const isFromCurrentMonth = new Date(sale.timestamp).getMonth() === new Date().getMonth() && new Date(sale.timestamp).getFullYear() === new Date().getFullYear();
                        
                        let typeColor = 'bg-slate-100 text-slate-600';
                        if(sale.transactionType === 'adelanto') typeColor = 'bg-yellow-100 text-yellow-800';
                        if(sale.transactionType === 'cierre') typeColor = 'bg-green-100 text-green-800';

                        return (
                          <tr key={sale.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">{new Date(sale.timestamp).toLocaleString('es-ES')}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${typeColor}`}>
                                    {sale.transactionType || 'Venta'}
                                </span>
                            </td>
                            {/* Updated Code Column */}
                            <td 
                                onClick={() => sale.bookingId && handleBookingClick(getBookingById(sale.bookingId)!)}
                                className={`px-4 py-3 whitespace-nowrap text-xs font-mono font-bold ${sale.bookingId ? 'text-blue-600 hover:text-blue-800 cursor-pointer underline' : 'text-slate-400'}`}
                            >
                                {sale.bookingId ? getBookingCode(sale.bookingId) || 'LINKED' : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                                {sale.client.name}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">{sale.client.dni}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <p>{sale.serviceType}</p>
                                <p className="text-xs text-slate-400">{sale.procedure}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800 font-mono">S/ {totalAmount.toFixed(2)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500">{paymentMethods}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                    {isFromCurrentMonth && (
                                    <button onClick={() => handleEditClick(sale)} className="text-slate-400 hover:text-purple-600" title="Editar venta">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                    </button>
                                    )}
                                    {userProfile?.role === 'admin' && (
                                    <button onClick={() => deleteSale(sale.id)} className="text-slate-400 hover:text-red-600 ml-2" title="Eliminar venta">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                    )}
                                </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredSales.length === 0 && <p className="text-center p-10 text-slate-500">No hay transacciones para el período seleccionado.</p>}
                </div>
              </div>
              
              {/* Sales Cards (Mobile) */}
              <div className="lg:hidden space-y-4">
                  {filteredSales.map(sale => {
                      const totalAmount = sale.payments.reduce((sum, p) => sum + p.amount, 0);
                      const isFromCurrentMonth = new Date(sale.timestamp).getMonth() === new Date().getMonth() && new Date(sale.timestamp).getFullYear() === new Date().getFullYear();
                      let typeColor = 'bg-slate-100 text-slate-600';
                      if(sale.transactionType === 'adelanto') typeColor = 'bg-yellow-100 text-yellow-800';
                      if(sale.transactionType === 'cierre') typeColor = 'bg-green-100 text-green-800';

                      return (
                          <div key={sale.id} className="bg-white rounded-xl shadow-lg p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1 inline-block ${typeColor}`}>
                                        {sale.transactionType || 'Venta'}
                                      </span>
                                      <p className="font-bold text-lg text-slate-800 flex items-center">{sale.client.name}</p>
                                      {sale.bookingId && (
                                          <p className="text-xs text-blue-600 font-mono mt-1" onClick={() => handleBookingClick(getBookingById(sale.bookingId!)!)}>
                                              Ref: {getBookingCode(sale.bookingId) || 'LINKED'}
                                          </p>
                                      )}
                                      <div className="flex justify-between items-center w-full mt-1">
                                          <p className="text-xs text-slate-500 font-mono">{new Date(sale.timestamp).toLocaleString('es-ES')}</p>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-xl text-purple-700">S/ {totalAmount.toFixed(2)}</p>
                                    <div className="flex justify-end mt-1 space-x-2">
                                        {isFromCurrentMonth && (
                                            <button onClick={() => handleEditClick(sale)} className="text-slate-400 hover:text-purple-600" title="Editar venta">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                            </button>
                                        )}
                                        {userProfile?.role === 'admin' && (
                                            <button onClick={() => deleteSale(sale.id)} className="text-slate-400 hover:text-red-600" title="Eliminar venta">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                  </div>
                              </div>
                               <div className="text-sm text-slate-600 pt-2 border-t border-slate-100">
                                  <p><strong>Servicio:</strong> {sale.serviceType} - {sale.procedure}</p>
                                  <p><strong>Pago:</strong> {sale.payments.map(p=>p.method).join(', ')}</p>
                               </div>
                          </div>
                      )
                  })}
                   {filteredSales.length === 0 && <p className="text-center p-10 text-slate-500">No hay transacciones para el período seleccionado.</p>}
              </div>

            </div>
          )}
          {activeView === 'cashControl' && (
              <div className="space-y-6">
                  {/* Header */}
                  <div className="bg-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="flex items-center gap-4">
                          <h2 className="text-2xl font-bold text-slate-800">Control de Caja (Físico)</h2>
                          <div className="flex gap-2">
                              <select value={displayedMonth} onChange={handleMonthChange} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                  <option value={-1}>Todos</option>
                                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                              </select>
                              <select value={displayedYear} onChange={handleYearChange} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                          </div>
                      </div>
                      <div className="flex gap-2">
                          <button 
                              onClick={() => setIsWithdrawalModalOpen(true)}
                              className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 transition-transform hover:scale-105 flex items-center gap-2"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span>Registrar Retiro</span>
                          </button>
                          <button 
                              onClick={handleDownloadCashControl}
                              className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-transform hover:scale-105 flex items-center gap-2"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              <span>Descargar</span>
                          </button>
                      </div>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
                          <p className="text-sm font-bold text-slate-500 uppercase">Ingresos (Efectivo)</p>
                          <p className="text-3xl font-bold text-green-700 mt-2">S/ {cashControlStats.totalCashIn.toFixed(2)}</p>
                      </div>
                      <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500">
                          <p className="text-sm font-bold text-slate-500 uppercase">Egresos (Retiros)</p>
                          <p className="text-3xl font-bold text-red-700 mt-2">S/ {cashControlStats.totalWithdrawals.toFixed(2)}</p>
                      </div>
                      <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
                          <p className="text-sm font-bold text-slate-500 uppercase">Saldo en Caja</p>
                          <p className="text-3xl font-bold text-blue-700 mt-2">S/ {cashControlStats.currentBalance.toFixed(2)}</p>
                      </div>
                  </div>

                  {/* Transactions Table */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                      <div className="p-4 border-b border-slate-200">
                          <h3 className="font-bold text-slate-700">Movimientos de Caja</h3>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-slate-50 text-slate-600 font-semibold">
                                  <tr>
                                      <th className="px-4 py-3">Fecha</th>
                                      <th className="px-4 py-3">Descripción</th>
                                      <th className="px-4 py-3 text-center">Tipo</th>
                                      <th className="px-4 py-3 text-right">Monto</th>
                                      <th className="px-4 py-3 text-right">Saldo</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {cashTransactions.map((tx) => (
                                      <tr key={tx.id} className="hover:bg-slate-50">
                                          <td className="px-4 py-3 whitespace-nowrap">{tx.timestamp.toLocaleString('es-ES')}</td>
                                          <td className="px-4 py-3 font-medium text-slate-800">{tx.description}</td>
                                          <td className="px-4 py-3 text-center">
                                              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${tx.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                  {tx.type === 'income' ? 'Ingreso' : 'Retiro'}
                                              </span>
                                          </td>
                                          <td className={`px-4 py-3 text-right font-mono font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                              {tx.type === 'income' ? '+' : '-'} S/ {tx.amount.toFixed(2)}
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                                              S/ {tx.balance.toFixed(2)}
                                          </td>
                                      </tr>
                                  ))}
                                  {cashTransactions.length === 0 && (
                                      <tr><td colSpan={5} className="p-8 text-center text-slate-400">No hay movimientos registrados.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          )}
           {activeView === 'configuration' && (
              <Configuration 
                specialists={configSpecialists} 
                setSpecialists={saveSpecialistsToDB}
                weeklySchedule={weeklySchedule} 
                setWeeklySchedule={saveScheduleToDB}
                salesGoals={configSalesGoals} 
                setSalesGoals={(goals) => saveGoalsToDB(goals as any, 'sales')}
                bookingGoals={configBookingGoals} 
                setBookingGoals={(goals) => saveGoalsToDB(goals as any, 'booking')}
                clientGoals={configClientGoals} 
                setClientGoals={(goals) => saveGoalsToDB(goals as any, 'client')}
                userRole={userProfile?.role || 'staff'}
                onBulkDelete={handleBulkDelete}
                onFactoryReset={() => setIsResetModalOpen(true)} // Open Custom Modal
              />
          )}
           {activeView === 'management' && (
              <ManagementDashboard 
                  allSales={sales} 
                  allBookings={bookings} 
                  salesGoals={configSalesGoals}
                  bookingGoals={configBookingGoals}
                  clientGoals={configClientGoals}
                  allSpecialists={activeSpecialists}
                  weeklySchedule={weeklySchedule}
                  configStartHour={globalStartHour} 
                  configEndHour={globalEndHour}   
                  configAvailableDays={activeDays} 
                  expenses={expenses}
              />
          )}
          {activeView === 'followUp' && (
              <FollowUpDashboard
                  sales={sales}
                  bookings={bookings}
                  tracking={followUpTracking}
                  onUpdateTracking={handleUpdateFollowUp}
                  onBookAppointment={handleBookFromFollowUp}
                  onArchiveClient={handleArchiveClient}
                  onBulkArchive={handleBulkArchive}
                  currentUserRole={userProfile?.role || 'staff'}
              />
          )}
          {activeView === 'expenses' && (
              <ExpensesDashboard
                  expenses={expenses}
                  onAddExpense={addExpense}
                  onDeleteExpense={deleteExpense}
                  expenseCategories={expenseCategories}
                  onUpdateCategories={updateExpenseCategories}
              />
          )}
            </main>
        </div>
        
        {/* Modals */}
        <ResetConfirmationModal 
            isOpen={isResetModalOpen}
            onClose={() => setIsResetModalOpen(false)}
            onConfirm={executeFactoryReset}
        />
        
        <SalesForm 
            isOpen={isSalesModalOpen} 
            onClose={handleCloseSalesModal} 
            onSave={handleSaveSale}
            saleToEdit={editingSale}
            allSales={sales}
        />
        <BookingForm 
            isOpen={isBookingModalOpen}
            onClose={handleCloseBookingModal}
            onSave={handleSaveBooking}
            existingBookings={bookings}
            allSales={sales} // Pass sales data here
            initialDate={initialBookingDate}
            specialists={activeSpecialists}
            bookingToEdit={editingBooking}
            startHour={globalStartHour}
            endHour={globalEndHour}
            weeklySchedule={weeklySchedule}
            prefillData={bookingPrefill}
            initialSpecialist={initialBookingSpecialist}
            initialServiceType={initialBookingService}
        />
        <BulkUploadModal 
            isOpen={isBulkUploadModalOpen}
            onClose={() => setIsBulkUploadModalOpen(false)}
            addBulkSales={addBulkSales}
            addBulkBookings={addBulkBookings}
            specialists={activeSpecialists}
        />
         <ClientHistoryModal 
            isOpen={!!historyClientDni}
            onClose={handleCloseHistoryModal}
            clientDni={historyClientDni}
            allSales={sales}
        />
         <WithdrawalForm
            isOpen={isWithdrawalModalOpen}
            onClose={() => setIsWithdrawalModalOpen(false)}
            onSave={addWithdrawal}
        />
        <BookingDetailModal 
            booking={viewingBooking}
            onClose={() => setViewingBooking(null)}
            onEdit={handleEditBookingClick}
            onDelete={handleDeleteBookingClick}
            onConfirm={executeBookingConfirmation}
            onNoShow={handleNoShowBookingClick}
            onReconfirm={updateBookingReconfirmation} // Pass handler
        />
    </div>
  );
};

export default App;
