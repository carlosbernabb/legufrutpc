'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
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
  { key: 'Frutas',               icon: '🍎' },
  { key: 'Verduras',             icon: '🥦' },
  { key: 'Chiles',               icon: '🌶️' },
  { key: 'Abarrotes',            icon: '🛒' },
  { key: 'Desechables y Limpieza', icon: '🧴' },
  { key: 'Carnes',               icon: '🥩' },
];

const UNIT_TYPES = ['kg', 'Gramos', 'Piezas'];
const SALE_TYPES = ['kg', 'Piezas'];

const EMPTY: Omit<Product, 'id'> = {
  name: '', description: '', category: 'Frutas',
  price: 0, unitType: 'kg', coverImage: '', image: '', saleType: 'kg',
};

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
  const [error, setError] = useState('');

  const set = (k: keyof typeof EMPTY, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    if (form.price <= 0) { setError('El precio debe ser mayor a 0'); return; }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...data } = form as Product;
      await onSave(data, initial.id);
      onClose();
    } catch (err) {
      setError('Error al guardar: ' + err);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border text-sm outline-none';
  const inputStyle = { borderColor: '#E5E7EB', background: 'white', color: '#1A1A1A' };
  const labelCls = 'block text-xs font-semibold mb-1';
  const labelStyle = { color: '#374151' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ background: '#2D5016', borderRadius: '1rem 1rem 0 0' }}
        >
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
          {/* Name */}
          <div>
            <label className={labelCls} style={labelStyle}>Nombre *</label>
            <input
              className={inputCls}
              style={inputStyle}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ej: Manzana Golden"
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls} style={labelStyle}>Descripción</label>
            <textarea
              className={inputCls}
              style={inputStyle}
              rows={2}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Descripción breve del producto"
            />
          </div>

          {/* Category + Unit Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Categoría *</label>
              <select
                className={inputCls}
                style={inputStyle}
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.icon} {c.key}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Tipo de unidad *</label>
              <select
                className={inputCls}
                style={inputStyle}
                value={form.unitType}
                onChange={e => set('unitType', e.target.value)}
              >
                {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Price + Sale Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>
                Precio *
                <span className="font-normal ml-1" style={{ color: '#6B7280' }}>
                  ($/
                  {form.unitType === 'Piezas' ? 'pza' : form.unitType === 'Gramos' ? '100g' : 'kg'}
                  )
                </span>
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputCls}
                style={inputStyle}
                value={form.price || ''}
                onChange={e => set('price', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Tipo de venta</label>
              <select
                className={inputCls}
                style={inputStyle}
                value={form.saleType}
                onChange={e => set('saleType', e.target.value)}
              >
                {SALE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Cover Image URL */}
          <div>
            <label className={labelCls} style={labelStyle}>URL imagen principal (coverImage)</label>
            <input
              className={inputCls}
              style={inputStyle}
              value={form.coverImage}
              onChange={e => set('coverImage', e.target.value)}
              placeholder="https://..."
            />
            {form.coverImage && (
              <img
                src={form.coverImage}
                alt="preview"
                className="mt-2 w-16 h-16 rounded-xl object-cover border"
                style={{ borderColor: '#E5E7EB' }}
                onError={e => (e.currentTarget.style.display = 'none')}
              />
            )}
          </div>

          {/* Secondary Image URL */}
          <div>
            <label className={labelCls} style={labelStyle}>URL imagen secundaria (image)</label>
            <input
              className={inputCls}
              style={inputStyle}
              value={form.image}
              onChange={e => set('image', e.target.value)}
              placeholder="https://..."
            />
          </div>

          {error && (
            <p className="text-xs font-medium px-3 py-2 rounded-xl" style={{ background: '#FFEBEE', color: '#C62828' }}>
              {error}
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-2 flex-shrink-0" style={{ borderColor: '#E5E7EB' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
            style={{ borderColor: '#E5E7EB', color: '#374151' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving}
            className="py-2.5 rounded-xl text-sm font-bold text-white transition-opacity"
            style={{ flex: 2, background: saving ? '#81C784' : '#2D5016' }}
          >
            {saving ? 'Guardando...' : initial.id ? '✓ Guardar cambios' : '+ Crear producto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Product Card ───────────────────────────────────────────────────────────

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const unitLabel = product.unitType === 'Piezas' ? '/pza'
    : product.unitType === 'Gramos' ? '/100g' : '/kg';

  return (
    <div
      className="bg-white rounded-2xl border flex items-center gap-3 px-4 py-3"
      style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      {/* Image */}
      {product.coverImage ? (
        <img
          src={product.coverImage}
          alt={product.name}
          className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border"
          style={{ borderColor: '#E5E7EB' }}
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div
          className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl border"
          style={{ background: '#F3F4F6', borderColor: '#E5E7EB' }}
        >
          {CATEGORIES.find(c => c.key === product.category)?.icon ?? '📦'}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate" style={{ color: '#1A1A1A' }}>
          {product.name}
        </div>
        {product.description && (
          <div className="text-xs truncate mt-0.5" style={{ color: '#6B7280' }}>
            {product.description}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: '#E8F5E9', color: '#2E7D32' }}
          >
            ${product.price.toFixed(2)}{unitLabel}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: '#F3F4F6', color: '#374151' }}
          >
            {product.unitType}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onEdit}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
          style={{ background: 'white', color: '#2D5016', borderColor: '#2D5016' }}
        >
          ✏️ Editar
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
          style={{ background: '#FFF5F5', color: '#C62828', borderColor: '#FFCDD2' }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Frutas');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | { data: Omit<Product, 'id'> & { id?: string } }>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setProducts(
        snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function handleSave(data: Omit<Product, 'id'>, id?: string) {
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

  const filtered = products
    .filter(p => p.category === activeCategory)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const countByCategory = (cat: string) =>
    products.filter(p => p.category === cat).length;

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
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2"
          style={{ background: '#2D5016' }}
        >
          + Nuevo producto
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar producto..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2.5 rounded-xl border text-sm outline-none mb-5"
        style={{ borderColor: '#E5E7EB', background: 'white' }}
      />

      {/* Category Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {CATEGORIES.map(c => {
          const active = activeCategory === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setActiveCategory(c.key)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5"
              style={{
                background: active ? '#2D5016' : 'white',
                color: active ? 'white' : '#374151',
                border: `1px solid ${active ? '#2D5016' : '#E5E7EB'}`,
              }}
            >
              <span>{c.icon}</span>
              {c.key}
              <span
                className="px-1.5 py-0.5 rounded-full text-xs ml-0.5"
                style={{
                  background: active ? 'rgba(255,255,255,0.2)' : '#F3F4F6',
                  color: active ? 'white' : '#6B7280',
                }}
              >
                {countByCategory(c.key)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Product List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-4xl mb-3">🥦</div>
            <p style={{ color: '#6B7280' }}>Cargando productos...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">
            {CATEGORIES.find(c => c.key === activeCategory)?.icon ?? '📦'}
          </div>
          <p className="font-semibold mb-1" style={{ color: '#374151' }}>
            {search ? 'Sin resultados' : `Sin productos en ${activeCategory}`}
          </p>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            {search ? 'Prueba con otro término' : 'Haz clic en "+ Nuevo producto" para agregar el primero'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => setModal({ data: p })}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ProductModal
          initial={modal.data}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
