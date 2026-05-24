'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (user === 'LeguFrut2026' && pass === 'manzanita44') {
      sessionStorage.setItem('lf_auth', 'true');
      router.push('/dashboard/pedidos');
    } else {
      setError('Usuario o contraseña incorrectos');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F4EF' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: '#2D5016' }}
          >
            <span className="text-2xl">🌿</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>
            <span style={{ color: '#2E7D32' }}>legu</span>
            <span style={{ color: '#FF7043' }}>frut</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Panel de Administración</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: '#E5E7EB' }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: '#1A1A1A' }}>Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                Usuario
              </label>
              <input
                type="text"
                value={user}
                onChange={e => setUser(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all"
                style={{ borderColor: '#E5E7EB', color: '#1A1A1A' }}
                onFocus={e => (e.target.style.borderColor = '#2E7D32')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                placeholder="Usuario"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all"
                style={{ borderColor: '#E5E7EB', color: '#1A1A1A' }}
                onFocus={e => (e.target.style.borderColor = '#2E7D32')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                placeholder="Contraseña"
                autoComplete="current-password"
              />
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
