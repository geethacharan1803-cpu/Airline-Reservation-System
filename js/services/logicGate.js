/**
 * ============================================================
 * SKYVOYAGE ENTERPRISE — Logic Gate Service (DMGT Unit 1)
 * ============================================================
 * Formal checkout rule validation using propositional logic.
 *
 * CanBook = (ValidIdentity ∧ PaymentCleared) ∧ (SeatAvailable ∨ OverbookAllowed)
 *
 * Features:
 * - Propositional variable evaluation
 * - Truth table generation for any formula
 * - Interactive expression parsing and evaluation
 * - Visualization-ready output
 * ============================================================
 */

// ══════════════════════════════════════════════════════════
//  PROPOSITIONS — Booking checkout variables
// ══════════════════════════════════════════════════════════

/**
 * @typedef {Object} BookingPropositions
 * @property {boolean} P — ValidIdentity (passenger has valid ID)
 * @property {boolean} Q — PaymentCleared (payment processed successfully)
 * @property {boolean} R — SeatAvailable (physical seat is available)
 * @property {boolean} S — OverbookAllowed (overbooking policy permits extra booking)
 */

/**
 * Evaluate the booking checkout formula:
 * CanBook = (P ∧ Q) ∧ (R ∨ S)
 *
 * @param {BookingPropositions} props
 * @returns {{
 *   canBook: boolean,
 *   subExpressions: Object,
 *   gate: string,
 *   explanation: string
 * }}
 */
export function evaluateBookingFormula({ P, Q, R, S }) {
  // Sub-expressions
  const identityAndPayment = P && Q;      // P ∧ Q
  const seatOrOverbook = R || S;           // R ∨ S
  const canBook = identityAndPayment && seatOrOverbook;  // (P ∧ Q) ∧ (R ∨ S)

  // Detailed gate breakdown
  const subExpressions = {
    'P (ValidIdentity)': P,
    'Q (PaymentCleared)': Q,
    'P ∧ Q (Identity & Payment)': identityAndPayment,
    'R (SeatAvailable)': R,
    'S (OverbookAllowed)': S,
    'R ∨ S (Seat or Overbook)': seatOrOverbook,
    '(P ∧ Q) ∧ (R ∨ S) → CanBook': canBook,
  };

  // Human-readable explanation
  let explanation;
  if (canBook) {
    explanation = '✓ Booking APPROVED: Identity verified, payment cleared, and seat availability confirmed.';
  } else {
    const reasons = [];
    if (!P) reasons.push('Identity not verified');
    if (!Q) reasons.push('Payment not cleared');
    if (!R && !S) reasons.push('No seat available and overbooking not allowed');
    explanation = `✗ Booking DENIED: ${reasons.join('; ')}.`;
  }

  return { canBook, subExpressions, explanation };
}

// ══════════════════════════════════════════════════════════
//  TRUTH TABLE GENERATOR
// ══════════════════════════════════════════════════════════

/**
 * Generate the complete truth table for the booking formula.
 * Enumerates all 2^4 = 16 combinations of P, Q, R, S.
 *
 * @returns {{ headers: string[], rows: Array<{inputs: boolean[], outputs: boolean[], canBook: boolean}> }}
 */
export function generateBookingTruthTable() {
  const headers = ['P', 'Q', 'R', 'S', 'P∧Q', 'R∨S', '(P∧Q)∧(R∨S)'];
  const rows = [];

  for (let p = 0; p <= 1; p++) {
    for (let q = 0; q <= 1; q++) {
      for (let r = 0; r <= 1; r++) {
        for (let s = 0; s <= 1; s++) {
          const P = !!p, Q = !!q, R = !!r, S = !!s;
          const pAndQ = P && Q;
          const rOrS = R || S;
          const result = pAndQ && rOrS;

          rows.push({
            inputs: [P, Q, R, S],
            intermediates: [pAndQ, rOrS],
            output: result,
            values: [P, Q, R, S, pAndQ, rOrS, result],
          });
        }
      }
    }
  }

  return { headers, rows };
}

/**
 * Generate a truth table for a custom logical expression.
 *
 * @param {string[]} variables — variable names (e.g., ['A', 'B', 'C'])
 * @param {Function} expression — function that takes an object of variable values and returns boolean
 * @param {string} expressionLabel — display label for the result column
 * @returns {{ headers: string[], rows: Object[] }}
 */
