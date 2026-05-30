'use client';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import 'leaflet/dist/leaflet.css';

// ── Types ──────────────────────────────────────────────────────────────────

interface OrderPin {
  id: string;
  nombrecliente: string;
  status: string;
  driverStatusText: string;
  total: number;
  confirmedTotal?: number;
  street: string;
  number: string;
  neighborhood: string;
  driverTag: string;
  lat: number;
  lng: number;
}

interface DriverPin {
  id: string;
  slot: number;
  driverTag: string;
  name: string;
  email: string;
  lat: number;
  lng: number;
  updatedAt: Date | null;
}

interface AppConfigData {
  driver1Email: string;
  driver2Email: string;
  driver3Email: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SLOT_STYLE = {
  1: { color: '#7B1FA2', label: 'Driver #1', emoji: '🟣' },
  2: { color: '#1565C0', label: 'Driver #2', emoji: '🔵' },
  3: { color: '#00695C', label: 'Driver #3', emoji: '🟢' },
} as Record<number, { color: string; label: string; emoji: string }>;

const ORDER_STATUS: Record<string, { color: string; label: string }> = {
  Pendiente:  { color: '#E65100', label: 'Pendiente' },
  Confirmado: { color: '#2E7D32', label: 'Confirmado' },
  Reparto:    { color: '#1565C0', label: 'En reparto' },
};

// ── GPS freshness ──────────────────────────────────────────────────────────

function freshness(date: Date | null): { text: string; color: string } {
  if (!date) return { text: 'Sin GPS', color: '#9CA3AF' };
  const diffMin = (Date.now() - date.getTime()) / 60000;
  if (diffMin < 2)  return { text: '● En vivo',               color: '#15803D' };
  if (diffMin < 30) return { text: `Hace ${Math.floor(diffMin)} min`, color: '#D97706' };
  return { text: 'Sin señal', color: '#9CA3AF' };
}

// ── Mapa page ──────────────────────────────────────────────────────────────

export default function MapaPage() {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);
  const orderPinsRef  = useRef<any[]>([]);
  const driverPinsRef = useRef<Record<number, any>>({});

  const [orders,    setOrders]    = useState<OrderPin[]>([]);
  const [drivers,   setDrivers]   = useState<DriverPin[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfigData>({ driver1Email: '', driver2Email: '', driver3Email: '' });
  const [selected,  setSelected]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);

