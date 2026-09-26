import { Router, Request, Response } from 'express';
import { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';

export const seatsRouter = Router();

// POST /api/v1/seats/lock — Temporarily lock seats during booking
seatsRouter.post('/lock', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const { flightId, seatNumbers, sessionId } = req.body;

  if (!flightId || !seatNumbers || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
    res.status(400).json({ error: 'Flight ID and seat numbers are required' });
    return;
  }

  const sid = sessionId || uuidv4();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min hold

  try {
    // Clean expired locks first
    db.run("DELETE FROM seat_locks WHERE expires_at < datetime('now')");

    db.run('BEGIN TRANSACTION');
    const lockedSeats: string[] = [];
    const failedSeats: string[] = [];

    for (const seatNumber of seatNumbers) {
      // Check if seat is already booked
      const bookedResult = db.exec(
        'SELECT 1 FROM booking_seats WHERE flight_id = ? AND seat_number = ?',
        [flightId, seatNumber]
      );
      if (bookedResult.length > 0 && bookedResult[0].values.length > 0) {
        failedSeats.push(seatNumber);
        continue;
      }

      // Check if seat is already locked by someone else
      const lockResult = db.exec(
        "SELECT session_id FROM seat_locks WHERE flight_id = ? AND seat_number = ? AND expires_at > datetime('now')",
        [flightId, seatNumber]
      );
      if (lockResult.length > 0 && lockResult[0].values.length > 0) {
        if (lockResult[0].values[0][0] !== sid) {
          failedSeats.push(seatNumber);
          continue;
        }
        // Same session — extend the lock
        db.run(
          'UPDATE seat_locks SET expires_at = ? WHERE flight_id = ? AND seat_number = ? AND session_id = ?',
          [expiresAt, flightId, seatNumber, sid]
        );
      } else {
        // Insert new lock
        db.run(
          'INSERT OR REPLACE INTO seat_locks (flight_id, seat_number, session_id, expires_at) VALUES (?, ?, ?, ?)',
          [flightId, seatNumber, sid, expiresAt]
        );
      }
      lockedSeats.push(seatNumber);
    }

    db.run('COMMIT');
    req.app.locals.saveDb();

    res.json({
      sessionId: sid,
      lockedSeats,
      failedSeats,
      expiresAt,
      holdDurationMinutes: 10,
      message: failedSeats.length > 0 
        ? `Some seats could not be locked: ${failedSeats.join(', ')}` 
        : 'Seats locked successfully',
    });
  } catch (error) {
    db.run('ROLLBACK');
    console.error('Error locking seats:', error);
    res.status(500).json({ error: 'Failed to lock seats' });
  }
});

// POST /api/v1/seats/release — Release seat locks
seatsRouter.post('/release', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const { flightId, seatNumbers, sessionId } = req.body;

  if (!flightId || !sessionId) {
    res.status(400).json({ error: 'Flight ID and session ID are required' });
    return;
  }

  try {
    if (seatNumbers && Array.isArray(seatNumbers)) {
      for (const seat of seatNumbers) {
        db.run(
          'DELETE FROM seat_locks WHERE flight_id = ? AND seat_number = ? AND session_id = ?',
          [flightId, seat, sessionId]
        );
      }
    } else {
      // Release all locks for this session on this flight
      db.run(
        'DELETE FROM seat_locks WHERE flight_id = ? AND session_id = ?',
        [flightId, sessionId]
      );
    }

    req.app.locals.saveDb();
    res.json({ message: 'Seats released' });
  } catch (error) {
    console.error('Error releasing seats:', error);
    res.status(500).json({ error: 'Failed to release seats' });
  }
});

