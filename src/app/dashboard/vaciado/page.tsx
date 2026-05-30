'use client';
import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;   // raw grams or piece count
  unit: string;       // 'g' or 'pza'
  price: number;      // pricePerKg
  unitPrice: number;  // pre-calculated line total
}

interface Order {
  id: string;
  nombrecliente: string;
  direccioncliente: string;
  total: number;
  status: string;
  createdAt: Date | null;
  items: OrderItem[];
}

interface AggregatedProduct {
  productName: string;
  unit: string;
  totalQuantity: number;
  orderCount: number;
  orders: { orderId: string; customerName: string; quantity: number }[];
}

function formatQty(qty: number, unit: string): string {
  if (unit === 'pza') return `${qty} pza${qty !== 1 ? 's' : ''}`;
  if (qty >= 1000) {
    const kg = qty / 1000;
    return `${Number.isInteger(kg) ? kg : parseFloat(kg.toFixed(3))} kg`;
  }
  return `${qty} g`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function VaciadoPage() {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(toInputDate(new Date()));
  const [statusFilter, setStatusFilter] = useState<'Pendiente' | 'En Reparto' | 'Todos'>('Pendiente');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [printOpen, setPrintOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      const ordersWithItems: Order[] = [];
      for (const doc of snap.docs) {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        const itemsSnap = await getDocs(collection(db, 'orders', doc.id, 'ordersitems'));
        const items: OrderItem[] = itemsSnap.docs.map(itemDoc => {
          const d = itemDoc.data();
          const rawGrams: number = d.grams ?? 0;
          const unitType: string = d.unitType ?? 'g';
          const isPieza = unitType === 'Piezas';
          return {
            id: itemDoc.id,
            productName: d.productName || 'Producto',
            quantity: rawGrams,
            unit: isPieza ? 'pza' : 'g',
            price: d.pricePerKg ?? 0,
            unitPrice: d.confirmedUnitPrice ?? d.unitPrice ?? 0,
          };
        });
        ordersWithItems.push({
          id: doc.id,
          nombrecliente: data.nombrecliente || data.customerName || 'Cliente',
          direccioncliente: data.direccioncliente || data.address || '',
          total: data.total || 0,
          status: data.status || 'Pendiente',
          createdAt,
          items,
        });
      }
      setAllOrders(ordersWithItems);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const selectedDateObj = new Date(selectedDate + 'T00:00:00');

  const filteredOrders = allOrders.filter(o => {
    const matchDate = o.createdAt ? isSameDay(o.createdAt, selectedDateObj) : false;
    const matchStatus =
      statusFilter === 'Todos' ? true :
      statusFilter === 'En Reparto' ? o.status === 'En Reparto' || o.status === 'Reparto' :
      // 'Pendiente' tab = needs to be bought → includes both Pendiente AND Confirmado
      o.status === 'Pendiente' || o.status === 'Confirmado';
    return matchDate && matchStatus;
  });

  // Aggregate products
  const aggregated: Record<string, AggregatedProduct> = {};
  for (const order of filteredOrders) {
    for (const item of order.items) {
      const key = `${item.productName}__${item.unit}`;
      if (!aggregated[key]) {
        aggregated[key] = {
          productName: item.productName,
          unit: item.unit,
          totalQuantity: 0,
          orderCount: 0,
          orders: [],
        };
      }
      aggregated[key].totalQuantity += item.quantity;
      aggregated[key].orderCount += 1;
      aggregated[key].orders.push({
        orderId: order.id.slice(-6).toUpperCase(),
        customerName: order.nombrecliente,
        quantity: item.quantity,
      });
    }
  }
  const aggregatedList = Object.values(aggregated).sort((a, b) =>
    a.productName.localeCompare(b.productName)
  );

  const totalItems = aggregatedList.reduce((s, p) => s + p.totalQuantity, 0);
  const totalOrders = filteredOrders.length;

  function toggleOrder(id: string) {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const SEP  = '--------------------------------';
  const SEP2 = '================================';

  function padRow(left: string, right: string, width = 32): string {
    const maxLeft = width - right.length - 1;
    const l = left.length > maxLeft ? left.slice(0, maxLeft - 1) + '.' : left;
    return l + ' '.repeat(width - l.length - right.length) + right;
  }

  function buildReceiptText(): string {
    const statusLabel =
      statusFilter === 'Pendiente' ? 'Por preparar' :
      statusFilter === 'En Reparto' ? 'En Reparto' : 'Todos';

    const productLines = aggregatedList.map(p => {
      const qty = formatQty(p.totalQuantity, p.unit);
      return [
        padRow(p.productName, qty),
        `  (${p.orderCount} pedido${p.orderCount !== 1 ? 's' : ''})`,
        SEP,
      ].join('\n');
    }).join('\n');

    const orderLines = filteredOrders.map(o => {
      const header = `#${o.id.slice(-6).toUpperCase()} ${o.nombrecliente}`;
      const items = o.items.length === 0
        ? '  (sin productos)'
        : o.items.map(item =>
            '  ' + padRow(item.productName, formatQty(item.quantity, item.unit), 30)
          ).join('\n');
      const total = padRow('TOTAL:', `$${o.total.toFixed(2)}`);
      return [header, items, SEP, total, SEP].join('\n');
    }).join('\n');

    const totalVentas = filteredOrders.reduce((s, o) => s + o.total, 0);

    return [
      SEP2,
      '         LEGUFRUT ADMIN         ',
      '       VACIADO DE COMPRAS       ',
      SEP2,
      `Fecha  : ${formatShortDate(selectedDateObj)}`,
      `Estado : ${statusLabel}`,
      `Pedidos: ${totalOrders}`,
      `Prods  : ${aggregatedList.length} distintos`,
      SEP2,
      '          QUE COMPRAR           ',
      SEP2,
      aggregatedList.length === 0 ? '  (sin productos)' : productLines,
      SEP2,
      '      DESGLOSE POR PEDIDO       ',
      SEP2,
      filteredOrders.length === 0 ? '  (sin pedidos)' : orderLines,
      SEP2,
      padRow('TOTAL VENTAS:', `$${totalVentas.toFixed(2)}`),
      SEP2,
    ].join('\n');
  }

  function doPrint() {
    const text = buildReceiptText();
    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Vaciado ${formatShortDate(selectedDateObj)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          line-height: 1.5;
          width: 300px;
          padding: 8px 4px;
          color: #000;
          background: #fff;
        }
        pre {
          white-space: pre-wrap;
          word-break: break-word;
          font-family: inherit;
          font-size: inherit;
        }
        @media print {
          body { margin: 0; padding: 4px; }
          @page { margin: 4mm; }
        }
      </style>
    </head><body><pre>${text}</pre></body></html>`;

    const win = window.open('', '_blank', 'width=360,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  const statusOptions: { value: typeof statusFilter; label: string; color: string }[] = [
    { value: 'Pendiente', label: 'Por preparar', color: '#E65100' },
    { value: 'En Reparto', label: 'En Reparto', color: '#1565C0' },
    { value: 'Todos', label: 'Todos', color: '#424242' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Vaciado de Compras</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            Qué productos necesitas comprar según los pedidos
          </p>
        </div>
        <button
          onClick={() => setPrintOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white no-print"
          style={{ background: '#2D5016' }}
        >
          🖨️ Imprimir vaciado
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border p-4 mb-6 flex flex-wrap gap-4 items-center no-print"
        style={{ borderColor: '#E5E7EB' }}>
        {/* Date picker */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: '#374151' }}>Fecha:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-sm outline-none"
            style={{ borderColor: '#E5E7EB', color: '#1A1A1A' }}
          />
        </div>
        {/* Status filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: '#374151' }}>Estado:</span>
          <div className="flex gap-1">
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: statusFilter === opt.value ? opt.color : '#F3F4F6',
                  color: statusFilter === opt.value ? 'white' : '#6B7280',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-sm">Cargando pedidos...</p>
        </div>
      ) : (
        <>
          {/* Summary chips */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <div className="bg-white rounded-xl border px-4 py-3 flex items-center gap-2"
              style={{ borderColor: '#E5E7EB' }}>
              <span className="text-xl">📋</span>
              <div>
                <div className="text-lg font-bold" style={{ color: '#2D5016' }}>{totalOrders}</div>
                <div className="text-xs" style={{ color: '#6B7280' }}>Pedidos</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border px-4 py-3 flex items-center gap-2"
              style={{ borderColor: '#E5E7EB' }}>
              <span className="text-xl">📦</span>
              <div>
                <div className="text-lg font-bold" style={{ color: '#2D5016' }}>{aggregatedList.length}</div>
                <div className="text-xs" style={{ color: '#6B7280' }}>Productos distintos</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border px-4 py-3 flex items-center gap-2"
              style={{ borderColor: '#E5E7EB' }}>
              <span className="text-xl">💰</span>
              <div>
                <div className="text-lg font-bold" style={{ color: '#2D5016' }}>
                  ${filteredOrders.reduce((s, o) => s + o.total, 0).toFixed(2)}
                </div>
                <div className="text-xs" style={{ color: '#6B7280' }}>Total ventas</div>
              </div>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#E5E7EB' }}>
              <div className="text-5xl mb-3">📭</div>
              <p className="font-medium" style={{ color: '#374151' }}>No hay pedidos para esta fecha</p>
              <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
                Selecciona otra fecha o cambia el filtro de estado
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Aggregated table */}
              <div>
                <h2 className="text-base font-bold mb-3" style={{ color: '#1A1A1A' }}>
                  Resumen — Qué comprar
                </h2>
                <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
                  {aggregatedList.length === 0 ? (
                    <div className="p-8 text-center text-sm" style={{ color: '#9CA3AF' }}>
                      Los pedidos no tienen productos registrados
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: '#2D5016' }}>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-white">Producto</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-white">Cantidad total</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-white">Pedidos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aggregatedList.map((p, i) => (
                          <tr key={`${p.productName}-${p.unit}`}
                            style={{ background: i % 2 === 0 ? '#FAFAFA' : 'white' }}>
                            <td className="px-4 py-3 text-sm font-medium" style={{ color: '#1A1A1A' }}>
                              {p.productName}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-base font-bold" style={{ color: '#2D5016' }}>
                                {formatQty(p.totalQuantity, p.unit)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ background: '#E8F5E9', color: '#2D5016' }}>
                                {p.orderCount}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#F3F4F6', borderTop: '2px solid #E5E7EB' }}>
                          <td className="px-4 py-3 text-sm font-bold" style={{ color: '#374151' }}>
                            {aggregatedList.length} producto{aggregatedList.length !== 1 ? 's' : ''} distintos
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>

              {/* Per-order breakdown */}
              <div>
                <h2 className="text-base font-bold mb-3" style={{ color: '#1A1A1A' }}>
                  Desglose — Pedido por pedido
                </h2>
                <div className="space-y-3">
                  {filteredOrders.map(order => {
                    const expanded = expandedOrders.has(order.id);
                    return (
                      <div key={order.id} className="bg-white rounded-2xl border overflow-hidden"
                        style={{ borderColor: '#E5E7EB' }}>
                        {/* Card header */}
                        <button
                          onClick={() => toggleOrder(order.id)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                              style={{ background: '#F3F4F6', color: '#374151' }}>
                              #{order.id.slice(-6).toUpperCase()}
                            </span>
                            <div>
                              <div className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                                {order.nombrecliente}
                              </div>
                              <div className="text-xs" style={{ color: '#9CA3AF' }}>
                                {order.items.length} producto{order.items.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold" style={{ color: '#2D5016' }}>
                              ${order.total.toFixed(2)}
                            </span>
                            <span style={{ color: '#9CA3AF' }}>{expanded ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {/* Expanded items */}
                        {expanded && (
                          <div style={{ borderTop: '1px solid #F3F4F6' }}>
                            {/* Address */}
                            {order.direccioncliente && (
                              <div className="px-4 py-2 text-xs flex items-center gap-1.5"
                                style={{ background: '#FFF8F0', color: '#92400E', borderBottom: '1px solid #FDE68A' }}>
                                <span>📍</span> {order.direccioncliente}
                              </div>
                            )}
                            {/* Items */}
                            {order.items.length === 0 ? (
                              <div className="px-4 py-3 text-sm italic" style={{ color: '#9CA3AF' }}>
                                Sin productos
                              </div>
                            ) : (
                              order.items.map(item => (
                                <div key={item.id}
                                  className="flex items-center justify-between px-4 py-2.5"
                                  style={{ borderBottom: '1px solid #F9FAFB' }}>
                                  <span className="text-sm" style={{ color: '#374151' }}>
                                    {item.productName}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold" style={{ color: '#2D5016' }}>
                                      {formatQty(item.quantity, item.unit)}
                                    </span>
                                    {item.unitPrice > 0 && (
                                      <span className="text-xs" style={{ color: '#9CA3AF' }}>
                                        ${item.unitPrice.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Print Preview Modal ──────────────────────────────────────────── */}
      {printOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setPrintOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center justify-between flex-shrink-0"
              style={{ background: '#2D5016', borderRadius: '1rem 1rem 0 0' }}
            >
              <div>
                <h3 className="font-bold text-white text-base">🖨️ Vista previa — Ticket térmico</h3>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Vaciado · {formatShortDate(selectedDateObj)} · {totalOrders} pedido{totalOrders !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setPrintOpen(false)}
                className="text-white text-xl opacity-70 hover:opacity-100"
              >✕</button>
            </div>

            {/* Receipt preview */}
            <div
              className="overflow-y-auto flex-1 flex justify-center py-6 px-4"
              style={{ background: '#E8E8E8' }}
            >
              {/* Paper receipt card */}
              <div style={{
                background: 'white',
                width: 280,
                padding: '14px 10px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                borderRadius: 2,
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: 11,
                lineHeight: 1.55,
                color: '#000',
                flexShrink: 0,
              }}>
                <pre style={{
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}>
                  {buildReceiptText()}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-4 border-t flex gap-3 flex-shrink-0"
              style={{ borderColor: '#E5E7EB' }}
            >
              <button
                onClick={() => setPrintOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                style={{ borderColor: '#E5E7EB', color: '#374151' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { doPrint(); setPrintOpen(false); }}
                className="py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ flex: 2, background: '#2D5016' }}
              >
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
