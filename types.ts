
export interface Client {
  name: string;
  dni: string;
  phone: string;
  source: string;
}

export interface Payment {
  method: string;
  code?: string;
  amount: number;
}

// NEW: User Profile linked to Supabase Auth
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
}

export interface Sale {
  id: string;
  timestamp: Date;
  client: Client;
  serviceType: string;
  procedure: string;
  payments: Payment[];
  creamSold?: boolean;
  comments?: string;
  createdBy?: string; // ID of the user who created this
  createdByName?: string; // Name of the user (for display)
}

export interface Booking {
  id: string;
  specialist: string;
  serviceType: string;
  procedure: string;
  startTime: Date;
  endTime: Date;
  client: Client;
  downPayment?: Payment;
  comments?: string;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'noshow';
  actualDuration?: number;
  createdAt: Date;
  createdBy?: string; // ID of the user who created this
  createdByName?: string; // Name of the user
}

export interface Withdrawal {
  id: string;
  timestamp: Date;
  amount: number;
  personInCharge: string;
  notes?: string;
  createdBy?: string;
}

export interface Expense {
    id: string;
    timestamp: Date;
    category: string;
    subcategory: string;
    amount: number;
    description?: string;
    createdBy?: string;
}

export interface Specialist {
  name: string;
  active: boolean;
}

export interface DaySchedule {
  dayId: number; // 1=Monday, 7=Sunday
  name: string;
  isOpen: boolean;
  startHour: number;
  endHour: number;
  hasLunch: boolean;
  lunchStartHour: number;
  lunchEndHour: number;
}

export type FollowUpStatus = 'PENDIENTE' | 'CONTACTADO' | 'AGENDADO' | 'PERDIDO';

export interface FollowUpState {
  status: FollowUpStatus;
  notes?: string;
  lastContactDate?: Date;
  archived?: boolean;
}

export interface FollowUpTracking {
  [saleId: string]: FollowUpState;
}

export type UserRole = 'admin' | 'staff';
