/**
 * ============================================================
 * SKYVOYAGE ENTERPRISE — Booking Service (DBMS Unit 1-2, 5)
 * ============================================================
 * Core booking engine with:
 * - Atomic check-and-set (DBMS Unit 5): acquire lock → check seat → book
 * - PNR generation and B-Tree indexing
 * - Seat hold with 10-minute TTL timer
 * - Cancellation with waitlist auto-promotion via MaxHeap
 * - Refund calculation via Strategy pattern
 * - Full audit trail
 * ============================================================
 */

import { get, put, getAll, getByIndex, auditLog, generateId, generatePNR } from '../core/db.js';
import { lockManager, Transaction } from '../core/mutex.js';
import { BTree } from '../core/btree.js';
import { MaxHeap, calculatePriority } from '../core/maxheap.js';
import { getRefundPolicy, DoubleBookingError, SeatUnavailableError, LockTimeoutError } from '../models/index.js';

// ── Singleton instances ──
export const bookingIndex = new BTree(3);
export const waitlistHeap = new MaxHeap();

/** Active seat holds: Map<holdId, { timer, seatId, flightId }> */
const activeHolds = new Map();

/** TTL duration for seat holds (10 minutes) */
const HOLD_TTL_MS = 10 * 60 * 1000;

// ══════════════════════════════════════════════════════════
//  HOLD SEAT — Temporary reservation with TTL
// ══════════════════════════════════════════════════════════

/**
 * Place a temporary hold on a seat (simulates SELECT ... FOR UPDATE).
 * Hold expires after 10 minutes if not converted to a booking.
 *
 * @param {string} flightId
 * @param {string} seatNo
 * @param {string} holderId — session/user ID
 * @returns {Promise<{success: boolean, holdId?: string, expiresAt?: string, error?: string}>}
 */
export async function holdSeat(flightId, seatNo, holderId, sessionHoldId = null) {
  const resourceId = `seat:${flightId}:${seatNo}`;
  const effectiveSessionId = sessionHoldId || holderId;

  const result = await lockManager.withLock(resourceId, holderId, async () => {
    // Check current seat status
    const seat = await getByIndex('seatInventory', 'flightSeat', [flightId, seatNo]);
    if (!seat) throw new SeatUnavailableError(seatNo, flightId);

    if (seat.status === 'booked') {
      throw new DoubleBookingError(seatNo, flightId);
    }
    if (seat.status === 'held' && seat.heldBy !== holderId && seat.session_hold_id !== effectiveSessionId) {
      // Check if hold has expired
      if (seat.heldUntil && new Date(seat.heldUntil) > new Date()) {
        throw new SeatUnavailableError(seatNo, flightId);
      }
    }

    // Place the hold
    const expiresAt = new Date(Date.now() + HOLD_TTL_MS).toISOString();
    const holdId = generateId('hold');

    seat.status = 'held';
    seat.heldBy = holderId;
    seat.session_hold_id = effectiveSessionId;
    seat.holdId = holdId;
    seat.heldUntil = expiresAt;
    await put('seatInventory', seat);

    // Set TTL timer to auto-release
    const timer = setTimeout(async () => {
      await releaseSeatHold(flightId, seatNo, holderId);
    }, HOLD_TTL_MS);

    activeHolds.set(holdId, { timer, seatId: seat.id, flightId, seatNo, holderId, session_hold_id: effectiveSessionId, expiresAt });

    await auditLog('SEAT_HELD', 'seat', seat.id, { flightId, seatNo, holderId, sessionHoldId: effectiveSessionId, expiresAt });

    return { holdId, expiresAt, session_hold_id: effectiveSessionId };
  }, 10000);

  if (!result.acquired) {
    return { success: false, error: 'Could not acquire lock — seat may be in use' };
  }
  if (result.error) {
    return { success: false, error: result.error.message };
  }
  return { success: true, ...result.result };
}

