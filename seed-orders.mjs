// seed-orders.mjs
// Run: node seed-orders.mjs
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, addDoc,
  doc, Timestamp, GeoPoint,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCR-Y51_I-jVxai97nvXuAkIugNkAmRvWY",
  authDomain: "legufrut-71350.firebaseapp.com",
  projectId: "legufrut-71350",
  storageBucket: "legufrut-71350.firebasestorage.app",
  messagingSenderId: "951790695087",
  appId: "1:951790695087:web:07c1f3c6875d6f3d4a9a5a",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Real addresses in León, Guanajuato ──────────────────────────────────────
const ORDERS = [
  {
    nombrecliente: 'María Pérez González',
    street: 'Blvd. Juan Alonso de Torres',
    number: '1247',
    neighborhood: 'Valle del Campestre',
    postalCode: '37150',
    referenceNote: 'Casa con portón negro, frente a la farmacia',
    fullAddress: 'Blvd. Juan Alonso de Torres 1247, Valle del Campestre, CP 37150',
    location: new GeoPoint(21.1086, -101.6733),
    shippingFee: 45,
    // productos: Guacamole (Aguacate + Lima + Chile Serrano) + Espinaca suelta
    wants: ['Aguacate', 'Lima', 'Chile Serrano', 'Espinaca'],
    qtys:  [0.6,         0.3,   0.1,              0.2],
    units: ['kg',        'kg',  'kg',             'kg'],
  },
  {
    nombrecliente: 'Carlos Ramírez Ortiz',
    street: 'Calle Madero',
    number: '315',
    neighborhood: 'Centro',
    postalCode: '37000',
    referenceNote: 'Edificio beige, departamento 3B, timbre con el apellido Ramírez',
    fullAddress: 'Calle Madero 315, Centro, CP 37000, León Gto.',
    location: new GeoPoint(21.1236, -101.6823),
    shippingFee: 30,
    // productos: Agua de frutas (Sandía + Lima + Naranja + Guayaba) + Espinaca repetida
    wants: ['Sandía', 'Lima', 'Naranja', 'Guayaba', 'Espinaca'],
    qtys:  [2000,    300,    500,       500,       150],
    units: ['g',     'g',    'g',       'g',       'g'],
  },
  {
    nombrecliente: 'Ana Sofía Mendoza',
    street: 'Av. Insurgentes',
    number: '789',
    neighborhood: 'Jardines de Jerez',
    postalCode: '37530',
    referenceNote: 'Casa esquina con Calle Fresno, buzón rojo',
    fullAddress: 'Av. Insurgentes 789, Jardines de Jerez, CP 37530, León Gto.',
    location: new GeoPoint(21.0952, -101.6901),
    shippingFee: 55,
    // productos: Ensalada fresca (Espinaca + Uva Verde + Fresas + Naranja + Lima) + Chile Serrano suelto
    wants: ['Espinaca', 'Uva Verde', 'Fresas', 'Naranja', 'Lima', 'Chile Serrano'],
    qtys:  [0.15,      0.25,        0.3,     0.4,      0.1,   0.08],
    units: ['kg',      'kg',        'kg',    'kg',     'kg',  'kg'],
  },
];

// ── Fetch all products from Firestore ───────────────────────────────────────
async function fetchProducts() {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
}

function findProduct(products, name) {
  const lower = name.toLowerCase().trim();
  // exact
  let p = products.find(p => p.name?.toLowerCase().trim() === lower);
  if (p) return p;
  // starts-with
  p = products.find(p => p.name?.toLowerCase().trim().startsWith(lower));
  if (p) return p;
  // contains (5+ chars)
  if (lower.length >= 5)
    p = products.find(p => p.name?.toLowerCase().includes(lower));
  return p ?? null;
}

function calcUnitPrice(pricePerKg, grams, unit, unitType) {
  if (unit === 'g') return pricePerKg * (grams / 1000);
  if (unitType === 'Piezas') return pricePerKg * grams;
  return pricePerKg * grams; // kg
}

// ── Create orders ────────────────────────────────────────────────────────────
async function createOrders() {
  const products = await fetchProducts();
  console.log(`Loaded ${products.length} products from Firestore\n`);

  for (const orderDef of ORDERS) {
    // Build items
    const items = [];
    let subtotal = 0;

    for (let i = 0; i < orderDef.wants.length; i++) {
      const productName = orderDef.wants[i];
      const qty = orderDef.qtys[i];
      const unit = orderDef.units[i];
      const product = findProduct(products, productName);

      if (!product) {
        console.warn(`  ⚠️  Product not found: "${productName}" — skipping`);
        continue;
      }

      const isPieza = product.saleType?.toLowerCase().includes('pieza') ||
                      product.saleType?.toLowerCase().includes('pza');
      const unitType = isPieza ? 'Piezas' : unit === 'g' ? 'Gramos' : 'kg';

      // grams stored: always in grams or piece-count
      const gramsStored = unit === 'kg' ? qty * 1000 : qty;
      const unitPrice = unit === 'g'
        ? product.price * (qty / 1000)
        : isPieza
          ? product.price * qty
          : product.price * qty;

      subtotal += unitPrice;
      items.push({
        productRef: product.ref,
        productName: product.name,
        pricePerKg: product.price,
        grams: gramsStored,
        unitType,
        unitPrice: parseFloat(unitPrice.toFixed(2)),
        coverimage: product.coverImage ?? product.coverimage ?? '',
      });
      console.log(`  ✓ ${product.name} — ${gramsStored}${unit === 'g' ? 'g' : unit === 'kg' ? 'g' : ' pzas'} → $${unitPrice.toFixed(2)}`);
    }

    if (items.length === 0) {
      console.warn(`  ✗ No valid products for ${orderDef.nombrecliente}, skipping order\n`);
      continue;
    }

    subtotal = parseFloat(subtotal.toFixed(2));
    const total = parseFloat((subtotal + orderDef.shippingFee).toFixed(2));

    // Create order doc
    const orderRef = await addDoc(collection(db, 'orders'), {
      nombrecliente: orderDef.nombrecliente,
      street: orderDef.street,
      number: orderDef.number,
      neighborhood: orderDef.neighborhood,
      postalCode: orderDef.postalCode,
      referenceNote: orderDef.referenceNote,
      fullAddress: orderDef.fullAddress,
      location: orderDef.location,
      subtotal,
      shippingFee: orderDef.shippingFee,
      total,
      status: 'Pendiente',
      driverTag: '',
      driverStatusText: '',
      driverStep: 0,
      showorder: false,
      createdAt: Timestamp.now(),
      userRef: null,
      userToken: '',
    });

    // Create ordersitems subcollection
    for (const item of items) {
      await addDoc(collection(db, 'orders', orderRef.id, 'ordersitems'), item);
    }

    console.log(`\n✅ Order created: ${orderDef.nombrecliente}`);
    console.log(`   ID: ${orderRef.id}`);
    console.log(`   Subtotal: $${subtotal} | Envío: $${orderDef.shippingFee} | Total: $${total}\n`);
  }

  console.log('🎉 All test orders created successfully!');
  process.exit(0);
}

createOrders().catch(e => { console.error(e); process.exit(1); });
