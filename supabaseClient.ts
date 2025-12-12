
import { createClient } from '@supabase/supabase-js';

// ⚠️ IMPORTANTE PARA DESPLIEGUE (VERCEL/NETLIFY):
// Lo ideal es configurar estas claves como "Environment Variables" en el panel de Vercel.
// Nombres de variables sugeridos: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

// El código buscará primero las variables de entorno. Si no existen, usará las cadenas fijas.
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ilskfqfrpewetqoihnfz.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlsc2tmcWZycGV3ZXRxb2lobmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNTU4OTYsImV4cCI6MjA3ODYzMTg5Nn0.2-w8D5-PYEnBjM2b3m3Bqra-KfgKbsRghmfji8Y9hD0';

// Safe initialization to prevent crash if keys are missing/placeholders
export const supabase = (() => {
    try {
        if (!SUPABASE_URL || SUPABASE_URL.includes('TU_SUPABASE')) {
            console.warn('Supabase credentials missing or invalid placeholder used.');
            return null; 
        }
        return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.error('Failed to initialize Supabase client:', e);
        return null;
    }
})();
