/**
 * ============================================================
 * SKYVOYAGE ENTERPRISE — IndexedDB ACID Layer (DBMS Unit 1-2)
 * ============================================================
 * Provides a promise-based wrapper over IndexedDB with:
 * - Normalized relational schema (6 tables)
 * - UNIQUE constraints (flight_id + seat_no)
 * - Atomic check-and-set operations
 * - CRUD helpers with audit logging
 * - Seed data initialization
 *
 * Schema:
 *   FLIGHT       — id, flightNumber, origin, destination, ...
 *   SEAT_INVENTORY — id, flightId, seatNo, class, status, ...
 *   BOOKING      — id, pnr, flightId, passengerId, seatNo, status, ...
 *   PASSENGER    — id, firstName, lastName, email, tier, ...
 *   PAYMENT      — id, bookingId, amount, method, status, ...
 *   AUDIT_LOG    — id, action, entityType, entityId, details, timestamp
 * ============================================================
 */

const DB_NAME = 'SkyVoyageDB';
const DB_VERSION = 1;

/** @type {IDBDatabase|null} */
let dbInstance = null;

/**
 * Open (or create) the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // ── FLIGHTS ──
      if (!db.objectStoreNames.contains('flights')) {
        const flights = db.createObjectStore('flights', { keyPath: 'id' });
        flights.createIndex('flightNumber', 'flightNumber', { unique: true });
        flights.createIndex('origin', 'origin');
        flights.createIndex('destination', 'destination');
        flights.createIndex('departureTime', 'departureTime');
        flights.createIndex('status', 'status');
      }

      // ── SEAT INVENTORY ──
      if (!db.objectStoreNames.contains('seatInventory')) {
        const seats = db.createObjectStore('seatInventory', { keyPath: 'id' });
        // Compound index for UNIQUE(flightId, seatNo) enforcement
        seats.createIndex('flightSeat', ['flightId', 'seatNo'], { unique: true });
        seats.createIndex('flightId', 'flightId');
        seats.createIndex('status', 'status');
        seats.createIndex('heldUntil', 'heldUntil');
      }

      // ── BOOKINGS ──
      if (!db.objectStoreNames.contains('bookings')) {
        const bookings = db.createObjectStore('bookings', { keyPath: 'id' });
        bookings.createIndex('pnr', 'pnr', { unique: true });
        bookings.createIndex('flightId', 'flightId');
        bookings.createIndex('passengerId', 'passengerId');
        bookings.createIndex('status', 'status');
        bookings.createIndex('bookedAt', 'bookedAt');
      }

      // ── PASSENGERS ──
      if (!db.objectStoreNames.contains('passengers')) {
        const passengers = db.createObjectStore('passengers', { keyPath: 'id' });
        passengers.createIndex('email', 'email', { unique: true });
        passengers.createIndex('tier', 'tier');
        passengers.createIndex('lastName', 'lastName');
      }

      // ── PAYMENTS ──
      if (!db.objectStoreNames.contains('payments')) {
        const payments = db.createObjectStore('payments', { keyPath: 'id' });
        payments.createIndex('bookingId', 'bookingId');
        payments.createIndex('status', 'status');
      }

      // ── AUDIT LOG ──
      if (!db.objectStoreNames.contains('auditLog')) {
        const audit = db.createObjectStore('auditLog', { keyPath: 'id', autoIncrement: true });
        audit.createIndex('action', 'action');
        audit.createIndex('entityType', 'entityType');
        audit.createIndex('timestamp', 'timestamp');
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error(`Failed to open database: ${event.target.error}`));
    };
  });
}

// ══════════════════════════════════════════════════════════
//  GENERIC CRUD HELPERS
// ══════════════════════════════════════════════════════════

/**
 * Put (insert or update) a record.
 * @param {string} storeName
 * @param {Object} data
 * @returns {Promise<IDBValidKey>}
 */
export async function put(storeName, data) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error(`put failed on ${storeName}: ${req.error}`));
  });
}

/**
 * Get a record by primary key.
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<Object|undefined>}
 */