// GET /api/v1/seats/:flightId — Get seat map for a flight
seatsRouter.get('/:flightId', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const flightId = parseInt(req.params.flightId, 10);

  try {
    // Get aircraft config
    const flightResult = db.exec(`
      SELECT a.* FROM flights f 
      JOIN aircraft a ON f.aircraft_id = a.id 
      WHERE f.id = ?
    `, [flightId]);

    if (flightResult.length === 0 || flightResult[0].values.length === 0) {
      res.status(404).json({ error: 'Flight not found' });
      return;
    }

    const cols = flightResult[0].columns;
    const row = flightResult[0].values[0];
    const ac: any = {};
    cols.forEach((c, i) => { ac[c] = row[i]; });

    // Get booked seats
    const bookedResult = db.exec(
      'SELECT seat_number, seat_class FROM booking_seats WHERE flight_id = ?',
      [flightId]
    );
    const bookedSeats = new Map<string, string>();
    if (bookedResult.length > 0) {
      bookedResult[0].values.forEach(r => {
        bookedSeats.set(r[0] as string, r[1] as string);
      });
    }

    // Get locked seats
    const lockedResult = db.exec(
      "SELECT seat_number, session_id FROM seat_locks WHERE flight_id = ? AND expires_at > datetime('now')",
      [flightId]
    );
    const lockedMap = new Map<string, string>();
    if (lockedResult.length > 0) {
      lockedResult[0].values.forEach(r => {
        lockedMap.set(r[0] as string, r[1] as string);
      });
    }

    // Deterministic status generator for realistic airline seat map occupancy
    function getBaselineSeatStatus(fId: number, rowNum: number, colIndex: number, isWindow: boolean): 'booked' | 'waitlist' | 'available' {
      const val = (fId * 1013 + rowNum * 37 + colIndex * 19 + 7) % 100;
      if (isWindow) {
        // Window seats are highly sought after & scarce (~82% occupied, ~6% waitlist, ~12% available)
        if (val < 82) return 'booked';
        if (val < 88) return 'waitlist';
        return 'available';
      }
      if (val < 62) return 'booked';
      if (val < 68) return 'waitlist';
      return 'available';
    }

    // Build seat map
    const seatLetters = 'ABCDEFGHJK'; // Skip I
    const sections: any[] = [];
    let currentRow = 1;

    let totalSeats = 0;
    let availableSeats = 0;
    let occupiedSeats = 0;
    let waitlistSeats = 0;
    let windowAvailable = 0;
    let aisleAvailable = 0;

    // Helper to build a section
    function buildSection(name: string, rows: number, seatsPerRow: number, aislePositions: string) {
      if (rows === 0) return;
      const aisles = aislePositions.split(',').filter(Boolean).map(Number);
      const sectionSeats: any[] = [];

      for (let r = 0; r < rows; r++) {
        const rowNum = currentRow + r;
        for (let s = 0; s < seatsPerRow; s++) {
          const letter = seatLetters[s];
          const seatNumber = `${rowNum}${letter}`;
          const isRealBooked = bookedSeats.has(seatNumber);
          const isLocked = lockedMap.has(seatNumber);
          const isWindow = s === 0 || s === seatsPerRow - 1;
          const isAisle = aisles.some(a => s === a - 1 || s === a);
          const isMiddle = !isWindow && !isAisle;

          let status: 'available' | 'booked' | 'locked' | 'waitlist' = 'available';
          if (isRealBooked) {
            status = 'booked';
          } else if (isLocked) {
            status = 'locked';
          } else {
            status = getBaselineSeatStatus(flightId, rowNum, s, isWindow);
          }

          totalSeats++;
          if (status === 'available') {
            availableSeats++;
            if (isWindow) windowAvailable++;
            if (isAisle) aisleAvailable++;
          } else if (status === 'waitlist') {
            waitlistSeats++;
          } else {
            occupiedSeats++;
          }

          sectionSeats.push({
            number: seatNumber,
            row: rowNum,
            column: s,
            letter,
            status,
            type: isWindow ? 'window' : isAisle ? 'aisle' : 'middle',
            lockedBySession: isLocked ? lockedMap.get(seatNumber) : null,
          });
        }
      }

      sections.push({
        name,
        startRow: currentRow,
        endRow: currentRow + rows - 1,
        seatsPerRow,
        aislePositions: aisles,
        seats: sectionSeats,
      });

      currentRow += rows;
    }

    buildSection('first', ac.rows_first, ac.seats_per_row_first, ac.aisle_position_first);
    buildSection('business', ac.rows_business, ac.seats_per_row_business, ac.aisle_position_business);
    buildSection('economy', ac.rows_economy, ac.seats_per_row_economy, ac.aisle_position_economy);

    res.json({
      flightId,
      aircraft: { model: ac.model, code: ac.code },
      sections,
      stats: {
        totalSeats,
        availableSeats,
        occupiedSeats,
        waitlistSeats,
        windowAvailable,
        aisleAvailable,
      },
    });
  } catch (error) {
    console.error('Error fetching seat map:', error);
    res.status(500).json({ error: 'Failed to fetch seat map' });
  }
});
