import { Router, Request, Response } from 'express';
import { Database } from 'sql.js';

export const airportsRouter = Router();

// GET /api/v1/airports — List all airports
airportsRouter.get('/', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const search = (req.query.search as string || '').toLowerCase();

  let query = 'SELECT code, name, city, country, latitude, longitude, timezone FROM airports';
  const params: string[] = [];

  if (search) {
    query += ' WHERE LOWER(code) LIKE ? OR LOWER(city) LIKE ? OR LOWER(name) LIKE ? OR LOWER(country) LIKE ?';
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  query += ' ORDER BY city ASC';

  try {
    const result = db.exec(query, params);
    if (result.length === 0) {
      res.json([]);
      return;
    }

    const airports = result[0].values.map(row => ({
      code: row[0],
      name: row[1],
      city: row[2],
      country: row[3],
      latitude: row[4],
      longitude: row[5],
      timezone: row[6],
    }));

    res.json(airports);
  } catch (error) {
    console.error('Error fetching airports:', error);
    res.status(500).json({ error: 'Failed to fetch airports' });
  }
});

// GET /api/v1/airports/:code — Get single airport
airportsRouter.get('/:code', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const code = req.params.code.toUpperCase();

  try {
    const result = db.exec(
      'SELECT code, name, city, country, latitude, longitude, timezone FROM airports WHERE code = ?',
      [code]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ error: 'Airport not found' });
      return;
    }

    const row = result[0].values[0];
    res.json({
      code: row[0], name: row[1], city: row[2], country: row[3],
      latitude: row[4], longitude: row[5], timezone: row[6],
    });
  } catch (error) {
    console.error('Error fetching airport:', error);
    res.status(500).json({ error: 'Failed to fetch airport' });
  }
});
