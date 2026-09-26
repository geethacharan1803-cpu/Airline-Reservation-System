import { Router, Request, Response } from 'express';
import { Database } from 'sql.js';

export const seatWaitlistRouter = Router();

// =============================================================================
// Helper: Notify earliest waitlisted passenger when a seat is released
// =============================================================================
export function onSeatWaitlistCancelledHook(
  db: Database,
  flightId: number,
  seatNumber: string
): void {
  try {
    const letter = seatNumber.slice(-1).toUpperCase();
    const isWindow = (letter === 'A' || letter === 'F');
    const isAisle = (letter === 'C' || letter === 'D');
    const seatType = isWindow ? 'window' : isAisle ? 'aisle' : 'middle';

    // Find the earliest waiting passenger for this flight matching the seat type (or 'any')
    const query = db.exec(`
      SELECT id, booking_id, pnr, passenger_id, passenger_name, contact_email, preferred_seat_type
      FROM seat_waitlist
      WHERE flight_id = ?
        AND (preferred_seat_type = ? OR preferred_seat_type = 'any')
        AND status = 'waiting'
      ORDER BY created_at ASC
      LIMIT 1
    `, [flightId, seatType]);

    if (query.length === 0 || query[0].values.length === 0) {
      return; // No waitlisted passengers for this seat type
    }

    const row = query[0].values[0];
    const waitlistId = row[0] as number;
    const bookingId = row[1] as number;
    const pnr = row[2] as string;
    const passengerName = row[4] as string;
    const contactEmail = row[5] as string;

    const notificationMsg = `Great news! A preferred ${seatType} seat (${seatNumber}) has opened up on your flight. Claim it now to complete your seat upgrade.`;

    // Mark as notified and assign the opened seat number
    db.run(`
      UPDATE seat_waitlist
      SET status = 'notified',
          notified_seat_number = ?,
          notification_time = datetime('now'),
          notification_message = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `, [seatNumber, notificationMsg, waitlistId]);

    // Simulated Email & SMS delivery logs
    console.log(`[SeatWaitlist Notification] 📧 Email sent to ${contactEmail} (PNR: ${pnr}): ${notificationMsg}`);
    console.log(`[SeatWaitlist Notification] 📱 SMS alert sent to ${passengerName} for seat ${seatNumber} on Flight #${flightId}`);
  } catch (err) {
    console.error('Error running onSeatWaitlistCancelledHook:', err);
  }
}

// =============================================================================
// POST /api/v1/seat-waitlist — Enroll passenger into Window/Aisle preference queue
// =============================================================================
seatWaitlistRouter.post('/', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const {
    userId,
    bookingId,
    pnr,
    flightId,
    passengerId,
    passengerName,
    contactEmail,
    preferredSeatType = 'window',
    currentSeatNumber
  } = req.body;

  if (!bookingId || !flightId || !passengerName || !contactEmail) {
    res.status(400).json({ error: 'Missing required waitlist parameters' });
    return;
  }

  try {
    // Check if an active waitlist entry already exists for this booking & passenger
    const existing = db.exec(`
      SELECT id FROM seat_waitlist
      WHERE booking_id = ? AND passenger_name = ? AND status IN ('waiting', 'notified')
    `, [bookingId, passengerName]);

    if (existing.length > 0 && existing[0].values.length > 0) {
      res.json({
        success: true,
        alreadyEnrolled: true,
        waitlistId: existing[0].values[0][0],
        message: 'You are already on the preference waitlist for this flight.'
      });
      return;
    }

    db.run(`
      INSERT INTO seat_waitlist (
        user_id, booking_id, pnr, flight_id, passenger_id,
        passenger_name, contact_email, preferred_seat_type,
        current_seat_number, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', datetime('now'), datetime('now'))
    `, [
      userId || null,
      bookingId,
      pnr,
      flightId,
      passengerId || null,
      passengerName,
      contactEmail,
      preferredSeatType.toLowerCase(),
      currentSeatNumber || null
    ]);

    req.app.locals.saveDb();

    const idRes = db.exec('SELECT last_insert_rowid()');
    const newId = idRes[0].values[0][0] as number;

    res.status(201).json({
      success: true,
      waitlistId: newId,
      message: `Successfully enrolled in ${preferredSeatType} seat waitlist. You will be notified the instant one becomes free!`
    });
  } catch (err: any) {
    console.error('Error adding to seat waitlist:', err);
    res.status(500).json({ error: 'Failed to join seat waitlist', details: err.message });
  }
});

