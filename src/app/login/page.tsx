'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user.trim() || !pass) return;
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, user.trim(), pass);
      router.push('/dashboard/pedidos');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Correo o contraseña incorrectos');
      } else if (code === 'auth/invalid-email') {
        setError('El correo no es válido');
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Espera un momento e intenta de nuevo.');
      } else {
        setError('Error al iniciar sesión. Intenta de nuevo.');
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F4EF' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt="LeguFrut"
            width={120}
            height={120}
            className="mx-auto"
            style={{ objectFit: 'contain' }}
          />
          <p className="text-sm mt-2" style={{ color: '#6B7280' }}>Panel de Administración</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: '#E5E7EB' }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: '#1A1A1A' }}>Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={user}
                onChange={e => setUser(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all"
                style={{ borderColor: '#E5E7EB', color: '#1A1A1A' }}
                onFocus={e => (e.target.style.borderColor = '#2E7D32')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none transition-all"
                  style={{ borderColor: '#E5E7EB', color: '#1A1A1A' }}
                  onFocus={e => (e.target.style.borderColor = '#2E7D32')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#9CA3AF', lineHeight: 0 }}
                  tabIndex={-1}
                >
                  {showPass ? (
                    /* Ojo abierto */
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    /* Ojo cerrado */
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm rounded-lg px-3 py-2" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity"
              style={{ background: loading ? '#6B7280' : '#2D5016' }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
