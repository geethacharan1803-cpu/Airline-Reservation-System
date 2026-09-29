/**
 * ============================================================
 * SKYVOYAGE ENTERPRISE — Seat Service (DMGT Unit 2)
 * ============================================================
 * Seat inventory management using Set Theory:
 *   AvailableSeats = AllConfiguredSeats ∖ ConfirmedBookings
 *
 * Also demonstrates:
 * - Injective (one-to-one) seat mapping: f: Passenger → Seat
 * - Functional dependency verification
 * ============================================================
 */

import { getAll, getByIndex, AIRPORTS } from '../core/db.js';

// ══════════════════════════════════════════════════════════
//  SET OPERATIONS — Available Seat Calculation
// ══════════════════════════════════════════════════════════

/**
 * Compute available seats using set difference.
 *
 * AvailableSeats = AllSeats ∖ (BookedSeats ∪ HeldSeats)
 *
 * @param {string} flightId
 * @returns {Promise<{
 *   all: Set<string>,
 *   booked: Set<string>,
 *   held: Set<string>,
 *   available: Set<string>,
 *   seats: Object[]
 * }>}
 */
export async function computeSeatAvailability(flightId) {
  const allSeatRecords = await getAll('seatInventory', 'flightId', flightId);
  const bookings = await getAll('bookings', 'flightId', flightId);
  const bookingBySeat = new Map();
  for (const b of bookings) {
    if (b.status === 'confirmed') bookingBySeat.set(b.seatNo, b);
  }

  // Realistic sample occupant pool for simulated seats
  const sampleNames = ['Rajesh S.', 'Dr. Vikram S.', 'Ananya V.', 'David C.', 'Sophia M.', 'Priya P.', 'Arjun S.', 'Kavita R.', 'Siddharth M.', 'Meera N.'];
  const sampleMeals = ['Asian Vegetarian', 'Standard Non-Veg', 'Diabetic Special', 'Hindu Meal', 'Jain Meal'];

  // Deterministic pseudo-random seeder based on seat identifier
  function seatHash(seatNo) {
    let h = 0;
    for (let i = 0; i < seatNo.length; i++) {
      h = ((h << 5) - h + seatNo.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  // Build sets
  const allSeats = new Set();
  const bookedSeats = new Set();
  const heldSeats = new Set();
  const seatDetails = {};

  for (let i = 0; i < allSeatRecords.length; i++) {
    const seat = allSeatRecords[i];
    allSeats.add(seat.seatNo);

    // If the seat has a real booking from the DB, honor it
    const hasRealBooking = bookingBySeat.has(seat.seatNo);

    // For seats without real bookings, simulate realistic cabin occupancy:
    // ~70% booked (red), ~12% held (amber), ~18% available (green)
    if (!hasRealBooking && seat.status === 'available') {
      const hash = seatHash(seat.seatNo + flightId);
      const bucket = hash % 100;
      if (bucket < 70) {
        seat.status = 'booked';  // ~70% booked
      } else if (bucket < 82) {
        seat.status = 'held';    // ~12% held/in-progress
      }
      // else remains 'available' (~18%)
    }

    if (seat.status === 'booked') {
      bookedSeats.add(seat.seatNo);
      const b = bookingBySeat.get(seat.seatNo);
      const nameSeed = sampleNames[(seat.seatNo.charCodeAt(0) * 7 + (seat.seatNo.charCodeAt(1) || 0)) % sampleNames.length];
      const pnrNum = 90000 + ((seat.seatNo.charCodeAt(0) * 31 + (seat.seatNo.charCodeAt(1) || 0) * 17) % 9999);
      const mealSeed = sampleMeals[(seat.seatNo.charCodeAt(0) + (seat.seatNo.charCodeAt(1) || 0)) % sampleMeals.length];

      seat.occupant = {
        name: b?.passengerName ? (b.passengerName.split(' ')[0] + ' ' + (b.passengerName.split(' ')[1] ? b.passengerName.split(' ')[1][0] + '.' : '')) : nameSeed,
        fullName: b?.passengerName || nameSeed,
        pnr: b?.pnr || seat.pnr || `SK-${pnrNum}`,
        status: 'Confirmed',
        meal: b?.mealPreference || seat.meal || mealSeed,
        tier: b?.tier || 'Gold Member'
      };
    } else if (seat.status === 'held') {
      // Check if hold has expired (for real holds)
      const holdTime = seat.heldUntil ? new Date(seat.heldUntil).getTime() : 0;
      const nowTime = Date.now();
      if (holdTime > nowTime) {
        heldSeats.add(seat.seatNo);
        const remMs = holdTime - nowTime;
        const mins = Math.floor(remMs / 60000);
        const secs = Math.floor((remMs % 60000) / 1000);
        seat.holdInfo = {
          holder: seat.heldBy || 'Active checkout session',
          timerText: `Held by checkout session • Expires in ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} min`,
          remainingMs: remMs,
        };
      } else if (!seat.heldUntil) {
        // Simulated hold (no real timer) — show as held with fake timer
        heldSeats.add(seat.seatNo);
        const fakeRemaining = 120000 + (seatHash(seat.seatNo) % 480000); // 2-10 minutes
        const mins = Math.floor(fakeRemaining / 60000);
        const secs = Math.floor((fakeRemaining % 60000) / 1000);
        seat.holdInfo = {
          holder: 'Active checkout session',
          timerText: `Held by checkout session • Expires in ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} min`,
          remainingMs: fakeRemaining,
        };
      } else {
        seat.status = 'available';
      }
    }

    seatDetails[seat.seatNo] = seat;
  }

  // Set difference: Available = All ∖ (Booked ∪ Held)
  const unavailable = new Set([...bookedSeats, ...heldSeats]);
  const available = new Set([...allSeats].filter(s => !unavailable.has(s)));

  return {
    all: allSeats,
    booked: bookedSeats,
    held: heldSeats,
    available,
    unavailable,
    seats: allSeatRecords,
    seatDetails,
    stats: {
      total: allSeats.size,
      booked: bookedSeats.size,
      held: heldSeats.size,
      available: available.size,
      occupancyRate: allSeats.size > 0 ? ((bookedSeats.size / allSeats.size) * 100).toFixed(1) : 0,
    },
  };
}

/**
 * Get seat availability breakdown by class.
 * @param {string} flightId
 * @returns {Promise<Object>}
 */
export async function getSeatsByClass(flightId) {
  const { seats } = await computeSeatAvailability(flightId);

  const byClass = { first: [], business: [], economy: [] };
  for (const seat of seats) {
    const cls = seat.class || 'economy';
    if (byClass[cls]) byClass[cls].push(seat);
  }

  const classSummary = {};
  for (const [cls, classSeats] of Object.entries(byClass)) {
    const available = classSeats.filter(s => s.status === 'available').length;
    const booked = classSeats.filter(s => s.status === 'booked').length;
    const held = classSeats.filter(s => s.status === 'held').length;
    classSummary[cls] = {
      total: classSeats.length,
      available,
      booked,
      held,
      seats: classSeats,
    };
  }

  return classSummary;
}

/**
 * Get the seat map structure for rendering (organized by rows and columns).
 * @param {string} flightId
 * @returns {Promise<Object>}
 */
export async function getSeatMap(flightId) {
  const { seats, stats } = await computeSeatAvailability(flightId);

  // Parse seats into rows
  const rowMap = new Map();
  for (const seat of seats) {
    const match = seat.seatNo.match(/^(\d+)([A-F])$/);
    if (!match) continue;
    const [, rowNum, letter] = match;
    const row = parseInt(rowNum);
    if (!rowMap.has(row)) rowMap.set(row, {});
    rowMap.get(row)[letter] = seat;
  }

  // Convert to sorted array of rows
  const rows = [...rowMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rowNum, cols]) => ({ rowNum, cols }));

  // Determine sections
  const sections = [];
  let currentClass = null;
  let sectionRows = [];

  for (const row of rows) {
    const firstSeat = Object.values(row.cols)[0];
    const seatClass = firstSeat?.class || 'economy';

    if (seatClass !== currentClass) {
      if (sectionRows.length > 0) {
        sections.push({ class: currentClass, rows: sectionRows });
      }
      currentClass = seatClass;
      sectionRows = [];
    }
    sectionRows.push(row);
  }
  if (sectionRows.length > 0) {
    sections.push({ class: currentClass, rows: sectionRows });
  }

  return { sections, stats, flightId };
}

// ══════════════════════════════════════════════════════════
//  INJECTIVE MAPPING PROOF — f: Passenger → Seat
// ══════════════════════════════════════════════════════════

/**
 * Verify that the seat assignment is an injective function
 * (no two passengers share the same seat on the same flight).
 *
 * @param {string} flightId
 * @returns {Promise<{
 *   isInjective: boolean,
 *   mapping: Array<{passenger: string, seat: string}>,
 *   violations: Array<{seat: string, passengers: string[]}>
 * }>}
 */
export async function verifyInjectiveMapping(flightId) {
  const bookings = await getAll('bookings', 'flightId', flightId);
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');

  // Build mapping: seat → [passengers]
  const seatToPassengers = new Map();
  const mapping = [];

  for (const booking of confirmedBookings) {
    mapping.push({
      passenger: booking.passengerName || booking.passengerId,
      seat: booking.seatNo,
      pnr: booking.pnr,
    });

    if (!seatToPassengers.has(booking.seatNo)) {
      seatToPassengers.set(booking.seatNo, []);
    }
    seatToPassengers.get(booking.seatNo).push(booking.passengerName || booking.passengerId);
  }

  // Check for violations (non-injective cases)
  const violations = [];
  for (const [seat, passengers] of seatToPassengers) {
    if (passengers.length > 1) {
      violations.push({ seat, passengers });
    }
  }

  return {
    isInjective: violations.length === 0,
    mapping,
    violations,
    totalMappings: mapping.length,
    proof: violations.length === 0
      ? `✓ f: Passenger → Seat is injective. All ${mapping.length} mappings are unique.`
      : `✗ f is NOT injective! ${violations.length} seat(s) assigned to multiple passengers.`,
  };
}

// ══════════════════════════════════════════════════════════
//  SET THEORY DEMONSTRATION
// ══════════════════════════════════════════════════════════

/**
 * Generate a complete set theory demonstration for a flight.
 * Returns formatted data suitable for UI display.
 */
export async function getSetTheoryDemo(flightId) {
  const availability = await computeSeatAvailability(flightId);
  const injectiveProof = await verifyInjectiveMapping(flightId);

  return {
    sets: {
      U: { name: 'Universal Set (All Configured Seats)', elements: [...availability.all], size: availability.all.size },
      B: { name: 'Booked Seats', elements: [...availability.booked], size: availability.booked.size },
      H: { name: 'Held Seats', elements: [...availability.held], size: availability.held.size },
      A: { name: 'Available Seats = U ∖ (B ∪ H)', elements: [...availability.available], size: availability.available.size },
    },
    operations: {
      union: {
        expression: 'B ∪ H (Unavailable)',
        result: [...availability.unavailable],
        size: availability.unavailable.size,
      },
      difference: {
        expression: 'U ∖ (B ∪ H) = A (Available)',
        result: [...availability.available],
        size: availability.available.size,
      },
      complement: {
        expression: "A' = B ∪ H (Not Available)",
        result: [...availability.unavailable],
        size: availability.unavailable.size,
      },
    },
    injection: injectiveProof,
    stats: availability.stats,
  };
}
