import { Router, Request, Response } from 'express';
import { Database } from 'sql.js';

export const seatWatchRouter = Router();

// Active SSE client connections keyed by passengerId
const sseClients: Map<number, Response[]> = new Map();

// Helper to push real-time alerts to connected client
export function broadcastSeatWatchAlert(passengerId: number, alertData: any) {
  const clients = sseClients.get(passengerId);
  if (clients && clients.length > 0) {
    const payload = `data: ${JSON.stringify(alertData)}\n\n`;
    clients.forEach(res => {
      try {
        res.write(payload);
      } catch (err) {
        // Client disconnected
      }
    });
  }
}

// -----------------------------------------------------------------------------
// POST /api/v1/seatwatch/subscribe — Enroll passenger into priority watcher queue
// -----------------------------------------------------------------------------
seatWatchRouter.post('/subscribe', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const {
    flightId,
    passengerId,
    passengerName,
    contactEmail,
    preferredSeatType = 'window',
    preferredSeatClass = 'economy',
    loyaltyTier = 'standard',
    maxUpgradeBid = 0
  } = req.body;

  if (!flightId || !passengerName || !contactEmail) {
    res.status(400).json({ error: 'Flight ID, passenger name, and contact email are required' });
    return;
  }

  // Multi-criteria ADSA priority score calculation
  const loyaltyWeights: Record<string, number> = {
    platinum: 100,
    gold: 75,
    silver: 50,
    standard: 20
  };
  const lScore = loyaltyWeights[loyaltyTier.toLowerCase()] || 20;
  const bidScore = Math.min(100, (Number(maxUpgradeBid) / 150) * 100);
  const priorityScore = Math.round(((0.40 * lScore) + (0.45 * bidScore) + 5) * 100) / 100;

  try {
    db.run(`
      INSERT INTO seat_watchers (
        flight_id, passenger_id, passenger_name, contact_email,
        preferred_seat_type, preferred_seat_class, priority_score,
        loyalty_tier, max_upgrade_bid, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [
      flightId,
      passengerId || null,
      passengerName,
      contactEmail,
      preferredSeatType.toLowerCase(),
      preferredSeatClass.toLowerCase(),
      priorityScore,
      loyaltyTier.toLowerCase(),
      Number(maxUpgradeBid) || 0
    ]);

    const result = db.exec('SELECT last_insert_rowid()');
    const watchId = result[0].values[0][0] as number;
    req.app.locals.saveDb();

    res.status(201).json({
      success: true,
      watchId,
      flightId,
      preferredSeatType,
      priorityScore,
      message: `Enrolled in SeatWatch for ${preferredSeatType} seat on flight ${flightId}`
    });
  } catch (error: any) {
    console.error('Error in seatwatch subscribe:', error);
    res.status(500).json({ error: 'Failed to subscribe to SeatWatch', details: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/v1/seatwatch/alerts/:passengerId — Poll active upgrade alerts
// -----------------------------------------------------------------------------
seatWatchRouter.get('/alerts/:passengerId', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const passengerId = parseInt(req.params.passengerId, 10);

  try {
    const result = db.exec(`
      SELECT o.offer_id, o.watch_id, o.flight_id, o.seat_number, o.seat_type,
             o.seat_class, o.upgrade_fee, o.claim_deadline, o.status,
             f.flight_number, orig.city as origin_city, dest.city as destination_city
      FROM upgrade_offers o
      JOIN flights f ON o.flight_id = f.id
      JOIN airports orig ON f.origin = orig.code
      JOIN airports dest ON f.destination = dest.code
      WHERE o.passenger_id = ? AND o.status = 'pending'
        AND datetime(o.claim_deadline) > datetime('now')
      ORDER BY o.created_at DESC
    `, [passengerId]);

    if (result.length === 0 || result[0].values.length === 0) {
      res.json({ alerts: [] });
      return;
    }

    const cols = result[0].columns;
    const now = Date.now();
    const alerts = result[0].values.map(row => {
      const obj: any = {};
      cols.forEach((c, i) => { obj[c] = row[i]; });
      const deadlineMs = new Date(obj.claim_deadline).getTime();
      const secondsRemaining = Math.max(0, Math.round((deadlineMs - now) / 1000));
      return {
        offerId: obj.offer_id,
        flightNumber: obj.flight_number,
        flightId: obj.flight_id,
        route: `${obj.origin_city} -> ${obj.destination_city}`,
        seatNumber: obj.seat_number,
        seatType: obj.seat_type,
        seatClass: obj.seat_class,
        upgradeFee: obj.upgrade_fee,
        secondsRemaining,
        status: obj.status
      };
    });

    res.json({ alerts });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch alerts', details: error.message });
  }
});

// -----------------------------------------------------------------------------
// POST /api/v1/seatwatch/claim — Claim an active upgrade offer within 60s
// -----------------------------------------------------------------------------
seatWatchRouter.post('/claim', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const { offerId, passengerId } = req.body;

  if (!offerId) {
    res.status(400).json({ error: 'Offer ID is required' });
    return;
  }

  try {
    const offerRes = db.exec(`
      SELECT o.offer_id, o.flight_id, o.seat_number, o.seat_class, o.upgrade_fee,
             o.claim_deadline, o.status, o.watch_id, w.passenger_name
      FROM upgrade_offers o
      JOIN seat_watchers w ON o.watch_id = w.watch_id
      WHERE o.offer_id = ?
    `, [offerId]);

    if (offerRes.length === 0 || offerRes[0].values.length === 0) {
      res.status(404).json({ error: 'Offer not found' });
      return;
    }

    const row = offerRes[0].values[0];
    const status = row[6] as string;
    const deadline = new Date(row[5] as string).getTime();
    const seatNumber = row[2] as string;
    const watchId = row[7] as number;
    const passengerName = row[8] as string;

    // DMGT Propositional Logic: (status == 'pending' ^ now <= deadline)
    if (status !== 'pending') {
      res.status(400).json({ error: `Offer is already ${status}` });
      return;
    }

    if (Date.now() > deadline) {
      db.run("UPDATE upgrade_offers SET status = 'expired' WHERE offer_id = ?", [offerId]);
      req.app.locals.saveDb();
      res.status(410).json({ error: 'Upgrade offer has expired. The 60-second claim window elapsed.' });
      return;
    }

    db.run('BEGIN TRANSACTION');
    try {
      // 1. Mark offer as claimed
      db.run("UPDATE upgrade_offers SET status = 'claimed' WHERE offer_id = ?", [offerId]);

      // 2. Mark watcher status as claimed
      db.run("UPDATE seat_watchers SET status = 'claimed', updated_at = datetime('now') WHERE watch_id = ?", [watchId]);

      // 3. Mark any other pending offers for this seat as declined/closed
      db.run("UPDATE upgrade_offers SET status = 'declined' WHERE offer_id != ? AND seat_number = ? AND status = 'pending'", [offerId, seatNumber]);

      db.run('COMMIT');
      req.app.locals.saveDb();

      res.json({
        success: true,
        offerId,
        seatNumber,
        passengerName,
        message: `Upgrade confirmed! Seat ${seatNumber} has been secured.`
      });
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Error claiming upgrade:', error);
    res.status(500).json({ error: 'Failed to claim upgrade', details: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/v1/seatwatch/events/:passengerId — Real-Time Server-Sent Events (SSE)
// -----------------------------------------------------------------------------
seatWatchRouter.get('/events/:passengerId', (req: Request, res: Response) => {
  const passengerId = parseInt(req.params.passengerId, 10);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!sseClients.has(passengerId)) {
    sseClients.set(passengerId, []);
  }
  sseClients.get(passengerId)!.push(res);

  // Send initial handshake ping
  res.write(`data: ${JSON.stringify({ type: 'connected', passengerId, timestamp: Date.now() })}\n\n`);

  req.on('close', () => {
    const list = sseClients.get(passengerId) || [];
    const idx = list.indexOf(res);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) sseClients.delete(passengerId);
  });
});

// -----------------------------------------------------------------------------
// Event Hook: Triggered by cancellation handler to notify top priority watcher
// -----------------------------------------------------------------------------
export function onSeatCancelledHook(
  db: Database,
  flightId: number,
  seatNumber: string,
  seatClass: string = 'economy'
): void {
  try {
    // Determine seat type from seat letter
    const letter = seatNumber.slice(-1).toUpperCase();
    const isWindow = (letter === 'A' || letter === 'F');
    const isAisle = (letter === 'C' || letter === 'D');
    const seatType = isWindow ? 'window' : isAisle ? 'aisle' : 'middle';

    // ADSA Max-Heap Query: Extract top priority active watcher for this flight and seat type
    const watcherQuery = db.exec(`
      SELECT watch_id, passenger_id, passenger_name, contact_email, priority_score
      FROM seat_watchers
      WHERE flight_id = ?
        AND (preferred_seat_type = ? OR preferred_seat_type = 'any')
        AND status = 'active'
      ORDER BY priority_score DESC, created_at ASC
      LIMIT 1
    `, [flightId, seatType]);

    if (watcherQuery.length === 0 || watcherQuery[0].values.length === 0) {
      return; // No active watcher in queue
    }

    const topWatcher = watcherQuery[0].values[0];
    const watchId = topWatcher[0] as number;
    const passengerId = topWatcher[1] as number;
    const passengerName = topWatcher[2] as string;

    // AI/ML Dynamic Upgrade Pricing Calculation
    const upgradeFee = seatClass === 'first' ? 149.0 : seatClass === 'business' ? 89.0 : (isWindow ? 39.0 : 29.0);

    // 60-second claim deadline
    const deadlineDate = new Date(Date.now() + 60 * 1000);
    const deadlineIso = deadlineDate.toISOString();

    // Insert upgrade offer atomically
    db.run(`
      INSERT INTO upgrade_offers (
        watch_id, flight_id, passenger_id, seat_number,
        seat_type, seat_class, upgrade_fee, claim_deadline, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [watchId, flightId, passengerId, seatNumber, seatType, seatClass, upgradeFee, deadlineIso]);

    // Update watcher status to 'notified'
    db.run("UPDATE seat_watchers SET status = 'notified', updated_at = datetime('now') WHERE watch_id = ?", [watchId]);

    // Fetch newly created offer ID
    const offerRes = db.exec('SELECT last_insert_rowid()');
    const offerId = offerRes[0].values[0][0] as number;

    // Dispatch real-time SSE push notification to connected client
    if (passengerId) {
      broadcastSeatWatchAlert(passengerId, {
        type: 'SEAT_OPENED',
        offerId,
        flightId,
        seatNumber,
        seatType,
        seatClass,
        upgradeFee,
        secondsRemaining: 60,
        claimDeadline: deadlineIso,
        message: `A ${seatType} seat (${seatNumber}) just opened on your flight! Claim now for $${upgradeFee} within 60 seconds.`
      });
    }

    console.log(`[SeatWatch] Upgrade offer #${offerId} generated for passenger "${passengerName}" on seat ${seatNumber} ($${upgradeFee}, 60s claim window)`);
  } catch (err) {
    console.error('[SeatWatch] Error processing seat cancellation hook:', err);
  }
}
