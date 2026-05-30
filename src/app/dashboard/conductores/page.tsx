'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, query, where, getDocs,
  doc, updateDoc, Timestamp,
} from 'firebase/firestore';

// ── Types ──────────────────────────────────────────────────────────────────

interface UserDoc {
  id: string;
  email: string;
  display_name?: string;
  isDriver?: boolean;
  driverSlot?: number;
  driverLatLng?: { latitude: number; longitude: number };
  driverLastUpdate?: Timestamp;
}

interface AppConfig {
  id: string;
  driver1Email: string;
  driver2Email: string;
  driver3Email: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SLOTS = [
  { n: 1, label: 'Driver #1', accentColor: '#7B1FA2', bgLight: '#FAF5FF' },
  { n: 2, label: 'Driver #2', accentColor: '#1565C0', bgLight: '#EFF6FF' },
  { n: 3, label: 'Driver #3', accentColor: '#00695C', bgLight: '#F0FDFA' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function gpsChip(lastUpdate?: Timestamp): { text: string; bg: string; color: string } {
  if (!lastUpdate) return { text: 'Sin GPS', bg: '#F3F4F6', color: '#9CA3AF' };
  const diffMin = (Date.now() - lastUpdate.toMillis()) / 60000;
  if (diffMin < 2)  return { text: '● En vivo',              bg: '#DCFCE7', color: '#15803D' };
  if (diffMin < 30) return { text: `Hace ${Math.floor(diffMin)} min`, bg: '#FEF3C7', color: '#92400E' };
  return { text: 'Sin señal', bg: '#F3F4F6', color: '#9CA3AF' };
}

// ── Driver Slot Card ───────────────────────────────────────────────────────

function DriverSlotCard({
  slot,
  assignedEmail,
  onAssign,
  onRemove,
}: {
  slot: typeof SLOTS[0];
  assignedEmail: string;
  onAssign: (email: string) => Promise<string | null>;
  onRemove: () => Promise<void>;
}) {
  const [inputEmail, setInputEmail] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [driver, setDriver] = useState<UserDoc | null>(null);

  useEffect(() => {
    if (!assignedEmail) { setDriver(null); return; }
    const q = query(collection(db, 'users'), where('email', '==', assignedEmail));
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setDriver({ id: d.id, ...(d.data() as Omit<UserDoc, 'id'>) });
      } else {
        setDriver(null);
      }
    });
    return () => unsub();
  }, [assignedEmail]);

  async function handleAssign() {
    const email = inputEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    setError('');
    const err = await onAssign(email);
    if (err) {
      setError(err);
    } else {
      setInputEmail('');
      setEditing(false);
    }
    setBusy(false);
  }

  async function handleRemove() {
    setBusy(true);
    await onRemove();
    setBusy(false);
  }

  const gps = gpsChip(driver?.driverLastUpdate);
  const driverName = driver?.display_name || assignedEmail;

