'use client';
import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot, where,
  getDocs, Timestamp, updateDoc, deleteDoc, doc, serverTimestamp, addDoc, GeoPoint,
} from 'firebase/firestore';

// ── Test order data ────────────────────────────────────────────────────────

const TEST_PRODUCTS = [
  // Frutas
  { name: 'Manzana Golden',        price: 45,  unit: 'Gramos', min: 500,  max: 2000, step: 250 },
  { name: 'Fresas',                price: 125, unit: 'Gramos', min: 250,  max: 1000, step: 250 },
  { name: 'Plátano Tabasco',       price: 18,  unit: 'Gramos', min: 1000, max: 3000, step: 500 },
  { name: 'Naranja Valencia',      price: 22,  unit: 'Gramos', min: 1000, max: 5000, step: 500 },
  { name: 'Mango Manila',          price: 55,  unit: 'Gramos', min: 500,  max: 2000, step: 250 },
  { name: 'Papaya Maradol',        price: 28,  unit: 'Gramos', min: 500,  max: 2000, step: 250 },
  { name: 'Uva Verde sin Semilla', price: 85,  unit: 'Gramos', min: 250,  max: 750,  step: 250 },
  { name: 'Melón Cantaloupe',      price: 20,  unit: 'Gramos', min: 1000, max: 3000, step: 500 },
  { name: 'Lima',                  price: 25,  unit: 'Gramos', min: 500,  max: 2000, step: 250 },
  // Verduras
  { name: 'Jitomate Saladette',    price: 28,  unit: 'Gramos', min: 500,  max: 3000, step: 250 },
  { name: 'Cebolla Blanca',        price: 22,  unit: 'Gramos', min: 500,  max: 2000, step: 250 },
  { name: 'Espinaca Baby',         price: 28,  unit: 'Gramos', min: 100,  max: 500,  step: 100 },
  { name: 'Zanahoria',             price: 18,  unit: 'Gramos', min: 500,  max: 2000, step: 250 },
  { name: 'Papa Blanca',           price: 15,  unit: 'Gramos', min: 1000, max: 5000, step: 500 },
  { name: 'Brócoli',               price: 32,  unit: 'Gramos', min: 500,  max: 2000, step: 250 },
  { name: 'Aguacate Hass',         price: 38,  unit: 'Piezas', min: 2,    max: 8,    step: 1   },
  { name: 'Lechuga Orejona',       price: 20,  unit: 'Piezas', min: 1,    max: 3,    step: 1   },
  { name: 'Pepino',                price: 15,  unit: 'Piezas', min: 2,    max: 6,    step: 1   },
  // Abarrotes
  { name: 'Arroz Extra',           price: 32,  unit: 'Gramos', min: 500,  max: 2000, step: 500 },
  { name: 'Frijol Negro',          price: 38,  unit: 'Gramos', min: 500,  max: 2000, step: 500 },
  { name: 'Aceite Vegetal 1L',     price: 45,  unit: 'Piezas', min: 1,    max: 3,    step: 1   },
  // Chiles–Semillas–Plantas
  { name: 'Chile Serrano',         price: 65,  unit: 'Gramos', min: 100,  max: 500,  step: 100 },
  { name: 'Chile Habanero',        price: 85,  unit: 'Gramos', min: 100,  max: 300,  step: 100 },
  { name: 'Semilla de Girasol',    price: 55,  unit: 'Gramos', min: 200,  max: 500,  step: 100 },
  { name: 'Flor de Jamaica',       price: 70,  unit: 'Gramos', min: 100,  max: 400,  step: 100 },
];

const TEST_ADDRESSES = [
  {
    street: 'Blvd. López Mateos', number: '1802', neighborhood: 'Jardines del Moral',
    postalCode: '37160', referenceNote: 'Edificio azul, piso 3, timbre con apellido García',
    lat: 21.1355, lng: -101.7098,
  },
  {
    street: 'Av. Juárez', number: '316', neighborhood: 'Centro Histórico',
    postalCode: '37000', referenceNote: 'Casa dos pisos, portón negro, entre Madero e Hidalgo',
    lat: 21.1233, lng: -101.6808,
  },
  {
    street: 'Blvd. Campestre', number: '1105', neighborhood: 'Jardines del Campestre',
    postalCode: '37150', referenceNote: 'Casa esquina barda blanca, reja dorada',
    lat: 21.1315, lng: -101.7041,
  },
  {
    street: 'Blvd. Francisco Villa', number: '2301', neighborhood: 'San Carlos',
    postalCode: '37210', referenceNote: 'Frente a farmacia Guadalajara, casa amarilla',
    lat: 21.1145, lng: -101.7195,
  },
  {
    street: 'Av. Juan Alonso de Torres', number: '1103', neighborhood: 'Los Olivos',
    postalCode: '37320', referenceNote: 'Junto a plaza Los Olivos, casa con árboles en jardín',
    lat: 21.1072, lng: -101.6875,
  },
  {
    street: 'Av. Insurgentes', number: '789', neighborhood: 'Jardines de Jerez',
    postalCode: '37530', referenceNote: 'Esquina con Calle Fresno, buzón rojo en puerta',
    lat: 21.1468, lng: -101.6748,
  },
  {
    street: 'Calle Madero', number: '450', neighborhood: 'La Martinica',
    postalCode: '37480', referenceNote: 'Portón azul marino, tocar tres veces',
    lat: 21.1408, lng: -101.7158,
  },
  {
    street: 'Blvd. del Campesino', number: '1302', neighborhood: 'Medina',
    postalCode: '37238', referenceNote: 'Casa blanca con jardín, estacionamiento para dos autos',
    lat: 21.1192, lng: -101.7172,
  },
];

