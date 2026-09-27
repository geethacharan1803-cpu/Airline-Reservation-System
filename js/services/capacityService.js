/**
 * ============================================================
 * SKYVOYAGE ENTERPRISE — Capacity & Overbooking Service
 *                         (Python/Applied ML)
 * ============================================================
 * JavaScript mirror of api/overbooking.py for offline/zero-build use.
 *
 * Implements:
 * 1. Logistic regression to estimate no-show probability p
 * 2. Expected cost minimization to derive optimal overbooking limit b:
 *
 *    E[Cost] = Σ P(X=k) · [BumpCost · max(0, k-b) + SpoilLoss · max(0, b-k)]
 *
 *    where X ~ Binomial(n, p) is the number of show-ups
 *
 * 3. Route-specific historical data simulation
 * ============================================================
 */

// ══════════════════════════════════════════════════════════
//  SIMULATED HISTORICAL DATA
// ══════════════════════════════════════════════════════════

/**
 * Simulated route-specific no-show rates (in reality, trained from data).
 * These represent logistic regression output probabilities.
 */
const ROUTE_NOSHOW_RATES = {
  'DEL-BOM': 0.08,
  'BOM-DEL': 0.09,
  'BLR-DEL': 0.07,
  'DEL-BLR': 0.06,
  'BOM-HYD': 0.10,
  'HYD-BOM': 0.09,
  'MAA-CCU': 0.12,
  'CCU-MAA': 0.11,
  'HYD-GOI': 0.15,
  'GOI-HYD': 0.14,
  'CCU-BLR': 0.08,
  'BLR-CCU': 0.07,
  'DEL-GOI': 0.13,
  'BOM-GOI': 0.11,
};

/** Default no-show probability when route data is unavailable */
const DEFAULT_NOSHOW_RATE = 0.10;

/** Cost parameters */
const DEFAULT_BUMP_COST = 15000;  // Cost of bumping a passenger (compensation + rebooking)
const DEFAULT_SPOIL_LOSS = 4500;  // Revenue lost per empty seat (opportunity cost)

// ══════════════════════════════════════════════════════════
//  LOGISTIC REGRESSION (Simplified)
// ══════════════════════════════════════════════════════════

/**
 * Sigmoid function: σ(z) = 1 / (1 + e^(-z))
 */
function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

/**
 * Simulated logistic regression prediction for no-show probability.
 * In production, this would use trained weights from the Python model.
 *
 * Features: [dayOfWeek, hour, routePopularity, tier, seasonality]
 *
 * @param {Object} features
 * @returns {number} p — predicted no-show probability
 */
export function predictNoShowProbability(features = {}) {
  const {
    route = '',
    dayOfWeek = new Date().getDay(),
    hour = new Date().getHours(),
    tier = 'basic',
    season = getCurrentSeason(),
  } = features;

  // Base rate from route history
  const baseRate = ROUTE_NOSHOW_RATES[route] || DEFAULT_NOSHOW_RATE;

  // Feature adjustments (simulating logistic regression coefficients)
  const weights = {
    weekend: 0.3,       // Weekend flights have higher no-show
    earlyMorning: 0.2,  // Very early flights have higher no-show
    lateNight: 0.15,
    tierGold: -0.4,     // Loyalty members show up more
    tierSilver: -0.25,
    tierBronze: -0.1,
    holiday: 0.25,      // Holiday season
    monsoon: 0.15,      // Monsoon disruptions
  };

  let z = Math.log(baseRate / (1 - baseRate)); // logit of base rate

  // Apply feature weights
  if (dayOfWeek === 0 || dayOfWeek === 6) z += weights.weekend;
  if (hour < 7) z += weights.earlyMorning;
  if (hour > 22) z += weights.lateNight;
  if (tier === 'gold') z += weights.tierGold;
  if (tier === 'silver') z += weights.tierSilver;
  if (tier === 'bronze') z += weights.tierBronze;
  if (season === 'holiday') z += weights.holiday;
  if (season === 'monsoon') z += weights.monsoon;

  return sigmoid(z);
}

function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 6 && month <= 9) return 'monsoon';
  if (month === 12 || month === 1) return 'holiday';
  return 'regular';
}

// ══════════════════════════════════════════════════════════
//  BINOMIAL PROBABILITY
// ══════════════════════════════════════════════════════════

/**
 * Compute binomial coefficient C(n, k) = n! / (k! * (n-k)!)
 * Using iterative method to avoid overflow.
 */
function binomialCoeff(n, k) {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return result;
}

/**
 * Binomial probability mass function P(X = k).
 * P(X = k) = C(n, k) * p^k * (1-p)^(n-k)
 *
 * @param {number} n — number of trials (booked passengers)
 * @param {number} k — number of successes (show-ups)
 * @param {number} p — probability of show-up (1 - noShowRate)
 */