  return (
    <div
      className="bg-white rounded-xl overflow-hidden flex"
      style={{ border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      {/* Left accent bar */}
      <div className="w-1 flex-shrink-0" style={{ background: slot.accentColor }} />

      <div className="flex-1 p-4">
        {/* Slot header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: slot.accentColor }}
            >
              {slot.n}
            </div>
            <span className="font-semibold text-sm" style={{ color: '#111827' }}>
              {slot.label}
            </span>
          </div>
          {assignedEmail && (
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-medium"
              style={{ background: gps.bg, color: gps.color }}
            >
              {gps.text}
            </span>
          )}
        </div>

        {/* Assigned driver */}
        {assignedEmail ? (
          <div className="space-y-3">
            <div
              className="rounded-lg p-3"
              style={{
                background: slot.bgLight,
                border: `1px solid ${slot.accentColor}30`,
              }}
            >
              <div className="text-sm font-semibold" style={{ color: '#111827' }}>
                {driverName}
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                {assignedEmail}
              </div>
              {driver?.driverLatLng && (
                <div className="text-xs mt-1.5 font-mono" style={{ color: '#9CA3AF' }}>
                  {driver.driverLatLng.latitude.toFixed(5)},&nbsp;
                  {driver.driverLatLng.longitude.toFixed(5)}
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-2">
                <input
                  type="email"
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: '#E5E7EB', color: '#111827' }}
                  placeholder="Nuevo correo del conductor"
                  value={inputEmail}
                  onChange={e => setInputEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAssign()}
                />
                {error && (
                  <p className="text-xs px-1" style={{ color: '#DC2626' }}>{error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditing(false); setError(''); setInputEmail(''); }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium border"
                    style={{ borderColor: '#E5E7EB', color: '#374151', background: '#F9FAFB' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={busy || !inputEmail.trim()}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: slot.accentColor, opacity: busy ? 0.6 : 1 }}
                  >
                    {busy ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium border"
                  style={{ borderColor: '#E5E7EB', color: '#374151', background: '#F9FAFB' }}
                >
                  Cambiar
                </button>
                <button
                  onClick={handleRemove}
                  disabled={busy}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#FFF1F2', color: '#BE123C', opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? '...' : 'Quitar conductor'}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Unassigned slot */
          <div className="space-y-2">
            <div
              className="text-xs py-2.5 rounded-lg text-center"
              style={{ background: '#F9FAFB', color: '#9CA3AF', border: '1px dashed #E5E7EB' }}
            >
              Sin conductor asignado
            </div>
            <input
              type="email"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: '#E5E7EB', color: '#111827' }}
              placeholder="Correo del conductor"
              value={inputEmail}
              onChange={e => setInputEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAssign()}
            />
            {error && (
              <p className="text-xs px-1" style={{ color: '#DC2626' }}>{error}</p>
            )}
            <button
              onClick={handleAssign}
              disabled={busy || !inputEmail.trim()}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
              style={{
                background: slot.accentColor,
                opacity: busy || !inputEmail.trim() ? 0.45 : 1,
              }}
            >
              {busy ? 'Buscando...' : 'Asignar conductor'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ConductoresPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'app_config'), snap => {
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        setConfig({
          id: d.id,
          driver1Email: data.driver1_email || '',
          driver2Email: data.driver2_email || '',
          driver3Email: data.driver3_email || '',
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function assignDriver(slotN: number, email: string): Promise<string | null> {
    if (!config) return 'Error: configuración no disponible.';

    const usersQ = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(usersQ);
    if (snap.empty) {
      return 'No se encontró ningún usuario con ese correo. Verifica que esté registrado en la app móvil.';
    }

    const userDocRef = doc(db, 'users', snap.docs[0].id);
    const userData = snap.docs[0].data();

    // If user is already a driver in a different slot, clear that slot in app_config
    if (userData.isDriver && userData.driverSlot && userData.driverSlot !== slotN) {
      const prevSlot = userData.driverSlot as number;
      await updateDoc(doc(db, 'app_config', config.id), {
        [`driver${prevSlot}_email`]: '',
      });
    }

    // Clear previous occupant of this slot (if any and different from new driver)
    const currentEmail = [config.driver1Email, config.driver2Email, config.driver3Email][slotN - 1];
    if (currentEmail && currentEmail !== email) {
      const prevQ = query(collection(db, 'users'), where('email', '==', currentEmail));
      const prevSnap = await getDocs(prevQ);
      if (!prevSnap.empty) {
        await updateDoc(doc(db, 'users', prevSnap.docs[0].id), { isDriver: false, driverSlot: 0 });
      }
    }

    // Assign new driver
    await updateDoc(userDocRef, { isDriver: true, driverSlot: slotN });
    await updateDoc(doc(db, 'app_config', config.id), {
      [`driver${slotN}_email`]: email,
    });

    return null;
  }

  async function removeDriver(slotN: number): Promise<void> {
    if (!config) return;
    const email = [config.driver1Email, config.driver2Email, config.driver3Email][slotN - 1];
    if (!email) return;

    const usersQ = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(usersQ);
    if (!snap.empty) {
      await updateDoc(doc(db, 'users', snap.docs[0].id), { isDriver: false, driverSlot: 0 });
    }

    await updateDoc(doc(db, 'app_config', config.id), {
      [`driver${slotN}_email`]: '',
    });
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <p className="text-sm" style={{ color: '#6B7280' }}>Cargando...</p>
      </div>
    );
  }

  const emails = [
    config?.driver1Email || '',
    config?.driver2Email || '',
    config?.driver3Email || '',
  ];
  const assigned = emails.filter(Boolean).length;

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Conductores</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
          {assigned} de 3 slots asignados · GPS en tiempo real
        </p>
      </div>

      {/* Info banner */}
      <div
        className="rounded-xl p-4 mb-6 flex gap-3 items-start"
        style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
      >
        <span className="text-base flex-shrink-0 mt-0.5">ℹ️</span>
        <div>
          <p className="text-sm font-medium" style={{ color: '#15803D' }}>
            ¿Cómo asignar un conductor?
          </p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#166534' }}>
            El conductor debe haberse registrado primero en la app móvil como usuario normal.
            Ingresa su correo exacto en el slot deseado y presiona "Asignar conductor".
            El sistema le otorgará automáticamente los permisos de conductor y la app
            comenzará a solicitar su ubicación GPS.
          </p>
        </div>
      </div>

      {/* Slots */}
      <div className="space-y-4">
        {SLOTS.map((slot, i) => (
          <DriverSlotCard
            key={slot.n}
            slot={slot}
            assignedEmail={emails[i]}
            onAssign={email => assignDriver(slot.n, email)}
            onRemove={() => removeDriver(slot.n)}
          />
        ))}
      </div>
    </div>
  );
}