export function generateCustomTruthTable(variables, expression, expressionLabel = 'Result') {
  const headers = [...variables, expressionLabel];
  const rows = [];
  const n = variables.length;
  const totalRows = Math.pow(2, n);

  for (let i = 0; i < totalRows; i++) {
    const values = {};
    const inputArray = [];
    for (let j = 0; j < n; j++) {
      const val = !!((i >> (n - 1 - j)) & 1);
      values[variables[j]] = val;
      inputArray.push(val);
    }

    const result = expression(values);
    rows.push({
      inputs: inputArray,
      output: result,
      values: [...inputArray, result],
    });
  }

  return { headers, rows };
}

// ══════════════════════════════════════════════════════════
//  GATE OPERATIONS — For interactive evaluator
// ══════════════════════════════════════════════════════════

export const LogicGates = {
  AND: (a, b) => a && b,
  OR: (a, b) => a || b,
  NOT: (a) => !a,
  NAND: (a, b) => !(a && b),
  NOR: (a, b) => !(a || b),
  XOR: (a, b) => a !== b,
  XNOR: (a, b) => a === b,
  IMPLIES: (a, b) => !a || b,      // a → b ≡ ¬a ∨ b
  BICONDITIONAL: (a, b) => a === b, // a ↔ b
};

/**
 * Evaluate a gate operation.
 * @param {string} gate — gate name
 * @param {boolean[]} inputs — input values
 * @returns {boolean}
 */
export function evaluateGate(gate, inputs) {
  const fn = LogicGates[gate];
  if (!fn) throw new Error(`Unknown gate: ${gate}`);
  if (gate === 'NOT') return fn(inputs[0]);
  return fn(inputs[0], inputs[1]);
}

/**
 * Get all gate definitions for display.
 */
export function getGateDefinitions() {
  return [
    { name: 'AND', symbol: '∧', description: 'True only when all inputs are true', inputs: 2 },
    { name: 'OR', symbol: '∨', description: 'True when at least one input is true', inputs: 2 },
    { name: 'NOT', symbol: '¬', description: 'Inverts the input', inputs: 1 },
    { name: 'NAND', symbol: '⊼', description: 'NOT AND — false only when all inputs are true', inputs: 2 },
    { name: 'NOR', symbol: '⊽', description: 'NOT OR — true only when all inputs are false', inputs: 2 },
    { name: 'XOR', symbol: '⊕', description: 'True when inputs differ', inputs: 2 },
    { name: 'XNOR', symbol: '⊙', description: 'True when inputs are the same', inputs: 2 },
    { name: 'IMPLIES', symbol: '→', description: 'False only when P is true and Q is false', inputs: 2 },
    { name: 'BICONDITIONAL', symbol: '↔', description: 'True when both operands have the same truth value', inputs: 2 },
  ];
}

// ══════════════════════════════════════════════════════════
//  REAL-TIME CHECKOUT VALIDATION
// ══════════════════════════════════════════════════════════

/**
 * Validate a booking checkout in real-time, returning gate-level feedback.
 *
 * @param {Object} checkoutData
 * @param {Object} checkoutData.passenger — passenger information
 * @param {Object} checkoutData.payment — payment information
 * @param {Object} checkoutData.seat — seat availability info
 * @param {Object} checkoutData.overbooking — overbooking policy
 * @returns {Object}
 */
export function validateCheckout({ passenger, payment, seat, overbooking }) {
  const P = !!(passenger && passenger.firstName && passenger.lastName &&
               passenger.idType && passenger.idNumber);
  const Q = !!(payment && payment.status === 'completed');
  const R = !!(seat && seat.status === 'available');
  const S = !!(overbooking && overbooking.allowed);

  const result = evaluateBookingFormula({ P, Q, R, S });

  return {
    ...result,
    variables: {
      P: { value: P, label: 'Valid Identity', detail: P ? `${passenger?.firstName} ${passenger?.lastName}` : 'Missing passenger details' },
      Q: { value: Q, label: 'Payment Cleared', detail: Q ? 'Payment confirmed' : 'Payment pending' },
      R: { value: R, label: 'Seat Available', detail: R ? `Seat ${seat?.seatNo} available` : 'Seat not available' },
      S: { value: S, label: 'Overbook Allowed', detail: S ? 'Overbooking permitted' : 'Overbooking not allowed' },
    },
  };
}