/**
 * Release a seat hold (either manually or by TTL expiry).
 */
export async function releaseSeatHold(flightId, seatNo, holderId) {
  const seat = await getByIndex('seatInventory', 'flightSeat', [flightId, seatNo]);
  if (!seat || seat.status !== 'held' || seat.heldBy !== holderId) return;

  seat.status = 'available';
  seat.heldBy = null;
  seat.heldUntil = null;
  await put('seatInventory', seat);

  // Clear any associated timer
  for (const [holdId, hold] of activeHolds) {
    if (hold.flightId === flightId && hold.seatNo === seatNo) {
      clearTimeout(hold.timer);
      activeHolds.delete(holdId);
    }
  }

  await auditLog('SEAT_HOLD_RELEASED', 'seat', seat.id, { flightId, seatNo, holderId });
}

/**
 * Get hold TTL info (remaining time).
 */
export function getHoldInfo(holdId) {
  const hold = activeHolds.get(holdId);
  if (!hold) return null;
  const remaining = Math.max(0, new Date(hold.expiresAt) - Date.now());
  return { ...hold, remainingMs: remaining, remainingSec: Math.ceil(remaining / 1000) };
}

/** Get all active holds */
export function getActiveHolds() {
  const holds = [];
  for (const [holdId, hold] of activeHolds) {
    const remaining = Math.max(0, new Date(hold.expiresAt) - Date.now());
    holds.push({ holdId, ...hold, remainingMs: remaining });
  }
  return holds;
}

// ══════════════════════════════════════════════════════════
//  CREATE BOOKING — Atomic check-and-set
// ══════════════════════════════════════════════════════════

/**
 * Create a confirmed booking with atomic seat assignment.
 *
 * Flow: Acquire lock → Verify seat → Create booking → Index in B-Tree → Audit
 *
 * @param {Object} params
 * @param {string} params.flightId
 * @param {string} params.seatNo
 * @param {string} params.passengerId
 * @param {string} params.passengerName
 * @param {number} params.amount
 * @param {string} params.paymentMethod
 * @param {string} [params.holdId] — if converting from a hold
 * @param {string} [params.session_hold_id] — persistent session hold token
 * @returns {Promise<{success: boolean, booking?: Object, pnr?: string, error?: string}>}
 */
