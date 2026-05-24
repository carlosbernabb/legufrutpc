'use client';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
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
  driverTag: string;
  lat: number;
  lng: number;
  updatedAt: Date | null;
  activeOrderId: string;
}

// ── Color palette ──────────────────────────────────────────────────────────

const STATUS: Record<string, { color: string; label: string }> = {
  Pendiente:  { color: '#E65100', label: 'Pendiente' },
  Confirmado: { color: '#2E7D32', label: 'Confirmado' },
  Reparto:    { color: '#1565C0', label: 'En reparto' },
};

// ── Map page ───────────────────────────────────────────────────────────────

export default function MapaPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const orderPinsRef = useRef<any[]>([]);
  const driverPinsRef = useRef<any[]>([]);

  const [orders, setOrders]     = useState<OrderPin[]>([]);
  const [drivers, setDrivers]   = useState<DriverPin[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  // ── Subscribe to orders ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'orders')), snap => {
      const pins: OrderPin[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        const loc  = data.location;
        // Skip delivered and cancelled
        if (!loc) return;
        if (data.status === 'Cancelado') return;
        if (data.driverStatusText === 'Su pedido ha llegado') return;

        const lat = typeof loc.latitude  === 'number' ? loc.latitude  : (loc._lat  ?? 0);
        const lng = typeof loc.longitude === 'number' ? loc.longitude : (loc._long ?? 0);
        if (!lat && !lng) return;

        pins.push({
          id: d.id,
          nombrecliente:  data.nombrecliente  ?? '',
          status:         data.status         ?? 'Pendiente',
          driverStatusText: data.driverStatusText ?? '',
          total:          data.total          ?? 0,
          confirmedTotal: data.confirmedTotal,
          street:         data.street         ?? '',
          number:         data.number         ?? '',
          neighborhood:   data.neighborhood   ?? '',
          driverTag:      data.driverTag      ?? '',
          lat,
          lng,
        });
      });
      setOrders(pins);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Subscribe to driver locations ────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'driverLocations')), snap => {
      const pins: DriverPin[] = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id:            d.id,
            driverTag:     data.driverTag     ?? d.id,
            lat:           data.lat           ?? 0,
            lng:           data.lng           ?? 0,
            updatedAt:     data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
            activeOrderId: data.activeOrderId ?? '',
          };
        })
        .filter(p => p.lat !== 0 || p.lng !== 0);
      setDrivers(pins);
    });
    return () => unsub();
  }, []);

  // ── Init map (once) ──────────────────────────────────────────────────────
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

      // CartoDB Voyager — clean, no API key needed
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> © <a href="https://carto.com/">CartoDB</a>',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      mapRef.current = map;
    }
    init();
    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // ── Update order markers ─────────────────────────────────────────────────
  useEffect(() => {
    async function update() {
      if (!mapRef.current) return;
      const L = (await import('leaflet')).default;

      orderPinsRef.current.forEach(m => m.remove());
      orderPinsRef.current = [];

      orders.forEach(order => {
        const info     = STATUS[order.status] ?? STATUS.Pendiente;
        const isActive = order.status === 'Reparto';
        const size     = isActive ? 20 : 15;

        const icon = L.divIcon({
          html: `
            <div style="
              position:relative;
              width:${size}px;
              height:${size}px;
            ">
              <div style="
                width:${size}px;
                height:${size}px;
                background:${info.color};
                border-radius:50%;
                border:2.5px solid white;
                box-shadow:0 2px 8px rgba(0,0,0,0.35);
                ${isActive ? 'animation:pulse 1.5s infinite;' : ''}
              "></div>
            </div>`,
          iconSize:   [size, size],
          iconAnchor: [size / 2, size / 2],
          className:  '',
        });

        const displayTotal = order.confirmedTotal ?? order.total;

        const marker = L.marker([order.lat, order.lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="font-family:system-ui,sans-serif;min-width:210px;padding:2px 0">
              <div style="font-weight:800;font-size:14px;color:#1A1A1A;margin-bottom:3px">
                ${order.nombrecliente}
              </div>
              <div style="font-size:12px;color:#6B7280;margin-bottom:8px">
                ${order.street} #${order.number}, ${order.neighborhood}
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="
                  background:${info.color};
                  color:white;
                  font-size:10px;
                  font-weight:700;
                  padding:2px 9px;
                  border-radius:20px;
                ">${info.label}</span>
                <span style="font-weight:800;color:#2E7D32;font-size:14px">
                  $${displayTotal.toFixed(2)}
                </span>
              </div>
              ${order.driverTag
                ? `<div style="margin-top:7px;font-size:11px;color:#374151">
                    🚚 <b>${order.driverTag}</b>
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

  // ── Update driver markers ────────────────────────────────────────────────
  useEffect(() => {
    async function update() {
      if (!mapRef.current) return;
      const L = (await import('leaflet')).default;

      driverPinsRef.current.forEach(m => m.remove());
      driverPinsRef.current = [];

      drivers.forEach(driver => {
        const icon = L.divIcon({
          html: `
            <div style="
              background:#5C35A0;
              color:white;
              font-size:17px;
              width:36px;
              height:36px;
              border-radius:50%;
              display:flex;
              align-items:center;
              justify-content:center;
              border:2.5px solid white;
              box-shadow:0 3px 10px rgba(0,0,0,0.4);
            ">🚚</div>`,
          iconSize:   [36, 36],
          iconAnchor: [18, 18],
          className:  '',
        });

        const time = driver.updatedAt
          ? driver.updatedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '—';

        L.marker([driver.lat, driver.lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="font-family:system-ui,sans-serif;min-width:180px">
              <div style="font-weight:800;font-size:14px;color:#1A1A1A;margin-bottom:3px">
                🚚 ${driver.driverTag}
              </div>
              <div style="font-size:11px;color:#6B7280">
                Última actualización: ${time}
              </div>
              ${driver.activeOrderId
                ? `<div style="margin-top:5px;font-size:11px;font-weight:600;color:#2E7D32">
                    Pedido activo
                   </div>`
                : ''}
            </div>
          `);

        driverPinsRef.current.push(driver);
      });
    }
    update();
  }, [drivers]);

  // ── Fly to selected order ────────────────────────────────────────────────
  useEffect(() => {
    if (!selected || !mapRef.current) return;
    const order = orders.find(o => o.id === selected);
    if (order?.lat && order?.lng) {
      mapRef.current.flyTo([order.lat, order.lng], 16, { duration: 0.8 });
    }
  }, [selected, orders]);

  // ── Derived stats ────────────────────────────────────────────────────────
  const counts = {
    Pendiente:  orders.filter(o => o.status === 'Pendiente').length,
    Confirmado: orders.filter(o => o.status === 'Confirmado').length,
    Reparto:    orders.filter(o => o.status === 'Reparto').length,
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%   { box-shadow: 0 0 0 0 rgba(21,101,192,0.5); }
          70%  { box-shadow: 0 0 0 10px rgba(21,101,192,0); }
          100% { box-shadow: 0 0 0 0 rgba(21,101,192,0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '14px 24px',
        background: 'white',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 20, color: '#1A1A1A', margin: 0 }}>
            Mapa de conductores
          </h1>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
            Pedidos activos y conductores en tiempo real · León, Gto.
          </p>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {Object.entries(STATUS).map(([s, info]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: info.color, border: '1.5px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              <span style={{ fontSize: 12, color: '#6B7280' }}>{info.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#5C35A0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>🚚</div>
            <span style={{ fontSize: 12, color: '#6B7280' }}>Conductor</span>
          </div>
        </div>
      </div>

      {/* Body = sidebar + map */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{
          width: 280,
          flexShrink: 0,
          background: '#F8F4EF',
          borderRight: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Stats chips */}
          <div style={{ padding: '12px 12px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {Object.entries(counts).map(([s, n]) => (
              <div key={s} style={{
                background: 'white',
                borderRadius: 12,
                padding: '8px 6px',
                textAlign: 'center',
                border: '1px solid #E5E7EB',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: STATUS[s]?.color }}>{n}</div>
                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>{STATUS[s]?.label}</div>
              </div>
            ))}
          </div>

          {/* Drivers panel */}
          {drivers.length > 0 && (
            <div style={{
              margin: '0 12px 8px',
              background: 'white',
              borderRadius: 12,
              border: '1px solid #E5E7EB',
              padding: '10px 12px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                Conductores en línea ({drivers.length})
              </div>
              {drivers.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>🚚</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', flex: 1 }}>{d.driverTag}</span>
                  {d.updatedAt && (
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {d.updatedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Driver offline hint */}
          {drivers.length === 0 && (
            <div style={{
              margin: '0 12px 8px',
              background: '#EDE9FE',
              borderRadius: 12,
              border: '1px solid #C4B5FD',
              padding: '10px 12px',
              fontSize: 11,
              color: '#5B21B6',
              lineHeight: 1.5,
            }}>
              🚚 <b>Sin conductores conectados.</b><br />
              Cuando el conductor abra la app y tenga un pedido activo, su posición aparecerá aquí automáticamente.
            </div>
          )}

          {/* Order list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>
                Cargando pedidos...
              </div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>
                Sin pedidos activos hoy
              </div>
            ) : (
              orders.map(order => {
                const info    = STATUS[order.status] ?? STATUS.Pendiente;
                const isSelected = selected === order.id;
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelected(isSelected ? null : order.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'white',
                      borderRadius: 12,
                      padding: '10px 12px',
                      marginBottom: 8,
                      border: `1.5px solid ${isSelected ? info.color : '#E5E7EB'}`,
                      cursor: 'pointer',
                      boxShadow: isSelected ? `0 0 0 2px ${info.color}22` : 'none',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: info.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: info.color }}>{info.label}</span>
                      {order.driverTag && (
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9CA3AF' }}>
                          🚚 {order.driverTag}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A1A' }}>{order.nombrecliente}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                      {order.street} #{order.number}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#2E7D32', marginTop: 4 }}>
                      ${(order.confirmedTotal ?? order.total).toFixed(2)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Map container */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>

      </div>
    </div>
  );
}
