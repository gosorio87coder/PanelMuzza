
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
import { SERVICE_TYPES, PROCEDURES_BY_SERVICE, CASH_METHODS, DIGITAL_METHODS, CARD_METHODS, DEFAULT_EXPENSE_CATEGORIES, MONTHS, YEARS } from './constants';

// Declare XLSX from the script loaded in index.html
declare const XLSX: any;

type View = 'home' | 'sales' | 'bookings' | 'cashControl' | 'configuration' | 'management' | 'followUp' | 'expenses';
type BookingView = 'day' | '3day' | 'week' | 'month';

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
        // Local variable check to satisfy TS and prevent runtime crash
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
                createdByName: s.creator?.name
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


  // Helper: Upsert Client to ensure relational integrity
  const upsertClient = async (clientData: Client): Promise<string | null> => {
      try {
          const client = supabase;
          if (!client) return null;
          // Check if exist
          const { data: existing } = await client.from('clients').select('id').eq('dni', clientData.dni).single();
          if (existing) {
              return existing.id;
          } else {
              // Insert
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
          alert("Error al guardar cliente. Verifique el DNI.");
          return null;
      }
  };

  // Derived Configuration (for backward compatibility)
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
    // Initialize visible specialists once data is loaded
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
        created_by: session.user.id // Track User
    }).select('id').single();

    if (error) {
        console.error(error);
        alert('Error al guardar venta en base de datos.');
    } else if (data) {
        // Optimistic Update or Refetch
        const newSaleWithId = { ...sale, id: data.id, createdBy: session.user.id, createdByName: userProfile?.name };
        setSales(prev => [newSaleWithId, ...prev]);
        alert('Venta registrada con éxito!');
        setFollowUpTracking(prev => ({ ...prev, [data.id]: { status: 'PENDIENTE' } }));
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
        comments: updatedSale.comments
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
                      created_by: session.user.id
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

  const addBooking = async (booking: Booking, downPaymentSale?: Sale) => {
    const client = supabase;
    if (!client || !session) return;
    const clientId = await upsertClient(booking.client);
    if (!clientId) return;

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
        created_by: session.user.id
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
            status: 'scheduled' as const,
            createdBy: session.user.id,
            createdByName: userProfile?.name
        };
        setBookings(prev => [...prev, newBooking].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()));

        if (downPaymentSale) {
            await addSale(downPaymentSale);
        } else {
            alert('Reserva registrada con éxito!');
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
             await addSale(downPaymentSale);
          } else {
             alert('Reserva actualizada con éxito!');
          }
      }
  };

  const confirmBooking = async (bookingId: string, actualDuration: number) => {
      const client = supabase;
      if (!client) return;
      const { error } = await client.from('bookings').update({
          status: 'completed',
          actual_duration: actualDuration
      }).eq('id', bookingId);

      if (error) {
           console.error(error);
           alert('Error al confirmar reserva.');
      } else {
          setBookings(prev => prev.map(b => {
            if (b.id === bookingId) {
                return { ...b, status: 'completed', actualDuration: actualDuration };
            }
            return b;
          }));
          alert('Atención confirmada correctamente.');
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
      if (window.confirm('¿Estás seguro de que deseas eliminar esta reserva? Esta acción no se puede deshacer.')) {
        const { error } = await client.from('bookings').delete().eq('id', bookingId);
        if (error) {
             console.error(error);
             alert('Error al eliminar reserva.');
        } else {
             setBookings(prev => prev.filter(b => b.id !== bookingId));
             alert('Reserva eliminada.');
        }
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
        } else if (specialist === 'Evaluación') {
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
  
  const handleConfirmBookingClick = (booking: Booking, duration: number) => {
      setViewingBooking(null);
      confirmBooking(booking.id, duration);
  }

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

    filteredSales.forEach(sale => {
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
    const totalServices = filteredSales.length;
    const uniqueClientsDNI = new Set(filteredSales.map(sale => sale.client.dni));
    const uniqueClients = uniqueClientsDNI.size;
    
    const periodStartDate = displayedMonth === -1 
      ? new Date(displayedYear, 0, 1)
      : new Date(displayedYear, displayedMonth, 1);
    periodStartDate.setHours(0, 0, 0, 0);

    let newClientsCount = 0;
    uniqueClientsDNI.forEach(dni => {
      const isExistingClient = sales.some(sale => 
        sale.client.dni === dni && new Date(sale.timestamp) < periodStartDate
      );
      if (!isExistingClient) {
        newClientsCount++;
      }
    });

    return { totalSales, totalServices, uniqueClients, totalPhysical, totalDigital, totalCard, cardPercentage, newClientsCount };
  }, [filteredSales, sales, displayedMonth, displayedYear]);

  const cashControlStats = useMemo(() => {
      const totalCashIn = salesStats.totalPhysical; 
      const totalWithdrawals = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);
      const currentBalance = totalCashIn - totalWithdrawals;
      return { totalCashIn, totalWithdrawals, currentBalance };
  }, [salesStats.totalPhysical, filteredWithdrawals]);

  const cashTransactions = useMemo(() => {
      const incomeTransactions = filteredSales.flatMap(sale =>
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
      const transactionsWithBalance = allTransactions.map(tx => {
          if (tx.type === 'income') {
              runningBalance += tx.amount;
          } else {
              runningBalance -= tx.amount;
          }
          return { ...tx, balance: runningBalance };
      });

      return transactionsWithBalance.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [filteredSales, filteredWithdrawals]);


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
    return bookings.filter(b => visibleSpecialists.includes(b.specialist));
  }, [bookings, visibleSpecialists]);


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
        'Registrado Por': sale.createdByName || 'Desconocido',
        'Cliente': sale.client.name,
        'DNI': sale.client.dni,
        'Celular': sale.client.phone,
        'Origen': sale.client.source,
        'Servicio': sale.serviceType,
        'Procedimiento': sale.procedure,
        'Crema Vendida': sale.creamSold ? 'SI' : 'NO',
        'Monto Total': totalAmount,
        'Medios de Pago': paymentMethods,
        'Comentarios': sale.comments || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventas');

    // Auto-size columns
    const objectMaxLength = Object.keys(dataToExport[0] || {}).map(key => ({
      wch: Math.max(...dataToExport.map(row => (row[key as keyof typeof row] || '').toString().length), key.length)
    }));
    worksheet['!cols'] = objectMaxLength;

    const fileName = `Ventas_${displayedPeriodText.replace(', ', '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleDownloadBookings = () => {
    const dataToExport = filteredBookings.map(b => ({
      'ID': b.id,
      'Registrado Por': b.createdByName || 'Desconocido',
      'Fecha': b.startTime.toLocaleDateString('es-ES'),
      'Hora Inicio': b.startTime.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}),
      'Hora Fin': b.endTime.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}),
      'Especialista': b.specialist,
      'Servicio': b.serviceType,
      'Procedimiento': b.procedure,
      'Cliente': b.client.name,
      'DNI': b.client.dni,
      'Celular': b.client.phone,
      'Estado': b.status === 'completed' ? 'Completada' : b.status === 'noshow' ? 'No Vino' : b.status === 'cancelled' ? 'Cancelada' : 'Programada',
      'Comentarios': b.comments || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reservas');
    
    // Auto-size columns
    const objectMaxLength = Object.keys(dataToExport[0] || {}).map(key => ({
      wch: Math.max(...dataToExport.map(row => (row[key as keyof typeof row] || '').toString().length), key.length) + 2
    }));
    worksheet['!cols'] = objectMaxLength;

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
      
       const objectMaxLength = Object.keys(dataToExport[0] || {}).map(key => ({
        wch: Math.max(...dataToExport.map(row => (row[key as keyof typeof row] || '').toString().length), key.length) + 2
      }));
      worksheet['!cols'] = objectMaxLength;

      XLSX.writeFile(workbook, `Caja_${displayedPeriodText.replace(', ', '_')}.xlsx`);
  }


  const handleViewChange = (view: View) => {
    setActiveView(view);
    setIsSidebarOpen(false); // Close sidebar on navigation
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
  const SalesIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
  const BookingsIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
  const CashControlIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
  const ConfigIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  const ManagementIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
  const FollowUpIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 17l4 4 4-4m-4-5v9" /></svg>;
  const ExpenseIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;

  const viewTitles: Record<View, string> = {
    home: 'Inicio',
    sales: 'Ventas',
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

  // If logged in but supabase client somehow failed (placeholder url)
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
                      <p className="opacity-90">Bienvenido al panel de gestión de Muzza.</p>
                      <div className="mt-6 flex flex-wrap gap-4">
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                              <span className="block text-sm opacity-80">Reservas Hoy</span>
                              <span className="text-2xl font-bold">
                                  {bookings.filter(b => {
                                      const d = new Date(b.startTime);
                                      const now = new Date();
                                      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                  }).length}
                              </span>
                          </div>
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                              <span className="block text-sm opacity-80">Ventas Hoy (S/)</span>
                              <span className="text-2xl font-bold">
                                  {sales.filter(s => {
                                      const d = new Date(s.timestamp);
                                      const now = new Date();
                                      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                  }).reduce((sum, s) => sum + s.payments.reduce((pSum, p) => pSum + p.amount, 0), 0).toFixed(2)}
                              </span>
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
                                  <p className="text-slate-500 mt-2 text-sm">Agendar una nueva cita en el calendario.</p>
                              </div>
                              <div className="flex justify-end">
                                  <span className="text-purple-600 font-bold text-sm flex items-center">
                                      Comenzar <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                  </span>
                              </div>
                          </div>

                          {/* New Sale Card */}
                          <div 
                              onClick={() => { setEditingSale(null); setIsSalesModalOpen(true); }}
                              className="bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition-all cursor-pointer group border-l-8 border-green-500 flex flex-col justify-between h-48"
                          >
                              <div>
                                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                  </div>
                                  <h3 className="text-xl font-bold text-slate-800 group-hover:text-green-600 transition-colors">Registrar Venta</h3>
                                  <p className="text-slate-500 mt-2 text-sm">Ingresar un servicio realizado o venta de producto.</p>
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
          )}
          {activeView === 'sales' && (
            <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-lg">
                <div className="flex justify-between items-start flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
                    Registro de Ventas
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
                          <span className="hidden sm:inline">Nueva Venta</span>
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
                    <div className="p-3 rounded-full bg-blue-100 text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.965 5.965 0 0112 13a5.965 5.965 0 013 1.803" /></svg></div>
                    <div>
                        <p className="text-sm text-slate-500 font-semibold">Atenciones</p>
                        <p className="text-3xl font-bold text-slate-800">{salesStats.totalServices}</p>
                    </div>
                </div>
                 <div className="bg-white p-5 rounded-xl shadow-lg flex items-center space-x-4">
                    <div className="p-3 rounded-full bg-purple-100 text-purple-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                    <div>
                        <p className="text-sm text-slate-500 font-semibold">Clientes Únicos</p>
                        <p className="text-3xl font-bold text-slate-800">{salesStats.uniqueClients}</p>
                         <p className="text-xs text-slate-500 mt-1">
                           <span className="font-semibold text-green-600">{salesStats.newClientsCount}</span> Nuevos en Periodo
                        </p>
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
                        {['Fecha', 'Registrado Por', 'Cliente', 'DNI', 'Celular', 'Servicio', 'Procedimiento', 'Crema', 'Monto', 'Medio de Pago', 'Comentarios', 'Acciones'].map(header => (
                          <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredSales.map(sale => {
                        const totalAmount = sale.payments.reduce((sum, p) => sum + p.amount, 0);
                        const paymentMethods = sale.payments.map(p => p.method).join(', ');
                        const isFromCurrentMonth = new Date(sale.timestamp).getMonth() === new Date().getMonth() && new Date(sale.timestamp).getFullYear() === new Date().getFullYear();
                        return (
                          <tr key={sale.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">{new Date(sale.timestamp).toLocaleString('es-ES')}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-purple-600 font-semibold">{sale.createdByName || 'Desconocido'}</td>
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800 flex items-center">
                                {sale.client.name}
                                <button onClick={() => handleOpenHistoryModal(sale.client.dni)} className="ml-2 text-slate-400 hover:text-purple-600" title="Ver historial del cliente">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2h3.586a1 1 0 01.707.293l1.414 1.414a1 1 0 01.293.707V6h-1V5.414L9.414 4H6a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V9h1v6a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">{sale.client.dni}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500">{sale.client.phone}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{sale.serviceType}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{sale.procedure}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-center"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${sale.creamSold ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{sale.creamSold ? 'SI' : 'NO'}</span></td>
                            <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800 font-mono">S/ {totalAmount.toFixed(2)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500">{paymentMethods}</td>
                            <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{sale.comments}</td>
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
                  {filteredSales.length === 0 && <p className="text-center p-10 text-slate-500">No hay ventas para el período seleccionado.</p>}
                </div>
              </div>
              
              {/* Sales Cards (Mobile) */}
              <div className="lg:hidden space-y-4">
                  {filteredSales.map(sale => {
                      const totalAmount = sale.payments.reduce((sum, p) => sum + p.amount, 0);
                      const isFromCurrentMonth = new Date(sale.timestamp).getMonth() === new Date().getMonth() && new Date(sale.timestamp).getFullYear() === new Date().getFullYear();
                      return (
                          <div key={sale.id} className="bg-white rounded-xl shadow-lg p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <p className="font-bold text-lg text-slate-800 flex items-center">{sale.client.name}
                                        <button onClick={() => handleOpenHistoryModal(sale.client.dni)} className="ml-2 text-slate-400 hover:text-purple-600" title="Ver historial del cliente">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                                <path fillRule="evenodd" d="M4 5a2 2 0 012-2h3.586a1 1 0 01.707.293l1.414 1.414a1 1 0 01.293.707V6h-1V5.414L9.414 4H6a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V9h1v6a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                      </p>
                                      <p className="text-sm text-slate-500 font-mono">{sale.client.dni}</p>
                                      <div className="flex justify-between items-center w-full mt-1">
                                          <p className="text-xs text-slate-500 font-mono">{new Date(sale.timestamp).toLocaleString('es-ES')}</p>
                                          <p className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{sale.createdByName || 'Desconocido'}</p>
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
                   {filteredSales.length === 0 && <p className="text-center p-10 text-slate-500">No hay ventas para el período seleccionado.</p>}
              </div>

            </div>
          )}
          {activeView === 'cashControl' && (
              <div className="space-y-6">
                  {/* Header */}
                  <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
                      <div className="flex gap-4 items-center">
                          <h2 className="text-2xl font-bold text-slate-800">Control de Caja Chica (Efectivo)</h2>
                          <div className="flex gap-2">
                              <select value={displayedMonth} onChange={handleMonthChange} className="px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                  <option value={-1}>Todos los Meses</option>
                                  {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
                              </select>
                              <select value={displayedYear} onChange={handleYearChange} className="px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-sm focus:ring-purple-500 focus:border-purple-500">
                                  {YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                              </select>
                          </div>
                      </div>
                      <div className="flex gap-3">
                          <button
                              onClick={() => setIsWithdrawalModalOpen(true)}
                              className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-transform transform hover:scale-105 flex items-center gap-2"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                              Registrar Retiro
                          </button>
                          <button
                              onClick={handleDownloadCashControl}
                              className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform transform hover:scale-105 flex items-center gap-2"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              Excel
                          </button>
                      </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-5 rounded-xl shadow-lg border-l-4 border-green-500">
                          <p className="text-sm font-bold text-slate-500 uppercase">Total Ingresos (Efectivo)</p>
                          <p className="text-3xl font-bold text-green-600 mt-2">S/ {cashControlStats.totalCashIn.toFixed(2)}</p>
                      </div>
                      <div className="bg-white p-5 rounded-xl shadow-lg border-l-4 border-red-500">
                          <p className="text-sm font-bold text-slate-500 uppercase">Total Retiros</p>
                          <p className="text-3xl font-bold text-red-600 mt-2">S/ {cashControlStats.totalWithdrawals.toFixed(2)}</p>
                      </div>
                      <div className="bg-white p-5 rounded-xl shadow-lg border-l-4 border-blue-500">
                          <p className="text-sm font-bold text-slate-500 uppercase">Saldo en Caja</p>
                          <p className="text-3xl font-bold text-slate-800 mt-2">S/ {cashControlStats.currentBalance.toFixed(2)}</p>
                      </div>
                  </div>

                  {/* Transactions Table */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                      <div className="p-4 border-b border-slate-100 bg-slate-50">
                          <h3 className="font-bold text-slate-700">Movimientos de Caja Detallados</h3>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                              <thead className="text-xs text-slate-500 uppercase bg-slate-100 font-bold">
                                  <tr>
                                      <th className="px-6 py-3">Fecha</th>
                                      <th className="px-6 py-3">Descripción</th>
                                      <th className="px-6 py-3 text-center">Tipo</th>
                                      <th className="px-6 py-3 text-right">Monto</th>
                                      <th className="px-6 py-3 text-right">Saldo Acum.</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {cashTransactions.map(tx => (
                                      <tr key={tx.id} className="hover:bg-slate-50">
                                          <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">{tx.timestamp.toLocaleString('es-ES')}</td>
                                          <td className="px-6 py-4">{tx.description}</td>
                                          <td className="px-6 py-4 text-center">
                                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${tx.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                  {tx.type === 'income' ? 'INGRESO' : 'RETIRO'}
                                              </span>
                                          </td>
                                          <td className={`px-6 py-4 text-right font-mono font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                              {tx.type === 'income' ? '+' : '-'} S/ {tx.amount.toFixed(2)}
                                          </td>
                                          <td className="px-6 py-4 text-right font-mono font-semibold text-slate-700">
                                              S/ {tx.balance.toFixed(2)}
                                          </td>
                                      </tr>
                                  ))}
                                  {cashTransactions.length === 0 && (
                                      <tr>
                                          <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                                              No hay movimientos de caja registrados en este periodo.
                                          </td>
                                      </tr>
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
            onConfirm={handleConfirmBookingClick}
            onNoShow={handleNoShowBookingClick}
        />
    </div>
  );
};

export default App;
