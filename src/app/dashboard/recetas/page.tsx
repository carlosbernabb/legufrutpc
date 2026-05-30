'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from 'firebase/firestore';

// ── Types ──────────────────────────────────────────────────────────────────

interface Ingredient {
  name: string;
  qty: number;
  unit: string;
}

interface Recipe {
  id: string;
  name: string;
  emoji: string;
  colorHex: string;
  servings: number;
  timeMin: number;
  ingredients: Ingredient[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const COLOR_PALETTE = [
  { hex: '4CAF50', label: 'Verde' },
  { hex: '8BC34A', label: 'Lima' },
  { hex: '2E7D32', label: 'Verde oscuro' },
  { hex: 'FF7043', label: 'Naranja' },
  { hex: 'E91E63', label: 'Rosa' },
  { hex: '009688', label: 'Teal' },
  { hex: '00897B', label: 'Teal oscuro' },
  { hex: 'FF8A65', label: 'Melocotón' },
  { hex: '3949AB', label: 'Azul' },
  { hex: 'E65100', label: 'Naranja oscuro' },
  { hex: '795548', label: 'Café' },
  { hex: '7B1FA2', label: 'Morado' },
];

const UNITS = ['kg', 'g', 'Piezas', 'taza', 'cucharada', 'cucharadita', 'ml', 'litros'];

const EMPTY_RECIPE: Omit<Recipe, 'id'> = {
  name: '', emoji: '🍽️', colorHex: '4CAF50',
  servings: 2, timeMin: 15, ingredients: [],
};

const EMPTY_ING: Ingredient = { name: '', qty: 0, unit: 'kg' };

// ── Helpers ────────────────────────────────────────────────────────────────

function parseColor(hex: string): string {
  return `#${hex}`;
}

// ── Recipe Form Modal ──────────────────────────────────────────────────────

function RecipeModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Omit<Recipe, 'id'> & { id?: string };
  onSave: (data: Omit<Recipe, 'id'>, id?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<Recipe, 'id'> & { id?: string }>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = <K extends keyof typeof EMPTY_RECIPE>(k: K, v: (typeof EMPTY_RECIPE)[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  function addIngredient() {
    setForm(f => ({ ...f, ingredients: [...f.ingredients, { ...EMPTY_ING }] }));
  }

  function removeIngredient(i: number) {
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));
  }

  function updateIngredient(i: number, key: keyof Ingredient, value: string | number) {
    setForm(f => {
      const ings = [...f.ingredients];
      ings[i] = { ...ings[i], [key]: value };
      return { ...f, ingredients: ings };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    if (form.ingredients.length === 0) { setError('Agrega al menos un ingrediente'); return; }
    const badIng = form.ingredients.find(i => !i.name.trim() || i.qty <= 0);
    if (badIng) { setError('Verifica que todos los ingredientes tengan nombre y cantidad'); return; }
    setSaving(true);
    try {
      const { id, ...data } = form as Recipe;
      void id;
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 flex flex-col"
        style={{ maxHeight: '94vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ background: '#2D5016', borderRadius: '1rem 1rem 0 0' }}
        >
          <div>
            <h3 className="font-bold text-white text-base">
              {initial.id ? 'Editar receta' : 'Nueva receta'}
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
            <label className={labelCls} style={labelStyle}>Nombre de la receta *</label>
            <input
              className={inputCls}
              style={inputStyle}
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Ej: Guacamole Clásico"
            />
          </div>

          {/* Emoji + Color */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Emoji</label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.emoji}
                onChange={e => setField('emoji', e.target.value)}
                placeholder="🍽️"
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Color de tarjeta</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setField('colorHex', c.hex)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{
                      background: parseColor(c.hex),
                      borderColor: form.colorHex === c.hex ? '#1A1A1A' : 'transparent',
                      transform: form.colorHex === c.hex ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Servings + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Porciones</label>
              <input
                type="number"
                min={1}
                className={inputCls}
                style={inputStyle}
                value={form.servings}
                onChange={e => setField('servings', parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Tiempo (minutos)</label>
              <input
                type="number"
                min={1}
                className={inputCls}
                style={inputStyle}
                value={form.timeMin}
                onChange={e => setField('timeMin', parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls} style={{ ...labelStyle, marginBottom: 0 }}>
                Ingredientes * ({form.ingredients.length})
              </label>
              <button
                type="button"
                onClick={addIngredient}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                style={{ background: '#E8F5E9', color: '#2E7D32' }}
              >
                + Agregar
              </button>
            </div>

            {form.ingredients.length === 0 && (
              <div
                className="text-center py-6 rounded-xl border-2 border-dashed text-sm"
                style={{ borderColor: '#E5E7EB', color: '#9CA3AF' }}
              >
                Sin ingredientes. Haz clic en "+ Agregar".
              </div>
            )}

            <div className="space-y-2">
              {form.ingredients.map((ing, i) => (
                <div
                  key={i}
                  className="flex gap-2 items-center rounded-xl p-2"
                  style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}
                >
                  {/* Ingredient name */}
                  <input
                    className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ borderColor: '#E5E7EB', background: 'white', color: '#1A1A1A' }}
                    value={ing.name}
                    onChange={e => updateIngredient(i, 'name', e.target.value)}
                    placeholder="Ingrediente"
                  />
                  {/* Quantity */}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="w-20 px-2 py-2 rounded-lg border text-sm outline-none text-center"
                    style={{ borderColor: '#E5E7EB', background: 'white', color: '#1A1A1A' }}
                    value={ing.qty || ''}
                    onChange={e => updateIngredient(i, 'qty', parseFloat(e.target.value) || 0)}
                    placeholder="Cant."
                  />
                  {/* Unit */}
                  <select
                    className="w-24 px-2 py-2 rounded-lg border text-sm outline-none"
                    style={{ borderColor: '#E5E7EB', background: 'white', color: '#1A1A1A' }}
                    value={ing.unit}
                    onChange={e => updateIngredient(i, 'unit', e.target.value)}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeIngredient(i)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm flex-shrink-0"
                    style={{ background: '#FFEBEE', color: '#C62828' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
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
            {saving ? 'Guardando...' : initial.id ? '✓ Guardar cambios' : '+ Crear receta'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recipe Card ────────────────────────────────────────────────────────────

function RecipeCard({
  recipe,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const color = parseColor(recipe.colorHex);

  return (
    <div
      className="rounded-xl bg-white flex overflow-hidden"
      style={{ border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {/* Left accent bar */}
      <div className="w-1 flex-shrink-0" style={{ background: color }} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Main row */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Emoji badge */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: `${color}18` }}
          >
            {recipe.emoji}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm" style={{ color: '#111827' }}>
              {recipe.name}
            </div>
            <div className="flex gap-4 mt-0.5">
              <span className="text-xs" style={{ color: '#6B7280' }}>
                👥 {recipe.servings} porciones
              </span>
              <span className="text-xs" style={{ color: '#6B7280' }}>
                ⏱️ {recipe.timeMin} min
              </span>
              <span className="text-xs" style={{ color: '#6B7280' }}>
                🥕 {recipe.ingredients.length} ingredientes
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setOpen(o => !o)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={{ background: '#F9FAFB', color: '#374151', borderColor: '#E5E7EB' }}
            >
              {open ? '▲' : '▼'} Ver
            </button>
            <button
              onClick={onEdit}
              className="w-8 h-8 flex items-center justify-center rounded-lg border text-sm transition-colors"
              style={{ background: '#F9FAFB', color: '#374151', borderColor: '#E5E7EB' }}
              title="Editar"
            >
              ✏️
            </button>
            <button
              onClick={onDelete}
              className="w-8 h-8 flex items-center justify-center rounded-lg border text-sm transition-colors"
              style={{ background: '#FFF5F5', color: '#C62828', borderColor: '#FFCDD2' }}
              title="Eliminar"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Ingredients (expandable) */}
        {open && (
          <div className="px-4 pb-3 border-t" style={{ borderColor: '#F3F4F6' }}>
            <div className="text-xs font-semibold tracking-wide pt-3 mb-2" style={{ color: '#9CA3AF' }}>
              INGREDIENTES
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {recipe.ingredients.map((ing, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                  style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}
                >
                  <span className="text-xs font-medium flex-1 truncate" style={{ color: '#374151' }}>
                    {ing.name}
                  </span>
                  <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: '#6B7280' }}>
                    {ing.qty} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function RecetasPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | { data: Omit<Recipe, 'id'> & { id?: string } }>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'recipes'), snap => {
      setRecipes(
        snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<Recipe, 'id'>),
          ingredients: (d.data().ingredients ?? []) as Ingredient[],
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function handleSave(data: Omit<Recipe, 'id'>, id?: string) {
    if (id) {
      await updateDoc(doc(db, 'recipes', id), { ...data });
    } else {
      await addDoc(collection(db, 'recipes'), {
        ...data,
        createdAt: serverTimestamp(),
      });
    }
  }

  async function handleDelete(recipe: Recipe) {
    if (!window.confirm(`¿Eliminar la receta "${recipe.name}"? Esta acción no se puede deshacer.`)) return;
    await deleteDoc(doc(db, 'recipes', recipe.id));
  }

  const filtered = recipes
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Recetas</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {recipes.length} recetas en total · ordenadas A–Z
          </p>
        </div>
        <button
          onClick={() => setModal({ data: { ...EMPTY_RECIPE } })}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2"
          style={{ background: '#2D5016' }}
        >
          + Nueva receta
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar receta..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2.5 rounded-xl border text-sm outline-none mb-5"
        style={{ borderColor: '#E5E7EB', background: 'white' }}
      />

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-4xl mb-3">👨‍🍳</div>
            <p style={{ color: '#6B7280' }}>Cargando recetas...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="font-semibold mb-1" style={{ color: '#374151' }}>
            {search ? 'Sin resultados' : 'Sin recetas'}
          </p>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            {search ? 'Prueba con otro término' : 'Haz clic en "+ Nueva receta" para crear la primera'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onEdit={() => setModal({ data: r })}
              onDelete={() => handleDelete(r)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <RecipeModal
          initial={modal.data}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
