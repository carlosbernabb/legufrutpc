'use client';
import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;
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
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      const ordersWithItems: Order[] = [];
      for (const doc of snap.docs) {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        const itemsSnap = await getDocs(collection(db, 'orders', doc.id, 'ordersitems'));
        const items: OrderItem[] = itemsSnap.docs.map(id => ({
          id: id.id,
          productName: id.data().productName || id.data().nombre || 'Producto',
          quantity: id.data().quantity || id.data().cantidad || 0,
          unit: id.data().unit || id.data().unidad || 'unidad',
          price: id.data().price || id.data().precio || 0,
        }));
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
      o.status === statusFilter;
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

  function printVaciado() {
    const statusLabel =
      statusFilter === 'Pendiente' ? 'Pedidos Pendientes' :
      statusFilter === 'En Reparto' ? 'En Reparto' : 'Todos los Pedidos';

    const aggregatedRows = aggregatedList.map(p =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${p.productName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:18px;font-weight:700;color:#2D5016">${p.totalQuantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666">${p.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px">${p.orderCount} pedido${p.orderCount > 1 ? 's' : ''}</td>
      </tr>`
    ).join('');

    const orderRows = filteredOrders.map(o =>
      `<div style="margin-bottom:16px;border:1px solid #ddd;border-radius:8px;overflow:hidden">
        <div style="background:#f5f5f5;padding:8px 12px;font-weight:600;font-size:13px">#${o.id.slice(-6).toUpperCase()} — ${o.nombrecliente}</div>
        <div style="padding:8px 12px;font-size:13px;color:#555">${o.direccioncliente}</div>
        ${o.items.length === 0
          ? '<div style="padding:8px 12px;color:#999;font-style:italic;font-size:13px">Sin productos</div>'
          : o.items.map(item =>
              `<div style="padding:6px 12px;border-top:1px solid #eee;font-size:13px;display:flex;justify-content:space-between">
                <span>${item.productName}</span>
                <span style="font-weight:600">${item.quantity} ${item.unit}</span>
              </div>`
            ).join('')
        }
        <div style="padding:8px 12px;border-top:1px solid #ddd;text-align:right;font-weight:700;color:#2D5016">Total: $${o.total.toFixed(2)}</div>
      </div>`
    ).join('');

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Vaciado ${formatShortDate(selectedDateObj)}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#1a1a1a}
        h1{color:#2D5016;margin:0 0 4px}
        .subtitle{color:#666;font-size:14px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;margin-bottom:32px}
        th{background:#2D5016;color:white;padding:10px 12px;text-align:left;font-size:13px}
        th:nth-child(2){text-align:center}
        @media print{button{display:none}}
      </style>
    </head><body>
      <h1>Vaciado de Compras</h1>
      <div class="subtitle">${formatDate(selectedDateObj)} &bull; ${statusLabel} &bull; ${totalOrders} pedido${totalOrders !== 1 ? 's' : ''}</div>
      <h2 style="font-size:15px;color:#2D5016;margin:0 0 10px">Resumen por Producto</h2>
      <table>
        <thead><tr>
          <th>Producto</th><th>Total</th><th>Unidad</th><th>Pedidos</th>
        </tr></thead>
        <tbody>${aggregatedRows}</tbody>
      </table>
      <h2 style="font-size:15px;color:#2D5016;margin:0 0 10px">Desglose por Pedido</h2>
      ${orderRows || '<p style="color:#999;font-style:italic">Sin pedidos para esta fecha.</p>'}
    </body></html>`;

    const win = window.open('', '_blank', 'width=800,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  const statusOptions: { value: typeof statusFilter; label: string; color: string }[] = [
    { value: 'Pendiente', label: 'Pendientes', color: '#E65100' },
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
          onClick={printVaciado}
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
              <span className="text-xl">🛒</span>
              <div>
                <div className="text-lg font-bold" style={{ color: '#2D5016' }}>{totalItems}</div>
                <div className="text-xs" style={{ color: '#6B7280' }}>Unidades totales</div>
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
                          <th className="text-center px-4 py-3 text-xs font-semibold text-white">Total</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-white">Unidad</th>
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
                            <td className="px-4 py-3 text-center">
                              <span className="text-lg font-bold" style={{ color: '#2D5016' }}>
                                {p.totalQuantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm" style={{ color: '#6B7280' }}>{p.unit}</td>
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
                            TOTAL
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-lg font-bold" style={{ color: '#2D5016' }}>
                              {totalItems}
                            </span>
                          </td>
                          <td colSpan={2} className="px-4 py-3 text-sm" style={{ color: '#6B7280' }}>
                            en {aggregatedList.length} producto{aggregatedList.length !== 1 ? 's' : ''}
                          </td>
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
                                      {item.quantity} {item.unit}
                                    </span>
                                    <span className="text-xs" style={{ color: '#9CA3AF' }}>
                                      ${(item.price * item.quantity).toFixed(2)}
                                    </span>
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
    </div>
  );
}
