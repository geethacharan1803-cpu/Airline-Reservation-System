import { getDb, initializeDatabase, saveDb } from './database';

// ─── Airport Data ───────────────────────────────────────────
const airports = [
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', lat: 40.6413, lng: -73.7781, tz: 'America/New_York' },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', lat: 33.9416, lng: -118.4085, tz: 'America/Los_Angeles' },
  { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', country: 'United States', lat: 41.9742, lng: -87.9073, tz: 'America/Chicago' },
  { code: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom', lat: 51.4700, lng: -0.4543, tz: 'Europe/London' },
  { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', lat: 49.0097, lng: 2.5479, tz: 'Europe/Paris' },
  { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates', lat: 25.2532, lng: 55.3657, tz: 'Asia/Dubai' },
  { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', lat: 1.3644, lng: 103.9915, tz: 'Asia/Singapore' },
  { code: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', lat: 35.7720, lng: 140.3929, tz: 'Asia/Tokyo' },
  { code: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Australia', lat: -33.9461, lng: 151.1772, tz: 'Australia/Sydney' },
  { code: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'India', lat: 28.5562, lng: 77.1000, tz: 'Asia/Kolkata' },
  { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India', lat: 19.0896, lng: 72.8656, tz: 'Asia/Kolkata' },
  { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India', lat: 13.1986, lng: 77.7066, tz: 'Asia/Kolkata' },
  { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lng: 8.5622, tz: 'Europe/Berlin' },
  { code: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'China', lat: 22.3080, lng: 113.9185, tz: 'Asia/Hong_Kong' },
  { code: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea', lat: 37.4602, lng: 126.4407, tz: 'Asia/Seoul' },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States', lat: 37.6213, lng: -122.3790, tz: 'America/Los_Angeles' },
  { code: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'United States', lat: 25.7959, lng: -80.2870, tz: 'America/New_York' },
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', country: 'United States', lat: 33.6407, lng: -84.4277, tz: 'America/New_York' },
  { code: 'AMS', name: 'Amsterdam Schiphol Airport', city: 'Amsterdam', country: 'Netherlands', lat: 52.3105, lng: 4.7683, tz: 'Europe/Amsterdam' },
  { code: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', lat: 25.2731, lng: 51.6081, tz: 'Asia/Qatar' },
  { code: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', country: 'India', lat: 17.2403, lng: 78.4294, tz: 'Asia/Kolkata' },
  { code: 'VTZ', name: 'Visakhapatnam International Airport', city: 'Visakhapatnam', country: 'India', lat: 17.7215, lng: 83.2245, tz: 'Asia/Kolkata' },
];

// ─── Aircraft Types ─────────────────────────────────────────
const aircraft = [
  { model: 'Airbus A320neo', code: 'A320', total_seats: 180, rows_economy: 26, rows_business: 4, rows_first: 0, spr_e: 6, spr_b: 4, spr_f: 0, aisle_e: '3', aisle_b: '2', aisle_f: '' },
  { model: 'Boeing 737 MAX 8', code: 'B738', total_seats: 189, rows_economy: 27, rows_business: 4, rows_first: 0, spr_e: 6, spr_b: 4, spr_f: 0, aisle_e: '3', aisle_b: '2', aisle_f: '' },
  { model: 'Boeing 777-300ER', code: 'B773', total_seats: 396, rows_economy: 38, rows_business: 8, rows_first: 4, spr_e: 9, spr_b: 6, spr_f: 4, aisle_e: '3,6', aisle_b: '3', aisle_f: '2' },
  { model: 'Airbus A350-900', code: 'A359', total_seats: 325, rows_economy: 34, rows_business: 7, rows_first: 3, spr_e: 9, spr_b: 6, spr_f: 4, aisle_e: '3,6', aisle_b: '3', aisle_f: '2' },
];

// ─── Route Definitions ──────────────────────────────────────
const routes = [
  // Domestic US
  { origin: 'JFK', destination: 'LAX', flightNum: 'SV-101', aircraftCode: 'B773', dur: 330, pe: 289, pb: 849, pf: 1899 },
  { origin: 'LAX', destination: 'JFK', flightNum: 'SV-102', aircraftCode: 'B773', dur: 300, pe: 279, pb: 829, pf: 1849 },
  { origin: 'JFK', destination: 'ORD', flightNum: 'SV-103', aircraftCode: 'A320', dur: 150, pe: 149, pb: 449, pf: null },
  { origin: 'ORD', destination: 'JFK', flightNum: 'SV-104', aircraftCode: 'A320', dur: 140, pe: 139, pb: 429, pf: null },
  { origin: 'JFK', destination: 'MIA', flightNum: 'SV-105', aircraftCode: 'B738', dur: 180, pe: 179, pb: 529, pf: null },
  { origin: 'LAX', destination: 'SFO', flightNum: 'SV-106', aircraftCode: 'A320', dur: 75, pe: 89, pb: 249, pf: null },
  { origin: 'SFO', destination: 'LAX', flightNum: 'SV-107', aircraftCode: 'A320', dur: 80, pe: 89, pb: 249, pf: null },
  { origin: 'ATL', destination: 'JFK', flightNum: 'SV-108', aircraftCode: 'B738', dur: 135, pe: 129, pb: 399, pf: null },
  // Transatlantic
  { origin: 'JFK', destination: 'LHR', flightNum: 'SV-201', aircraftCode: 'B773', dur: 420, pe: 499, pb: 2499, pf: 5999 },
  { origin: 'LHR', destination: 'JFK', flightNum: 'SV-202', aircraftCode: 'B773', dur: 480, pe: 479, pb: 2399, pf: 5799 },
  { origin: 'JFK', destination: 'CDG', flightNum: 'SV-203', aircraftCode: 'A359', dur: 445, pe: 529, pb: 2599, pf: 6299 },
  { origin: 'LAX', destination: 'LHR', flightNum: 'SV-204', aircraftCode: 'B773', dur: 630, pe: 599, pb: 2899, pf: 6999 },
  // Europe
  { origin: 'LHR', destination: 'CDG', flightNum: 'SV-301', aircraftCode: 'A320', dur: 80, pe: 99, pb: 349, pf: null },
  { origin: 'LHR', destination: 'FRA', flightNum: 'SV-302', aircraftCode: 'A320', dur: 105, pe: 109, pb: 369, pf: null },
  { origin: 'CDG', destination: 'AMS', flightNum: 'SV-303', aircraftCode: 'A320', dur: 80, pe: 89, pb: 299, pf: null },
  { origin: 'FRA', destination: 'LHR', flightNum: 'SV-304', aircraftCode: 'B738', dur: 110, pe: 119, pb: 389, pf: null },
  // Middle East / India
  { origin: 'DXB', destination: 'LHR', flightNum: 'SV-401', aircraftCode: 'A359', dur: 420, pe: 449, pb: 2199, pf: 5499 },
  { origin: 'DXB', destination: 'DEL', flightNum: 'SV-402', aircraftCode: 'B773', dur: 210, pe: 229, pb: 799, pf: 1999 },
  { origin: 'DXB', destination: 'BOM', flightNum: 'SV-403', aircraftCode: 'B738', dur: 195, pe: 199, pb: 699, pf: null },
  { origin: 'DEL', destination: 'BLR', flightNum: 'SV-404', aircraftCode: 'A320', dur: 165, pe: 79, pb: 249, pf: null },
  { origin: 'BLR', destination: 'DEL', flightNum: 'SV-405', aircraftCode: 'A320', dur: 160, pe: 79, pb: 249, pf: null },
  { origin: 'DEL', destination: 'BOM', flightNum: 'SV-406', aircraftCode: 'B738', dur: 130, pe: 69, pb: 219, pf: null },
  { origin: 'BOM', destination: 'DEL', flightNum: 'SV-407', aircraftCode: 'B738', dur: 135, pe: 69, pb: 219, pf: null },
  // Regional India Routes (VTZ / HYD / BLR / DEL / BOM)
  { origin: 'VTZ', destination: 'HYD', flightNum: 'SV-701', aircraftCode: 'A320', dur: 65, pe: 59, pb: 189, pf: null },
  { origin: 'HYD', destination: 'VTZ', flightNum: 'SV-702', aircraftCode: 'A320', dur: 65, pe: 59, pb: 189, pf: null },
  { origin: 'HYD', destination: 'DEL', flightNum: 'SV-703', aircraftCode: 'B738', dur: 130, pe: 79, pb: 249, pf: null },
  { origin: 'DEL', destination: 'HYD', flightNum: 'SV-704', aircraftCode: 'B738', dur: 130, pe: 79, pb: 249, pf: null },
  { origin: 'HYD', destination: 'BLR', flightNum: 'SV-705', aircraftCode: 'A320', dur: 75, pe: 59, pb: 179, pf: null },
  { origin: 'BLR', destination: 'HYD', flightNum: 'SV-706', aircraftCode: 'A320', dur: 75, pe: 59, pb: 179, pf: null },
  { origin: 'HYD', destination: 'BOM', flightNum: 'SV-707', aircraftCode: 'B738', dur: 90, pe: 69, pb: 219, pf: null },
  { origin: 'BOM', destination: 'HYD', flightNum: 'SV-708', aircraftCode: 'B738', dur: 90, pe: 69, pb: 219, pf: null },
  { origin: 'VTZ', destination: 'BLR', flightNum: 'SV-709', aircraftCode: 'A320', dur: 95, pe: 69, pb: 209, pf: null },
  { origin: 'BLR', destination: 'VTZ', flightNum: 'SV-710', aircraftCode: 'A320', dur: 95, pe: 69, pb: 209, pf: null },
  // Asia-Pacific
  { origin: 'SIN', destination: 'NRT', flightNum: 'SV-501', aircraftCode: 'A359', dur: 405, pe: 399, pb: 1899, pf: 4499 },
  { origin: 'NRT', destination: 'SIN', flightNum: 'SV-502', aircraftCode: 'A359', dur: 430, pe: 389, pb: 1849, pf: 4399 },
  { origin: 'SIN', destination: 'SYD', flightNum: 'SV-503', aircraftCode: 'B773', dur: 480, pe: 449, pb: 2199, pf: 5299 },
  { origin: 'HKG', destination: 'NRT', flightNum: 'SV-504', aircraftCode: 'B738', dur: 240, pe: 249, pb: 899, pf: null },
  { origin: 'ICN', destination: 'NRT', flightNum: 'SV-505', aircraftCode: 'A320', dur: 135, pe: 169, pb: 529, pf: null },
  { origin: 'SIN', destination: 'HKG', flightNum: 'SV-506', aircraftCode: 'A320', dur: 225, pe: 199, pb: 649, pf: null },
  // Long-haul
  { origin: 'SFO', destination: 'NRT', flightNum: 'SV-601', aircraftCode: 'B773', dur: 660, pe: 699, pb: 3299, pf: 7999 },
  { origin: 'LAX', destination: 'SYD', flightNum: 'SV-602', aircraftCode: 'A359', dur: 900, pe: 799, pb: 3899, pf: 9499 },
  { origin: 'LHR', destination: 'SIN', flightNum: 'SV-603', aircraftCode: 'A359', dur: 780, pe: 599, pb: 2999, pf: 7299 },
  { origin: 'DOH', destination: 'JFK', flightNum: 'SV-604', aircraftCode: 'B773', dur: 840, pe: 649, pb: 3199, pf: 7799 },
  { origin: 'DEL', destination: 'SFO', flightNum: 'SV-605', aircraftCode: 'B773', dur: 990, pe: 749, pb: 3599, pf: 8699 },
];

// ─── Deterministic pseudo-random for reproducible seeds ─────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ─── Main Seed Function ─────────────────────────────────────
export async function seed(): Promise<void> {
  const db = await getDb();
  initializeDatabase(db);

  // Check if already seeded
  const result = db.exec('SELECT COUNT(*) as cnt FROM airports');
  if (result.length > 0 && result[0].values[0][0] as number > 0) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  console.log('Seeding database...');
  const rand = seededRandom(42);

  db.run('BEGIN TRANSACTION');

  try {
    // Insert airports
    for (const ap of airports) {
      db.run(
        'INSERT INTO airports (code, name, city, country, latitude, longitude, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [ap.code, ap.name, ap.city, ap.country, ap.lat, ap.lng, ap.tz]
      );
    }
    console.log(`  ✓ ${airports.length} airports inserted`);

    // Insert aircraft
    const aircraftIdMap = new Map<string, number>();
    for (const ac of aircraft) {
      db.run(
        `INSERT INTO aircraft (model, code, total_seats, rows_economy, rows_business, rows_first, 
          seats_per_row_economy, seats_per_row_business, seats_per_row_first,
          aisle_position_economy, aisle_position_business, aisle_position_first) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ac.model, ac.code, ac.total_seats, ac.rows_economy, ac.rows_business, ac.rows_first,
         ac.spr_e, ac.spr_b, ac.spr_f, ac.aisle_e, ac.aisle_b, ac.aisle_f]
      );
      // Get the last inserted id
      const idResult = db.exec('SELECT last_insert_rowid()');
      aircraftIdMap.set(ac.code, idResult[0].values[0][0] as number);
    }
    console.log(`  ✓ ${aircraft.length} aircraft types inserted`);

    // Generate flights for the next 30 days
    const departureTimes = ['06:00', '08:30', '10:00', '12:30', '14:00', '16:30', '18:00', '20:30', '22:00'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let flightCount = 0;

    for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);

      for (const route of routes) {
        const aircraftId = aircraftIdMap.get(route.aircraftCode);
        if (!aircraftId) continue;

        const numFlights = route.dur < 120 ? 3 : route.dur < 300 ? 2 : 1;
        
        for (let i = 0; i < numFlights; i++) {
          const depTimeIdx = (i * 3) % departureTimes.length;
          const depTime = departureTimes[depTimeIdx];
          const [depHour, depMin] = depTime.split(':').map(Number);
          
          const departureDate = new Date(date);
          departureDate.setHours(depHour, depMin, 0, 0);
          
          const arrivalDate = new Date(departureDate);
          arrivalDate.setMinutes(arrivalDate.getMinutes() + route.dur);

          const priceMultiplier = 0.85 + rand() * 0.30;
          const economyPrice = Math.round(route.pe * priceMultiplier);
          const businessPrice = route.pb ? Math.round(route.pb * priceMultiplier) : null;
          const firstPrice = route.pf ? Math.round(route.pf * priceMultiplier) : null;

          const flightNum = numFlights > 1 ? `${route.flightNum}${String.fromCharCode(65 + i)}` : route.flightNum;

          db.run(
            `INSERT INTO flights (flight_number, aircraft_id, origin, destination, 
              departure_time, arrival_time, base_price_economy, base_price_business, base_price_first)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [flightNum, aircraftId, route.origin, route.destination,
             departureDate.toISOString(), arrivalDate.toISOString(),
             economyPrice, businessPrice, firstPrice]
          );
          flightCount++;
        }
      }
    }
    console.log(`  ✓ ${flightCount} flights generated (next 30 days)`);

    db.run('COMMIT');
    saveDb(db);
    console.log('Database seeded successfully!');
  } catch (error) {
    db.run('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  }
}

// Run if called directly
seed().catch(console.error);
