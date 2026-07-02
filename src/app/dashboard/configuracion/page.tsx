'use client';
import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

interface AppConfig {
  id: string;
  price_per_km?: number;
  min_shipping_fee?: number;
  origin_lat?: number;
  origin_lng?: number;
  whatsapp_number?: string;
  mercadopago_link?: string;
  mercadopago_card?: string;
  popup_enabled?: boolean;
  popup_title?: string;
  carnas_enabled?: boolean;
}

type SavedKey = 'envio' | 'whatsapp' | 'mp' | null;

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SavedKey>(null);
  const [saved, setSaved] = useState<SavedKey>(null);

  // Local editable values
  const [pricePerKm, setPricePerKm] = useState('');
  const [minFee, setMinFee] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [mpLink, setMpLink] = useState('');
  const [mpCard, setMpCard] = useState('');

  const loadConfig = useCallback(async () => {
    const snap = await getDocs(collection(db, 'app_config'));
    if (!snap.empty) {
      const d = snap.docs[0];
      const data = d.data() as Omit<AppConfig, 'id'>;
      const cfg = { id: d.id, ...data };
      setConfig(cfg);
      setPricePerKm(String(cfg.price_per_km ?? 7));
      setMinFee(String(cfg.min_shipping_fee ?? 30));
      setWhatsapp(cfg.whatsapp_number ?? '');
      setMpLink(cfg.mercadopago_link ?? '');
      setMpCard(cfg.mercadopago_card ?? '');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function save(key: Exclude<SavedKey, null>, fields: Record<string, unknown>) {
    if (!config) return;
    setSaving(key);
    try {
      await updateDoc(doc(db, 'app_config', config.id), fields);
      setConfig(prev => prev ? { ...prev, ...fields } : prev);
      setSaved(key);
      setTimeout(() => setSaved(null), 2500);
    } catch (e) {
      alert('Error al guardar: ' + e);
    } finally {
      setSaving(null);
    }
  }

  function saveEnvio() {
    const km = parseFloat(pricePerKm);
    const min = parseFloat(minFee);
    if (isNaN(km) || km <= 0 || isNaN(min) || min < 0) {
      alert('Ingresa números válidos: precio por km mayor a 0 y mínimo mayor o igual a 0.');
      return;
    }
    save('envio', { price_per_km: km, min_shipping_fee: min });
  }

  function saveWhatsapp() {
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length !== 10) {
      alert('El número debe tener 10 dígitos (sin +52). Ejemplo: 4771118588');
      return;
    }
    save('whatsapp', { whatsapp_number: digits });
  }

  function saveMp() {
    const link = mpLink.trim();
    const card = mpCard.replace(/\D/g, '');
    if (!link.startsWith('http')) {
      alert('El link de Mercado Pago debe empezar con https://');
      return;
    }
    if (card.length !== 16) {
      alert('La tarjeta debe tener 16 dígitos.');
      return;
    }
    save('mp', { mercadopago_link: link, mercadopago_card: card });
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

  const btnStyle = (key: Exclude<SavedKey, null>) => ({
    background: saved === key ? '#388E3C' : saving === key ? '#81C784' : '#2D5016',
    minWidth: 110,
  });
  const btnLabel = (key: Exclude<SavedKey, null>) =>
    saving === key ? 'Guardando...' : saved === key ? '✓ Guardado' : 'Guardar';

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border text-sm outline-none';
  const inputStyle = { borderColor: '#E5E7EB', background: '#FAFAFA', color: '#1A1A1A' };

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Configuración</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
          Ajustes globales que se aplican a todos los usuarios de la app
        </p>
      </div>

      {/* ── Envío por distancia ── */}
      <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🚚</span>
          <div>
            <h2 className="font-bold text-base" style={{ color: '#1A1A1A' }}>Envío por distancia</h2>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Se cobra por km de manejo desde la Central de Abastos hasta el domicilio del cliente
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
              Precio por kilómetro
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={inputStyle}>
              <span className="font-bold" style={{ color: '#6B7280' }}>$</span>
              <input
                type="number" min="1" step="0.5" value={pricePerKm}
                onChange={e => setPricePerKm(e.target.value)}
                className="flex-1 bg-transparent outline-none font-bold text-lg w-16"
                style={{ color: '#1A1A1A' }}
              />
              <span className="text-xs" style={{ color: '#9CA3AF' }}>/km</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
              Cobro mínimo de envío
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={inputStyle}>
              <span className="font-bold" style={{ color: '#6B7280' }}>$</span>
              <input
                type="number" min="0" step="5" value={minFee}
                onChange={e => setMinFee(e.target.value)}
                className="flex-1 bg-transparent outline-none font-bold text-lg w-16"
                style={{ color: '#1A1A1A' }}
              />
              <span className="text-xs" style={{ color: '#9CA3AF' }}>MXN</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between max-w-md">
          <span className="text-xs" style={{ color: '#9CA3AF' }}>
            Ejemplo: 5 km × ${pricePerKm || '7'} = ${((parseFloat(pricePerKm) || 7) * 5).toFixed(0)} de envío
          </span>
          <button
            onClick={saveEnvio}
            disabled={saving === 'envio'}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={btnStyle('envio')}
          >
            {btnLabel('envio')}
          </button>
        </div>

        <div
          className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
          style={{ background: '#F0FBF0', color: '#2D5016', border: '1px solid #BBDFBB' }}
        >
          <span>📍</span>
          <span>
            Punto de partida: Central de Abastos ({config.origin_lat ?? 21.0716592}, {config.origin_lng ?? -101.6841543}).
            El cambio aplica a los pedidos <b>nuevos</b>; los ya creados conservan su costo.
          </span>
        </div>
      </div>

      {/* ── WhatsApp ── */}
      <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">💬</span>
          <div>
            <h2 className="font-bold text-base" style={{ color: '#1A1A1A' }}>WhatsApp del negocio</h2>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              A este número llegan los clientes desde el botón verde de la app
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 max-w-md">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border flex-1" style={inputStyle}>
            <span className="text-sm font-semibold" style={{ color: '#6B7280' }}>+52</span>
            <input
              type="tel" value={whatsapp} maxLength={14}
              onChange={e => setWhatsapp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveWhatsapp()}
              className="flex-1 bg-transparent outline-none font-bold"
              style={{ color: '#1A1A1A' }}
              placeholder="4771118588"
            />
          </div>
          <button
            onClick={saveWhatsapp}
            disabled={saving === 'whatsapp'}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={btnStyle('whatsapp')}
          >
            {btnLabel('whatsapp')}
          </button>
        </div>
      </div>

      {/* ── Mercado Pago ── */}
      <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">💳</span>
          <div>
            <h2 className="font-bold text-base" style={{ color: '#1A1A1A' }}>Pagos con tarjeta (Mercado Pago)</h2>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              El cliente paga en este link o transfiere a la tarjeta de débito
            </p>
          </div>
        </div>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
              Link de pago
            </label>
            <input
              type="url" value={mpLink}
              onChange={e => setMpLink(e.target.value)}
              className={inputCls}
              style={inputStyle}
              placeholder="https://link.mercadopago.com.mx/legufrut"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
              Tarjeta de débito (16 dígitos)
            </label>
            <input
              type="text" value={mpCard} maxLength={19}
              onChange={e => setMpCard(e.target.value)}
              className={inputCls}
              style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 700 }}
              placeholder="5428780305518714"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={saveMp}
              disabled={saving === 'mp'}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={btnStyle('mp')}
            >
              {btnLabel('mp')}
            </button>
          </div>
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