// =============================================================================
// GET /api/v1/seat-waitlist/status/:bookingId — Get waitlist records for booking
// =============================================================================
seatWaitlistRouter.get('/status/:bookingId', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const bookingId = req.params.bookingId;

  try {
    const results = db.exec(`
      SELECT id, user_id, booking_id, pnr, flight_id, passenger_id, passenger_name,
             contact_email, preferred_seat_type, current_seat_number, status,
             notified_seat_number, notification_time, notification_message, created_at
      FROM seat_waitlist
      WHERE booking_id = ? OR pnr = ?
      ORDER BY id DESC
    `, [bookingId, bookingId]);

    if (results.length === 0 || results[0].values.length === 0) {
      res.json({ entries: [] });
      return;
    }

    const entries = results[0].values.map(row => ({
      id: row[0],
      userId: row[1],
      bookingId: row[2],
      pnr: row[3],
      flightId: row[4],
      passengerId: row[5],
      passengerName: row[6],
      contactEmail: row[7],
      preferredSeatType: row[8],
      currentSeatNumber: row[9],
      status: row[10],
      notifiedSeatNumber: row[11],
      notificationTime: row[12],
      notificationMessage: row[13],
      createdAt: row[14]
    }));

    res.json({ entries });
  } catch (err: any) {
    console.error('Error fetching seat waitlist status:', err);
    res.status(500).json({ error: 'Failed to fetch waitlist status' });
  }
});

