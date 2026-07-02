'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) {
        router.replace('/login');
        return;
      }
      // Solo cuentas con isadmin pueden usar el panel: cualquier cliente de la
      // app tiene cuenta Firebase, pero no debe entrar aquí.
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().isadmin === true) {
          setReady(true);
        } else {
          await signOut(auth);
          router.replace('/login?e=denied');
        }
      } catch {
        await signOut(auth);
        router.replace('/login?e=denied');
      }
    });
    return () => unsub();
  }, [router]);

  if (!ready) return null;

  async function logout() {
    await signOut(auth);
    router.push('/login');
  }

  const navItems = [
    { href: '/dashboard/pedidos',         label: 'Pedidos',         icon: '📋' },
    { href: '/dashboard/vaciado',         label: 'Vaciado',         icon: '📊' },
    { href: '/dashboard/mapa',            label: 'Mapa',            icon: '🗺️' },
    { href: '/dashboard/productos',       label: 'Productos',       icon: '🥦' },
    { href: '/dashboard/recetas',         label: 'Recetas',         icon: '👨‍🍳' },
    { href: '/dashboard/conductores',     label: 'Conductores',     icon: '🚗' },
    { href: '/dashboard/configuracion',   label: 'Configuración',   icon: '⚙️' },
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

      {/* ── Branch decorations (fixed, repeat-y, faded) ── */}
      {/* Left branch — starts right after the sidebar */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: '224px',          // w-56 = 224 px
          width: '110px',
          backgroundImage: 'url(https://cdn.shopify.com/s/files/1/0630/0100/2073/files/Ramapng.png?v=1780769052)',
          backgroundRepeat: 'repeat-y',
          backgroundSize: '100% auto',
          backgroundPosition: 'top left',
          opacity: 0.13,
          pointerEvents: 'none',
          zIndex: 5,
          // Fade the inner edge so branches dissolve into the page
          WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
          maskImage: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
        }}
      />
      {/* Right branch — mirrored */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          right: 0,
          width: '110px',
          backgroundImage: 'url(https://cdn.shopify.com/s/files/1/0630/0100/2073/files/Ramapng.png?v=1780769052)',
          backgroundRepeat: 'repeat-y',
          backgroundSize: '100% auto',
          backgroundPosition: 'top left',
          opacity: 0.13,
          pointerEvents: 'none',
          zIndex: 5,
          transform: 'scaleX(-1)',  // mirror horizontally
          WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
          maskImage: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
        }}
      />

      {/* Main content — z-index above the branches */}
      <main
        className="flex-1 overflow-auto"
        style={{ background: '#F8F4EF', position: 'relative', zIndex: 10 }}
      >
        {children}
      </main>
    </div>
  );
}
