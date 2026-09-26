import { Router, Request, Response } from 'express';
import { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import { onSeatCancelledHook } from './seatwatch';
import { onSeatWaitlistCancelledHook } from './seatwaitlist';

export const bookingsRouter = Router();

// Generate a 6-character PNR (alphanumeric, uppercase, no confusing chars)
function generatePNR(db: Database): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O/1/I confusion
  let pnr: string;
  let attempts = 0;
  
  do {
    pnr = '';
    for (let i = 0; i < 6; i++) {
      pnr += chars[Math.floor(Math.random() * chars.length)];
    }
    // Check uniqueness
    const existing = db.exec('SELECT 1 FROM bookings WHERE pnr = ?', [pnr]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return pnr;
    }
    attempts++;
  } while (attempts < 100);
  
  throw new Error('Failed to generate unique PNR');
}

// POST /api/v1/bookings — Create a new booking
bookingsRouter.post('/', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const { flightId, fareClass, passengers, seats, contactEmail, contactPhone, addons, preferredSeatType } = req.body;

  if (!flightId || !passengers || !Array.isArray(passengers) || passengers.length === 0) {
    res.status(400).json({ error: 'Flight ID and at least one passenger are required' });
    return;
  }

  if (!contactEmail) {
    res.status(400).json({ error: 'Contact email is required' });
    return;
  }

  try {
    // Verify flight exists and is bookable
    const flightResult = db.exec(`
      SELECT f.id, f.base_price_economy, f.base_price_business, f.base_price_first, f.status
      FROM flights f WHERE f.id = ?
    `, [flightId]);

    if (flightResult.length === 0 || flightResult[0].values.length === 0) {
      res.status(404).json({ error: 'Flight not found' });
      return;
    }

    const flightRow = flightResult[0].values[0];
    if (flightRow[4] !== 'scheduled') {
      res.status(400).json({ error: 'Flight is not available for booking' });
      return;
    }

    // Calculate pricing
    const fc = fareClass || 'economy';
    let basePrice = 0;
    if (fc === 'economy') basePrice = flightRow[1] as number;
    else if (fc === 'business') basePrice = (flightRow[2] as number) || 0;
    else if (fc === 'first') basePrice = (flightRow[3] as number) || 0;

    if (basePrice === 0) {
      res.status(400).json({ error: `${fc} class is not available on this flight` });
      return;
    }

    const pnr = generatePNR(db);
    const passengerCount = passengers.length;
    let totalAmount = basePrice * passengerCount;

    // Add addon costs
    let addonTotal = 0;
    if (addons && Array.isArray(addons)) {
      addons.forEach((addon: any) => {
        addonTotal += (addon.price || 0) * (addon.quantity || 1);
      });
    }
    totalAmount += addonTotal;

    db.run('BEGIN TRANSACTION');

    try {
      // Create booking
      db.run(
        `INSERT INTO bookings (pnr, flight_id, contact_email, contact_phone, total_amount, fare_class, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [pnr, flightId, contactEmail, contactPhone || null, totalAmount, fc]
      );
      const bookingIdResult = db.exec('SELECT last_insert_rowid()');
      const bookingId = bookingIdResult[0].values[0][0] as number;

      // Insert passengers
      const passengerIds: number[] = [];
      for (const pax of passengers) {
        db.run(
          `INSERT INTO passengers (booking_id, first_name, last_name, date_of_birth, gender, passport_number, nationality, id_type, id_number, id_expiry, issuing_country, passenger_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [bookingId, pax.firstName, pax.lastName, pax.dateOfBirth || null,
           pax.gender || null, pax.passportNumber || null, pax.nationality || 'Indian',
           pax.idType || 'Aadhaar Card', pax.idNumber || null, pax.idExpiry || null, pax.issuingCountry || null,
           pax.passengerType || 'adult']
        );
        const paxIdResult = db.exec('SELECT last_insert_rowid()');
        passengerIds.push(paxIdResult[0].values[0][0] as number);
      }

      // Assign seats (if provided)
      if (seats && Array.isArray(seats)) {
        for (let i = 0; i < seats.length && i < passengerIds.length; i++) {
          const seatItem = seats[i];
          const seatNumber = typeof seatItem === 'string' ? seatItem : seatItem?.seatNumber;
          const seatClass = (typeof seatItem === 'object' && seatItem?.seatClass) ? seatItem.seatClass : fc;

          if (!seatNumber) continue;

          // Check if seat is already booked (UNIQUE constraint will also catch this)
          const existingResult = db.exec(
            'SELECT 1 FROM booking_seats WHERE flight_id = ? AND seat_number = ?',
            [flightId, seatNumber]
          );
          if (existingResult.length > 0 && existingResult[0].values.length > 0) {
            db.run('ROLLBACK');
            res.status(409).json({ error: `Seat ${seatNumber} is already booked` });
            return;
          }

          // Remove any seat lock
          db.run(
            'DELETE FROM seat_locks WHERE flight_id = ? AND seat_number = ?',
            [flightId, seatNumber]
          );

          // Insert seat assignment
          db.run(
            `INSERT INTO booking_seats (booking_id, flight_id, passenger_id, seat_number, seat_class)
             VALUES (?, ?, ?, ?, ?)`,
            [bookingId, flightId, passengerIds[i], seatNumber, seatClass]
          );
        }
      }

      // Insert addons
      if (addons && Array.isArray(addons)) {
        for (const addon of addons) {
          db.run(
            `INSERT INTO booking_addons (booking_id, passenger_id, addon_type, addon_name, price, quantity)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [bookingId, addon.passengerId || null, addon.type, addon.name, addon.price, addon.quantity || 1]
          );
        }
      }

      // Check preferred seat type waitlist enrollment
      let autoWaitlistEnrolled = false;
      if (preferredSeatType && preferredSeatType.toLowerCase() !== 'any') {
        const pref = preferredSeatType.toLowerCase();
        for (let i = 0; i < passengers.length; i++) {
          const seatItem = seats && seats[i];
          const seatNum = typeof seatItem === 'string' ? seatItem : seatItem?.seatNumber;
          const letter = seatNum ? seatNum.slice(-1).toUpperCase() : '';
          const isWindow = (letter === 'A' || letter === 'F');
          const isAisle = (letter === 'C' || letter === 'D');
          const matchesPref = (pref === 'window' && isWindow) || (pref === 'aisle' && isAisle);

          if (!matchesPref) {
            db.run(`
              INSERT INTO seat_waitlist (
                booking_id, pnr, flight_id, passenger_id, passenger_name,
                contact_email, preferred_seat_type, current_seat_number, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting', datetime('now'), datetime('now'))
            `, [
              bookingId,
              pnr,
              flightId,
              passengerIds[i] || null,
              `${passengers[i].firstName} ${passengers[i].lastName}`,
              contactEmail,
              pref,
              seatNum || null
            ]);
            autoWaitlistEnrolled = true;
            console.log(`[SeatWaitlist] Auto-enrolled ${passengers[i].firstName} on Flight #${flightId} for preferred ${pref} seat`);
          }
        }
      }

      db.run('COMMIT');
      req.app.locals.saveDb();

      res.status(201).json({
        pnr,
        bookingId,
        flightId,
        fareClass: fc,
        passengers: passengers.map((p: any, i: number) => ({
          id: passengerIds[i],
          firstName: p.firstName,
          lastName: p.lastName,
          seat: seats && seats[i] ? seats[i].seatNumber : null,
        })),
        totalAmount,
        currency: 'USD',
        status: 'pending',
        seatWaitlistEnrolled: autoWaitlistEnrolled,
        message: 'Booking created. Complete payment to confirm.',
      });
    } catch (innerError: any) {
      db.run('ROLLBACK');
      if (innerError.message && innerError.message.includes('UNIQUE constraint failed')) {
        res.status(409).json({ error: 'One or more selected seats are no longer available. Please try different seats.' });
      } else {
        throw innerError;
      }
    }
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// GET /api/v1/bookings/:pnr — Retrieve booking by PNR
bookingsRouter.get('/:pnr', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const pnr = req.params.pnr.toUpperCase();

  try {
    const bookingResult = db.exec(`
      SELECT b.*, f.flight_number, f.origin, f.destination, f.departure_time, f.arrival_time,
             a.model as aircraft_model, a.code as aircraft_code,
             orig.city as origin_city, dest.city as destination_city
      FROM bookings b
      JOIN flights f ON b.flight_id = f.id
      JOIN aircraft a ON f.aircraft_id = a.id
      JOIN airports orig ON f.origin = orig.code
      JOIN airports dest ON f.destination = dest.code
      WHERE b.pnr = ?
    `, [pnr]);

    if (bookingResult.length === 0 || bookingResult[0].values.length === 0) {
      res.status(404).json({ error: 'Booking not found. Please check your PNR.' });
      return;
    }

    const cols = bookingResult[0].columns;
    const row = bookingResult[0].values[0];
    const booking: any = {};
    cols.forEach((col, i) => { booking[col] = row[i]; });

    // Get passengers
    const paxResult = db.exec(
      'SELECT * FROM passengers WHERE booking_id = ?',
      [booking.id]
    );
    const passengers = paxResult.length > 0
      ? paxResult[0].values.map(pRow => {
          const pax: any = {};
          paxResult[0].columns.forEach((c, i) => { pax[c] = pRow[i]; });
          return pax;
        })
      : [];

    // Get seat assignments
    const seatsResult = db.exec(
      'SELECT * FROM booking_seats WHERE booking_id = ?',
      [booking.id]
    );
    const seatAssignments = seatsResult.length > 0
      ? seatsResult[0].values.map(sRow => {
          const seat: any = {};
          seatsResult[0].columns.forEach((c, i) => { seat[c] = sRow[i]; });
          return seat;
        })
      : [];

    // Get payment
    const payResult = db.exec(
      'SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1',
      [booking.id]
    );
    const payment = payResult.length > 0 && payResult[0].values.length > 0
      ? (() => {
          const p: any = {};
          payResult[0].columns.forEach((c, i) => { p[c] = payResult[0].values[0][i]; });
          return p;
        })()
      : null;

    // Get addons
    const addonsResult = db.exec(
      'SELECT * FROM booking_addons WHERE booking_id = ?',
      [booking.id]
    );
    const addonsList = addonsResult.length > 0
      ? addonsResult[0].values.map(aRow => {
          const addon: any = {};
          addonsResult[0].columns.forEach((c, i) => { addon[c] = aRow[i]; });
          return addon;
        })
      : [];

    const dep = new Date(booking.departure_time);
    const arr = new Date(booking.arrival_time);

    res.json({
      pnr: booking.pnr,
      status: booking.status,
      fareClass: booking.fare_class,
      totalAmount: booking.total_amount,
      currency: booking.currency,
      contactEmail: booking.contact_email,
      contactPhone: booking.contact_phone,
      createdAt: booking.created_at,
      flight: {
        id: booking.flight_id,
        flightNumber: booking.flight_number,
        origin: { code: booking.origin, city: booking.origin_city },
        destination: { code: booking.destination, city: booking.destination_city },
        departureTime: booking.departure_time,
        arrivalTime: booking.arrival_time,
        durationMinutes: Math.round((arr.getTime() - dep.getTime()) / 60000),
        aircraft: { model: booking.aircraft_model, code: booking.aircraft_code },
      },
      passengers: passengers.map(p => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        dateOfBirth: p.date_of_birth,
        gender: p.gender,
        passportNumber: p.passport_number,
        nationality: p.nationality || 'Indian',
        idType: p.id_type || 'Aadhaar Card',
        idNumber: p.id_number,
        idExpiry: p.id_expiry,
        issuingCountry: p.issuing_country,
        passengerType: p.passenger_type,
        seat: seatAssignments.find(s => s.passenger_id === p.id)?.seat_number || null,
        seatClass: seatAssignments.find(s => s.passenger_id === p.id)?.seat_class || null,
      })),
      payment: payment ? {
        status: payment.status,
        amount: payment.amount,
        method: payment.method,
        transactionId: payment.transaction_id,
        cardLastFour: payment.card_last_four,
        bankName: payment.bank_name,
        upiId: payment.upi_id,
      } : null,
      addons: addonsList.map(a => ({
        type: a.addon_type,
        name: a.addon_name,
        price: a.price,
        quantity: a.quantity,
      })),
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// PUT /api/v1/bookings/:pnr/cancel — Cancel booking
bookingsRouter.put('/:pnr/cancel', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const pnr = req.params.pnr.toUpperCase();

  try {
    const bookingResult = db.exec('SELECT id, status FROM bookings WHERE pnr = ?', [pnr]);
    if (bookingResult.length === 0 || bookingResult[0].values.length === 0) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    const bookingId = bookingResult[0].values[0][0] as number;
    const currentStatus = bookingResult[0].values[0][1] as string;

    if (currentStatus === 'cancelled') {
      res.status(400).json({ error: 'Booking is already cancelled' });
      return;
    }

    db.run('BEGIN TRANSACTION');
    try {
      // Look up seats before release to notify highest-priority SeatWatch watcher
      const cancelledSeats = db.exec(
        'SELECT b.flight_id, bs.seat_number, bs.seat_class FROM booking_seats bs JOIN bookings b ON bs.booking_id = b.id WHERE bs.booking_id = ?',
        [bookingId]
      );
      if (cancelledSeats.length > 0 && cancelledSeats[0].values.length > 0) {
        for (const row of cancelledSeats[0].values) {
          const cFlightId = row[0] as number;
          const cSeatNumber = row[1] as string;
          const cSeatClass = (row[2] as string) || 'economy';
          onSeatCancelledHook(db, cFlightId, cSeatNumber, cSeatClass);
          onSeatWaitlistCancelledHook(db, cFlightId, cSeatNumber);
        }
      }

      // Release seats
      db.run('DELETE FROM booking_seats WHERE booking_id = ?', [bookingId]);
      
      // Update booking status
      db.run(
        "UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?",
        [bookingId]
      );

      // Refund payment if completed
      db.run(
        "UPDATE payments SET status = 'refunded', updated_at = datetime('now') WHERE booking_id = ? AND status = 'completed'",
        [bookingId]
      );

      db.run('COMMIT');
      req.app.locals.saveDb();

      res.json({
        pnr,
        status: 'cancelled',
        message: 'Booking cancelled successfully. Refund will be processed within 5-7 business days.',
      });
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});
