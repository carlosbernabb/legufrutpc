'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('lf_auth') !== 'true') {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  function logout() {
    sessionStorage.removeItem('lf_auth');
    router.push('/login');
  }

  const navItems = [
    { href: '/dashboard/pedidos', label: 'Pedidos', icon: '📋' },
    { href: '/dashboard/vaciado', label: 'Vaciado', icon: '📊' },
    { href: '/dashboard/mapa',    label: 'Mapa',    icon: '🗺️' },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col"
        style={{ background: '#2D5016', minHeight: '100vh' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <Image
            src="/logo.png"
            alt="LeguFrut"
            width={40}
            height={40}
            style={{ objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <div className="text-base font-bold leading-tight">
              <span style={{ color: '#81C784' }}>legu</span>
              <span style={{ color: '#FF8A65' }}>frut</span>
            </div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Panel Admin
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.65)',
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <span>🚪</span> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto" style={{ background: '#F8F4EF' }}>
        {children}
      </main>
    </div>
  );
}
