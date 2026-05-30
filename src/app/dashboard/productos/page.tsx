'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from 'firebase/firestore';

// ── Types ──────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  unitType: string;
  coverImage: string;
  image: string;
  saleType: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'Frutas',                icon: '🍎', color: '#E8F5E9', accent: '#2E7D32' },
  { key: 'Verduras',              icon: '🥦', color: '#F1F8E9', accent: '#558B2F' },
  { key: 'Chiles',                icon: '🌶️', color: '#FBE9E7', accent: '#BF360C' },
  { key: 'Abarrotes',             icon: '🛒', color: '#FFF8E1', accent: '#F57F17' },
  { key: 'Desechables y Limpieza',icon: '🧴', color: '#E3F2FD', accent: '#1565C0' },
  { key: 'Carnes',                icon: '🥩', color: '#FCE4EC', accent: '#880E4F' },
];

const UNIT_TYPES  = ['kg', 'Gramos', 'Piezas'];
const SALE_TYPES  = ['kg', 'Piezas'];

const EMPTY: Omit<Product, 'id'> = {
  name: '', description: '', category: 'Frutas',
  price: 0, unitType: 'kg', coverImage: '', image: '', saleType: 'kg',
};

function unitLabel(unitType: string) {
  if (unitType === 'Piezas') return '/pza';
  if (unitType === 'Gramos')  return '/100g';
  return '/kg';
}

// ── Product Form Modal ─────────────────────────────────────────────────────

function ProductModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Omit<Product, 'id'> & { id?: string };
  onSave: (data: Omit<Product, 'id'>, id?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof EMPTY, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim())  { setError('El nombre es obligatorio'); return; }
    if (form.price <= 0)    { setError('El precio debe ser mayor a 0'); return; }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...data } = form as Product;
      await onSave(data, initial.id);
      onClose();
    } catch (err) {
      setError('Error al guardar: ' + err);
    } finally {
      setSaving(false);
    }
  }

  const inp = 'w-full px-3 py-2.5 rounded-xl border text-sm outline-none';
  const inpS = { borderColor: '#E5E7EB', background: 'white', color: '#1A1A1A' };
  const lbl  = 'block text-xs font-semibold mb-1 text-gray-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col"
        style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ background: '#2D5016', borderRadius: '1rem 1rem 0 0' }}>
          <div>
            <h3 className="font-bold text-white text-base">
              {initial.id ? 'Editar producto' : 'Nuevo producto'}
            </h3>
            {initial.id && (
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {initial.name}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-white text-xl opacity-70 hover:opacity-100">✕</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div>
            <label className={lbl}>Nombre *</label>
            <input className={inp} style={inpS}
              value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Ej: Manzana Golden" />
          </div>

          <div>
            <label className={lbl}>Descripción</label>
            <textarea className={inp} style={inpS} rows={2}
              value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Descripción breve" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Categoría *</label>
              <select className={inp} style={inpS}
                value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.icon} {c.key}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Tipo de unidad *</label>
              <select className={inp} style={inpS}
                value={form.unitType} onChange={e => set('unitType', e.target.value)}>
                {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>
                Precio * <span className="font-normal text-gray-400">
                  (${unitLabel(form.unitType)})
                </span>
              </label>
              <input type="number" min={0} step={0.01} className={inp} style={inpS}
                value={form.price || ''} onChange={e => set('price', parseFloat(e.target.value) || 0)}
                placeholder="0.00" />
            </div>
            <div>
              <label className={lbl}>Tipo de venta</label>
              <select className={inp} style={inpS}
                value={form.saleType} onChange={e => set('saleType', e.target.value)}>
                {SALE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>URL imagen principal (coverImage)</label>
            <input className={inp} style={inpS}
              value={form.coverImage} onChange={e => set('coverImage', e.target.value)}
              placeholder="https://..." />
            {form.coverImage && (
              <img src={form.coverImage} alt="preview"
                className="mt-2 w-16 h-16 rounded-xl object-cover border"
                style={{ borderColor: '#E5E7EB' }}
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            )}
          </div>

          <div>
            <label className={lbl}>URL imagen secundaria (image)</label>
            <input className={inp} style={inpS}
              value={form.image} onChange={e => set('image', e.target.value)}
              placeholder="https://..." />
          </div>

          {error && (
            <p className="text-xs font-medium px-3 py-2 rounded-xl"
              style={{ background: '#FFEBEE', color: '#C62828' }}>{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-2 flex-shrink-0" style={{ borderColor: '#E5E7EB' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
            style={{ borderColor: '#E5E7EB', color: '#374151' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving}
            className="py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ flex: 2, background: saving ? '#81C784' : '#2D5016' }}>
            {saving ? 'Guardando...' : initial.id ? '✓ Guardar cambios' : '+ Crear producto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Product Card — app-like ────────────────────────────────────────────────

function ProductCard({
  product, catColor, catAccent,
  onEdit, onDelete,
}: {
  product: Product;
  catColor: string;
  catAccent: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ul = unitLabel(product.unitType);
  const catInfo = CATEGORIES.find(c => c.key === product.category);

  return (
    <div className="bg-white rounded-2xl border flex overflow-hidden"
      style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>

      {/* Image area */}
      <div className="w-28 flex-shrink-0 flex items-center justify-center relative"
        style={{ background: catColor, minHeight: 96 }}>
        {product.coverImage ? (
          <img src={product.coverImage} alt={product.name}
            className="w-full h-full object-cover"
            style={{ minHeight: 96, maxHeight: 120 }}
            onError={e => {
              e.currentTarget.style.display = 'none';
              (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex';
            }} />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center text-5xl"
          style={{ display: product.coverImage ? 'none' : 'flex' }}>
          {catInfo?.icon ?? '📦'}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3 flex flex-col justify-between min-w-0">
        <div>
          <div className="font-bold text-base truncate" style={{ color: '#1A1A1A' }}>
            {product.name}
          </div>
          {product.description && (
            <div className="text-xs mt-0.5 line-clamp-2" style={{ color: '#6B7280' }}>
              {product.description}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Price badge — matches app style */}
          <div className="flex items-baseline gap-0.5 rounded-xl px-3 py-1"
            style={{ background: catColor }}>
            <span className="text-lg font-extrabold" style={{ color: catAccent }}>
              ${product.price.toFixed(2)}
            </span>
            <span className="text-xs font-semibold" style={{ color: catAccent }}>
              {ul}
            </span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: '#F3F4F6', color: '#374151' }}>
            {product.unitType}
          </span>
          {product.saleType && product.saleType !== product.unitType && (
            <span className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: '#FFF3E0', color: '#E65100' }}>
              Venta: {product.saleType}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 justify-center pr-4 flex-shrink-0">
        <button onClick={onEdit}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
          style={{ background: 'white', color: '#2D5016', borderColor: '#2D5016' }}>
          ✏️ Editar
        </button>
        <button onClick={onDelete}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
          style={{ background: '#FFF5F5', color: '#C62828', borderColor: '#FFCDD2' }}>
          🗑️ Borrar
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState('');
  const [activeCategory, setActiveCat] = useState('Frutas');
  const [search, setSearch]         = useState('');
  const [modal, setModal]           = useState<null | { data: Omit<Product,'id'> & { id?: string } }>(null);

  useEffect(() => {
    // orderBy removed — sort client-side to avoid index requirements
    const unsub = onSnapshot(
      collection(db, 'products'),
      snap => {
        setProducts(
          snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Product,'id'>) }))
        );
        setLoading(false);
        setLoadError('');
      },
      err => {
        setLoadError('Error al cargar: ' + err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  async function handleSave(data: Omit<Product,'id'>, id?: string) {
    if (id) {
      await updateDoc(doc(db, 'products', id), { ...data });
    } else {
      await addDoc(collection(db, 'products'), {
        ...data,
        createdTime: serverTimestamp(),
      });
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    await deleteDoc(doc(db, 'products', product.id));
  }

  const catInfo = CATEGORIES.find(c => c.key === activeCategory)!;

  const filtered = products
    .filter(p => p.category === activeCategory)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const countByCategory = (cat: string) => products.filter(p => p.category === cat).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Productos</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {products.length} productos en total
          </p>
        </div>
        <button
          onClick={() => setModal({ data: { ...EMPTY, category: activeCategory } })}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 shadow"
          style={{ background: '#2D5016' }}>
          + Nuevo producto
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input type="text" placeholder="Buscar producto..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{ borderColor: '#E5E7EB', background: 'white' }} />
      </div>

      {/* Category Tabs — app-style horizontal scroll */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {CATEGORIES.map(c => {
          const active = activeCategory === c.key;
          return (
            <button key={c.key}
              onClick={() => setActiveCat(c.key)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all"
              style={{
                background: active ? c.accent : 'white',
                color: active ? 'white' : '#374151',
                border: `1.5px solid ${active ? c.accent : '#E5E7EB'}`,
                boxShadow: active ? `0 2px 8px ${c.accent}44` : 'none',
              }}>
              <span className="text-base">{c.icon}</span>
              {c.key}
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{
                  background: active ? 'rgba(255,255,255,0.25)' : '#F3F4F6',
                  color: active ? 'white' : '#6B7280',
                }}>
                {countByCategory(c.key)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category header strip — like the app */}
      <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl"
        style={{ background: catInfo.color }}>
        <span className="text-2xl">{catInfo.icon}</span>
        <div>
          <div className="font-bold text-base" style={{ color: catInfo.accent }}>
            {catInfo.key}
          </div>
          <div className="text-xs" style={{ color: catInfo.accent + 'aa' }}>
            {filtered.length} producto{filtered.length !== 1 ? 's' : ''} · orden A–Z
          </div>
        </div>
      </div>

      {/* Error */}
      {loadError && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#FFEBEE', color: '#C62828' }}>
          ⚠️ {loadError}
        </div>
      )}

      {/* Product List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-5xl mb-3 animate-bounce">{catInfo.icon}</div>
            <p style={{ color: '#6B7280' }}>Cargando productos...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-3">{catInfo.icon}</div>
          <p className="font-semibold text-base mb-1" style={{ color: '#374151' }}>
            {search ? 'Sin resultados' : `Sin productos en ${activeCategory}`}
          </p>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            {search
              ? 'Prueba con otro término'
              : 'Haz clic en "+ Nuevo producto" para agregar el primero'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p}
              catColor={catInfo.color} catAccent={catInfo.accent}
              onEdit={() => setModal({ data: p })}
              onDelete={() => handleDelete(p)} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ProductModal
          initial={modal.data}
          onSave={handleSave}
          onClose={() => setModal(null)} />
      )}
    </div>
  );
}