export async function createBooking({ flightId, seatNo, passengerId, passengerName, amount, paymentMethod, holdId, session_hold_id }) {
  const resourceId = `seat:${flightId}:${seatNo}`;
  const txId = generateId('tx');

  const result = await lockManager.withLock(resourceId, txId, async () => {
    // ── Step 1: Verify seat availability ──
    const seat = await getByIndex('seatInventory', 'flightSeat', [flightId, seatNo]);
    if (!seat) throw new SeatUnavailableError(seatNo, flightId);

    if (seat.status === 'booked') {
      throw new DoubleBookingError(seatNo, flightId);
    }

    // Mathematical specification:
    // CanConfirm = (seat.status = 'HELD' ∧ seat.session_hold_id = current_session) ∨ (seat.status = 'AVAILABLE')
    const currentSession = session_hold_id || holdId || passengerId;
    const isHoldExpired = seat.status === 'held' && seat.heldUntil && new Date(seat.heldUntil) <= new Date();
    const isHeldByCurrentSession = seat.status === 'held' && (
      (seat.session_hold_id && (seat.session_hold_id === currentSession || seat.session_hold_id === session_hold_id)) ||
      (seat.heldBy && (seat.heldBy === currentSession || seat.heldBy === passengerId)) ||
      (holdId && seat.holdId === holdId)
    );

    const canConfirm = (seat.status === 'held' && isHeldByCurrentSession) || seat.status === 'available' || isHoldExpired;

    if (!canConfirm) {
      throw new SeatUnavailableError(seatNo, flightId);
    }

    // ── Step 2: Create booking record ──
    const pnr = generatePNR();
    const bookingId = generateId('bk');
    const now = new Date().toISOString();

    const booking = {
      id: bookingId,
      pnr,
      flightId,
      passengerId,
      passengerName,
      seatNo,
      seatClass: seat.class,
      status: 'confirmed',
      bookedAt: now,
      totalPrice: amount,
      fareType: 'tiered',
    };

    // ── Step 3: Update seat status atomically ──
    seat.status = 'booked';
    seat.heldBy = passengerId;
    seat.session_hold_id = null;
    seat.holdId = null;
    seat.heldUntil = null;
    seat.passengerName = passengerName;
    seat.pnr = pnr;
    seat.bookedAt = now;

    // ── Step 4: Create payment record ──
    const payment = {
      id: generateId('pay'),
      bookingId,
      amount,
      method: paymentMethod || 'card',
      status: 'completed',
      transactionId: `TXN${Date.now()}`,
      paidAt: now,
    };

    // ── Persist atomically ──
    await put('bookings', booking);
    await put('seatInventory', seat);
    await put('payments', payment);

    // ── Step 5: Index in B-Tree ──
    bookingIndex.insert(pnr, booking);

    // ── Clear hold if converting ──
    if (holdId && activeHolds.has(holdId)) {
      clearTimeout(activeHolds.get(holdId).timer);
      activeHolds.delete(holdId);
    }

    await auditLog('BOOKING_CREATED', 'booking', bookingId, {
      pnr, flightId, seatNo, passengerId, amount,
    });

    return { booking, pnr, payment };
  }, 15000);

  if (!result.acquired) {
    return { success: false, error: 'Could not acquire seat lock — try again' };
  }
  if (result.error) {
    return { success: false, error: result.error.message };
  }
  return { success: true, ...result.result };
}

// ══════════════════════════════════════════════════════════
//  CANCEL BOOKING — with waitlist auto-promotion
// ══════════════════════════════════════════════════════════

/**
 * Cancel a booking. Releases the seat and auto-promotes the
 * highest-priority waitlisted passenger (if any) via MaxHeap.extractMax().
 *
 * @param {string} pnr
 * @returns {Promise<{success: boolean, refund?: Object, promoted?: Object, error?: string}>}
 */
export async function cancelBooking(pnr) {
  // Look up booking by PNR
  const bookingResult = bookingIndex.search(pnr);
  let booking;

  if (bookingResult) {
    booking = bookingResult.value;
  } else {
    booking = await getByIndex('bookings', 'pnr', pnr);
  }

  if (!booking) return { success: false, error: 'Booking not found' };
  if (booking.status === 'cancelled') return { success: false, error: 'Booking already cancelled' };

  const resourceId = `seat:${booking.flightId}:${booking.seatNo}`;

  const result = await lockManager.withLock(resourceId, `cancel_${pnr}`, async () => {
    // ── Calculate refund ──
    const flight = await get('flights', booking.flightId);
    const departureTime = new Date(flight.departureTime);
    const hoursBeforeDeparture = Math.max(0, (departureTime - Date.now()) / (1000 * 60 * 60));

    const refundPolicy = getRefundPolicy(booking.fareType || 'tiered');
    const refund = refundPolicy.calculateRefund(booking.totalPrice, hoursBeforeDeparture);

    // ── Update booking status ──
    booking.status = 'cancelled';
    booking.cancelledAt = new Date().toISOString();
    booking.refund = refund;
    await put('bookings', booking);

    // ── Remove from B-Tree index ──
    bookingIndex.delete(pnr);

    // ── Release the seat ──
    const seat = await getByIndex('seatInventory', 'flightSeat', [booking.flightId, booking.seatNo]);
    if (seat) {
      seat.status = 'available';
      seat.heldBy = null;
      seat.heldUntil = null;
      await put('seatInventory', seat);
    }

    await auditLog('BOOKING_CANCELLED', 'booking', booking.id, {
      pnr, refund, flightId: booking.flightId, seatNo: booking.seatNo,
    });

    // ── Auto-promote from waitlist ──
    let promoted = null;
    const waitlistEntries = waitlistHeap.getByFlight(booking.flightId);
    if (waitlistEntries.length > 0) {
      const topEntry = waitlistHeap.extractMax();
      if (topEntry && topEntry.flightId === booking.flightId) {
        // Auto-book for the promoted passenger
        const promoResult = await createBooking({
          flightId: booking.flightId,
          seatNo: booking.seatNo,
          passengerId: topEntry.passengerId,
          passengerName: topEntry.passengerName,
          amount: booking.totalPrice,
          paymentMethod: 'waitlist_promotion',
        });

        if (promoResult.success) {
          promoted = {
            passengerId: topEntry.passengerId,
            passengerName: topEntry.passengerName,
            pnr: promoResult.pnr,
            tier: topEntry.tier,
            priority: topEntry.priority,
          };
          await auditLog('WAITLIST_PROMOTED', 'booking', promoResult.booking.id, promoted);
        }
      }
    }

    return { refund, promoted };
  }, 15000);

  if (!result.acquired) {
    return { success: false, error: 'Could not acquire lock for cancellation' };
  }
  if (result.error) {
    return { success: false, error: result.error.message };
  }
  return { success: true, ...result.result };
}

