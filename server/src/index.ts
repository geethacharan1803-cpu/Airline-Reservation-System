import express from 'express';
import cors from 'cors';
import { getDb, initializeDatabase, saveDb } from './db/database';
import { seed } from './db/seed';
import { flightsRouter } from './routes/flights';
import { bookingsRouter } from './routes/bookings';
import { paymentsRouter } from './routes/payments';
import { airportsRouter } from './routes/airports';
import { seatsRouter } from './routes/seats';
import { chatRouter } from './routes/chat';
import { seatWatchRouter } from './routes/seatwatch';
import { seatWaitlistRouter } from './routes/seatwaitlist';

const PORT = process.env.PORT || 3001;

async function startServer() {
  const app = express();

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  // Initialize database
  const db = await getDb();
  initializeDatabase(db);
  
  // Auto-seed if database is empty
  const result = db.exec('SELECT COUNT(*) FROM airports');
  if (result.length === 0 || (result[0].values[0][0] as number) === 0) {
    console.log('Empty database detected. Running seed...');
    await seed();
  }

  // Make db available to routes
  app.locals.db = db;
  app.locals.saveDb = () => saveDb(db);

  // Periodically save DB to disk (every 30 seconds)
  setInterval(() => {
    try { saveDb(db); } catch (e) { /* ignore */ }
  }, 30000);

  // Clean expired seat locks every 60 seconds
  setInterval(() => {
    try {
      db.run("DELETE FROM seat_locks WHERE expires_at < datetime('now')");
    } catch (e) { /* ignore */ }
  }, 60000);

  // API Routes
  app.use('/api/v1/flights', flightsRouter);
  app.use('/api/v1/bookings', bookingsRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/airports', airportsRouter);
  app.use('/api/v1/seats', seatsRouter);
  app.use('/api/v1/chat', chatRouter);
  app.use('/api/v1/seatwatch', seatWatchRouter);
  app.use('/api/v1/seat-waitlist', seatWaitlistRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  });

  app.listen(PORT, () => {
    console.log(`\n  ✈️  SkyVoyage API Server running on http://localhost:${PORT}`);
    console.log(`  📊 Health check: http://localhost:${PORT}/api/health\n`);
  });
}

startServer().catch(console.error);
