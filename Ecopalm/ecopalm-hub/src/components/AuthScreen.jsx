import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Anchor, Lock, Mail, User, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';

export default function AuthScreen({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [regPassword, setRegPassword] = useState(''); // Contraseña maestra para autorizar el registro
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Contraseña obligatoria del sistema para poder crear nuevos usuarios
  const SYSTEM_REGISTRATION_PASSWORD = '0203mada0302';

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        // VALIDACIÓN: Comprobar si la contraseña de registro del sistema es correcta
        if (regPassword !== SYSTEM_REGISTRATION_PASSWORD) {
          throw new Error('La contraseña de registro del sistema es incorrecta. Acceso denegado para crear usuarios.');
        }

        // Registro del nuevo usuario en Supabase
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split('@')[0] }
          }
        });

        if (error) throw error;
        
        setSuccessMsg('¡Cuenta creada con éxito! Ya puedes iniciar sesión.');
        if (data.session) {
          onLoginSuccess(data.session.user);
        }
      } else {
        // Inicio de sesión normal para usuarios existentes
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        if (data.session) {
          onLoginSuccess(data.session.user);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Ocurrió un error en la autenticación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-900 font-sans p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
        
        {/* Cabecera */}
        <div className="bg-slate-800 p-6 text-center border-b border-slate-700">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 mb-3 border border-emerald-500/20">
            <Anchor size={24} />
          </div>
          <h1 className="text-xl font-bold text-white">EcoPalm Hub</h1>
          <p className="text-xs text-slate-400 mt-1">Plataforma de Onboarding y Operaciones de UCO & POME</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleAuth} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg text-xs">
              <CheckCircle size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre o Alias</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    required
                    placeholder="Tu nombre"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-emerald-500 text-slate-800"
                  />
                </div>
              </div>

              {/* Campo exclusivo para la contraseña de registro del sistema */}
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                <label className="block text-xs font-bold text-amber-900 mb-1">Contraseña de Registro del Sistema</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-amber-600" size={16} />
                  <input 
                    type="password" 
                    required
                    placeholder="Introduce el código de acceso"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-amber-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500 text-slate-800 font-mono"
                  />
                </div>
                <p className="text-[10px] text-amber-700 mt-1">Requerido para autorizar la creación de la cuenta.</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input 
                type="email" 
                required
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-emerald-500 text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Contraseña de tu cuenta</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input 
                type="password" 
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-emerald-500 text-slate-800"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            {loading ? 'Procesando...' : (isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión')}
            <ArrowRight size={14} />
          </button>

          <div className="text-center pt-2">
            <button 
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-slate-500 hover:text-emerald-600 font-medium transition-colors"
            >
              {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}