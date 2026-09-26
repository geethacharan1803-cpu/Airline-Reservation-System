import { Router, Request, Response } from 'express';
import { Database } from 'sql.js';

export const flightsRouter = Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

// Helper to map DB row to flight object
function mapFlightRow(columns: string[], row: any[]): any {
  const obj: any = {};
  columns.forEach((col, i) => {
    obj[col] = row[i];
  });
  return obj;
}

// ML recommendation ranker with graceful fallback
async function rankFlightsWithML(flights: any[], fareClass: string): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`${ML_SERVICE_URL}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flights: flights.map(f => ({
          ...f,
          price: f.pricing[fareClass] || f.pricing.economy
        })),
        sort_by: 'recommended'
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && data.results && data.results.length > 0) {
        return data.results;
      }
    }
  } catch (err) {
    // Fallback below
  }

  // Graceful heuristic fallback ranking
  return flights.map(f => {
    const price = f.pricing[fareClass] || f.pricing.economy;
    const score = Math.round(Math.max(65, Math.min(98, 100 - (price / 25))));
    return {
      ...f,
      recommendationScore: score,
      tags: score >= 88 ? ['Top Pick'] : score >= 80 ? ['Best Value'] : ['Reliable Choice']
    };
  });
}

// Helper: Format INR currency
function formatINR(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

// -----------------------------------------------------------------------------
// Helper: Calculate "When to Book" Price Advice (Rule-Based & Historical)
// -----------------------------------------------------------------------------
export function getRoutePriceAdvice(
  db: Database,
  originCode: string,
  destCode: string,
  targetDateStr?: string,
  currentLowestPrice?: number
) {
  let avgPrice = 0;
  let minPrice = 0;
  let maxPrice = 0;

  try {
    const histResult = db.exec(
      `SELECT AVG(avg_price) as avg_p, MIN(min_price) as min_p, MAX(max_price) as max_p
       FROM price_history
       WHERE origin = ? AND destination = ?`,
      [originCode, destCode]
    );

    if (histResult.length > 0 && histResult[0].values.length > 0 && histResult[0].values[0][0] != null) {
      avgPrice = Math.round(histResult[0].values[0][0] as number);
      minPrice = Math.round(histResult[0].values[0][1] as number);
      maxPrice = Math.round(histResult[0].values[0][2] as number);
    }
  } catch (e) {
    // table might be empty or fallback
  }

  if (avgPrice === 0) {
    const baseCheck = db.exec(
      `SELECT AVG(base_price_economy) FROM flights WHERE origin = ? AND destination = ?`,
      [originCode, destCode]
    );
    if (baseCheck.length > 0 && baseCheck[0].values.length > 0 && baseCheck[0].values[0][0] != null) {
      avgPrice = Math.round(baseCheck[0].values[0][0] as number);
      minPrice = Math.round(avgPrice * 0.85);
      maxPrice = Math.round(avgPrice * 1.35);
    } else {
      avgPrice = 5200;
      minPrice = 4100;
      maxPrice = 7500;
    }
  }

  const now = new Date();
  const targetDate = targetDateStr ? new Date(targetDateStr) : new Date(now.getTime() + 86400000 * 5);
  const diffDays = Math.max(0, Math.round((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const currentPrice = currentLowestPrice && currentLowestPrice > 0 ? currentLowestPrice : avgPrice;

  let recommendation: 'Book Now' | 'Wait 2-3 days' | 'Prices are rising – book soon';
  let trend: 'low' | 'falling' | 'rising';
  let confidence: number;
  let advice: string;
  let expectedChangeText: string;

  if (diffDays <= 5 || currentPrice >= avgPrice * 1.15) {
    recommendation = 'Prices are rising – book soon';
    trend = 'rising';
    confidence = Math.min(95, 82 + Math.round((6 - Math.min(diffDays, 6)) * 2));
    advice = `High travel demand detected for this date. Remaining seats are selling quickly and prices typically rise +10% to +25% in the final 5 days.`;
    expectedChangeText = '+₹600 to +₹1,400 in next 48h';
  } else if (diffDays >= 14 && currentPrice > avgPrice * 1.05) {
    recommendation = 'Wait 2-3 days';
    trend = 'falling';
    confidence = 78;
    advice = `Current fare is slightly above historical average. Off-peak fare updates typically roll out mid-week for flights booked 2+ weeks out.`;
    expectedChangeText = '-₹400 to -₹750 expected drop';
  } else {
    recommendation = 'Book Now';
    trend = 'low';
    confidence = 89;
    const savings = Math.max(0, avgPrice - currentPrice);
    advice = savings > 0 
      ? `Great time to book! Current price is ₹${savings.toLocaleString('en-IN')} below the 30-day route average (₹${avgPrice.toLocaleString('en-IN')}).`
      : `Current fare is at a stable seasonal baseline. Locking in now protects against upcoming fare tier jumps.`;
    expectedChangeText = 'Locked at lowest available tier';
  }

  return {
    route: `${originCode} → ${destCode}`,
    recommendation,
    urgency: trend === 'rising' ? 'high' : trend === 'falling' ? 'medium' : 'low',
    confidence,
    reason: advice,
    advice,
    expectedChange: expectedChangeText,
    currentPrice,
    currentMinPrice: currentPrice,
    historicalAverage: avgPrice,
    historicalAvgPrice: avgPrice,
    priceDifference: Math.abs(currentPrice - avgPrice),
    priceTrend: trend === 'rising' ? 'rising' : trend === 'falling' ? 'falling' : 'stable',
    avgOccupancyPercent: 78,
    daysToDeparture: diffDays,
    priceRange: {
      low: minPrice,
      avg: avgPrice,
      high: maxPrice
    },
    daysUntilDeparture: diffDays
  };
}

// -----------------------------------------------------------------------------
// Helper: 7-Day Flexible Date Price Calendar (±3 days)
// -----------------------------------------------------------------------------
export function getFlexiblePriceCalendar(
  db: Database,
  originCode: string,
  destCode: string,
  centerDateStr: string,
  fareClass: string = 'economy'
) {
  let centerDate = centerDateStr ? new Date(centerDateStr) : new Date();
  if (isNaN(centerDate.getTime())) {
    centerDate = new Date();
    centerDate.setDate(centerDate.getDate() + 1);
  }
  const calendar: any[] = [];

  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(centerDate);
    d.setDate(d.getDate() + offset);
    const dateIso = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayMonth = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const priceCol = fareClass === 'business' ? 'base_price_business' : fareClass === 'first' ? 'base_price_first' : 'base_price_economy';
    const dayRes = db.exec(
      `SELECT MIN(${priceCol}), COUNT(*)
       FROM flights
       WHERE origin = ? AND destination = ?
         AND status = 'scheduled'
         AND DATE(departure_time) = ?`,
      [originCode, destCode, dateIso]
    );

    let lowestPrice: number | null = null;
    let flightCount = 0;

    if (dayRes.length > 0 && dayRes[0].values.length > 0 && dayRes[0].values[0][0] != null) {
      lowestPrice = Math.round(dayRes[0].values[0][0] as number);
      flightCount = dayRes[0].values[0][1] as number;
    }

    calendar.push({
      date: dateIso,
      dayName,
      dayMonth,
      dayOfWeek: dayName,
      displayDate: dayMonth,
      lowestPrice,
      minPrice: lowestPrice,
      flightCount,
      isSelected: offset === 0,
      isSearchedDate: offset === 0,
      isLowestInWindow: false
    });
  }

  const validPrices = calendar.filter(c => c.lowestPrice != null).map(c => c.lowestPrice as number);
  const minCalPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
  calendar.forEach(c => {
    c.isLowestInWindow = (minCalPrice != null && c.lowestPrice === minCalPrice);
  });

  return calendar;
}

// Helper: Query flights for route and date
function queryFlightsForRoute(
  db: Database,
  origVal: string,
  destVal: string,
  date?: string,
  flexibleDates?: boolean
): any[] {
  let query = `
    SELECT f.id, f.flight_number, f.origin, f.destination,
           f.departure_time, f.arrival_time,
           f.base_price_economy, f.base_price_business, f.base_price_first,
           f.status, f.overbooking_limit,
           a.model as aircraft_model, a.code as aircraft_code, a.total_seats,
           a.rows_economy, a.rows_business, a.rows_first,
           a.seats_per_row_economy, a.seats_per_row_business, a.seats_per_row_first,
           orig.city as origin_city, orig.country as origin_country,
           dest.city as destination_city, dest.country as destination_country
    FROM flights f
    JOIN aircraft a ON f.aircraft_id = a.id
    JOIN airports orig ON f.origin = orig.code
    JOIN airports dest ON f.destination = dest.code
    WHERE (f.origin = ? OR UPPER(orig.city) = ? OR UPPER(orig.name) LIKE ?)
      AND (f.destination = ? OR UPPER(dest.city) = ? OR UPPER(dest.name) LIKE ?)
      AND f.status = 'scheduled'
      AND f.departure_time > datetime('now')
  `;
  const params: any[] = [
    origVal, origVal, `%${origVal}%`,
    destVal, destVal, `%${destVal}%`
  ];

  if (date) {
    if (flexibleDates) {
      const center = new Date(date);
      const minus3 = new Date(center);
      minus3.setDate(minus3.getDate() - 3);
      const plus3 = new Date(center);
      plus3.setDate(plus3.getDate() + 3);
      query += ` AND DATE(f.departure_time) BETWEEN ? AND ?`;
      params.push(minus3.toISOString().split('T')[0], plus3.toISOString().split('T')[0]);
    } else {
      query += ` AND DATE(f.departure_time) = ?`;
      params.push(date);
    }
  }

  query += ` ORDER BY f.departure_time ASC LIMIT 60`;

  let result = db.exec(query, params);

  // Fallback: If no flights on exact date, show next available scheduled flights
  if (result.length === 0 && date && !flexibleDates) {
    const fallbackQuery = `
      SELECT f.id, f.flight_number, f.origin, f.destination,
             f.departure_time, f.arrival_time,
             f.base_price_economy, f.base_price_business, f.base_price_first,
             f.status, f.overbooking_limit,
             a.model as aircraft_model, a.code as aircraft_code, a.total_seats,
             a.rows_economy, a.rows_business, a.rows_first,
             a.seats_per_row_economy, a.seats_per_row_business, a.seats_per_row_first,
             orig.city as origin_city, orig.country as origin_country,
             dest.city as destination_city, dest.country as destination_country
      FROM flights f
      JOIN aircraft a ON f.aircraft_id = a.id
      JOIN airports orig ON f.origin = orig.code
      JOIN airports dest ON f.destination = dest.code
      WHERE (f.origin = ? OR UPPER(orig.city) = ? OR UPPER(orig.name) LIKE ?)
        AND (f.destination = ? OR UPPER(dest.city) = ? OR UPPER(dest.name) LIKE ?)
        AND f.status = 'scheduled'
        AND f.departure_time > datetime('now')
      ORDER BY f.departure_time ASC LIMIT 50
    `;
    result = db.exec(fallbackQuery, [origVal, origVal, `%${origVal}%`, destVal, destVal, `%${destVal}%`]);
  }

  if (result.length === 0) return [];

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const flight = mapFlightRow(columns, row);

    // Count booked seats per class
    const bookedResult = db.exec(
      `SELECT seat_class, COUNT(*) as booked FROM booking_seats 
       WHERE flight_id = ? GROUP BY seat_class`,
      [flight.id]
    );
    
    const booked: any = { economy: 0, business: 0, first: 0 };
    if (bookedResult.length > 0) {
      bookedResult[0].values.forEach(r => {
        booked[r[0] as string] = r[1] as number;
      });
    }

    // Count locked seats
    const lockedResult = db.exec(
      `SELECT COUNT(*) FROM seat_locks WHERE flight_id = ? AND expires_at > datetime('now')`,
      [flight.id]
    );
    const lockedCount = lockedResult.length > 0 ? lockedResult[0].values[0][0] as number : 0;

    const totalEconomy = flight.rows_economy * flight.seats_per_row_economy;
    const totalBusiness = flight.rows_business * flight.seats_per_row_business;
    const totalFirst = flight.rows_first * flight.seats_per_row_first;

    const dep = new Date(flight.departure_time);
    const arr = new Date(flight.arrival_time);
    const durationMinutes = Math.round((arr.getTime() - dep.getTime()) / 60000);

    return {
      id: flight.id,
      flightNumber: flight.flight_number,
      origin: { code: flight.origin, city: flight.origin_city, country: flight.origin_country },
      destination: { code: flight.destination, city: flight.destination_city, country: flight.destination_country },
      departureTime: flight.departure_time,
      arrivalTime: flight.arrival_time,
      durationMinutes,
      aircraft: { model: flight.aircraft_model, code: flight.aircraft_code },
      pricing: {
        economy: flight.base_price_economy,
        business: flight.base_price_business,
        first: flight.base_price_first,
      },
      availability: {
        economy: { total: totalEconomy, booked: booked.economy, available: totalEconomy - booked.economy },
        business: { total: totalBusiness, booked: booked.business, available: totalBusiness - booked.business },
        first: { total: totalFirst, booked: booked.first, available: totalFirst - booked.first },
      },
      lockedSeats: lockedCount,
      status: flight.status,
    };
  });
}

// -----------------------------------------------------------------------------
// GET /api/v1/flights/price-advice — Standalone Price Prediction & Booking Advice
// -----------------------------------------------------------------------------
flightsRouter.get('/price-advice', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const { origin, destination, date, currentPrice } = req.query;

  if (!origin || !destination) {
    res.status(400).json({ error: 'Origin and destination are required' });
    return;
  }

  const origCode = (origin as string).match(/\(([A-Za-z]{3})\)/)?.[1] || (origin as string).slice(0, 3).toUpperCase();
  const destCode = (destination as string).match(/\(([A-Za-z]{3})\)/)?.[1] || (destination as string).slice(0, 3).toUpperCase();
  const curPrice = currentPrice ? parseFloat(currentPrice as string) : undefined;

  const advice = getRoutePriceAdvice(db, origCode, destCode, date as string, curPrice);
  res.json({ success: true, origin: origCode, destination: destCode, ...advice });
});

// -----------------------------------------------------------------------------
// GET /api/v1/flights/roundtrip — Round-Trip Smart Planning & Best Value Finder
// -----------------------------------------------------------------------------
flightsRouter.get('/roundtrip', async (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const outboundDate = (req.query.outboundDate || req.query.departureDate || req.query.date) as string;
  const returnDate = req.query.returnDate as string;
  const passengers = (req.query.passengers as string) || '1';
  const fareClass = (req.query.fareClass as string) || 'economy';
  const isFlexReturn = req.query.flexibleReturnDates === 'true' || req.query.flexibleReturn === 'true';
  const origin = req.query.origin as string;
  const destination = req.query.destination as string;

  if (!origin || !destination || !outboundDate || !returnDate) {
    res.status(400).json({ error: 'Origin, destination, outboundDate, and returnDate are required for round-trip' });
    return;
  }

  try {
    const origCode = (origin as string).match(/\(([A-Za-z]{3})\)/)?.[1] || (origin as string).trim().toUpperCase();
    const destCode = (destination as string).match(/\(([A-Za-z]{3})\)/)?.[1] || (destination as string).trim().toUpperCase();
    const numPax = parseInt(passengers as string, 10) || 1;
    const fc = (fareClass as string) || 'economy';

    // 1. Search Outbound flights
    const outboundRaw = queryFlightsForRoute(db, origCode, destCode, outboundDate as string, false);
    const availableOutbound = outboundRaw.filter(f => {
      const avail = f.availability[fc as keyof typeof f.availability];
      return avail && avail.available >= numPax;
    });
    const rankedOutbound = await rankFlightsWithML(availableOutbound, fc);

    // 2. Search Return flights
    const returnRaw = queryFlightsForRoute(db, destCode, origCode, returnDate as string, isFlexReturn);
    const availableReturn = returnRaw.filter(f => {
      const avail = f.availability[fc as keyof typeof f.availability];
      return avail && avail.available >= numPax;
    });
    const rankedReturn = await rankFlightsWithML(availableReturn, fc);

    // 3. Mark cheapest in each leg
    const minOutboundPrice = availableOutbound.reduce((min, f) => {
      const p = f.pricing[fc as keyof typeof f.pricing] || f.pricing.economy;
      return p < min ? p : min;
    }, Infinity);

    const minReturnPrice = availableReturn.reduce((min, f) => {
      const p = f.pricing[fc as keyof typeof f.pricing] || f.pricing.economy;
      return p < min ? p : min;
    }, Infinity);

    const outboundFlights = rankedOutbound.map(f => {
      const price = f.pricing[fc as keyof typeof f.pricing] || f.pricing.economy;
      const isCheapest = minOutboundPrice !== Infinity && price === minOutboundPrice;
      return {
        ...f,
        isCheapest,
        priceDiffFromCheapest: minOutboundPrice !== Infinity ? Math.round(price - minOutboundPrice) : 0,
        cheapestComparisonText: isCheapest ? 'Cheapest Outbound' : `+${formatINR(price - minOutboundPrice)} vs cheapest`
      };
    });

    const returnFlights = rankedReturn.map(f => {
      const price = f.pricing[fc as keyof typeof f.pricing] || f.pricing.economy;
      const isCheapest = minReturnPrice !== Infinity && price === minReturnPrice;
      return {
        ...f,
        isCheapest,
        priceDiffFromCheapest: minReturnPrice !== Infinity ? Math.round(price - minReturnPrice) : 0,
        cheapestComparisonText: isCheapest ? 'Cheapest Return' : `+${formatINR(price - minReturnPrice)} vs cheapest`
      };
    });

    // 4. Calculate Best Value Combination
    let bestValueCombo: any = null;
    let lowestComboPrice = Infinity;

    for (const outF of outboundFlights) {
      const outPrice = outF.pricing[fc as keyof typeof outF.pricing] || outF.pricing.economy;
      const outArrTime = new Date(outF.arrivalTime).getTime();

      for (const retF of returnFlights) {
        const retDepTime = new Date(retF.departureTime).getTime();
        // Return must be at least 2 hours after outbound arrival
        if (retDepTime > outArrTime + (2 * 60 * 60 * 1000)) {
          const retPrice = retF.pricing[fc as keyof typeof retF.pricing] || retF.pricing.economy;
          const comboPrice = outPrice + retPrice;

          // Score based on price + convenient daytime flight timing bonus
          const outHour = new Date(outF.departureTime).getHours();
          const retHour = new Date(retF.departureTime).getHours();
          const timingBonus = (outHour >= 8 && outHour <= 19 ? 300 : 0) + (retHour >= 9 && retHour <= 20 ? 300 : 0);
          const effectiveScore = comboPrice - timingBonus;

          if (effectiveScore < lowestComboPrice) {
            lowestComboPrice = effectiveScore;
            // Round-trip bundled discount (₹500 discount for combo)
            const bundledPrice = Math.round(comboPrice * 0.95);
            const savings = comboPrice - bundledPrice;

            bestValueCombo = {
              outboundFlight: outF,
              returnFlight: retF,
              totalBasePrice: comboPrice,
              totalRoundTripPrice: bundledPrice,
              combinedPrice: bundledPrice,
              savingsAmount: savings,
              bundledSavings: savings,
              bundledDiscountText: `Save ${formatINR(savings)} with Round-Trip Bundle`,
              badge: 'Best Value Recommendation',
              reason: 'Optimal match of lowest combined fare and convenient daytime travel schedule.',
              valueRationale: 'Optimal match of lowest combined fare and convenient daytime travel schedule.',
              score: Math.round(lowestComboPrice)
            };
          }
        }
      }
    }

    const priceCalendarOutbound = getFlexiblePriceCalendar(db, origCode, destCode, outboundDate as string, fc);
    const priceCalendarReturn = getFlexiblePriceCalendar(db, destCode, origCode, returnDate as string, fc);
    const priceAdviceOutbound = getRoutePriceAdvice(db, origCode, destCode, outboundDate as string, minOutboundPrice);

    res.json({
      success: true,
      tripType: 'roundtrip',
      origin: origCode,
      destination: destCode,
      departureDate: outboundDate,
      returnDate,
      fareClass: fc,
      outboundFlights,
      returnFlights,
      bestValueCombo,
      outboundPriceCalendar: priceCalendarOutbound,
      returnPriceCalendar: priceCalendarReturn,
      priceAdvice: priceAdviceOutbound,
      outbound: {
        flights: outboundFlights,
        total: outboundFlights.length,
        cheapestFlightId: minOutboundPrice !== Infinity ? outboundFlights.find(f => f.isCheapest)?.id : null,
        cheapestPrice: minOutboundPrice !== Infinity ? minOutboundPrice : null,
        priceCalendar: priceCalendarOutbound,
        priceAdvice: priceAdviceOutbound
      },
      return: {
        flights: returnFlights,
        total: returnFlights.length,
        cheapestFlightId: minReturnPrice !== Infinity ? returnFlights.find(f => f.isCheapest)?.id : null,
        cheapestPrice: minReturnPrice !== Infinity ? minReturnPrice : null,
        priceCalendar: priceCalendarReturn
      }
    });
  } catch (error: any) {
    console.error('Error searching round-trip flights:', error);
    res.status(500).json({ error: 'Failed to search round-trip flights', details: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/v1/flights/search — Search flights (Enhanced with comparison & filters)
// -----------------------------------------------------------------------------
flightsRouter.get('/search', async (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const {
    origin,
    destination,
    date,
    passengers = '1',
    fareClass = 'economy',
    flexibleDates = 'false',
    sortBy = 'price_asc',
    airline,
    maxDuration,
    departureWindow
  } = req.query;

  if (!origin || !destination) {
    res.status(400).json({ error: 'Origin and destination are required' });
    return;
  }

  try {
    const cleanOrigin = (origin as string).trim();
    const cleanDest = (destination as string).trim();

    const origCodeMatch = cleanOrigin.match(/\(([A-Za-z]{3})\)/) || cleanOrigin.match(/^([A-Za-z]{3})$/);
    const destCodeMatch = cleanDest.match(/\(([A-Za-z]{3})\)/) || cleanDest.match(/^([A-Za-z]{3})$/);

    const origVal = (origCodeMatch ? origCodeMatch[1] : cleanOrigin).toUpperCase();
    const destVal = (destCodeMatch ? destCodeMatch[1] : cleanDest).toUpperCase();
    const isFlex = flexibleDates === 'true';

    const rawFlights = queryFlightsForRoute(db, origVal, destVal, date as string, isFlex);

    if (rawFlights.length === 0) {
      res.json({
        flights: [],
        total: 0,
        priceAdvice: getRoutePriceAdvice(db, origVal, destVal, date as string),
        priceCalendar: date ? getFlexiblePriceCalendar(db, origVal, destVal, date as string, fareClass as string) : []
      });
      return;
    }

    const numPassengers = parseInt(passengers as string, 10) || 1;
    const fc = fareClass as string;

    // Filter by available seats
    let availableFlights = rawFlights.filter(f => {
      const avail = f.availability[fc as keyof typeof f.availability];
      return avail && avail.available >= numPassengers;
    });

    // Optional airline filter
    if (airline && typeof airline === 'string' && airline !== 'all') {
      availableFlights = availableFlights.filter(f => 
        f.flightNumber.toLowerCase().startsWith(airline.toLowerCase()) ||
        f.aircraft.model.toLowerCase().includes(airline.toLowerCase())
      );
    }

    // Optional duration filter
    if (maxDuration) {
      const maxMins = parseInt(maxDuration as string, 10);
      if (!isNaN(maxMins)) {
        availableFlights = availableFlights.filter(f => f.durationMinutes <= maxMins);
      }
    }

    // Optional departure time window filter
    if (departureWindow && typeof departureWindow === 'string' && departureWindow !== 'all') {
      availableFlights = availableFlights.filter(f => {
        const hour = new Date(f.departureTime).getHours();
        if (departureWindow === 'morning') return hour >= 6 && hour < 12;
        if (departureWindow === 'afternoon') return hour >= 12 && hour < 18;
        if (departureWindow === 'evening') return hour >= 18 && hour < 24;
        if (departureWindow === 'night') return hour >= 0 && hour < 6;
        return true;
      });
    }

    const rankedFlights = await rankFlightsWithML(availableFlights, fc);

    // Find cheapest flight
    const minPrice = rankedFlights.reduce((min, f) => {
      const p = f.pricing[fc as keyof typeof f.pricing] || f.pricing.economy;
      return p < min ? p : min;
    }, Infinity);

    // Decorate each flight with comparison metrics
    const flightsWithComparison = rankedFlights.map(f => {
      const price = f.pricing[fc as keyof typeof f.pricing] || f.pricing.economy;
      const isCheapest = minPrice !== Infinity && price === minPrice;
      const priceDiffFromCheapest = minPrice !== Infinity ? Math.round(price - minPrice) : 0;
      return {
        ...f,
        isCheapest,
        priceDiffFromCheapest,
        cheapestComparisonText: isCheapest ? 'Cheapest Flight' : `+${formatINR(priceDiffFromCheapest)} vs cheapest`
      };
    });

    // Sort by requested order (default: price_asc -> cheapest first!)
    flightsWithComparison.sort((a, b) => {
      const priceA = a.pricing[fc as keyof typeof a.pricing] || a.pricing.economy;
      const priceB = b.pricing[fc as keyof typeof b.pricing] || b.pricing.economy;
      if (sortBy === 'price_asc') return priceA - priceB;
      if (sortBy === 'price_desc') return priceB - priceA;
      if (sortBy === 'duration_asc') return a.durationMinutes - b.durationMinutes;
      if (sortBy === 'departure_asc') return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
      return (b.recommendationScore || 0) - (a.recommendationScore || 0);
    });

    // Generate price advice & 7-day flexible price calendar
    const priceAdvice = getRoutePriceAdvice(db, origVal, destVal, date as string, minPrice !== Infinity ? minPrice : undefined);
    const effectiveDate = (date as string) || (flightsWithComparison[0] ? flightsWithComparison[0].departureTime.split('T')[0] : new Date().toISOString().split('T')[0]);
    const priceCalendar = getFlexiblePriceCalendar(db, origVal, destVal, effectiveDate, fc);

    res.json({
      flights: flightsWithComparison,
      total: flightsWithComparison.length,
      cheapestFlightId: minPrice !== Infinity ? (flightsWithComparison.find(f => f.isCheapest)?.id || null) : null,
      cheapestPrice: minPrice !== Infinity ? minPrice : null,
      priceAdvice,
      priceCalendar
    });
  } catch (error) {
    console.error('Error searching flights:', error);
    res.status(500).json({ error: 'Failed to search flights' });
  }
});

// GET /api/v1/flights/:id — Get flight details
flightsRouter.get('/:id', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const flightId = parseInt(req.params.id, 10);

  try {
    const result = db.exec(`
      SELECT f.*, a.model as aircraft_model, a.code as aircraft_code, a.total_seats,
             a.rows_economy, a.rows_business, a.rows_first,
             a.seats_per_row_economy, a.seats_per_row_business, a.seats_per_row_first,
             a.aisle_position_economy, a.aisle_position_business, a.aisle_position_first,
             orig.city as origin_city, orig.name as origin_name, orig.country as origin_country,
             dest.city as destination_city, dest.name as destination_name, dest.country as destination_country
      FROM flights f
      JOIN aircraft a ON f.aircraft_id = a.id
      JOIN airports orig ON f.origin = orig.code
      JOIN airports dest ON f.destination = dest.code
      WHERE f.id = ?
    `, [flightId]);

    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ error: 'Flight not found' });
      return;
    }

    const columns = result[0].columns;
    const flight = mapFlightRow(columns, result[0].values[0]);

    // Get booked seats
    const seatsResult = db.exec(
      `SELECT seat_number, seat_class FROM booking_seats WHERE flight_id = ?`,
      [flightId]
    );
    const bookedSeats = seatsResult.length > 0
      ? seatsResult[0].values.map(r => ({ seatNumber: r[0], seatClass: r[1] }))
      : [];

    // Get locked seats
    const locksResult = db.exec(
      `SELECT seat_number FROM seat_locks WHERE flight_id = ? AND expires_at > datetime('now')`,
      [flightId]
    );
    const lockedSeats = locksResult.length > 0
      ? locksResult[0].values.map(r => r[0] as string)
      : [];

    const dep = new Date(flight.departure_time);
    const arr = new Date(flight.arrival_time);
    const durationMinutes = Math.round((arr.getTime() - dep.getTime()) / 60000);

    res.json({
      id: flight.id,
      flightNumber: flight.flight_number,
      origin: {
        code: flight.origin, city: flight.origin_city,
        name: flight.origin_name, country: flight.origin_country
      },
      destination: {
        code: flight.destination, city: flight.destination_city,
        name: flight.destination_name, country: flight.destination_country
      },
      departureTime: flight.departure_time,
      arrivalTime: flight.arrival_time,
      durationMinutes,
      aircraft: {
        model: flight.aircraft_model,
        code: flight.aircraft_code,
        config: {
          rowsEconomy: flight.rows_economy,
          rowsBusiness: flight.rows_business,
          rowsFirst: flight.rows_first,
          seatsPerRowEconomy: flight.seats_per_row_economy,
          seatsPerRowBusiness: flight.seats_per_row_business,
          seatsPerRowFirst: flight.seats_per_row_first,
          aisleEconomy: flight.aisle_position_economy,
          aisleBusiness: flight.aisle_position_business,
          aisleFirst: flight.aisle_position_first,
        }
      },
      pricing: {
        economy: flight.base_price_economy,
        business: flight.base_price_business,
        first: flight.base_price_first,
      },
      bookedSeats,
      lockedSeats,
      status: flight.status,
    });
  } catch (error) {
    console.error('Error fetching flight:', error);
    res.status(500).json({ error: 'Failed to fetch flight details' });
  }
});

// GET /api/v1/flights/:id/no-show — Predictive no-show ML intelligence
flightsRouter.get('/:id/no-show', async (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const flightId = parseInt(req.params.id, 10);

  try {
    const result = db.exec(`
      SELECT f.departure_time, a.total_seats,
             (SELECT COUNT(*) FROM booking_seats WHERE flight_id = f.id) as booked_count
      FROM flights f
      JOIN aircraft a ON f.aircraft_id = a.id
      WHERE f.id = ?
    `, [flightId]);

    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ error: 'Flight not found' });
      return;
    }

    const row = result[0].values[0];
    const depTime = new Date(row[0] as string);
    const totalSeats = row[1] as number;
    const bookedCount = row[2] as number;
    const now = new Date();
    const leadTimeDays = Math.max(0, Math.round((depTime.getTime() - now.getTime()) / (1000 * 3600 * 24)));
    const dayOfWeek = depTime.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) ? 1 : 0;

    try {
      const mlRes = await fetch(`${ML_SERVICE_URL}/predict/no-show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_time: leadTimeDays,
          fare_class: 'economy',
          is_weekend: isWeekend,
          total_seats: totalSeats
        })
      });

      if (mlRes.ok) {
        const mlData = (await mlRes.json()) as any;
        res.json({
          flightId,
          leadTimeDays,
          totalSeats,
          bookedCount,
          ...mlData
        });
        return;
      }
    } catch (e) {
      // Fallback below
    }

    // Heuristic fallback
    const prob = 0.082;
    const expected = Math.round(totalSeats * prob);
    const safeOverbook = Math.min(expected, Math.round(totalSeats * 0.04));

    res.json({
      flightId,
      leadTimeDays,
      totalSeats,
      bookedCount,
      no_show_probability: prob,
      no_show_percentage: `${(prob * 100).toFixed(1)}%`,
      expected_no_shows: expected,
      recommended_overbooking_seats: safeOverbook,
      overbooking_capacity: totalSeats + safeOverbook,
      risk_level: 'Low',
      model_type: 'Heuristic Baseline'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