// ══════════════════════════════════════════════════════════
//  WAITLIST — Add passenger to priority queue
// ══════════════════════════════════════════════════════════

/**
 * Add a passenger to the waitlist for a flight.
 * @param {Object} params
 * @returns {string} waitlist entry ID
 */
export function addToWaitlist({ passengerId, passengerName, flightId, tier, seatPreference }) {
  const timestamp = Date.now();
  const priority = calculatePriority(tier, timestamp);
  const entry = {
    id: generateId('wl'),
    passengerId,
    passengerName,
    flightId,
    tier,
    priority,
    timestamp,
    seatPreference: seatPreference || 'economy',
  };

  waitlistHeap.insert(entry);
  auditLog('WAITLIST_ADDED', 'waitlist', entry.id, { passengerId, flightId, tier, priority });
  return entry.id;
}

/**
 * Get waitlist entries for a flight, sorted by priority.
 * @param {string} flightId
 * @returns {WaitlistEntry[]}
 */
export function getFlightWaitlist(flightId) {
  return waitlistHeap.getByFlight(flightId);
}

// ══════════════════════════════════════════════════════════
//  LOOKUP — PNR search via B-Tree
// ══════════════════════════════════════════════════════════

/**
 * Look up a booking by PNR using the B-Tree index.
 * @param {string} pnr
 * @returns {Promise<Object|null>}
 */
export async function lookupByPNR(pnr) {
  // First try B-Tree (O(log n))
  const btreeResult = bookingIndex.search(pnr);
  if (btreeResult) return btreeResult.value;

  // Fallback to DB
  return await getByIndex('bookings', 'pnr', pnr);
}

/**
 * Get all bookings for a passenger.
 * @param {string} passengerId
 * @returns {Promise<Object[]>}
 */
export async function getPassengerBookings(passengerId) {
  return await getAll('bookings', 'passengerId', passengerId);
}

/**
 * Get all bookings for a flight.
 * @param {string} flightId
 * @returns {Promise<Object[]>}
 */
export async function getFlightBookings(flightId) {
  return await getAll('bookings', 'flightId', flightId);
}

/**
 * Get all confirmed bookings.
 * @returns {Promise<Object[]>}
 */
export async function getAllBookings() {
  return await getAll('bookings');
}

/**
 * Initialize the B-Tree index from existing bookings in the database.
 * Called on application startup.
 */
export async function initializeBookingIndex() {
  const bookings = await getAll('bookings');
  for (const booking of bookings) {
    if (booking.status === 'confirmed') {
      bookingIndex.insert(booking.pnr, booking);
    }
  }
  return bookings.length;
}