const FAKE_NAMES = [
  'María García López', 'Carlos Hernández', 'Laura Martínez R.', 'José Rodríguez',
  'Ana Sofía Mendoza', 'Roberto Sánchez', 'Gabriela Torres', 'Luis Pérez Vega',
];

function rand(min: number, max: number, step = 1): number {
  const steps = Math.floor((max - min) / step);
  return min + Math.floor(Math.random() * (steps + 1)) * step;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildRandomItems() {
  // Shuffle and take 4-7 products ensuring at least 2 categories represented
  const shuffled = [...TEST_PRODUCTS].sort(() => Math.random() - 0.5);
  const count = rand(4, 7, 1);
  const picked = shuffled.slice(0, count);

  return picked.map(p => {
    const grams = rand(p.min, p.max, p.step);
    const lineTotal = p.unit === 'Piezas'
      ? p.price * grams
      : Math.round(p.price * grams / 1000 * 100) / 100;
    return {
      productName: p.name,
      coverimage: '',
      unitPrice: lineTotal,
      pricePerKg: p.price,
      grams,
      unitType: p.unit,
    };
  });
}

// ── Types ──────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  productName: string;
  coverimage: string;
  unitPrice: number;
  pricePerKg: number;
  grams: number;
  unitType: string; // 'kg' | 'Gramos' | 'Piezas'
  confirmedGrams?: number;
  confirmedUnitPrice?: number;
}

