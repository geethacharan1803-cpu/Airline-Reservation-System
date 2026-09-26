import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'skyvoyage.db');
let dbInstance: SqlJsDatabase | null = null;

export async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(buffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');

  return dbInstance;
}

export function saveDb(db: SqlJsDatabase): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function initializeDatabase(db: SqlJsDatabase): void {
  db.run(`
    -- ============================================================
    -- AIRPORTS: Global airport directory
    -- ============================================================
    CREATE TABLE IF NOT EXISTS airports (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC'
    );
  `);

  db.run(`
    -- ============================================================
    -- AIRCRAFT: Fleet definitions with cabin configuration
    -- ============================================================
    CREATE TABLE IF NOT EXISTS aircraft (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      total_seats INTEGER NOT NULL,
      rows_economy INTEGER NOT NULL,
      rows_business INTEGER NOT NULL DEFAULT 0,
      rows_first INTEGER NOT NULL DEFAULT 0,
      seats_per_row_economy INTEGER NOT NULL DEFAULT 6,
      seats_per_row_business INTEGER NOT NULL DEFAULT 4,
      seats_per_row_first INTEGER NOT NULL DEFAULT 2,
      aisle_position_economy TEXT NOT NULL DEFAULT '3',
      aisle_position_business TEXT NOT NULL DEFAULT '2',
      aisle_position_first TEXT NOT NULL DEFAULT '1'
    );
  `);

  db.run(`
    -- ============================================================
    -- FLIGHTS: Scheduled flights with pricing
    -- ============================================================
    CREATE TABLE IF NOT EXISTS flights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_number TEXT NOT NULL,
      aircraft_id INTEGER NOT NULL REFERENCES aircraft(id),
      origin TEXT NOT NULL REFERENCES airports(code),
      destination TEXT NOT NULL REFERENCES airports(code),
      departure_time TEXT NOT NULL,
      arrival_time TEXT NOT NULL,
      base_price_economy REAL NOT NULL,
      base_price_business REAL,
      base_price_first REAL,
      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK(status IN ('scheduled', 'boarding', 'departed', 'arrived', 'cancelled')),
      overbooking_limit INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_flights_route ON flights(origin, destination, departure_time);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_flights_departure ON flights(departure_time);`);

  db.run(`
    -- ============================================================
    -- BOOKINGS: Reservation records with PNR
    -- ============================================================
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pnr TEXT NOT NULL UNIQUE,
      flight_id INTEGER NOT NULL REFERENCES flights(id),
      contact_email TEXT NOT NULL,
      contact_phone TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'confirmed', 'cancelled', 'completed')),
      fare_class TEXT NOT NULL DEFAULT 'economy'
        CHECK(fare_class IN ('economy', 'business', 'first')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_pnr ON bookings(pnr);`);

  db.run(`
    -- ============================================================
    -- PASSENGERS: Individual traveler details per booking
    -- ============================================================
    CREATE TABLE IF NOT EXISTS passengers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT,
      gender TEXT CHECK(gender IN ('M', 'F', 'X')),
      passport_number TEXT,
      nationality TEXT,
      passenger_type TEXT NOT NULL DEFAULT 'adult'
        CHECK(passenger_type IN ('adult', 'child', 'infant'))
    );
  `);

  db.run(`
    -- ============================================================
    -- BOOKING_SEATS: Seat assignments
    -- UNIQUE(flight_id, seat_number) prevents double-booking
    -- ============================================================
    CREATE TABLE IF NOT EXISTS booking_seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      flight_id INTEGER NOT NULL REFERENCES flights(id),
      passenger_id INTEGER NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
      seat_number TEXT NOT NULL,
      seat_class TEXT NOT NULL DEFAULT 'economy'
        CHECK(seat_class IN ('economy', 'business', 'first')),
      UNIQUE(flight_id, seat_number)
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_booking_seats_flight ON booking_seats(flight_id);`);

  db.run(`
    -- ============================================================
    -- SEAT_LOCKS: Temporary seat holds during booking flow
    -- ============================================================
    CREATE TABLE IF NOT EXISTS seat_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL REFERENCES flights(id),
      seat_number TEXT NOT NULL,
      session_id TEXT NOT NULL,
      locked_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      UNIQUE(flight_id, seat_number)
    );
  `);

  db.run(`
    -- ============================================================
    -- PAYMENTS: Transaction records
    -- ============================================================
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id),
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      method TEXT NOT NULL DEFAULT 'card'
        CHECK(method IN ('card', 'upi', 'netbanking', 'wallet')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
      transaction_id TEXT UNIQUE,
      card_last_four TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    -- ============================================================
    -- BOOKING_ADDONS: Extra services
    -- ============================================================
    CREATE TABLE IF NOT EXISTS booking_addons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      passenger_id INTEGER REFERENCES passengers(id) ON DELETE CASCADE,
      addon_type TEXT NOT NULL
        CHECK(addon_type IN ('meal', 'baggage', 'insurance', 'priority_boarding', 'lounge')),
      addon_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1
    );
  `);

  db.run(`
    -- ============================================================
    -- ML_PREDICTIONS: Cached ML model outputs
    -- ============================================================
    CREATE TABLE IF NOT EXISTS ml_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL REFERENCES flights(id),
      prediction_type TEXT NOT NULL
        CHECK(prediction_type IN ('no_show', 'demand', 'delay')),
      probability REAL NOT NULL,
      confidence REAL,
      model_version TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    -- ============================================================
    -- SEAT_WATCHERS: Real-time preference alert queue
    -- ============================================================
    CREATE TABLE IF NOT EXISTS seat_watchers (
      watch_id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      passenger_id INTEGER,
      passenger_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      preferred_seat_type TEXT NOT NULL CHECK(preferred_seat_type IN ('window', 'aisle', 'extra_legroom', 'any')),
      preferred_seat_class TEXT DEFAULT 'economy' CHECK(preferred_seat_class IN ('economy', 'business', 'first')),
      priority_score REAL DEFAULT 0.0,
      loyalty_tier TEXT DEFAULT 'standard' CHECK(loyalty_tier IN ('standard', 'silver', 'gold', 'platinum')),
      max_upgrade_bid REAL DEFAULT 0.0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'notified', 'claimed', 'expired', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    -- ============================================================
    -- UPGRADE_OFFERS: 60-second claim window temporary locks
    -- ============================================================
    CREATE TABLE IF NOT EXISTS upgrade_offers (
      offer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      watch_id INTEGER NOT NULL REFERENCES seat_watchers(watch_id) ON DELETE CASCADE,
      flight_id INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      passenger_id INTEGER,
      seat_number TEXT NOT NULL,
      seat_type TEXT NOT NULL,
      seat_class TEXT NOT NULL,
      upgrade_fee REAL NOT NULL,
      claim_deadline DATETIME NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'claimed', 'expired', 'declined')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================================
    -- SEAT_WAITLIST: Window / Aisle Seat Preference Upgrade Queue
    -- ============================================================
    CREATE TABLE IF NOT EXISTS seat_waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      pnr TEXT NOT NULL,
      flight_id INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      passenger_id INTEGER REFERENCES passengers(id) ON DELETE CASCADE,
      passenger_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      preferred_seat_type TEXT NOT NULL CHECK(preferred_seat_type IN ('window', 'aisle', 'any')),
      current_seat_number TEXT,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'notified', 'claimed', 'expired', 'declined')),
      notified_seat_number TEXT,
      notification_time TEXT,
      notification_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_seat_waitlist_flight ON seat_waitlist(flight_id, preferred_seat_type, status);
    CREATE INDEX IF NOT EXISTS idx_seat_waitlist_booking ON seat_waitlist(booking_id, status);

    -- ============================================================
    -- PRICE_HISTORY: Historical route fare trends for booking advice
    -- ============================================================
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      date_recorded TEXT NOT NULL,
      avg_price REAL NOT NULL,
      min_price REAL NOT NULL,
      max_price REAL NOT NULL,
      demand_level TEXT DEFAULT 'normal' CHECK(demand_level IN ('low', 'normal', 'high', 'surge'))
    );

    CREATE INDEX IF NOT EXISTS idx_price_history_route ON price_history(origin, destination);
  `);

  // Run dynamic schema migrations for passenger identity verification and payments
  try { db.run("ALTER TABLE passengers ADD COLUMN nationality TEXT DEFAULT 'Indian'"); } catch (e) { /* column exists */ }
  try { db.run("ALTER TABLE passengers ADD COLUMN id_type TEXT DEFAULT 'Aadhaar Card'"); } catch (e) { /* column exists */ }
  try { db.run("ALTER TABLE passengers ADD COLUMN id_number TEXT"); } catch (e) { /* column exists */ }
  try { db.run("ALTER TABLE passengers ADD COLUMN id_expiry TEXT"); } catch (e) { /* column exists */ }
  try { db.run("ALTER TABLE passengers ADD COLUMN issuing_country TEXT"); } catch (e) { /* column exists */ }
  try { db.run("ALTER TABLE payments ADD COLUMN bank_name TEXT"); } catch (e) { /* column exists */ }
  try { db.run("ALTER TABLE payments ADD COLUMN upi_id TEXT"); } catch (e) { /* column exists */ }

  ensureRegionalIndianAirportsAndFlights(db);
  ensureINRPricing(db);
  seedRealisticDemoBookings(db);
  seedPriceHistory(db);
}

