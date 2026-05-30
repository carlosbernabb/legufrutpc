'use client';
import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot,
  getDocs, Timestamp, updateDoc, deleteDoc, doc, serverTimestamp, addDoc,
} from 'firebase/firestore';

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

function statusColor(s: string, ds: string): { bg: string; fg: string; label: string } {
  if (ds === 'Su pedido ha llegado') return { bg: '#E8F5E9', fg: '#2E7D32', label: 'Entregado' };
  if (ds === 'En camino') return { bg: '#E3F2FD', fg: '#1565C0', label: 'En camino' };
  if (ds === 'En preparación') return { bg: '#FFF3E0', fg: '#E65100', label: 'En preparación' };
  if (s === 'Reparto') return { bg: '#F3E5F5', fg: '#6A1B9A', label: 'En reparto' };
  if (s === 'Confirmado') return { bg: '#E8F5E9', fg: '#2E7D32', label: '✓ Confirmado' };
  if (s === 'Cancelado') return { bg: '#FFEBEE', fg: '#C62828', label: '✕ Cancelado' };
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

      {(type === 'negocio' || type === 'conductor') && (
        <div style={{ marginTop: 6 }}>
          <b>ENTREGA:</b><br />
          {order.street} #{order.number}<br />
          Col. {order.neighborhood}, CP {order.postalCode}<br />
          {order.referenceNote && <>Ref: {order.referenceNote}<br /></>}
          {order.driverTag && <>Driver: {order.driverTag}</>}
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <b>PRODUCTOS:</b>
        <div style={{ marginTop: 4 }}>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{item.productName} ({fmtQty(item.grams, item.unitType)})</span>
              <span>{fmtMoney(item.unitPrice)}</span>
            </div>
          ))}
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
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'Confirmado',
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
  onPrint,
  onConfirmar,
  onCancelar,
  onDelete,
}: {
  order: Order;
  onPrint: () => void;
  onConfirmar: () => void;
  onCancelar: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const sc = statusColor(order.status, order.driverStatusText);
  const isConfirmado = order.status === 'Confirmado';
  const isCancelado = order.status === 'Cancelado';
  const isEntregado = order.driverStatusText === 'Su pedido ha llegado';

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
              {fmtMoney(isConfirmado && order.confirmedTotal != null ? order.confirmedTotal : order.total)}
            </div>
            {isConfirmado && order.confirmedTotal != null && Math.abs(order.confirmedTotal - order.total) > 0.01 && (
              <div className="text-xs line-through" style={{ color: '#9CA3AF' }}>{fmtMoney(order.total)}</div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="ml-4 flex flex-col gap-2 flex-shrink-0 no-print">
          {!isConfirmado && !isCancelado && !isEntregado && (
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
  { key: 'Reparto', label: 'En Reparto' },
  { key: 'entregado', label: 'Entregados' },
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

  async function createTestOrder() {
    if (creatingTest) return;
    setCreatingTest(true);
    try {
      // Create a realistic test order
      const orderRef = await addDoc(collection(db, 'orders'), {
        nombrecliente: '🧪 Pedido de Prueba',
        status: 'Pendiente',
        driverTag: '',
        driverStatusText: '',
        subtotal: 247.50,
        shippingFee: 35.00,
        total: 282.50,
        street: 'Av. Insurgentes',
        number: '123',
        neighborhood: 'Col. Centro',
        postalCode: '37000',
        referenceNote: 'Casa blanca, portón azul — PEDIDO DE PRUEBA',
        showorder: true,
        isTest: true,
        createdAt: serverTimestamp(),
        userRef: null,
        location: null,
      });

      // Add realistic test items (ordersitems subcollection)
      const testItems = [
        { productName: 'Manzana Golden',   coverimage: '', unitPrice: 45.00, pricePerKg: 45.00, grams: 1000, unitType: 'Gramos' },
        { productName: 'Fresas',            coverimage: '', unitPrice: 125.00, pricePerKg: 125.00, grams: 500, unitType: 'Gramos' },
        { productName: 'Aguacate Hass',     coverimage: '', unitPrice: 38.00, pricePerKg: 38.00, grams: 3,    unitType: 'Piezas' },
        { productName: 'Espinaca Baby',     coverimage: '', unitPrice: 28.00, pricePerKg: 28.00, grams: 250,  unitType: 'Gramos' },
        { productName: 'Limón Persa',       coverimage: '', unitPrice: 22.00, pricePerKg: 22.00, grams: 750,  unitType: 'Gramos' },
      ];

      for (const item of testItems) {
        await addDoc(collection(db, 'orders', orderRef.id, 'ordersitems'), item);
      }

      alert('✅ Pedido de prueba creado. Aparece arriba en la lista marcado con 🧪. Puedes gestionar su estado, imprimir tickets, verlo en el vaciado y eliminarlo cuando termines.');
    } catch (e) {
      alert('Error al crear pedido de prueba: ' + e);
    } finally {
      setCreatingTest(false);
    }
  }

  const filtered = orders.filter(o => {
    if (filter === 'entregado') return o.driverStatusText === 'Su pedido ha llegado';
    if (filter === 'Reparto') return o.status === 'Reparto' && o.driverStatusText !== 'Su pedido ha llegado';
    if (filter !== 'todos') return o.status === filter;
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
    Cancelado: orders.filter(o => o.status === 'Cancelado').length,
  } as Record<string, number>;

  return (
    <div className="p-6 no-print">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Pedidos</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {orders.length} pedidos totales
          </p>
        </div>
        <button
          onClick={createTestOrder}
          disabled={creatingTest}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
          style={{ borderColor: '#D1D5DB', color: '#6B7280', background: creatingTest ? '#F9FAFB' : 'white' }}
          title="Crea un pedido de prueba con datos realistas para validar el panel"
        >
          {creatingTest ? '⏳ Creando...' : '🧪 Pedido de prueba'}
        </button>
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