interface Order {
  id: string;
  userRef: string;
  nombrecliente: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  confirmedTotal?: number;
  status: string;
  driverTag: string;
  driverStatusText: string;
  street: string;
  number: string;
  neighborhood: string;
  postalCode: string;
  referenceNote: string;
  cancelReason?: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: Date | null;
  items: OrderItem[];
  isTest?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: Date | null) {
  if (!d) return '—';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtQty(grams: number, unitType: string): string {
  if (unitType === 'Piezas') return `${grams} pza${grams !== 1 ? 's' : ''}`;
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${Number.isInteger(kg) ? kg : parseFloat(kg.toFixed(3))} kg`;
  }
  return `${grams} g`;
}

// Un pedido está confirmado si ya se pesó y se guardó el total real.
// 'Confirmado' en status es el formato viejo, se sigue reconociendo.
function estaConfirmado(o: Order): boolean {
  return o.confirmedTotal != null || o.status === 'Confirmado';
}

function statusColor(o: Order): { bg: string; fg: string; label: string } {
  const ds = o.driverStatusText;
  if (ds === 'Su pedido ha llegado') return { bg: '#E8F5E9', fg: '#2E7D32', label: 'Entregado' };
  if (ds === 'En camino') return { bg: '#E3F2FD', fg: '#1565C0', label: 'En camino' };
  if (ds === 'En preparación') return { bg: '#FFF3E0', fg: '#E65100', label: 'En preparación' };
  if (o.status === 'Reparto') return { bg: '#F3E5F5', fg: '#6A1B9A', label: 'En reparto' };
  if (o.status === 'Cancelado') return { bg: '#FFEBEE', fg: '#C62828', label: '✕ Cancelado' };
  if (estaConfirmado(o)) return { bg: '#E8F5E9', fg: '#2E7D32', label: '✓ Confirmado' };
  return { bg: '#F3F4F6', fg: '#374151', label: 'Pendiente' };
}

// ── Etapas del pedido ──────────────────────────────────────────────────────
// Las mismas 3 etapas del Panel de Órdenes de la app (Pendientes / Preparando
// / Entregados), más Cancelados, que solo existe en la PC.
//
// Regla clave: todo pedido cae en EXACTAMENTE una etapa, así ninguno queda
// invisible. 'Confirmado' es un estado que solo usa la PC (no existe en la
// app), por eso se agrupa dentro de Pendientes: está aceptado pero todavía
// sin repartidor.

type Stage = 'Pendiente' | 'Preparando' | 'Entregado' | 'Cancelado';

function orderStage(o: Order): Stage {
  if (o.driverStatusText === 'Su pedido ha llegado') return 'Entregado';
  if (o.status === 'Cancelado') return 'Cancelado';
  // Si ya tiene conductor asignado está en preparación, aunque el status haya
  // quedado en 'Confirmado' por haberse confirmado después de asignar.
  if (o.status === 'Reparto' || o.driverTag !== '') return 'Preparando';
  return 'Pendiente'; // incluye 'Pendiente', 'Confirmado' y vacío
}

// ── Conductores ────────────────────────────────────────────────────────────
// Los 3 slots son los mismos que en el panel "Conductores" y en la app móvil:
// la app del conductor filtra sus pedidos por driverTag == 'Driver #<slot>'.

const DRIVER_SLOTS = [
  { n: 1, tag: 'Driver #1', color: '#7B1FA2' },
  { n: 2, tag: 'Driver #2', color: '#1565C0' },
  { n: 3, tag: 'Driver #3', color: '#00695C' },
];

interface DriverInfo {
  n: number;
  tag: string;
  color: string;
  name: string;   // nombre real del conductor asignado a ese slot
  active: boolean;
}

function useDrivers(): DriverInfo[] {
  const [names, setNames] = useState<Record<number, string>>({});

  useEffect(() => {
    const q = query(collection(db, 'users'), where('isDriver', '==', true));
    const unsub = onSnapshot(q, snap => {
      const map: Record<number, string> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const slot = data.driverSlot as number | undefined;
        if (slot && slot >= 1 && slot <= 3) {
          map[slot] = data.display_name || data.email || '';
        }
      });
      setNames(map);
    });
    return () => unsub();
  }, []);

  return DRIVER_SLOTS.map(s => ({
    ...s,
    name: names[s.n] ?? '',
    active: Boolean(names[s.n]),
  }));
}

// ── Asignar conductor ──────────────────────────────────────────────────────
// Mismo efecto que en la app: status → 'Reparto' y driverStatusText → 'En
// preparación', para que el pedido aparezca en el panel del conductor.

function AsignarConductor({ order, drivers }: { order: Order; drivers: DriverInfo[] }) {
  const asignado = order.driverTag !== '';
  const [busy, setBusy] = useState('');
  const [abierto, setAbierto] = useState(!asignado);

  const actual = drivers.find(d => d.tag === order.driverTag);

  async function asignar(d: DriverInfo) {
    if (busy) return;
    if (!d.active && !window.confirm(
      `${d.tag} no tiene ningún conductor asignado en la sección Conductores.\n\n` +
      `Si asignas el pedido a este slot, nadie lo verá en la app hasta que asignes ` +
      `un conductor ahí. ¿Continuar de todos modos?`
    )) return;

    setBusy(d.tag);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        driverTag: d.tag,
        status: 'Reparto',
        driverStatusText: 'En preparación',
      });
      setAbierto(false);
    } catch (e) {
      alert('Error al asignar conductor: ' + e);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="px-5 pb-3 no-print">
      <div className="rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold" style={{ color: '#475569' }}>
            🚚 {asignado ? 'Conductor asignado' : 'Asignar a repartidor'}
          </span>
          {asignado && (
            <button
              onClick={() => setAbierto(o => !o)}
              className="text-xs font-semibold"
              style={{ color: '#2E7D32' }}
            >
              {abierto ? 'Cerrar' : 'Cambiar conductor'}
            </button>
          )}
        </div>

        {asignado && !abierto && (
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
              style={{ background: actual?.color ?? '#6B7280' }}
            >
              {order.driverTag}
            </span>
            <span className="text-xs font-medium" style={{ color: '#334155' }}>
              {actual?.name || 'Slot sin conductor asignado'}
            </span>
            <span className="text-xs" style={{ color: '#94A3B8' }}>
              · {order.driverStatusText || 'En preparación'}
            </span>
          </div>
        )}

        {abierto && (
          <>
            <div className="flex gap-2">
              {drivers.map(d => {
                const esActual = d.tag === order.driverTag;
                return (
                  <button
                    key={d.n}
                    onClick={() => asignar(d)}
                    disabled={busy !== ''}
                    className="flex-1 py-2 px-2 rounded-lg text-white transition-opacity"
                    style={{
                      background: d.color,
                      opacity: busy && busy !== d.tag ? 0.45 : d.active ? 1 : 0.6,
                      outline: esActual ? `2px solid ${d.color}` : 'none',
                      outlineOffset: 2,
                    }}
                  >
                    <div className="text-xs font-bold">
                      {busy === d.tag ? 'Asignando...' : d.tag}
                    </div>
                    <div className="text-[10px] truncate" style={{ opacity: 0.85 }}>
                      {d.active ? d.name : 'sin conductor'}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] mt-2 leading-snug" style={{ color: '#94A3B8' }}>
              Al asignar, el pedido pasa a <b>En reparto · En preparación</b> y le aparece
              al conductor en su app.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Payment chip ───────────────────────────────────────────────────────────
// Efectivo: informativo (Por cobrar / Pagado al entregar). Tarjeta: clic para
// alternar Esperando pago ↔ Pagado cuando el dueño confirma en Mercado Pago.

function PaymentChip({ order }: { order: Order }) {
  const isCard = order.paymentMethod === 'Tarjeta';
  const paid = order.paymentStatus === 'Pagado';
  const color = isCard ? (paid ? '#2E7D32' : '#009EE3') : (paid ? '#2E7D32' : '#E65100');
  const label = isCard
    ? (paid ? '💳 Tarjeta · Pagado' : '💳 Tarjeta · Esperando pago')
    : (paid ? '💵 Efectivo · Pagado' : '💵 Efectivo · Por cobrar');

  async function toggle() {
    if (!isCard) return;
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        paymentStatus: paid ? 'Esperando pago' : 'Pagado',
      });
    } catch (e) {
      alert('Error al actualizar el pago: ' + e);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={!isCard}
      title={isCard ? 'Clic para marcar como pagado / no pagado' : undefined}
      className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
      style={{
        background: `${color}1A`,
        color,
        border: `1px solid ${color}55`,
        cursor: isCard ? 'pointer' : 'default',
      }}
    >
      {label}{isCard && !paid ? ' 👆' : ''}
    </button>
  );
}

// ── Ticket print component (rendered in DOM, shown only on print) ──────────

function TicketContent({ order, type }: { order: Order; type: 'negocio' | 'cliente' | 'conductor' }) {
  const titles: Record<typeof type, string> = {
    negocio:   'TICKET — NEGOCIO',
    cliente:   'TICKET — CLIENTE',
    conductor: 'TICKET — CONDUCTOR',
  };

  const HR = ({ solid }: { solid?: boolean }) => (
    <div style={{ borderTop: solid ? '2px solid #000' : '1px dashed #777', margin: '3px 0' }} />
  );

  const Row = ({ left, right }: { left: string; right: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {left}
      </span>
      <span style={{ flexShrink: 0 }}>{right}</span>
    </div>
  );

  return (
    <div className="ticket-block" style={{
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: 11,
      fontWeight: 'bold',
      lineHeight: 1.4,
      width: '100%',
    }}>
      <HR solid />
      <div style={{ textAlign: 'center', fontSize: 12 }}>{titles[type]}</div>
      <HR solid />

      <div>LeguFrut | #{order.id.substring(0, 10)}</div>
      <div>Fecha: {fmtDate(order.createdAt)}</div>
      <div>CLIENTE: {order.nombrecliente || 'Sin nombre'}</div>

      {(type === 'negocio' || type === 'conductor') && (
        <>
          <HR />
          <div>ENTREGA:</div>
          <div>{order.street} #{order.number}</div>
          <div>Col. {order.neighborhood}, CP {order.postalCode}</div>
          {order.referenceNote && <div>Ref: {order.referenceNote}</div>}
          {order.driverTag && <div>Driver: {order.driverTag}</div>}
        </>
      )}

      <HR />
      <div>PRODUCTOS:</div>
      {order.items.map((item, i) => (
        <Row
          key={i}
          left={`${item.productName} (${fmtQty(item.grams, item.unitType)})`}
          right={fmtMoney(item.unitPrice)}
        />
      ))}

      <HR solid />
      <Row left="Subtotal:" right={fmtMoney(order.subtotal)} />
      <Row left="Envio:" right={fmtMoney(order.shippingFee)} />
      <Row left="TOTAL:" right={fmtMoney(order.total)} />
      <Row
        left="PAGO:"
        right={order.paymentMethod === 'Tarjeta'
          ? (order.paymentStatus === 'Pagado' ? 'TARJETA (PAGADO)' : 'TARJETA (PENDIENTE)')
          : (order.paymentStatus === 'Pagado' ? 'EFECTIVO (PAGADO)' : 'EFECTIVO - COBRAR')}
      />

      {type === 'negocio' && (
        <>
          <HR />
          <div>Estado: {order.driverStatusText || order.status}</div>
        </>
      )}
      <HR solid />
    </div>
  );
}

// ── Print Modal ────────────────────────────────────────────────────────────

function PrintModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [tab, setTab] = useState<'negocio' | 'cliente' | 'conductor'>('negocio');

  function printTicket(type: 'negocio' | 'cliente' | 'conductor' | 'todos') {
    const el = document.getElementById(type === 'todos' ? 'print-todos' : `print-${type}`);
    if (!el) return;
    const win = window.open('', '_blank', 'width=360,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>Ticket LeguFrut</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          font-weight: bold;
          line-height: 1.4;
          width: 100%;
          color: #000;
          background: #fff;
          padding: 3px 10px;
        }
        .ticket-block { width: 100%; margin-bottom: 4px; }
        .ticket-separator { border-top: 1px dashed #777; margin: 5px 0; }
      </style>
      </head><body>${el.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center no-print"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ background: '#2D5016', borderColor: '#1a3a08' }}>
          <div>
            <h3 className="font-bold text-white text-base">Imprimir Ticket</h3>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Pedido #{order.id.substring(0, 10)} — {order.nombrecliente || 'Sin nombre'}
            </p>
          </div>
          <button onClick={onClose} className="text-white text-xl leading-none opacity-70 hover:opacity-100">✕</button>
        </div>

        <div className="flex border-b" style={{ borderColor: '#E5E7EB' }}>
          {(['negocio', 'cliente', 'conductor'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-sm font-medium capitalize transition-all"
              style={{
                background: tab === t ? '#E8F5E9' : 'white',
                color: tab === t ? '#2E7D32' : '#6B7280',
                borderBottom: tab === t ? '2px solid #2E7D32' : '2px solid transparent',
              }}
            >
              {t === 'negocio' ? '🏪 Negocio' : t === 'cliente' ? '🧾 Cliente' : '🚚 Conductor'}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto" style={{ maxHeight: 340 }}>
          <div
            className="mx-auto rounded-lg p-4 text-xs"
            style={{ fontFamily: 'monospace', background: '#FAFAFA', border: '1px dashed #D1D5DB', maxWidth: 280 }}
          >
            <TicketContent order={order} type={tab} />
          </div>
        </div>

        <div style={{ display: 'none' }}>
          <div id="print-negocio"><TicketContent order={order} type="negocio" /></div>
          <div id="print-cliente"><TicketContent order={order} type="cliente" /></div>
          <div id="print-conductor"><TicketContent order={order} type="conductor" /></div>
          <div id="print-todos">
            <TicketContent order={order} type="negocio" />
            <div className="ticket-separator" />
            <TicketContent order={order} type="cliente" />
            <div className="ticket-separator" />
            <TicketContent order={order} type="conductor" />
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t" style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }}>
          <button
            onClick={() => printTicket(tab)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
            style={{ background: '#2D5016' }}
          >
            🖨️ Imprimir {tab === 'negocio' ? 'Negocio' : tab === 'cliente' ? 'Cliente' : 'Conductor'}
          </button>
          <button
            onClick={() => printTicket('todos')}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity border"
            style={{ background: 'white', color: '#2D5016', borderColor: '#2D5016' }}
          >
            Imprimir los 3
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirmar Modal ────────────────────────────────────────────────────────

function ConfirmarModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [editedGrams, setEditedGrams] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: Record<string, string> = {};
    order.items.forEach(item => {
      init[item.id] = String(item.confirmedGrams ?? item.grams);
    });
    setEditedGrams(init);
  }, [order.items]);

  function isPieza(item: OrderItem) {
    return item.unitType === 'Piezas';
  }

  function calcPrice(item: OrderItem, gramsStr: string) {
    const g = parseFloat(gramsStr) || 0;
    return isPieza(item) ? item.pricePerKg * g : item.pricePerKg * (g / 1000);
  }

  const confirmedSubtotal = order.items.reduce(
    (s, item) => s + calcPrice(item, editedGrams[item.id] ?? String(item.grams)), 0
  );
  const confirmedTotal = confirmedSubtotal + order.shippingFee;

  async function handleConfirm() {
    setSaving(true);
    try {
      for (const item of order.items) {
        const g = parseFloat(editedGrams[item.id]) || item.grams;
        await updateDoc(doc(db, 'orders', order.id, 'ordersitems', item.id), {
          confirmedGrams: g,
          confirmedUnitPrice: calcPrice(item, String(g)),
        });
      }
      // OJO: confirmar NO toca 'status'. La app solo conoce Pendiente /
      // Reparto / entregado; si le escribíamos 'Confirmado' el pedido se caía
      // de todas las pestañas, aquí y en el teléfono. La confirmación se marca
      // con confirmedAt/confirmedTotal, que la app ignora sin romperse.
      await updateDoc(doc(db, 'orders', order.id), {
        confirmedTotal,
        confirmedSubtotal,
        confirmedAt: serverTimestamp(),
      });
      onClose();
    } catch (e) {
      alert('Error al confirmar: ' + e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0" style={{ background: '#2D5016', borderRadius: '1rem 1rem 0 0' }}>
          <div>
            <h3 className="font-bold text-white text-base">Confirmar pedido</h3>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              #{order.id.substring(0, 8)} — {order.nombrecliente}
            </p>
          </div>
          <button onClick={onClose} className="text-white text-xl opacity-70 hover:opacity-100">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <p className="text-xs mb-1" style={{ color: '#6B7280' }}>
            Ajusta el peso o cantidad real de cada producto según lo que se pesó/surtió.
          </p>
          {order.items.map(item => {
            const pieza = isPieza(item);
            const gramsStr = editedGrams[item.id] ?? String(item.grams);
            const price = calcPrice(item, gramsStr);
            const changed = Math.abs((parseFloat(gramsStr) || 0) - item.grams) > 0.01;

            return (
              <div
                key={item.id}
                className="rounded-xl p-3 border"
                style={{ borderColor: changed ? '#FF7043' : '#E5E7EB', background: changed ? '#FFF8F6' : '#FAFAFA' }}
              >
                <div className="flex items-center gap-3 mb-2">
                  {item.coverimage && (
                    <img src={item.coverimage} alt={item.productName} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>{item.productName}</div>
                    <div className="text-xs" style={{ color: '#9CA3AF' }}>
                      Pedido: {fmtQty(item.grams, item.unitType)}
                      {' · '}${fmtMoney(item.pricePerKg)}/{pieza ? 'pza' : 'kg'}
                    </div>
                  </div>
                  <div className="font-bold text-sm flex-shrink-0" style={{ color: changed ? '#FF7043' : '#2E7D32' }}>
                    {fmtMoney(price)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium flex-shrink-0" style={{ color: '#374151' }}>
                    {pieza ? 'Piezas reales:' : 'Gramos reales:'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={pieza ? 1 : 10}
                    value={gramsStr}
                    onChange={e => setEditedGrams(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-28 px-3 py-1.5 rounded-lg border text-sm text-center outline-none font-semibold"
                    style={{ borderColor: changed ? '#FF7043' : '#E5E7EB' }}
                  />
                  {changed && (
                    <span className="text-xs font-medium" style={{ color: '#FF7043' }}>modificado</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t flex-shrink-0" style={{ background: '#F8F4EF', borderColor: '#E5E7EB' }}>
          <div className="flex justify-between text-sm mb-1" style={{ color: '#6B7280' }}>
            <span>Subtotal real:</span><span>{fmtMoney(confirmedSubtotal)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2" style={{ color: '#6B7280' }}>
            <span>Envío:</span><span>{fmtMoney(order.shippingFee)}</span>
          </div>
          <div className="flex justify-between font-bold text-base" style={{ color: '#2E7D32' }}>
            <span>Total confirmado:</span><span>{fmtMoney(confirmedTotal)}</span>
          </div>
          {Math.abs(confirmedTotal - order.total) > 0.01 && (
            <div className="mt-1 text-xs" style={{ color: '#FF7043' }}>
              Cotizado: {fmtMoney(order.total)} → Ajustado: {fmtMoney(confirmedTotal)}
            </div>
          )}
        </div>

        <div className="px-5 py-4 flex gap-2 border-t flex-shrink-0" style={{ borderColor: '#E5E7EB', borderRadius: '0 0 1rem 1rem' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
            style={{ borderColor: '#E5E7EB', color: '#374151' }}
          >
            Cerrar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="py-2.5 rounded-xl text-sm font-bold text-white transition-opacity"
            style={{ flex: 2, background: saving ? '#81C784' : '#2D5016' }}
          >
            {saving ? 'Confirmando...' : '✓ Confirmar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cancelar Modal ─────────────────────────────────────────────────────────

function CancelarModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const QUICK_REASONS = [
    'No contamos con stock suficiente hoy',
    'Zona de entrega fuera de cobertura',
    'Problema con el pago',
    'Pedido duplicado',
  ];

  async function handleCancel() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'Cancelado',
        cancelReason: reason.trim(),
        cancelledAt: serverTimestamp(),
      });
      onClose();
    } catch (e) {
      alert('Error al cancelar: ' + e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ background: '#B71C1C', borderRadius: '1rem 1rem 0 0' }}>
          <div>
            <h3 className="font-bold text-white text-base">Cancelar pedido</h3>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              #{order.id.substring(0, 8)} — {order.nombrecliente}
            </p>
          </div>
          <button onClick={onClose} className="text-white text-xl opacity-70 hover:opacity-100">✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-sm mb-4" style={{ color: '#374151' }}>
            El cliente verá esta cancelación en sus pedidos. Puedes indicar el motivo.
          </p>

          {/* Quick reasons */}
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_REASONS.map(r => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                style={{
                  background: reason === r ? '#FFEBEE' : '#F9FAFB',
                  color: reason === r ? '#C62828' : '#374151',
                  borderColor: reason === r ? '#EF9A9A' : '#E5E7EB',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>
            Motivo (edita o escribe)
          </label>
          <textarea
            placeholder="Ej: Lo sentimos mucho, no contamos con suficiente stock hoy."
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none"
            style={{ borderColor: '#E5E7EB', color: '#1A1A1A' }}
          />
          <p className="mt-1.5 text-xs" style={{ color: '#9CA3AF' }}>
            Puedes dejarlo vacío si prefieres no indicar motivo.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 py-4 border-t" style={{ borderColor: '#E5E7EB', borderRadius: '0 0 1rem 1rem' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
            style={{ borderColor: '#E5E7EB', color: '#374151' }}
          >
            No cancelar
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ flex: 2, background: saving ? '#EF9A9A' : '#C62828' }}
          >
            {saving ? 'Cancelando...' : '✕ Cancelar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order Card ─────────────────────────────────────────────────────────────

function OrderCard({
  order,
  drivers,
  onPrint,
  onConfirmar,
  onCancelar,
  onDelete,
}: {
  order: Order;
  drivers: DriverInfo[];
  onPrint: () => void;
  onConfirmar: () => void;
  onCancelar: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const sc = statusColor(order);
  const stage = orderStage(order);
  const isCancelado = stage === 'Cancelado';
  const isEntregado = stage === 'Entregado';
  const cerrado = isCancelado || isEntregado;
  const confirmado = estaConfirmado(order);
  // El total confirmado sigue siendo el bueno aunque el pedido ya pase a Reparto.
  const totalMostrado = order.confirmedTotal ?? order.total;

  return (
    <div
      className="bg-white rounded-2xl border mb-4"
      style={{
        borderColor: order.isTest ? '#FCD34D' : isCancelado ? '#FFCDD2' : '#E5E7EB',
        boxShadow: order.isTest ? '0 0 0 2px #FEF3C7' : '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      {/* Test order banner */}
      {order.isTest && (
        <div className="px-5 py-2 flex items-center gap-2 rounded-t-2xl"
          style={{ background: '#FEF3C7', borderBottom: '1px solid #FCD34D' }}>
          <span className="text-xs font-bold" style={{ color: '#92400E' }}>
            🧪 PEDIDO DE PRUEBA — no es un pedido real
          </span>
        </div>
      )}
      {/* Header row */}
      <div className="flex items-start justify-between px-5 pt-4 pb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: sc.bg, color: sc.fg }}
            >
              {sc.label}
            </span>
            {order.driverTag && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#F3F4F6', color: '#374151' }}>
                {order.driverTag}
              </span>
            )}
            <PaymentChip order={order} />
            <span className="text-xs" style={{ color: '#9CA3AF' }}>#{order.id.substring(0, 8)}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-base font-bold" style={{ color: '#1A1A1A' }}>
              {order.nombrecliente || 'Sin nombre'}
            </span>
            <span className="text-xs" style={{ color: '#6B7280' }}>
              {fmtDate(order.createdAt)}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-2xl font-extrabold" style={{ color: isCancelado ? '#9CA3AF' : '#2E7D32' }}>
              {fmtMoney(totalMostrado)}
            </div>
            {order.confirmedTotal != null && Math.abs(order.confirmedTotal - order.total) > 0.01 && (
              <div className="text-xs line-through" style={{ color: '#9CA3AF' }}>{fmtMoney(order.total)}</div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="ml-4 flex flex-col gap-2 flex-shrink-0 no-print">
          {!confirmado && !cerrado && (
            <button
              onClick={onConfirmar}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              style={{ background: '#2E7D32', color: 'white' }}
            >
              ✓ Confirmar
            </button>
          )}
          {!isCancelado && !isEntregado && (
            <button
              onClick={onCancelar}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all"
              style={{ background: '#FFF5F5', color: '#C62828', borderColor: '#FFCDD2' }}
            >
              ✕ Cancelar
            </button>
          )}
          <button
            onClick={onPrint}
            className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border"
            style={{ background: 'white', color: '#2D5016', borderColor: '#2D5016' }}
          >
            🖨️ Ticket
          </button>
          {(isEntregado || isCancelado || order.isTest) && (
            <button
              onClick={onDelete}
              className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all"
              style={order.isTest
                ? { background: '#FEF3C7', color: '#92400E', borderColor: '#FCD34D' }
                : { background: '#F9FAFB', color: '#9CA3AF', borderColor: '#E5E7EB' }}
            >
              🗑️ {order.isTest ? 'Eliminar prueba' : 'Eliminar'}
            </button>
          )}
        </div>
      </div>

      {/* Cancellation banner */}
      {isCancelado && (
        <div className="mx-5 mb-3 rounded-xl p-3 border" style={{ background: '#FFEBEE', borderColor: '#FFCDD2' }}>
          <div className="flex items-start gap-2">
            <span className="text-sm">✕</span>
            <div>
              <div className="text-xs font-bold" style={{ color: '#C62828' }}>Pedido cancelado</div>
              {order.cancelReason && (
                <div className="text-xs mt-0.5" style={{ color: '#E57373' }}>{order.cancelReason}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Address */}
      <div className="px-5 pb-3">
        <div className="rounded-xl p-3 text-sm" style={{ background: '#F0FBF0', border: '1px solid #BBDFBB' }}>
          <div className="flex items-center gap-1 mb-1">
            <span style={{ color: '#2E7D32', fontSize: 11, fontWeight: 600 }}>📍 Dirección de entrega</span>
          </div>
          <div style={{ color: '#1A1A1A', fontWeight: 500 }}>{order.street} #{order.number}</div>
          <div style={{ color: '#374151' }}>Col. {order.neighborhood}, CP {order.postalCode}</div>
          {order.referenceNote && (
            <div style={{ color: '#6B7280', fontStyle: 'italic' }}>Ref: {order.referenceNote}</div>
          )}
        </div>
      </div>

      {/* Asignar conductor — desde que el pedido queda confirmado */}
      {(confirmado || order.driverTag !== '') && !cerrado && (
        <AsignarConductor order={order} drivers={drivers} />
      )}

      {/* Items toggle */}
      <div className="border-t" style={{ borderColor: '#F3F4F6' }}>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium"
          style={{ color: '#2E7D32' }}
        >
          <span>{open ? '▲ Ocultar productos' : `▼ Ver productos (${order.items.length})`}</span>
          {!open && (
            <span className="text-xs font-normal" style={{ color: '#6B7280' }}>
              Subtotal: {fmtMoney(order.subtotal)} + Envío: {fmtMoney(order.shippingFee)}
            </span>
          )}
        </button>

        {open && (
          <div className="px-5 pb-4 space-y-2">
            {order.items.length === 0 ? (
              <p className="text-sm" style={{ color: '#6B7280' }}>Sin productos registrados.</p>
            ) : (
              order.items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}
                >
                  {item.coverimage && (
                    <img src={item.coverimage} alt={item.productName} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>{item.productName}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                      {fmtQty(item.grams, item.unitType)}
                      {item.unitType !== 'Piezas' && ` · ${fmtMoney(item.pricePerKg)}/kg`}
                    </div>
                  </div>
                  <div className="font-bold text-sm flex-shrink-0" style={{ color: '#2E7D32' }}>
                    {fmtMoney(item.unitPrice)}
                  </div>
                </div>
              ))
            )}
            <div
              className="flex justify-between text-sm font-semibold pt-1 border-t"
              style={{ borderColor: '#E5E7EB', color: '#374151' }}
            >
              <span>Subtotal: {fmtMoney(order.subtotal)}</span>
              <span>Envío: {fmtMoney(order.shippingFee)}</span>
              <span style={{ color: '#2E7D32' }}>Total: {fmtMoney(order.total)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'Pendiente', label: 'Pendientes' },
  { key: 'Preparando', label: 'Preparando' },
  { key: 'Entregado', label: 'Entregados' },
  { key: 'Cancelado', label: 'Cancelados' },
];

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [confirmarOrder, setConfirmarOrder] = useState<Order | null>(null);
  const [cancelarOrder, setCancelarOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const drivers = useDrivers();

  const loadItems = useCallback(async (orderId: string): Promise<OrderItem[]> => {
    const snap = await getDocs(collection(db, 'orders', orderId, 'ordersitems'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<OrderItem, 'id'>) }));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, async snap => {
      const raw = snap.docs.map(d => {
        const data = d.data();
        const ts = data.createdAt;
        return {
          id: d.id,
          userRef: data.userRef?.id ?? '',
          nombrecliente: data.nombrecliente ?? '',
          subtotal: data.subtotal ?? 0,
          shippingFee: data.shippingFee ?? 0,
          total: data.total ?? 0,
          confirmedTotal: data.confirmedTotal,
          status: data.status ?? '',
          driverTag: data.driverTag ?? '',
          driverStatusText: data.driverStatusText ?? '',
          street: data.street ?? '',
          number: data.number ?? '',
          neighborhood: data.neighborhood ?? '',
          postalCode: data.postalCode ?? '',
          referenceNote: data.referenceNote ?? '',
          cancelReason: data.cancelReason ?? '',
          paymentMethod: data.paymentMethod ?? 'Efectivo',
          paymentStatus: data.paymentStatus ?? '',
          createdAt: ts instanceof Timestamp ? ts.toDate() : null,
          isTest: data.isTest === true,
          items: [] as OrderItem[],
        } as Order;
      });

      const withItems = await Promise.all(
        raw.map(async o => ({ ...o, items: await loadItems(o.id) }))
      );
      setOrders(withItems);
      setLoading(false);
    });
    return () => unsub();
  }, [loadItems]);

  async function handleDeleteOrder(orderId: string) {
    if (!window.confirm('¿Eliminar este pedido permanentemente? Esta acción no se puede deshacer.')) return;
    try {
      const itemsSnap = await getDocs(collection(db, 'orders', orderId, 'ordersitems'));
      for (const itemDoc of itemsSnap.docs) {
        await deleteDoc(itemDoc.ref);
      }
      await deleteDoc(doc(db, 'orders', orderId));
    } catch (e) {
      alert('Error al eliminar: ' + e);
    }
  }

  const [creatingTest, setCreatingTest] = useState(false);
  const [testCount, setTestCount] = useState(1);

  async function createTestOrders() {
    if (creatingTest) return;
    setCreatingTest(true);
    try {
      const usedAddressIdxs: number[] = [];

      for (let i = 0; i < testCount; i++) {
        // Pick a unique address for each order
        let addrIdx: number;
        do { addrIdx = Math.floor(Math.random() * TEST_ADDRESSES.length); }
        while (usedAddressIdxs.includes(addrIdx) && usedAddressIdxs.length < TEST_ADDRESSES.length);
        usedAddressIdxs.push(addrIdx);

        const addr = TEST_ADDRESSES[addrIdx];
        const name = pickRandom(FAKE_NAMES);
        const items = buildRandomItems();

        const subtotal = Math.round(items.reduce((s, it) => s + it.unitPrice, 0) * 100) / 100;
        const shipping = 35.00;
        const total = Math.round((subtotal + shipping) * 100) / 100;
        const isCard = Math.random() < 0.4;

        const orderRef = await addDoc(collection(db, 'orders'), {
          nombrecliente: name,
          status: 'Pendiente',
          driverTag: '',
          driverStatusText: '',
          subtotal,
          shippingFee: shipping,
          total,
          paymentMethod: isCard ? 'Tarjeta' : 'Efectivo',
          paymentStatus: isCard ? 'Esperando pago' : 'Por cobrar',
          street: addr.street,
          number: addr.number,
          neighborhood: addr.neighborhood,
          postalCode: addr.postalCode,
          referenceNote: addr.referenceNote,
          location: new GeoPoint(addr.lat, addr.lng),
          showorder: true,
          isTest: true,
          createdAt: serverTimestamp(),
          userRef: null,
        });

        for (const item of items) {
          await addDoc(collection(db, 'orders', orderRef.id, 'ordersitems'), item);
        }
      }

      alert(`✅ ${testCount} pedido${testCount > 1 ? 's' : ''} de prueba creado${testCount > 1 ? 's' : ''} con direcciones reales de León y productos variados. Aparecen arriba marcados con 🧪.`);
    } catch (e) {
      alert('Error: ' + e);
    } finally {
      setCreatingTest(false);
    }
  }

  const filtered = orders.filter(o => {
    return filter === 'todos' || orderStage(o) === filter;
  }).filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.nombrecliente.toLowerCase().includes(s) ||
      o.id.toLowerCase().includes(s) ||
      o.street.toLowerCase().includes(s)
    );
  });

  // Se cuenta con la misma función que filtra, así las pestañas siempre suman
  // el total y ningún pedido se queda fuera de todas.
  const counts: Record<string, number> = {
    todos: orders.length,
    Pendiente: 0, Preparando: 0, Entregado: 0, Cancelado: 0,
  };
  orders.forEach(o => { counts[orderStage(o)]++; });

  return (
    <div className="p-6 no-print">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Pedidos</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {orders.length} pedidos totales
          </p>
        </div>
        <div className="flex items-center gap-1 border rounded-xl overflow-hidden"
          style={{ borderColor: '#D1D5DB', background: 'white' }}>
          {/* Count selector */}
          <div className="flex border-r" style={{ borderColor: '#E5E7EB' }}>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => setTestCount(n)}
                className="w-8 h-8 text-xs font-bold transition-all"
                style={{
                  background: testCount === n ? '#FEF3C7' : 'transparent',
                  color: testCount === n ? '#92400E' : '#9CA3AF',
                }}
              >{n}</button>
            ))}
          </div>
          <button
            onClick={createTestOrders}
            disabled={creatingTest}
            className="flex items-center gap-1.5 px-3 h-8 text-xs font-semibold transition-all"
            style={{ color: creatingTest ? '#9CA3AF' : '#6B7280' }}
          >
            {creatingTest ? '⏳ Creando...' : '🧪 Pedido de prueba'}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por cliente, ID o dirección..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{ borderColor: '#E5E7EB', background: 'white' }}
          onFocus={e => (e.target.style.borderColor = '#2E7D32')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
        />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: filter === f.key ? (f.key === 'Cancelado' ? '#C62828' : '#2D5016') : 'white',
              color: filter === f.key ? 'white' : '#374151',
              border: `1px solid ${filter === f.key ? (f.key === 'Cancelado' ? '#C62828' : '#2D5016') : '#E5E7EB'}`,
            }}
          >
            {f.label}
            <span
              className="ml-2 px-1.5 py-0.5 rounded-full text-xs"
              style={{
                background: filter === f.key ? 'rgba(255,255,255,0.2)' : '#F3F4F6',
                color: filter === f.key ? 'white' : '#6B7280',
              }}
            >
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-4xl mb-3">🌿</div>
            <p style={{ color: '#6B7280' }}>Cargando pedidos...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📭</div>
          <p style={{ color: '#6B7280' }}>Sin pedidos para este filtro</p>
        </div>
      ) : (
        filtered.map(o => (
          <OrderCard
            key={o.id}
            order={o}
            drivers={drivers}
            onPrint={() => setPrintOrder(o)}
            onConfirmar={() => setConfirmarOrder(o)}
            onCancelar={() => setCancelarOrder(o)}
            onDelete={() => handleDeleteOrder(o.id)}
          />
        ))
      )}

      {printOrder && <PrintModal order={printOrder} onClose={() => setPrintOrder(null)} />}
      {confirmarOrder && <ConfirmarModal order={confirmarOrder} onClose={() => setConfirmarOrder(null)} />}
      {cancelarOrder && <CancelarModal order={cancelarOrder} onClose={() => setCancelarOrder(null)} />}
    </div>
  );
}