export function ensureINRPricing(db: SqlJsDatabase): void {
  try {
    // If prices are in legacy USD scale (< 2000), calibrate them into authentic INR
    const check = db.exec("SELECT COUNT(*) FROM flights WHERE base_price_economy < 1500");
    if (check.length > 0 && (check[0].values[0][0] as number) > 0) {
      db.run(`
        UPDATE flights SET
          base_price_economy = ROUND(base_price_economy * 75),
          base_price_business = CASE WHEN base_price_business IS NOT NULL THEN ROUND(base_price_business * 75) ELSE NULL END,
          base_price_first = CASE WHEN base_price_first IS NOT NULL THEN ROUND(base_price_first * 75) ELSE NULL END
        WHERE base_price_economy < 1500
      `);
      db.run("UPDATE bookings SET currency = 'INR' WHERE currency = 'USD'");
      db.run("UPDATE payments SET currency = 'INR' WHERE currency = 'USD'");
      saveDb(db);
      console.log('✓ Calibrated flight catalog and reservations to Indian Rupees (INR ₹)');
    }
  } catch (err) {
    console.error('Error calibrating INR pricing:', err);
  }
}

export function seedRealisticDemoBookings(db: SqlJsDatabase): void {
  try {
    const demoBookings = [
      {
        pnr: 'SK-784210',
        flightNum: 'AI-204',
        aircraftCode: 'A320',
        origin: 'VTZ',
        dest: 'HYD',
        depDate: '2026-10-15T07:15:00.000Z',
        arrDate: '2026-10-15T08:20:00.000Z',
        duration: 65,
        fareClass: 'economy',
        totalAmount: 8400,
        email: 'rajesh.sharma@gmail.com',
        phone: '+91 98480 22334',
        passengers: [
          { first: 'Rajesh', last: 'Sharma', nat: 'Indian', idType: 'Aadhaar Card', idNum: '4829 1049 8821', type: 'adult', seat: '12A' },
          { first: 'Meena', last: 'Sharma', nat: 'Indian', idType: 'Aadhaar Card', idNum: '5920 3847 1920', type: 'adult', seat: '12B' },
        ],
        payment: { method: 'upi', txn: 'TXN-UPI-98421', upiId: 'rajesh@okhdfcbank' },
      },
      {
        pnr: 'SK-619043',
        flightNum: '6E-501',
        aircraftCode: 'A320',
        origin: 'BLR',
        dest: 'DEL',
        depDate: '2026-10-08T11:00:00.000Z',
        arrDate: '2026-10-08T13:40:00.000Z',
        duration: 160,
        fareClass: 'economy',
        totalAmount: 5600,
        email: 'priya.reddy@techcorp.in',
        phone: '+91 99887 66554',
        passengers: [
          { first: 'Priya', last: 'Reddy', nat: 'Indian', idType: 'Driving License', idNum: 'KA0420210049281', type: 'adult', seat: '14F' },
        ],
        payment: { method: 'netbanking', txn: 'TXN-NET-61904', bankName: 'HDFC Bank' },
      },
      {
        pnr: 'SK-902341',
        flightNum: 'EK-505',
        aircraftCode: 'B773',
        origin: 'BOM',
        dest: 'DXB',
        depDate: '2026-12-20T16:30:00.000Z',
        arrDate: '2026-12-20T18:45:00.000Z',
        duration: 195,
        fareClass: 'economy',
        totalAmount: 78500,
        email: 'geetha.charan@outlook.com',
        phone: '+91 94401 55678',
        passengers: [
          { first: 'Geetha', last: 'Charan', nat: 'Indian', idType: 'Passport', idNum: 'Z8942104', type: 'adult', seat: '22A' },
          { first: 'Sunitha', last: 'Charan', nat: 'Indian', idType: 'Passport', idNum: 'Z8942105', type: 'adult', seat: '22B' },
          { first: 'Aarav', last: 'Charan', nat: 'Indian', idType: 'Aadhaar Card', idNum: '9920 4812 0019', type: 'child', seat: '22C' },
        ],
        payment: { method: 'card', txn: 'TXN-CARD-90234', cardLastFour: '4532' },
      },
      {
        pnr: 'SK-331298',
        flightNum: 'AI-161',
        aircraftCode: 'B773',
        origin: 'DEL',
        dest: 'LHR',
        depDate: '2027-01-18T02:30:00.000Z',
        arrDate: '2027-01-18T06:50:00.000Z',
        duration: 560,
        fareClass: 'economy',
        totalAmount: 62000,
        email: 'ananya.verma@delhi.edu.in',
        phone: '+91 98110 33445',
        passengers: [
          { first: 'Ananya', last: 'Verma', nat: 'Indian', idType: 'Passport', idNum: 'V7410294', type: 'adult', seat: '28A' },
        ],
        payment: { method: 'upi', txn: 'TXN-UPI-33129', upiId: 'ananya@paytm' },
      },
      {
        pnr: 'SK-458129',
        flightNum: '6E-243',
        aircraftCode: 'A320',
        origin: 'HYD',
        dest: 'BLR',
        depDate: '2026-10-12T18:20:00.000Z',
        arrDate: '2026-10-12T19:35:00.000Z',
        duration: 75,
        fareClass: 'economy',
        totalAmount: 4200,
        email: 'vikram.rao@itconsulting.com',
        phone: '+91 97001 88990',
        passengers: [
          { first: 'Vikram', last: 'Rao', nat: 'Indian', idType: 'Voter ID', idNum: 'TEL7849102', type: 'adult', seat: '10C' },
        ],
        payment: { method: 'netbanking', txn: 'TXN-NET-45812', bankName: 'State Bank of India' },
      },
      {
        pnr: 'SK-821940',
        flightNum: 'UK-995',
        aircraftCode: 'B738',
        origin: 'DEL',
        dest: 'BOM',
        depDate: '2026-10-02T09:15:00.000Z',
        arrDate: '2026-10-02T11:25:00.000Z',
        duration: 130,
        fareClass: 'economy',
        totalAmount: 11200,
        email: 'amit.patel@mumbaifinance.com',
        phone: '+91 98200 11223',
        passengers: [
          { first: 'Amit', last: 'Patel', nat: 'Indian', idType: 'Aadhaar Card', idNum: '7829 4019 3321', type: 'adult', seat: '15B' },
          { first: 'Neha', last: 'Patel', nat: 'Indian', idType: 'Aadhaar Card', idNum: '6719 3029 4410', type: 'adult', seat: '15C' },
        ],
        payment: { method: 'rupay', txn: 'TXN-RUPAY-82194', cardLastFour: '8910' },
      },
    ];

    const acMap = new Map<string, number>();
    const acResult = db.exec('SELECT code, id FROM aircraft');
    if (acResult.length > 0) {
      acResult[0].values.forEach(row => acMap.set(row[0] as string, row[1] as number));
    }

    let seededCount = 0;
    db.run('BEGIN TRANSACTION');

    for (const demo of demoBookings) {
      const existing = db.exec('SELECT 1 FROM bookings WHERE pnr = ?', [demo.pnr]);
      if (existing.length > 0 && existing[0].values.length > 0) continue;

      // Find or create flight
      let flightId: number;
      const fCheck = db.exec('SELECT id FROM flights WHERE flight_number = ?', [demo.flightNum]);
      if (fCheck.length > 0 && fCheck[0].values.length > 0) {
        flightId = fCheck[0].values[0][0] as number;
      } else {
        const aircraftId = acMap.get(demo.aircraftCode) || 1;
        db.run(
          `INSERT INTO flights (flight_number, aircraft_id, origin, destination, departure_time, arrival_time, base_price_economy, base_price_business, base_price_first, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
          [demo.flightNum, aircraftId, demo.origin, demo.dest, demo.depDate, demo.arrDate, demo.totalAmount / demo.passengers.length, demo.totalAmount * 2, null]
        );
        flightId = (db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number);
      }

      // Insert booking
      db.run(
        `INSERT INTO bookings (pnr, flight_id, contact_email, contact_phone, total_amount, currency, status, fare_class)
         VALUES (?, ?, ?, ?, ?, 'INR', 'confirmed', ?)`,
        [demo.pnr, flightId, demo.email, demo.phone, demo.totalAmount, demo.fareClass]
      );
      const bookingId = (db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number);

      // Insert passengers & seats
      for (const p of demo.passengers) {
        db.run(
          `INSERT INTO passengers (booking_id, first_name, last_name, nationality, id_type, id_number, passenger_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [bookingId, p.first, p.last, p.nat, p.idType, p.idNum, p.type]
        );
        const paxId = (db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number);

        // Assign seat
        db.run(
          `INSERT OR REPLACE INTO booking_seats (booking_id, flight_id, passenger_id, seat_number, seat_class)
           VALUES (?, ?, ?, ?, ?)`,
          [bookingId, flightId, paxId, p.seat, demo.fareClass]
        );
      }

      // Insert payment
      const dbMethod = demo.payment.method === 'rupay' ? 'card' : demo.payment.method;
      db.run(
        `INSERT INTO payments (booking_id, amount, currency, method, status, transaction_id, card_last_four, bank_name, upi_id)
         VALUES (?, ?, 'INR', ?, 'completed', ?, ?, ?, ?)`,
        [bookingId, demo.totalAmount, dbMethod, demo.payment.txn,
         demo.payment.cardLastFour || null, demo.payment.bankName || null, demo.payment.upiId || null]
      );

      seededCount++;
    }

    db.run('COMMIT');
    if (seededCount > 0) {
      saveDb(db);
      console.log(`✓ Pre-seeded ${seededCount} realistic confirmed demo bookings for Viva/Presentation`);
    }
  } catch (err) {
    db.run('ROLLBACK');
    console.error('Error seeding demo bookings:', err);
  }
}


export function ensureRegionalIndianAirportsAndFlights(db: SqlJsDatabase): void {
  try {
    // Check if VTZ or HYD is missing
    const vtzCheck = db.exec("SELECT 1 FROM airports WHERE code = 'VTZ'");
    const hydCheck = db.exec("SELECT 1 FROM airports WHERE code = 'HYD'");

    let airportsAdded = false;

    if (hydCheck.length === 0 || hydCheck[0].values.length === 0) {
      db.run(
        'INSERT OR IGNORE INTO airports (code, name, city, country, latitude, longitude, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['HYD', 'Rajiv Gandhi International Airport', 'Hyderabad', 'India', 17.2403, 78.4294, 'Asia/Kolkata']
      );
      airportsAdded = true;
    }

    if (vtzCheck.length === 0 || vtzCheck[0].values.length === 0) {
      db.run(
        'INSERT OR IGNORE INTO airports (code, name, city, country, latitude, longitude, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['VTZ', 'Visakhapatnam International Airport', 'Visakhapatnam', 'India', 17.7215, 83.2245, 'Asia/Kolkata']
      );
      airportsAdded = true;
    }

    // Check if flights exist for VTZ or HYD
    const flightCheck = db.exec("SELECT 1 FROM flights WHERE origin IN ('VTZ', 'HYD') LIMIT 1");
    if (flightCheck.length === 0 || flightCheck[0].values.length === 0) {
      console.log('Populating regional flights for VTZ & HYD routes...');
      const acMap = new Map<string, number>();
      const acResult = db.exec('SELECT code, id FROM aircraft');
      if (acResult.length > 0) {
        acResult[0].values.forEach(row => {
          acMap.set(row[0] as string, row[1] as number);
        });
      }

      const a320Id = acMap.get('A320') || 1;
      const b738Id = acMap.get('B738') || 2;

      const indianRoutes = [
        { origin: 'VTZ', destination: 'HYD', flightNum: 'SV-701', aircraftId: a320Id, dur: 65, pe: 59, pb: 189 },
        { origin: 'HYD', destination: 'VTZ', flightNum: 'SV-702', aircraftId: a320Id, dur: 65, pe: 59, pb: 189 },
        { origin: 'HYD', destination: 'DEL', flightNum: 'SV-703', aircraftId: b738Id, dur: 130, pe: 79, pb: 249 },
        { origin: 'DEL', destination: 'HYD', flightNum: 'SV-704', aircraftId: b738Id, dur: 130, pe: 79, pb: 249 },
        { origin: 'HYD', destination: 'BLR', flightNum: 'SV-705', aircraftId: a320Id, dur: 75, pe: 59, pb: 179 },
        { origin: 'BLR', destination: 'HYD', flightNum: 'SV-706', aircraftId: a320Id, dur: 75, pe: 59, pb: 179 },
        { origin: 'HYD', destination: 'BOM', flightNum: 'SV-707', aircraftId: b738Id, dur: 90, pe: 69, pb: 219 },
        { origin: 'BOM', destination: 'HYD', flightNum: 'SV-708', aircraftId: b738Id, dur: 90, pe: 69, pb: 219 },
        { origin: 'VTZ', destination: 'BLR', flightNum: 'SV-709', aircraftId: a320Id, dur: 95, pe: 69, pb: 209 },
        { origin: 'BLR', destination: 'VTZ', flightNum: 'SV-710', aircraftId: a320Id, dur: 95, pe: 69, pb: 209 },
      ];

      const departureTimes = ['07:00', '11:30', '16:00', '20:15'];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      db.run('BEGIN TRANSACTION');
      try {
        for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
          const date = new Date(today);
          date.setDate(date.getDate() + dayOffset);

          for (const route of indianRoutes) {
            const numFlights = 2; // 2 daily flights
            for (let i = 0; i < numFlights; i++) {
              const depTime = departureTimes[(i * 2) % departureTimes.length];
              const [depHour, depMin] = depTime.split(':').map(Number);
              const depDate = new Date(date);
              depDate.setHours(depHour, depMin, 0, 0);

              const arrDate = new Date(depDate);
              arrDate.setMinutes(arrDate.getMinutes() + route.dur);

              const fNum = `${route.flightNum}${String.fromCharCode(65 + i)}`;

              db.run(
                `INSERT INTO flights (flight_number, aircraft_id, origin, destination, 
                  departure_time, arrival_time, base_price_economy, base_price_business, base_price_first)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [fNum, route.aircraftId, route.origin, route.destination,
                 depDate.toISOString(), arrDate.toISOString(),
                 route.pe, route.pb, null]
              );
            }
          }
        }
        db.run('COMMIT');
        saveDb(db);
        console.log('✓ Successfully populated VTZ & HYD routes and flights for next 30 days');
      } catch (err) {
        db.run('ROLLBACK');
        console.error('Failed to populate Indian flights:', err);
      }
    } else if (airportsAdded) {
      saveDb(db);
    }
  } catch (error) {
    console.error('Error ensuring regional airports/flights:', error);
  }
}

export function seedPriceHistory(db: SqlJsDatabase): void {
  try {
    const countCheck = db.exec("SELECT COUNT(*) FROM price_history");
    if (countCheck.length > 0 && (countCheck[0].values[0][0] as number) > 0) {
      return; // already seeded
    }

    const popularRouteBaselines = [
      { origin: 'DEL', destination: 'BLR', avg: 6499, min: 5499, max: 8999 },
      { origin: 'BLR', destination: 'DEL', avg: 6499, min: 5499, max: 8999 },
      { origin: 'BOM', destination: 'DXB', avg: 24500, min: 21900, max: 32000 },
      { origin: 'DXB', destination: 'BOM', avg: 24500, min: 21900, max: 32000 },
      { origin: 'HYD', destination: 'VTZ', avg: 4200, min: 3800, max: 5900 },
      { origin: 'VTZ', destination: 'HYD', avg: 4200, min: 3800, max: 5900 },
      { origin: 'DEL', destination: 'BOM', avg: 5800, min: 4900, max: 7600 },
      { origin: 'BOM', destination: 'DEL', avg: 5800, min: 4900, max: 7600 },
      { origin: 'BLR', destination: 'HYD', avg: 3600, min: 3100, max: 4800 },
      { origin: 'HYD', destination: 'BLR', avg: 3600, min: 3100, max: 4800 },
      { origin: 'BOM', destination: 'GOI', avg: 4100, min: 3400, max: 5900 },
      { origin: 'DEL', destination: 'GOI', avg: 6900, min: 5800, max: 9400 }
    ];

    const today = new Date();
    db.run('BEGIN TRANSACTION');
    for (const route of popularRouteBaselines) {
      for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
        const recordDate = new Date(today);
        recordDate.setDate(recordDate.getDate() - dayOffset);
        const dateStr = recordDate.toISOString().split('T')[0];
        const variance = Math.sin(dayOffset) * 0.08;
        const avg = Math.round(route.avg * (1 + variance));
        const min = Math.round(route.min * (1 + variance * 0.5));
        const max = Math.round(route.max * (1 + variance * 1.2));
        const demand = dayOffset % 7 === 0 || dayOffset % 7 === 6 ? 'high' : 'normal';

        db.run(
          `INSERT INTO price_history (origin, destination, date_recorded, avg_price, min_price, max_price, demand_level)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [route.origin, route.destination, dateStr, avg, min, max, demand]
        );
      }
    }
    db.run('COMMIT');
    saveDb(db);
    console.log('✓ Seeded realistic 30-day price history for booking intelligence');
  } catch (err) {
    console.error('Error seeding price history:', err);
  }
}