// =============================================================================
// GET /api/v1/seat-waitlist/alerts/:email — Check active upgrade notifications
// =============================================================================
seatWaitlistRouter.get('/alerts/:email', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const email = req.params.email;

  try {
    const results = db.exec(`
      SELECT sw.id, sw.booking_id, sw.pnr, sw.flight_id, sw.passenger_name,
             sw.preferred_seat_type, sw.current_seat_number, sw.notified_seat_number,
             sw.notification_message, sw.notification_time,
             f.flight_number, f.origin, f.destination, f.departure_time
      FROM seat_waitlist sw
      JOIN flights f ON sw.flight_id = f.id
      WHERE sw.contact_email = ? AND sw.status = 'notified'
      ORDER BY sw.notification_time DESC
    `, [email]);

    if (results.length === 0 || results[0].values.length === 0) {
      res.json({ alerts: [] });
      return;
    }

    const alerts = results[0].values.map(row => ({
      waitlistId: row[0],
      bookingId: row[1],
      pnr: row[2],
      flightId: row[3],
      passengerName: row[4],
      preferredSeatType: row[5],
      currentSeatNumber: row[6],
      notifiedSeatNumber: row[7],
      notificationMessage: row[8],
      notificationTime: row[9],
      flightNumber: row[10],
      origin: row[11],
      destination: row[12],
      departureTime: row[13]
    }));

    res.json({ alerts });
  } catch (err: any) {
    console.error('Error fetching waitlist alerts:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// =============================================================================
// GET /api/v1/seat-waitlist/active-notifications — Check any active waitlist notifications
// =============================================================================
seatWaitlistRouter.get('/active-notifications', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;

  try {
    const results = db.exec(`
      SELECT sw.id, sw.booking_id, sw.pnr, sw.flight_id, sw.passenger_name,
             sw.preferred_seat_type, sw.current_seat_number, sw.notified_seat_number,
             sw.notification_message, sw.notification_time,
             f.flight_number, f.origin, f.destination, f.departure_time
      FROM seat_waitlist sw
      JOIN flights f ON sw.flight_id = f.id
      WHERE sw.status = 'notified'
      ORDER BY sw.notification_time DESC
      LIMIT 5
    `);

    if (results.length === 0 || results[0].values.length === 0) {
      res.json({ alerts: [] });
      return;
    }

    const alerts = results[0].values.map(row => ({
      waitlistId: row[0],
      bookingId: row[1],
      pnr: row[2],
      flightId: row[3],
      passengerName: row[4],
      preferredSeatType: row[5],
      currentSeatNumber: row[6],
      notifiedSeatNumber: row[7],
      notificationMessage: row[8],
      notificationTime: row[9],
      flightNumber: row[10],
      origin: row[11],
      destination: row[12],
      departureTime: row[13]
    }));

    res.json({ alerts });
  } catch (err: any) {
    console.error('Error fetching active waitlist notifications:', err);
    res.status(500).json({ error: 'Failed to fetch active notifications' });
  }
});

// =============================================================================
// POST /api/v1/seat-waitlist/claim — Claim an opened preferred seat
// =============================================================================
seatWaitlistRouter.post('/claim', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const { waitlistId } = req.body;

  if (!waitlistId) {
    res.status(400).json({ error: 'Waitlist ID is required' });
    return;
  }

  try {
    // 1. Fetch waitlist details
    const resWaitlist = db.exec(`
      SELECT id, booking_id, flight_id, current_seat_number, notified_seat_number, status
      FROM seat_waitlist
      WHERE id = ?
    `, [waitlistId]);

    if (resWaitlist.length === 0 || resWaitlist[0].values.length === 0) {
      res.status(404).json({ error: 'Waitlist record not found' });
      return;
    }

    const [id, bookingId, flightId, currentSeat, targetSeat, status] = resWaitlist[0].values[0];

    if (status === 'claimed') {
      res.status(400).json({ error: 'Seat upgrade has already been claimed' });
      return;
    }

    if (!targetSeat) {
      res.status(400).json({ error: 'No opened seat is currently assigned to this waitlist entry' });
      return;
    }

    // 2. Double check that targetSeat is not taken by someone else
    const checkOccupied = db.exec(`
      SELECT bs.id FROM booking_seats bs
      JOIN bookings b ON bs.booking_id = b.id
      WHERE b.flight_id = ? AND bs.seat_number = ? AND b.status != 'cancelled'
    `, [flightId, targetSeat]);

    if (checkOccupied.length > 0 && checkOccupied[0].values.length > 0) {
      // Seat was snatched or re-booked
      db.run("UPDATE seat_waitlist SET status = 'expired', updated_at = datetime('now') WHERE id = ?", [waitlistId]);
      req.app.locals.saveDb();
      res.status(409).json({ error: 'Sorry, this seat was claimed by another passenger or is no longer available.' });
      return;
    }

    // 3. Atomically update seat allocation in booking_seats
    db.run('BEGIN TRANSACTION');
    try {
      if (currentSeat) {
        // Swap existing seat to new seat
        db.run(`
          UPDATE booking_seats
          SET seat_number = ?
          WHERE booking_id = ? AND seat_number = ?
        `, [targetSeat, bookingId, currentSeat]);
      } else {
        // Assign new seat directly
        db.run(`
          INSERT INTO booking_seats (booking_id, seat_number, seat_class, price)
          VALUES (?, ?, 'economy', 0)
        `, [bookingId, targetSeat]);
      }

      // Mark waitlist as claimed
      db.run(`
        UPDATE seat_waitlist
        SET status = 'claimed',
            current_seat_number = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [targetSeat, waitlistId]);

      db.run('COMMIT');
      req.app.locals.saveDb();

      console.log(`[SeatWaitlist] Booking #${bookingId} successfully claimed upgraded seat ${targetSeat}!`);

      res.json({
        success: true,
        upgradedSeat: targetSeat,
        message: `Congratulations! Your seat has been successfully upgraded to ${targetSeat}.`
      });
    } catch (txErr) {
      db.run('ROLLBACK');
      throw txErr;
    }
  } catch (err: any) {
    console.error('Error claiming seat upgrade:', err);
    res.status(500).json({ error: 'Failed to claim seat upgrade', details: err.message });
  }
});

// =============================================================================
// POST /api/v1/seat-waitlist/decline — Decline an opened seat offer
// =============================================================================
seatWaitlistRouter.post('/decline', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const { waitlistId } = req.body;

  try {
    db.run(`
      UPDATE seat_waitlist
      SET status = 'declined', updated_at = datetime('now')
      WHERE id = ?
    `, [waitlistId]);

    req.app.locals.saveDb();
    res.json({ success: true, message: 'Seat upgrade declined.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to decline upgrade' });
  }
});