  // ── app_config (driver slot assignments) ──────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'app_config'), snap => {
      if (!snap.empty) {
        const d = snap.docs[0].data();
        setAppConfig({
          driver1Email: d.driver1_email || '',
          driver2Email: d.driver2_email || '',
          driver3Email: d.driver3_email || '',
        });
      }
    });
    return () => unsub();
  }, []);

  // ── Subscribe to driver locations (users where isDriver==true) ────────────
  useEffect(() => {
    const q = query(collection(db, 'users'), where('isDriver', '==', true));
    const unsub = onSnapshot(q, snap => {
      const pins: DriverPin[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        const loc  = data.driverLatLng;
        if (!loc || !data.driverSlot) return;
        const lat = typeof loc.latitude  === 'number' ? loc.latitude  : (loc._lat  ?? 0);
        const lng = typeof loc.longitude === 'number' ? loc.longitude : (loc._long ?? 0);
        if (!lat && !lng) return;
        pins.push({
          id:        d.id,
          slot:      data.driverSlot,
          driverTag: `Driver #${data.driverSlot}`,
          name:      data.display_name || data.email || `Driver #${data.driverSlot}`,
          email:     data.email || '',
          lat,
          lng,
          updatedAt: data.driverLastUpdate?.toDate ? data.driverLastUpdate.toDate() : null,
        });
      });
      setDrivers(pins);
    });
    return () => unsub();
  }, []);

  // ── Subscribe to orders ───────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'orders')), snap => {
      const pins: OrderPin[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        const loc  = data.location;
        if (!loc) return;
        if (data.status === 'Cancelado') return;
        if (data.driverStatusText === 'Su pedido ha llegado') return;

        const lat = typeof loc.latitude  === 'number' ? loc.latitude  : (loc._lat  ?? 0);
        const lng = typeof loc.longitude === 'number' ? loc.longitude : (loc._long ?? 0);
        if (!lat && !lng) return;

        pins.push({
          id:              d.id,
          nombrecliente:   data.nombrecliente    ?? '',
          status:          data.status           ?? 'Pendiente',
          driverStatusText: data.driverStatusText ?? '',
          total:           data.total            ?? 0,
          confirmedTotal:  data.confirmedTotal,
          street:          data.street           ?? '',
          number:          data.number           ?? '',
          neighborhood:    data.neighborhood     ?? '',
          driverTag:       data.driverTag        ?? '',
          lat,
          lng,
        });
      });
      setOrders(pins);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Init Leaflet map ──────────────────────────────────────────────────────
  useEffect(() => {
    let destroyed = false;
    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const L = (await import('leaflet')).default;
      if (destroyed || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [21.1236, -101.6823],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      mapRef.current = map;
    }
    init();
    return () => {
      destroyed = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // ── Update order markers ──────────────────────────────────────────────────
  useEffect(() => {
    async function update() {
      if (!mapRef.current) return;
      const L = (await import('leaflet')).default;

      orderPinsRef.current.forEach(m => m.remove());
      orderPinsRef.current = [];

      orders.forEach(order => {
        const info     = ORDER_STATUS[order.status] ?? ORDER_STATUS.Pendiente;
        const isReparto = order.status === 'Reparto';
        // If assigned to a driver, use that driver's color
        const slotNum  = parseInt(order.driverTag?.replace('Driver #', '') || '0');
        const dotColor = isReparto && slotNum ? (SLOT_STYLE[slotNum]?.color ?? info.color) : info.color;
        const size     = isReparto ? 18 : 13;

        const icon = L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;
            background:${dotColor};
            border-radius:50%;
            border:2.5px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            ${isReparto ? 'animation:pulse 1.6s infinite;' : ''}
          "></div>`,
          iconSize:   [size, size],
          iconAnchor: [size / 2, size / 2],
          className: '',
        });

        const displayTotal = order.confirmedTotal ?? order.total;
        const marker = L.marker([order.lat, order.lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="font-family:system-ui,sans-serif;min-width:210px;padding:2px 0">
              <div style="font-weight:800;font-size:14px;color:#1A1A1A;margin-bottom:3px">
                ${order.nombrecliente}
              </div>
              <div style="font-size:11px;color:#6B7280;margin-bottom:8px">
                ${order.street} #${order.number}, ${order.neighborhood}
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="
                  background:${dotColor};color:white;
                  font-size:10px;font-weight:700;
                  padding:2px 9px;border-radius:20px;
                ">${info.label}</span>
                <span style="font-weight:800;color:#2E7D32;font-size:14px">
                  $${displayTotal.toFixed(2)}
                </span>
              </div>
              ${order.driverTag
                ? `<div style="margin-top:7px;font-size:11px;color:#374151">
                    🚗 <b>${order.driverTag}</b>
                   </div>`
                : ''}
            </div>
          `);

        marker.on('click', () => setSelected(order.id));
        orderPinsRef.current.push(marker);
      });
    }
    update();
  }, [orders]);

  // ── Update driver markers ─────────────────────────────────────────────────
  useEffect(() => {
    async function update() {
      if (!mapRef.current) return;
      const L = (await import('leaflet')).default;

      // Remove old driver markers
      Object.values(driverPinsRef.current).forEach((m: any) => { if (m?.remove) m.remove(); });
      driverPinsRef.current = {};

      drivers.forEach(driver => {
        const style = SLOT_STYLE[driver.slot] ?? { color: '#5C35A0', label: driver.driverTag };
        const time  = driver.updatedAt
          ? driver.updatedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
          : '—';

        // Active orders for this driver
        const activeOrders = orders.filter(
          o => o.driverTag === driver.driverTag && o.status === 'Reparto'
        );

        const icon = L.divIcon({
          html: `
            <div style="
              position:relative;
              width:42px;height:42px;
            ">
              <div style="
                width:42px;height:42px;
                background:${style.color};
                border-radius:50%;
                border:3px solid white;
                box-shadow:0 3px 12px rgba(0,0,0,0.4);
                display:flex;align-items:center;justify-content:center;
                font-size:20px;
              ">🚗</div>
              <div style="
                position:absolute;top:-4px;right:-4px;
                background:white;
                border:2px solid ${style.color};
                border-radius:50%;
                width:18px;height:18px;
                font-size:9px;font-weight:900;
                display:flex;align-items:center;justify-content:center;
                color:${style.color};
              ">#${driver.slot}</div>
            </div>`,
          iconSize:   [42, 42],
          iconAnchor: [21, 21],
          className: '',
        });

        const ordersHtml = activeOrders.length
          ? activeOrders.map(o =>
              `<div style="margin-top:5px;font-size:11px;color:#374151;padding:4px 8px;background:#F3F4F6;border-radius:6px">
                📦 <b>${o.nombrecliente}</b><br>
                <span style="color:#6B7280">${o.street} #${o.number}</span>
              </div>`
            ).join('')
          : `<div style="margin-top:5px;font-size:11px;color:#9CA3AF">Sin pedidos activos</div>`;

        const marker = L.marker([driver.lat, driver.lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="font-family:system-ui,sans-serif;min-width:220px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <div style="
                  width:10px;height:10px;border-radius:50%;
                  background:${style.color};flex-shrink:0;
                "></div>
                <span style="font-weight:800;font-size:14px;color:#1A1A1A">${style.label}</span>
              </div>
              <div style="font-size:11px;color:#6B7280">${driver.name}</div>
              <div style="font-size:10px;color:#9CA3AF;margin-top:2px">GPS: ${time}</div>
              <div style="margin-top:8px;font-size:11px;font-weight:700;color:#374151">
                Pedidos en ruta (${activeOrders.length})
              </div>
              ${ordersHtml}
            </div>
          `);

        driverPinsRef.current[driver.slot] = marker;
      });
    }
    update();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers, orders]);

  // ── Fly to selected order ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selected || !mapRef.current) return;
    const order = orders.find(o => o.id === selected);
    if (order?.lat && order?.lng) {
      mapRef.current.flyTo([order.lat, order.lng], 16, { duration: 0.8 });
    }
  }, [selected, orders]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const counts = {
    Pendiente:  orders.filter(o => o.status === 'Pendiente').length,
    Reparto:    orders.filter(o => o.status === 'Reparto').length,
  };

  const slotEmails = [appConfig.driver1Email, appConfig.driver2Email, appConfig.driver3Email];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <style>{`
        @keyframes pulse {
          0%   { box-shadow: 0 0 0 0 rgba(21,101,192,0.45); }
          70%  { box-shadow: 0 0 0 10px rgba(21,101,192,0); }
          100% { box-shadow: 0 0 0 0 rgba(21,101,192,0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '12px 20px',
        background: 'white',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 18, color: '#111827', margin: 0 }}>
            Mapa en tiempo real
          </h1>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>
            Conductores y pedidos activos · León, Gto.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {[1, 2, 3].map(n => {
            const s = SLOT_STYLE[n];
            const live = drivers.find(d => d.slot === n);
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: slotEmails[n - 1] ? s.color : '#E5E7EB',
                }} />
                <span style={{ fontSize: 11, color: slotEmails[n - 1] ? '#374151' : '#9CA3AF' }}>
                  {s.label}
                  {live ? ' ●' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{
          width: 290,
          flexShrink: 0,
          background: '#F8F4EF',
          borderRight: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Count chips */}
          <div style={{ padding: '10px 12px 6px', display: 'flex', gap: 8 }}>
            {[
              { key: 'Pendiente', label: 'Pendientes', color: '#E65100' },
              { key: 'Reparto',   label: 'En reparto', color: '#1565C0' },
            ].map(({ key, label, color }) => (
              <div key={key} style={{
                flex: 1, background: 'white', borderRadius: 10,
                padding: '8px 6px', textAlign: 'center', border: '1px solid #E5E7EB',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{counts[key as keyof typeof counts]}</div>
                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Driver slots */}
          <div style={{ padding: '6px 12px 0' }}>
            {[1, 2, 3].map(n => {
              const style    = SLOT_STYLE[n];
              const driver   = drivers.find(d => d.slot === n);
              const email    = slotEmails[n - 1];
              const gps      = freshness(driver?.updatedAt ?? null);
              const myOrders = orders.filter(o => o.driverTag === `Driver #${n}` && o.status === 'Reparto');

              return (
                <div
                  key={n}
                  style={{
                    background: 'white',
                    borderRadius: 10,
                    marginBottom: 8,
                    overflow: 'hidden',
                    border: '1px solid #E5E7EB',
                    display: 'flex',
                  }}
                >
                  {/* Color bar */}
                  <div style={{ width: 3, background: email ? style.color : '#E5E7EB', flexShrink: 0 }} />

                  <div style={{ flex: 1, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {/* Slot badge */}
                      <div style={{
                        width: 20, height: 20, borderRadius: 6,
                        background: email ? style.color : '#E5E7EB',
                        color: email ? 'white' : '#9CA3AF',
                        fontSize: 10, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>{n}</div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                        {style.label}
                      </span>
                      {email && (
                        <span style={{
                          marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                          color: gps.color,
                        }}>
                          {driver ? gps.text : 'Sin GPS'}
                        </span>
                      )}
                    </div>

                    {email ? (
                      <>
                        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
                          {driver?.name || email}
                        </div>
                        {myOrders.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {myOrders.map(o => (
                              <button
                                key={o.id}
                                onClick={() => setSelected(o.id)}
                                style={{
                                  textAlign: 'left', background: `${style.color}0D`,
                                  border: `1px solid ${style.color}30`,
                                  borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                                }}
                              >
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>
                                  📦 {o.nombrecliente}
                                </div>
                                <div style={{ fontSize: 10, color: '#6B7280' }}>
                                  {o.street} #{o.number}
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 10, color: '#9CA3AF' }}>Sin pedidos activos</div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>Sin conductor asignado</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pending orders list */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '0 12px 16px',
            borderTop: '1px solid #E5E7EB',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', padding: '8px 0 4px', letterSpacing: '0.05em' }}>
              PEDIDOS PENDIENTES
            </div>
            {loading ? (
              <div style={{ color: '#9CA3AF', fontSize: 12, paddingTop: 12 }}>Cargando...</div>
            ) : orders.filter(o => o.status === 'Pendiente').length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: 12, paddingTop: 8 }}>Sin pedidos pendientes</div>
            ) : (
              orders.filter(o => o.status === 'Pendiente').map(order => {
                const isSelected = selected === order.id;
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelected(isSelected ? null : order.id)}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: 'white', borderRadius: 10,
                      padding: '8px 10px', marginBottom: 6,
                      border: `1.5px solid ${isSelected ? '#E65100' : '#E5E7EB'}`,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 0 2px #E6510022' : 'none',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#111827' }}>
                      {order.nombrecliente}
                    </div>
                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
                      {order.street} #{order.number}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 12, color: '#2E7D32', marginTop: 3 }}>
                      ${(order.confirmedTotal ?? order.total).toFixed(2)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}
