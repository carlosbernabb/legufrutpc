'use client';
import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

interface AppConfig {
  id: string;
  shipping_fee?: number;
  popup_enabled?: boolean;
  popup_title?: string;
  carnas_enabled?: boolean;
  whatsapp_number?: string;
}

type SavedKey = 'shipping' | null;

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SavedKey>(null);
  const [saved, setSaved] = useState<SavedKey>(null);

  // Local editable values
  const [shippingFee, setShippingFee] = useState('');

  const loadConfig = useCallback(async () => {
    const snap = await getDocs(collection(db, 'app_config'));
    if (!snap.empty) {
      const d = snap.docs[0];
      const data = d.data() as Omit<AppConfig, 'id'>;
      const cfg = { id: d.id, ...data };
      setConfig(cfg);
      setShippingFee(String(cfg.shipping_fee ?? 50));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function saveShippingFee() {
    if (!config) return;
    const val = parseFloat(shippingFee);
    if (isNaN(val) || val < 0) {
      alert('Ingresa un número válido mayor o igual a 0.');
      return;
    }
    setSaving('shipping');
    try {
      await updateDoc(doc(db, 'app_config', config.id), { shipping_fee: val });
      setConfig(prev => prev ? { ...prev, shipping_fee: val } : prev);
      setSaved('shipping');
      setTimeout(() => setSaved(null), 2500);
    } catch (e) {
      alert('Error al guardar: ' + e);
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <div className="text-center">
          <div className="text-4xl mb-3">⚙️</div>
          <p style={{ color: '#6B7280' }}>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-medium" style={{ color: '#374151' }}>No se encontró el documento app_config en Firestore</p>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Verifica que exista la colección app_config con al menos un documento</p>
        </div>
      </div>
    );
  }

  const currentFee = config.shipping_fee ?? 50;

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Configuración</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
          Ajustes globales que se aplican a todos los usuarios de la app
        </p>
      </div>

      {/* ── Costo de envío ── */}
      <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🚚</span>
          <div>
            <h2 className="font-bold text-base" style={{ color: '#1A1A1A' }}>Costo de envío</h2>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Se cobra a todos los clientes en cada pedido
            </p>
          </div>
        </div>

        {/* Current value chip */}
        <div className="flex items-center gap-2 mb-4 mt-3">
          <span className="text-xs font-medium" style={{ color: '#6B7280' }}>Valor actual en Firestore:</span>
          <span
            className="px-3 py-1 rounded-full text-sm font-bold"
            style={{ background: '#E8F5E9', color: '#2D5016' }}
          >
            ${currentFee.toFixed(2)} MXN
          </span>
        </div>

        {/* Input row */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border flex-1 max-w-xs"
            style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }}
          >
            <span className="text-lg font-bold" style={{ color: '#6B7280' }}>$</span>
            <input
              type="number"
              min="0"
              step="5"
              value={shippingFee}
              onChange={e => setShippingFee(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveShippingFee()}
              className="flex-1 bg-transparent outline-none font-bold text-xl"
              style={{ color: '#1A1A1A', width: 90 }}
              placeholder="50"
            />
            <span className="text-sm" style={{ color: '#9CA3AF' }}>MXN</span>
          </div>

          <button
            onClick={saveShippingFee}
            disabled={saving === 'shipping'}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={{
              background: saved === 'shipping' ? '#388E3C' : saving === 'shipping' ? '#81C784' : '#2D5016',
              minWidth: 110,
            }}
          >
            {saving === 'shipping' ? 'Guardando...' : saved === 'shipping' ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>

        {/* Warning note */}
        <div
          className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
          style={{ background: '#FFF8E1', color: '#92400E', border: '1px solid #FDE68A' }}
        >
          <span>⚠️</span>
          <span>
            Este cambio se aplica a los pedidos <b>nuevos</b> que hagan los clientes desde la app.
            Los pedidos ya creados mantienen su costo original.
            <br />
            <span style={{ color: '#B45309', marginTop: 2, display: 'block' }}>
              También actualiza el valor en el código Flutter (carrito_widget.dart) si quieres que
              se muestre el precio correcto antes de confirmar el pedido.
            </span>
          </span>
        </div>
      </div>

      {/* ── Info de otros campos ── */}
      <div
        className="rounded-2xl border p-4 text-sm"
        style={{ borderColor: '#E5E7EB', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
      >
        <div className="font-semibold mb-3" style={{ color: '#374151' }}>📋 Otros valores en app_config</div>
        <div className="space-y-2">
          {[
            { label: 'Popup activo', value: config.popup_enabled ? '✅ Sí' : '❌ No' },
            { label: 'Categoría Carnes', value: config.carnas_enabled ? '✅ Visible' : '❌ Oculta' },
            { label: 'WhatsApp', value: config.whatsapp_number || '—' },
            { label: 'Título popup', value: config.popup_title || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b last:border-0" style={{ borderColor: '#F3F4F6' }}>
              <span style={{ color: '#6B7280' }}>{label}</span>
              <span className="font-medium text-right" style={{ color: '#1A1A1A', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: '#9CA3AF' }}>
          Estos campos se editan desde la app Flutter en Admin → Alerta/Popup
        </p>
      </div>
    </div>
  );
}