function binomialPMF(n, k, p) {
  if (k > n || k < 0) return 0;
  return binomialCoeff(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

// ══════════════════════════════════════════════════════════
//  EXPECTED COST MINIMIZATION
// ══════════════════════════════════════════════════════════

/**
 * Compute the expected cost for a given overbooking level b.
 *
 * E[Cost] = Σ_{k=0}^{n+b} P(X=k) · [BumpCost · max(0, k - capacity) + SpoilLoss · max(0, capacity - k)]
 *
 * where:
 *   n = capacity (physical seats)
 *   b = overbooking limit (extra bookings allowed)
 *   X = number of passengers who show up
 *   X ~ Binomial(n + b, 1 - noShowRate)
 *
 * @param {number} capacity — physical seat count
 * @param {number} b — overbooking limit (extra bookings)
 * @param {number} noShowRate — probability of no-show
 * @param {number} bumpCost — cost per bumped passenger
 * @param {number} spoilLoss — revenue lost per empty seat
 * @returns {{ expectedCost: number, breakdown: Object }}
 */
export function computeExpectedCost(capacity, b, noShowRate, bumpCost = DEFAULT_BUMP_COST, spoilLoss = DEFAULT_SPOIL_LOSS) {
  const totalBooked = capacity + b;
  const showUpProb = 1 - noShowRate;
  let expectedCost = 0;
  let expectedBumpCost = 0;
  let expectedSpoilLoss = 0;
  const distribution = [];

  for (let k = 0; k <= totalBooked; k++) {
    const prob = binomialPMF(totalBooked, k, showUpProb);

    const bumpPenalty = Math.max(0, k - capacity) * bumpCost;
    const spoilPenalty = Math.max(0, capacity - k) * spoilLoss;
    const cost = prob * (bumpPenalty + spoilPenalty);

    expectedBumpCost += prob * bumpPenalty;
    expectedSpoilLoss += prob * spoilPenalty;
    expectedCost += cost;

    if (prob > 0.001) { // Only include significant probabilities
      distribution.push({
        showUps: k,
        probability: prob,
        bumpPenalty,
        spoilPenalty,
        weightedCost: cost,
      });
    }
  }

  return {
    expectedCost: Math.round(expectedCost),
    expectedBumpCost: Math.round(expectedBumpCost),
    expectedSpoilLoss: Math.round(expectedSpoilLoss),
    overbookingLevel: b,
    totalBooked,
    capacity,
    distribution,
  };
}

/**
 * Find the optimal overbooking limit that minimizes expected cost.
 *
 * @param {Object} params
 * @param {number} params.capacity — physical seat count
 * @param {number} params.noShowRate — estimated no-show probability
 * @param {number} [params.bumpCost] — cost per bumped passenger
 * @param {number} [params.spoilLoss] — revenue lost per empty seat
 * @param {number} [params.maxOverbook] — maximum overbooking limit to test
 * @returns {Object} optimal overbooking analysis
 */
export function findOptimalOverbooking({
  capacity,
  noShowRate,
  bumpCost = DEFAULT_BUMP_COST,
  spoilLoss = DEFAULT_SPOIL_LOSS,
  maxOverbook = 15,
}) {
  let optimal = { b: 0, cost: Infinity };
  const costCurve = [];

  for (let b = 0; b <= maxOverbook; b++) {
    const result = computeExpectedCost(capacity, b, noShowRate, bumpCost, spoilLoss);
    costCurve.push({
      overbookingLevel: b,
      expectedCost: result.expectedCost,
      expectedBumpCost: result.expectedBumpCost,
      expectedSpoilLoss: result.expectedSpoilLoss,
    });

    if (result.expectedCost < optimal.cost) {
      optimal = { b, cost: result.expectedCost };
    }
  }

  const optimalDetails = computeExpectedCost(capacity, optimal.b, noShowRate, bumpCost, spoilLoss);

  return {
    optimalLevel: optimal.b,
    minimumExpectedCost: optimal.cost,
    noShowRate,
    capacity,
    costCurve,
    optimalDetails,
    recommendation: `Overbook by ${optimal.b} seats (total ${capacity + optimal.b} bookings for ${capacity} seats). ` +
      `Expected cost: ₹${optimal.cost.toLocaleString()}. No-show rate: ${(noShowRate * 100).toFixed(1)}%.`,
  };
}

/**
 * Full overbooking analysis for a specific flight.
 * @param {Object} flight — flight record from DB
 * @returns {Object}
 */
export function analyzeFlightOverbooking(flight) {
  const route = `${flight.origin}-${flight.destination}`;
  const noShowRate = predictNoShowProbability({ route });

  const analysis = findOptimalOverbooking({
    capacity: flight.totalSeats,
    noShowRate,
    maxOverbook: Math.min(15, Math.ceil(flight.totalSeats * 0.15)),
  });

  return {
    flight: {
      id: flight.id,
      flightNumber: flight.flightNumber,
      route,
    },
    noShowPrediction: {
      probability: noShowRate,
      percentage: (noShowRate * 100).toFixed(1) + '%',
      expectedNoShows: Math.round(flight.totalSeats * noShowRate),
    },
    ...analysis,
  };
}

// ══════════════════════════════════════════════════════════
//  DEMO DATA FOR UI
// ══════════════════════════════════════════════════════════

/**
 * Generate data for the overbooking cost curve chart.
 */
export function getCostCurveData(capacity = 152, noShowRate = 0.10) {
  const { costCurve, optimalLevel } = findOptimalOverbooking({ capacity, noShowRate });
  return { costCurve, optimalLevel, capacity, noShowRate };
}
