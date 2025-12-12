
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between login/signup
  const [name, setName] = useState(''); // For signup only
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
        if (!supabase) throw new Error("Error de conexión con Supabase");

        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name, // This will be used by the trigger to create the profile
                    }
                }
            });
            if (error) throw error;
            alert('Registro exitoso! Por favor inicia sesión.');
            setIsSignUp(false);
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        }
    } catch (err: any) {
        setError(err.message || 'Error de autenticación');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-purple-800 mb-2">Muzza</h1>
            <p className="text-slate-500">Panel de Gestión</p>
        </div>

        <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">
            {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
        </h2>

        {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <span className="block sm:inline">{error}</span>
            </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Nombre Completo</label>
                    <input 
                        type="text" 
                        required 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Ej. Juan Perez"
                    />
                </div>
            )}
            
            <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Correo Electrónico</label>
                <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    placeholder="correo@muzza.com"
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Contraseña</label>
                <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    placeholder="••••••••"
                />
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
                {loading ? 'Procesando...' : (isSignUp ? 'Registrarse' : 'Ingresar')}
            </button>
        </form>

        <div className="mt-6 text-center text-sm">
            <button 
                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                className="text-purple-600 hover:text-purple-800 font-semibold"
            >
                {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
