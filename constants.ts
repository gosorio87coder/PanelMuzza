
export const SOURCES = ['FB', 'IG', 'Tiktok', 'Pauta', 'Recomendada', 'Otros'];
export const PAYMENT_METHODS = ['Cash', 'Plin', 'Yape', 'Transfer', 'POS', 'Link'];

// Used strictly for Cash Control (Caja Chica/Física)
export const CASH_METHODS = ['Cash']; 

// Used for Sales Stats grouping
export const DIGITAL_METHODS = ['Plin', 'Yape', 'Transfer'];
export const CARD_METHODS = ['POS', 'Link'];

export const SERVICE_TYPES = ['Cejas', 'Remoción', 'Pestañas', 'Otro'];

export const PROCEDURES_BY_SERVICE: Record<string, string[]> = {
  'Cejas': ['Microblading', 'Microshading', 'Hair', 'Powder', 'Henna', 'Retoque', 'Crema', 'Otro'],
  'Pestañas': ['Lifting', 'Laminado', 'Otros'],
  'Remoción': ['Laser 1', 'Laser 2', 'Laser 3', 'Laser 4', 'Laser 5+'],
  'Otro': [], 
};

export const SERVICE_DURATIONS: Record<string, number> = { // duration in minutes
  'Cejas': 90,
  'Retoque': 60,
  'Lifting': 90,
  'Laminado': 60,
  'Otros': 60, // Pestañas otros
  'Laser 1': 30,
  'Laser 2': 30,
  'Laser 3': 30,
  'Laser 4': 30,
  'Laser 5+': 30,
  'Otro': 60,
};

// NEW: Expense Categories Definition
export const DEFAULT_EXPENSE_CATEGORIES: Record<string, string[]> = {
    'Sueldos': ['Recepción', 'Especialistas', 'Otros'],
    'Marketing': ['Facebook', 'Tiktok', 'Elab. Contenido', 'Filmmaker', 'CRM', 'Dominio', 'Host', 'Cursos', 'Otros'],
    'Materiales': ['Insumos', 'Descartables', 'Otros'],
    'Servicios': ['Limpieza', 'Mantenimiento', 'Luz', 'Agua', 'Cable', 'Internet', 'Celular', 'Anuncios Colab', 'Otros'],
    'Alquiler': ['Estudio', 'Otros'],
    'Otros': ['Varios']
};

export const MOCK_CLIENTS = [
    { dni: '12345678', name: 'Ana Garcia', phone: '987654321', source: 'IG' },
    { dni: '87654321', name: 'Carlos Rodriguez', phone: '912345678', source: 'Recomendada' },
];

export const SPECIALIST_COLORS: Record<string, { bg: string; text: string }> = {
    'Julissa': { bg: 'bg-pink-100', text: 'text-pink-800' },
    'Laura': { bg: 'bg-green-100', text: 'text-green-800' },
    'D.G.': { bg: 'bg-blue-100', text: 'text-blue-800' },
    'Evaluación': { bg: 'bg-blue-100', text: 'text-blue-800' },
    'default': { bg: 'bg-slate-100', text: 'text-slate-800' },
};

export const SERVICE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
    'Cejas': { bg: 'bg-purple-100', text: 'text-purple-800' },
    'Remoción': { bg: 'bg-red-100', text: 'text-red-800' },
    'Pestañas': { bg: 'bg-sky-100', text: 'text-sky-800' },
    'Otro': { bg: 'bg-slate-100', text: 'text-slate-800' },
    'Bloqueo': { bg: 'bg-gray-200', text: 'text-gray-700' }, // NEW COLOR FOR BLOCKS
    'default': { bg: 'bg-slate-100', text: 'text-slate-800' },
};

export const SOURCE_GROUPS: Record<string, string[]> = {
    'Digital/Pauta': ['FB', 'IG', 'Tiktok', 'Pauta'],
    'Recomendación': ['Recomendada'],
    'Otros': ['Otros']
};

export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const currentYear = new Date().getFullYear();
// Generate a range of years: 5 years back and 1 year forward
export const YEARS = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);
