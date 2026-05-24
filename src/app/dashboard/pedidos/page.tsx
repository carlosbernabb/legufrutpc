'use client';
import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot,
  getDocs, Timestamp,
} from 'firebase/firestore';

// ── Types ──────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  productName: string;
  coverimage: string;
  unitPrice: number;
  pricePerKg: number;
  grams: number;
  unitType: string; // 'Gramos' | 'Piezas'
}

interface Order {
  id: string;
  nombrecliente: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  status: string;
  driverTag: string;
  driverStatusText: string;
  street: string;
  number: string;
  neighborhood: string;
  postalCode: string;
  referenceNote: string;
  createdAt: Date | null;
  items: OrderItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: Date | null) {
  if (!d) return '—';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function statusColor(s: string, ds: string): { bg: string; fg: string; label: string } {
  if (ds === 'Su pedido ha llegado') return { bg: '#E8F5E9', fg: '#2E7D32', label: 'Entregado' };
  if (ds === 'En camino') return { bg: '#E3F2FD', fg: '#1565C0', label: 'En camino' };
  if (ds === 'En preparación') return { bg: '#FFF3E0', fg: '#E65100', label: 'En preparación' };
  if (s === 'Reparto') return { bg: '#F3E5F5', fg: '#6A1B9A', label: 'En reparto' };
  return { bg: '#F3F4F6', fg: '#374151', label: 'Pendiente' };
}

// ── Ticket print component (rendered in DOM, shown only on print) ──────────

function TicketContent({ order, type }: { order: Order; type: 'negocio' | 'cliente' | 'conductor' }) {
  const titles = {
    negocio: '🏪 TICKET — NEGOCIO',
    cliente: '🧾 TICKET — CLIENTE',
    conductor: '🚚 TICKET — CONDUCTOR',
  };

  return (
    <div className="ticket-block" style={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 300 }}>
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14, marginBottom: 8 }}>
        {titles[type]}
      </div>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        ─────────────────────────
      </div>
      <div><b>LeguFrut</b></div>
      <div>Pedido: #{order.id.substring(0, 10)}</div>
      <div>Fecha: {fmtDate(order.createdAt)}</div>
      <div style={{ marginTop: 6 }}>
        <b>CLIENTE:</b> {order.nombrecliente || 'Sin nombre'}
      </div>

      {/* Dirección — para negocio y conductor */}
      {(type === 'negocio' || type === 'conductor') && (
        <div style={{ marginTop: 6 }}>
          <b>ENTREGA:</b><br />
          {order.street} #{order.number}<br />
          Col. {order.neighborhood}, CP {order.postalCode}<br />
          {order.referenceNote && <>Ref: {order.referenceNote}<br /></>}
          {order.driverTag && <>Driver: {order.driverTag}</>}
        </div>
      )}

      {/* Items */}
      <div style={{ marginTop: 8 }}>
        <b>PRODUCTOS:</b>
        <div style={{ marginTop: 4 }}>
          {order.items.map((item, i) => {
            const qty = item.unitType === 'Gramos'
              ? `${item.grams}g`
              : `${item.grams} pzas`;
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.productName} ({qty})</span>
                <span>{fmtMoney(item.unitPrice)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 6, borderTop: '1px solid #999', paddingTop: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal:</span><span>{fmtMoney(order.subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Envío:</span><span>{fmtMoney(order.shippingFee)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: 4 }}>
          <span>TOTAL:</span><span>{fmtMoney(order.total)}</span>
        </div>
      </div>

      {/* Status */}
      {type === 'negocio' && (
        <div style={{ marginTop: 6 }}>
          <b>Estado:</b> {order.driverStatusText || order.status}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        ─────────────────────────
      </div>
    </div>
  );
}

// ── Print Modal ────────────────────────────────────────────────────────────

function PrintModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [tab, setTab] = useState<'negocio' | 'cliente' | 'conductor'>('negocio');

  function printTicket(type: 'negocio' | 'cliente' | 'conductor' | 'todos') {
    const el = document.getElementById(type === 'todos' ? 'print-todos' : `print-${type}`);
    if (!el) return;
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>Ticket LeguFrut</title>
      <style>
        body { font-family: monospace; font-size: 12px; margin: 16px; }
        .ticket-block { margin-bottom: 24px; max-width: 300px; }
        .ticket-separator { border-top: 2px dashed #999; margin: 16px 0; }
      </style>
      </head><body>${el.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ background: '#2D5016', borderColor: '#1a3a08' }}>
          <div>
            <h3 className="font-bold text-white text-base">Imprimir Ticket</h3>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Pedido #{order.id.substring(0, 10)} — {order.nombrecliente || 'Sin nombre'}
            </p>
          </div>
          <button onClick={onClose} className="text-white text-xl leading-none opacity-70 hover:opacity-100">✕</button>
        </div>

        {/* Tabs */}
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

        {/* Preview */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 340 }}>
          <div
            className="mx-auto rounded-lg p-4 text-xs"
            style={{ fontFamily: 'monospace', background: '#FAFAFA', border: '1px dashed #D1D5DB', maxWidth: 280 }}
          >
            <TicketContent order={order} type={tab} />
          </div>
        </div>

        {/* Hidden print targets */}
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

        {/* Actions */}
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

// ── Order Card ─────────────────────────────────────────────────────────────

function OrderCard({ order, onPrint }: { order: Order; onPrint: () => void }) {
  const [open, setOpen] = useState(false);
  const sc = statusColor(order.status, order.driverStatusText);

  return (
    <div
      className="bg-white rounded-2xl border mb-4"
      style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
    >
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
              <span
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: '#F3F4F6', color: '#374151' }}
              >
                {order.driverTag}
              </span>
            )}
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
          <div className="text-2xl font-extrabold mt-1" style={{ color: '#2E7D32' }}>
            {fmtMoney(order.total)}
          </div>
        </div>
        <button
          onClick={onPrint}
          className="ml-4 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all no-print"
          style={{ background: '#2D5016', color: 'white' }}
        >
          🖨️ Ticket
        </button>
      </div>

      {/* Address */}
      <div className="px-5 pb-3">
        <div
          className="rounded-xl p-3 text-sm"
          style={{ background: '#F0FBF0', border: '1px solid #BBDFBB' }}
        >
          <div className="flex items-center gap-1 mb-1">
            <span style={{ color: '#2E7D32', fontSize: 11, fontWeight: 600 }}>📍 Dirección de entrega</span>
          </div>
          <div style={{ color: '#1A1A1A', fontWeight: 500 }}>
            {order.street} #{order.number}
          </div>
          <div style={{ color: '#374151' }}>Col. {order.neighborhood}, CP {order.postalCode}</div>
          {order.referenceNote && (
            <div style={{ color: '#6B7280', fontStyle: 'italic' }}>Ref: {order.referenceNote}</div>
          )}
        </div>
      </div>

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
                    <img
                      src={item.coverimage}
                      alt={item.productName}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>
                      {item.productName}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                      {item.unitType === 'Gramos'
                        ? `${item.grams} g · ${fmtMoney(item.pricePerKg)}/kg`
                        : `${item.grams} pzas`}
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
  { key: 'Reparto', label: 'En Reparto' },
  { key: 'entregado', label: 'Entregados' },
];

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

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
          nombrecliente: data.nombrecliente ?? '',
          subtotal: data.subtotal ?? 0,
          shippingFee: data.shippingFee ?? 0,
          total: data.total ?? 0,
          status: data.status ?? '',
          driverTag: data.driverTag ?? '',
          driverStatusText: data.driverStatusText ?? '',
          street: data.street ?? '',
          number: data.number ?? '',
          neighborhood: data.neighborhood ?? '',
          postalCode: data.postalCode ?? '',
          referenceNote: data.referenceNote ?? '',
          createdAt: ts instanceof Timestamp ? ts.toDate() : null,
          items: [] as OrderItem[],
        } as Order;
      });

      // Load items for all orders
      const withItems = await Promise.all(
        raw.map(async o => ({ ...o, items: await loadItems(o.id) }))
      );
      setOrders(withItems);
      setLoading(false);
    });
    return () => unsub();
  }, [loadItems]);

  const filtered = orders.filter(o => {
    if (filter === 'entregado') return o.driverStatusText === 'Su pedido ha llegado';
    if (filter === 'Reparto') return o.status === 'Reparto' && o.driverStatusText !== 'Su pedido ha llegado';
    if (filter !== 'todos') return o.status === filter;
    if (search) {
      const s = search.toLowerCase();
      return (
        o.nombrecliente.toLowerCase().includes(s) ||
        o.id.toLowerCase().includes(s) ||
        o.street.toLowerCase().includes(s)
      );
    }
    return true;
  }).filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.nombrecliente.toLowerCase().includes(s) ||
      o.id.toLowerCase().includes(s) ||
      o.street.toLowerCase().includes(s)
    );
  });

  const counts = {
    todos: orders.length,
    Pendiente: orders.filter(o => o.status === 'Pendiente').length,
    Reparto: orders.filter(o => o.status === 'Reparto' && o.driverStatusText !== 'Su pedido ha llegado').length,
    entregado: orders.filter(o => o.driverStatusText === 'Su pedido ha llegado').length,
  } as Record<string, number>;

  return (
    <div className="p-6 no-print">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Pedidos</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
          {orders.length} pedidos totales
        </p>
      </div>

      {/* Search */}
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

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: filter === f.key ? '#2D5016' : 'white',
              color: filter === f.key ? 'white' : '#374151',
              border: `1px solid ${filter === f.key ? '#2D5016' : '#E5E7EB'}`,
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

      {/* List */}
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
          <OrderCard key={o.id} order={o} onPrint={() => setPrintOrder(o)} />
        ))
      )}

      {/* Print modal */}
      {printOrder && (
        <PrintModal order={printOrder} onClose={() => setPrintOrder(null)} />
      )}
    </div>
  );
}