export async function get(storeName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all records from a store, optionally filtered by an index.
 * @param {string} storeName
 * @param {string} [indexName]
 * @param {IDBValidKey} [indexValue]
 * @returns {Promise<Object[]>}
 */
export async function getAll(storeName, indexName, indexValue) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);

    let req;
    if (indexName && indexValue !== undefined) {
      const index = store.index(indexName);
      req = index.getAll(indexValue);
    } else {
      req = store.getAll();
    }

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get a record by index value (first match).
 * @param {string} storeName
 * @param {string} indexName
 * @param {IDBValidKey} value
 * @returns {Promise<Object|undefined>}
 */
export async function getByIndex(storeName, indexName, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.get(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a record by primary key.
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<void>}
 */
export async function remove(storeName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Count records in a store.
 * @param {string} storeName
 * @param {string} [indexName]
 * @param {IDBValidKey} [indexValue]
 * @returns {Promise<number>}
 */
export async function count(storeName, indexName, indexValue) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    let req;
    if (indexName && indexValue !== undefined) {
      req = store.index(indexName).count(indexValue);
    } else {
      req = store.count();
    }
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clear all records from a store.
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export async function clear(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ══════════════════════════════════════════════════════════
//  AUDIT LOGGING
// ══════════════════════════════════════════════════════════

/**
 * Write an entry to the audit log.
 * @param {string} action — e.g., 'BOOKING_CREATED', 'SEAT_HELD', 'LOCK_ACQUIRED'
 * @param {string} entityType — e.g., 'booking', 'seat', 'flight'
 * @param {string} entityId
 * @param {Object} details — additional context
 */
export async function auditLog(action, entityType, entityId, details = {}) {
  await put('auditLog', {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action,
    entityType,
    entityId,
    details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get recent audit log entries.
 * @param {number} limit
 * @returns {Promise<Object[]>}
 */
export async function getRecentAuditLogs(limit = 50) {
  const all = await getAll('auditLog');
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}

// ══════════════════════════════════════════════════════════
//  UTILITY: Generate IDs
// ══════════════════════════════════════════════════════════

/** Generate a unique ID with a prefix */
export function generateId(prefix = '') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${ts}_${rand}` : `${ts}_${rand}`;
}

/** Generate an authentic 6-character PNR (Passenger Name Record) e.g. SK-894210 */
export function generatePNR(prefix = 'SK') {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let numPart = '';
  for (let i = 0; i < 6; i++) {
    // Generate realistic alphanumeric digits, leaning towards numbers like SK-894210
    numPart += chars[Math.floor(Math.random() * (i < 4 ? 10 : chars.length))];
  }
  return `${prefix}-${numPart}`;
}

// ══════════════════════════════════════════════════════════
//  SEED DATA
// ══════════════════════════════════════════════════════════

const AIRPORTS = {
  DEL: { code: 'DEL', city: 'Delhi', name: 'Indira Gandhi International (DEL)', country: 'India' },
  BOM: { code: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji Maharaj International (BOM)', country: 'India' },
  BLR: { code: 'BLR', city: 'Bengaluru', name: 'Kempegowda International (BLR)', country: 'India' },
  MAA: { code: 'MAA', city: 'Chennai', name: 'Chennai International (MAA)', country: 'India' },
  HYD: { code: 'HYD', city: 'Hyderabad', name: 'Rajiv Gandhi International (RGIA)', country: 'India' },
  VTZ: { code: 'VTZ', city: 'Visakhapatnam', name: 'Visakhapatnam International (VTZ)', country: 'India' },
  CCU: { code: 'CCU', city: 'Kolkata', name: 'Netaji Subhas Chandra Bose International (CCU)', country: 'India' },
  GOI: { code: 'GOI', city: 'Goa', name: 'Manohar International / MOPA (GOI)', country: 'India' },
  JAI: { code: 'JAI', city: 'Jaipur', name: 'Jaipur International (JAI)', country: 'India' },
  COK: { code: 'COK', city: 'Kochi', name: 'Cochin International (COK)', country: 'India' },
  AMD: { code: 'AMD', city: 'Ahmedabad', name: 'Sardar Vallabhbhai Patel International (AMD)', country: 'India' },
  DXB: { code: 'DXB', city: 'Dubai', name: 'Dubai International (DXB)', country: 'United Arab Emirates' },
  LHR: { code: 'LHR', city: 'London', name: 'London Heathrow (LHR)', country: 'United Kingdom' },
  SIN: { code: 'SIN', city: 'Singapore', name: 'Singapore Changi Airport (SIN)', country: 'Singapore' },
};

export { AIRPORTS };

/**
 * Generate seat inventory for a flight based on aircraft config.
 * @param {string} flightId
 * @param {Object} config — { first: number, business: number, economy: number }
 * @returns {Object[]} Array of seat records
 */
function generateSeats(flightId, config = { first: 4, business: 16, economy: 132 }) {
  const seats = [];
  let row = 1;
  const seatLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // First class: 2 seats per row (A, F)
  for (let i = 0; i < config.first / 2; i++) {
    for (const letter of ['A', 'F']) {
      seats.push({
        id: `seat_${flightId}_${row}${letter}`,
        flightId,
        seatNo: `${row}${letter}`,
        class: 'first',
        status: 'available',
        heldBy: null,
        heldUntil: null,
        price: 0,
      });
    }
    row++;
  }

  // Business class: 4 seats per row (A, C, D, F)
  for (let i = 0; i < config.business / 4; i++) {
    for (const letter of ['A', 'C', 'D', 'F']) {
      seats.push({
        id: `seat_${flightId}_${row}${letter}`,
        flightId,
        seatNo: `${row}${letter}`,
        class: 'business',
        status: 'available',
        heldBy: null,
        heldUntil: null,
        price: 0,
      });
    }
    row++;
  }

  // Economy class: 6 seats per row (A-F)
  for (let i = 0; i < config.economy / 6; i++) {
    for (const letter of seatLetters) {
      seats.push({
        id: `seat_${flightId}_${row}${letter}`,
        flightId,
        seatNo: `${row}${letter}`,
        class: 'economy',
        status: 'available',
        heldBy: null,
        heldUntil: null,
        price: 0,
      });
    }
    row++;
  }

  return seats;
}

/**
 * Initialize database with seed data (flights, seats, sample passengers, and demo bookings).
 */
export async function seedDatabase() {
  const db = await openDatabase();

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const formatTime = (date, hours, minutes) => {
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  const flights = [
    {
      id: 'fl_vtz', flightNumber: 'AI442', origin: 'VTZ', destination: 'HYD',
      departureTime: formatTime(tomorrow, 10, 15), arrivalTime: formatTime(tomorrow, 11, 30),
      aircraft: 'Airbus A320neo', totalSeats: 152, basePrice: 3450,
      status: 'scheduled', overbookingLimit: 4, airline: 'Air India',
    },
    {
      id: 'fl_dxb', flightNumber: 'EK501', origin: 'BOM', destination: 'DXB',
      departureTime: formatTime(tomorrow, 18, 30), arrivalTime: formatTime(tomorrow, 20, 45),
      aircraft: 'Boeing 777-300ER', totalSeats: 152, basePrice: 16800,
      status: 'scheduled', overbookingLimit: 6, airline: 'Emirates',
    },
    {
      id: 'fl_blr', flightNumber: '6E204', origin: 'BLR', destination: 'DEL',
      departureTime: formatTime(tomorrow, 8, 0), arrivalTime: formatTime(tomorrow, 10, 45),
      aircraft: 'Airbus A321neo', totalSeats: 152, basePrice: 5400,
      status: 'scheduled', overbookingLimit: 5, airline: 'IndiGo',
    },
    {
      id: 'fl_lhr', flightNumber: 'BA138', origin: 'BOM', destination: 'LHR',
      departureTime: formatTime(tomorrow, 2, 20), arrivalTime: formatTime(tomorrow, 7, 15),
      aircraft: 'Boeing 787-9 Dreamliner', totalSeats: 152, basePrice: 42500,
      status: 'scheduled', overbookingLimit: 4, airline: 'British Airways',
    },
    {
      id: 'fl_sin', flightNumber: 'SQ402', origin: 'DEL', destination: 'SIN',
      departureTime: formatTime(dayAfter, 9, 50), arrivalTime: formatTime(dayAfter, 18, 5),
      aircraft: 'Airbus A350-900', totalSeats: 152, basePrice: 24800,
      status: 'scheduled', overbookingLimit: 4, airline: 'Singapore Airlines',
    },
    {
      id: 'fl_001', flightNumber: 'SV101', origin: 'DEL', destination: 'BOM',
      departureTime: formatTime(tomorrow, 6, 30), arrivalTime: formatTime(tomorrow, 8, 45),
      aircraft: 'Boeing 737-800', totalSeats: 152, basePrice: 4500,
      status: 'scheduled', overbookingLimit: 5, airline: 'SkyVoyage',
    },
    {
      id: 'fl_002', flightNumber: 'SV202', origin: 'BLR', destination: 'DEL',
      departureTime: formatTime(tomorrow, 9, 15), arrivalTime: formatTime(tomorrow, 12, 0),
      aircraft: 'Airbus A320', totalSeats: 152, basePrice: 5200,
      status: 'scheduled', overbookingLimit: 4, airline: 'SkyVoyage',
    },
    {
      id: 'fl_003', flightNumber: 'SV303', origin: 'BOM', destination: 'HYD',
      departureTime: formatTime(tomorrow, 14, 0), arrivalTime: formatTime(tomorrow, 15, 30),
      aircraft: 'Boeing 737-800', totalSeats: 152, basePrice: 3800,
      status: 'scheduled', overbookingLimit: 6, airline: 'SkyVoyage',
    },
    {
      id: 'fl_004', flightNumber: 'SV404', origin: 'MAA', destination: 'CCU',
      departureTime: formatTime(tomorrow, 7, 45), arrivalTime: formatTime(tomorrow, 10, 15),
      aircraft: 'Airbus A320', totalSeats: 152, basePrice: 4900,
      status: 'scheduled', overbookingLimit: 4, airline: 'SkyVoyage',
    },
    {
      id: 'fl_005', flightNumber: 'SV505', origin: 'DEL', destination: 'BLR',
      departureTime: formatTime(tomorrow, 16, 30), arrivalTime: formatTime(tomorrow, 19, 15),
      aircraft: 'Boeing 787', totalSeats: 152, basePrice: 6100,
      status: 'scheduled', overbookingLimit: 5, airline: 'SkyVoyage',
    },
    {
      id: 'fl_006', flightNumber: 'SV606', origin: 'HYD', destination: 'GOI',
      departureTime: formatTime(dayAfter, 8, 0), arrivalTime: formatTime(dayAfter, 9, 30),
      aircraft: 'ATR 72', totalSeats: 152, basePrice: 3200,
      status: 'scheduled', overbookingLimit: 3, airline: 'SkyVoyage',
    },
    {
      id: 'fl_007', flightNumber: 'SV707', origin: 'BOM', destination: 'DEL',
      departureTime: formatTime(dayAfter, 11, 0), arrivalTime: formatTime(dayAfter, 13, 15),
      aircraft: 'Boeing 737-800', totalSeats: 152, basePrice: 4700,
      status: 'scheduled', overbookingLimit: 5, airline: 'SkyVoyage',
    },
    {
      id: 'fl_008', flightNumber: 'SV808', origin: 'CCU', destination: 'BLR',
      departureTime: formatTime(dayAfter, 13, 45), arrivalTime: formatTime(dayAfter, 16, 30),
      aircraft: 'Airbus A320', totalSeats: 152, basePrice: 5500,
      status: 'scheduled', overbookingLimit: 4, airline: 'SkyVoyage',
    },
  ];

  // Insert flights and their seats if not existing
  for (const flight of flights) {
    const existing = await get('flights', flight.id);
    if (!existing) {
      await put('flights', flight);
      const seats = generateSeats(flight.id);
      for (const seat of seats) {
        if (seat.class === 'first') seat.price = Math.round(flight.basePrice * 3.5);
        else if (seat.class === 'business') seat.price = Math.round(flight.basePrice * 2.0);
        else seat.price = flight.basePrice;
        await put('seatInventory', seat);
      }
    }
  }

  // Pre-populate realistic passengers
  const passengers = [
    { id: 'pax_demo_1', firstName: 'Dr. Vikram', lastName: 'Sarabhai', email: 'vikram.sarabhai@isro.gov.in', phone: '+91 9848022338', tier: 'gold', nationality: 'Indian', idType: 'aadhaar', idNumber: '8492-1049-5820' },
    { id: 'pax_demo_2', firstName: 'Sophia', lastName: 'Al-Mansoor', email: 'sophia.mansoor@emirates.ae', phone: '+971 501234567', tier: 'gold', nationality: 'Foreign', idType: 'passport', idNumber: 'N8291048', issuingCountry: 'United Arab Emirates', passportExpiry: '2028-11-15' },
    { id: 'pax_demo_3', firstName: 'Rajesh', lastName: 'Nair', email: 'rajesh.nair@techcorp.in', phone: '+91 9900112233', tier: 'silver', nationality: 'Indian', idType: 'aadhaar', idNumber: '3918-2049-1184' },
    { id: 'pax_demo_4', firstName: 'David', lastName: 'Chen', email: 'david.chen@oxford.ac.uk', phone: '+44 7700900123', tier: 'gold', nationality: 'Foreign', idType: 'passport', idNumber: 'P9482015', issuingCountry: 'United Kingdom', passportExpiry: '2029-06-20' },
    { id: 'pax_demo_5', firstName: 'Ananya', lastName: 'Verma', email: 'ananya.verma@delhiuniv.ac.in', phone: '+91 9811223344', tier: 'bronze', nationality: 'Indian', idType: 'voter', idNumber: 'VTR8492018' },
    { id: 'pax_001', firstName: 'Arjun', lastName: 'Sharma', email: 'arjun.sharma@email.com', phone: '+91 9876543210', tier: 'gold', nationality: 'Indian', idType: 'aadhaar', idNumber: '1234-5678-9012' },
    { id: 'pax_002', firstName: 'Priya', lastName: 'Patel', email: 'priya.patel@email.com', phone: '+91 9876543211', tier: 'silver', nationality: 'Indian', idType: 'passport', idNumber: 'J8765432' },
  ];

  for (const pax of passengers) {
    const existing = await get('passengers', pax.id);
    if (!existing) {
      await put('passengers', pax);
    }
  }

  // Pre-populate 5 realistic demo bookings for instant viva demonstration
  const demoBookings = [
    {
      id: 'bk_demo_1',
      pnr: 'SK-894210',
      flightId: 'fl_vtz',
      flightNumber: 'AI442',
      airline: 'Air India',
      seatNo: '12A',
      seatClass: 'economy',
      passengerId: 'pax_demo_1',
      passengerName: 'Dr. Vikram Sarabhai',
      passengerEmail: 'vikram.sarabhai@isro.gov.in',
      phone: '+91 9848022338',
      nationality: 'Indian',
      idType: 'aadhaar',
      idNumber: '8492-1049-5820',
      amount: 3450,
      totalPrice: 3450,
      paymentMethod: 'upi',
      fareType: 'tiered',
      status: 'confirmed',
      bookedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
      gate: 'G4',
      boardingTime: '09:45 AM',
    },
    {
      id: 'bk_demo_2',
      pnr: 'EK-381029',
      flightId: 'fl_dxb',
      flightNumber: 'EK501',
      airline: 'Emirates',
      seatNo: '3A',
      seatClass: 'business',
      passengerId: 'pax_demo_2',
      passengerName: 'Sophia Al-Mansoor',
      passengerEmail: 'sophia.mansoor@emirates.ae',
      phone: '+971 501234567',
      nationality: 'Foreign',
      idType: 'passport',
      idNumber: 'N8291048',
      issuingCountry: 'United Arab Emirates',
      passportExpiry: '2028-11-15',
      amount: 33600,
      totalPrice: 33600,
      paymentMethod: 'card',
      fareType: 'tiered',
      status: 'confirmed',
      bookedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      gate: 'T2-B7',
      boardingTime: '05:45 PM',
    },
    {
      id: 'bk_demo_3',
      pnr: 'IN-928174',
      flightId: 'fl_blr',
      flightNumber: '6E204',
      airline: 'IndiGo',
      seatNo: '18C',
      seatClass: 'economy',
      passengerId: 'pax_demo_3',
      passengerName: 'Rajesh Nair',
      passengerEmail: 'rajesh.nair@techcorp.in',
      phone: '+91 9900112233',
      nationality: 'Indian',
      idType: 'aadhaar',
      idNumber: '3918-2049-1184',
      amount: 5400,
      totalPrice: 5400,
      paymentMethod: 'netbanking',
      fareType: 'tiered',
      status: 'confirmed',
      bookedAt: new Date(Date.now() - 3600000 * 16).toISOString(),
      gate: 'G12',
      boardingTime: '07:20 AM',
    },
    {
      id: 'bk_demo_4',
      pnr: 'BA-641920',
      flightId: 'fl_lhr',
      flightNumber: 'BA138',
      airline: 'British Airways',
      seatNo: '1F',
      seatClass: 'first',
      passengerId: 'pax_demo_4',
      passengerName: 'David Chen',
      passengerEmail: 'david.chen@oxford.ac.uk',
      phone: '+44 7700900123',
      nationality: 'Foreign',
      idType: 'passport',
      idNumber: 'P9482015',
      issuingCountry: 'United Kingdom',
      passportExpiry: '2029-06-20',
      amount: 148750,
      totalPrice: 148750,
      paymentMethod: 'paypal',
      fareType: 'tiered',
      status: 'confirmed',
      bookedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
      gate: 'T2-A3',
      boardingTime: '01:30 AM',
    },
    {
      id: 'bk_demo_5',
      pnr: 'SK-731945',
      flightId: 'fl_001',
      flightNumber: 'SV101',
      airline: 'SkyVoyage',
      seatNo: '8F',
      seatClass: 'economy',
      passengerId: 'pax_demo_5',
      passengerName: 'Ananya Verma',
      passengerEmail: 'ananya.verma@delhiuniv.ac.in',
      phone: '+91 9811223344',
      nationality: 'Indian',
      idType: 'voter',
      idNumber: 'VTR8492018',
      amount: 4500,
      totalPrice: 4500,
      paymentMethod: 'upi',
      fareType: 'tiered',
      status: 'confirmed',
      bookedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      gate: 'G2',
      boardingTime: '05:50 AM',
    }
  ];

  for (const demo of demoBookings) {
    const existing = await getByIndex('bookings', 'pnr', demo.pnr);
    if (!existing) {
      await put('bookings', demo);
      // Mark seat as booked in seat inventory
      const seat = await getByIndex('seatInventory', 'flightSeat', [demo.flightId, demo.seatNo]);
      if (seat) {
        seat.status = 'booked';
        seat.heldBy = demo.passengerId;
        seat.heldUntil = null;
        await put('seatInventory', seat);
      }
      // Add payment
      await put('payments', {
        id: `pay_${demo.pnr.replace('-', '')}`,
        bookingId: demo.id,
        amount: demo.totalPrice,
        method: demo.paymentMethod,
        status: 'completed',
        transactionId: `TXN_${demo.pnr.replace('-', '')}`,
        paidAt: demo.bookedAt,
      });
    }
  }

  await auditLog('DATABASE_SEEDED', 'system', 'init', {
    flights: flights.length,
    passengers: passengers.length,
    demoBookings: demoBookings.length,
  });

  return true;
}


/**
 * Reset the entire database (clear all stores and re-seed).
 */
export async function resetDatabase() {
  const stores = ['flights', 'seatInventory', 'bookings', 'passengers', 'payments', 'auditLog'];
  for (const store of stores) {
    await clear(store);
  }
  await seedDatabase();
}

/**
 * Get database statistics.
 */
export async function getDbStats() {
  const [flights, seats, bookings, passengers, payments, logs] = await Promise.all([
    count('flights'),
    count('seatInventory'),
    count('bookings'),
    count('passengers'),
    count('payments'),
    count('auditLog'),
  ]);
  return { flights, seats, bookings, passengers, payments, auditLogs: logs };
}
