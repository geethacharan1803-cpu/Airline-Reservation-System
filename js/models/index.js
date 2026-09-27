/**
 * ============================================================
 * SKYVOYAGE ENTERPRISE — OOP Models (OOPJ Units 1-4)
 * ============================================================
 * Demonstrates:
 * - Abstract base class (Person) — OOPJ Unit 1
 * - Inheritance (Passenger, User extend Person) — OOPJ Unit 2
 * - Encapsulation with private fields (#) — OOPJ Unit 1
 * - Polymorphism via Strategy Pattern (RefundPolicyStrategy) — OOPJ Unit 3
 * - Exception encapsulation (BookingException) — OOPJ Unit 4
 * ============================================================
 */

// ══════════════════════════════════════════════════════════
//  ABSTRACT BASE CLASS: Person
// ══════════════════════════════════════════════════════════

export class Person {
  #firstName;
  #lastName;
  #email;
  #phone;

  /**
   * @param {string} firstName
   * @param {string} lastName
   * @param {string} email
   * @param {string} phone
   */
  constructor(firstName, lastName, email, phone) {
    if (new.target === Person) {
      throw new TypeError('Cannot instantiate abstract class Person directly');
    }
    this.#firstName = firstName;
    this.#lastName = lastName;
    this.#email = email;
    this.#phone = phone;
  }

  get firstName() { return this.#firstName; }
  get lastName() { return this.#lastName; }
  get fullName() { return `${this.#firstName} ${this.#lastName}`; }
  get email() { return this.#email; }
  get phone() { return this.#phone; }

  set email(value) {
    if (!value || !value.includes('@')) throw new ValidationError('Invalid email address');
    this.#email = value;
  }

  /** Abstract method — must be overridden by subclasses */
  getRole() {
    throw new Error('Abstract method getRole() must be implemented');
  }

  /** Abstract method */
  toRecord() {
    throw new Error('Abstract method toRecord() must be implemented');
  }

  toString() {
    return `${this.getRole()}: ${this.fullName} <${this.email}>`;
  }
}

// ══════════════════════════════════════════════════════════
//  PASSENGER — extends Person
// ══════════════════════════════════════════════════════════

export class Passenger extends Person {
  #id;
  #tier;
  #idType;
  #idNumber;
  #bookingHistory;

  /**
   * @param {Object} data
   */
  constructor({ id, firstName, lastName, email, phone, tier = 'basic', idType, idNumber }) {
    super(firstName, lastName, email, phone);
    this.#id = id;
    this.#tier = tier;
    this.#idType = idType;
    this.#idNumber = idNumber;
    this.#bookingHistory = [];
  }

  get id() { return this.#id; }
  get tier() { return this.#tier; }
  get idType() { return this.#idType; }
  get idNumber() { return this.#idNumber; }
  get bookingHistory() { return [...this.#bookingHistory]; }

  /** @override */
  getRole() { return 'Passenger'; }

  /**
   * Get the tier weight for priority calculation.
   * @returns {number}
   */
  getTierWeight() {
    const weights = { gold: 4, silver: 3, bronze: 2, basic: 1 };
    return weights[this.#tier] || 1;
  }

  /**
   * Get the tier display information.
   */
  getTierInfo() {
    const tiers = {
      gold: { label: 'Gold', color: '#FFB020', icon: '👑' },
      silver: { label: 'Silver', color: '#94A3B8', icon: '⭐' },
      bronze: { label: 'Bronze', color: '#CD7F32', icon: '🔰' },
      basic: { label: 'Basic', color: '#64748B', icon: '✈️' },
    };
    return tiers[this.#tier] || tiers.basic;
  }

  addBooking(bookingId) {
    this.#bookingHistory.push(bookingId);
  }

  /** @override — Convert to a plain DB record */
  toRecord() {
    return {
      id: this.#id,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phone: this.phone,
      tier: this.#tier,
      idType: this.#idType,
      idNumber: this.#idNumber,
    };
  }

  /** Create a Passenger instance from a DB record */
  static fromRecord(record) {
    return new Passenger(record);
  }
}

// ══════════════════════════════════════════════════════════
//  USER — extends Person
// ══════════════════════════════════════════════════════════

export class User extends Person {
  #id;
  #role;
  #lastLogin;

  constructor({ id, firstName, lastName, email, phone, role = 'customer' }) {
    super(firstName, lastName, email, phone);
    this.#id = id;
    this.#role = role;
    this.#lastLogin = new Date();
  }

  get id() { return this.#id; }
  get role() { return this.#role; }
  get lastLogin() { return this.#lastLogin; }

  /** @override */
  getRole() { return this.#role; }

  isAdmin() { return this.#role === 'admin'; }

  recordLogin() { this.#lastLogin = new Date(); }

  /** @override */
  toRecord() {
    return {
      id: this.#id,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phone: this.phone,
      role: this.#role,
      lastLogin: this.#lastLogin.toISOString(),
    };
  }
}

// ══════════════════════════════════════════════════════════
//  STRATEGY PATTERN: Refund Policy (OOPJ Unit 3)
// ══════════════════════════════════════════════════════════

/**
 * Abstract Strategy interface for refund calculation.
 */
export class RefundPolicyStrategy {
  constructor(name) {
    if (new.target === RefundPolicyStrategy) {
      throw new TypeError('Cannot instantiate abstract RefundPolicyStrategy');
    }
    this.name = name;
  }

  /**
   * Calculate refund amount.
   * @param {number} originalAmount — original booking amount
   * @param {number} hoursBeforeDeparture — hours until departure
   * @returns {{ refundAmount: number, percentage: number, fee: number, reason: string }}
   */
  calculateRefund(originalAmount, hoursBeforeDeparture) {
    throw new Error('Abstract method calculateRefund() must be implemented');
  }
}

/**
 * Full refund policy — 100% refund anytime.
 */
export class FullRefundPolicy extends RefundPolicyStrategy {
  constructor() { super('Full Refund'); }

  calculateRefund(originalAmount, hoursBeforeDeparture) {
    return {
      refundAmount: originalAmount,
      percentage: 100,
      fee: 0,
      reason: 'Full refund — no cancellation fee applied',
    };
  }
}

/**
 * Tiered refund policy — percentage depends on how close to departure.
 */
export class TieredRefundPolicy extends RefundPolicyStrategy {
  constructor() { super('Tiered Refund'); }

  calculateRefund(originalAmount, hoursBeforeDeparture) {
    let percentage, fee, reason;

    if (hoursBeforeDeparture >= 72) {
      percentage = 95;
      fee = Math.round(originalAmount * 0.05);
      reason = 'Cancelled 72+ hrs before departure — 5% processing fee';
    } else if (hoursBeforeDeparture >= 24) {
      percentage = 75;
      fee = Math.round(originalAmount * 0.25);
      reason = 'Cancelled 24-72 hrs before departure — 25% cancellation fee';
    } else if (hoursBeforeDeparture >= 4) {
      percentage = 50;
      fee = Math.round(originalAmount * 0.50);
      reason = 'Cancelled 4-24 hrs before departure — 50% cancellation fee';
    } else {
      percentage = 0;
      fee = originalAmount;
      reason = 'Cancelled less than 4 hrs before departure — non-refundable';
    }

    return {
      refundAmount: Math.round(originalAmount * percentage / 100),
      percentage,
      fee,
      reason,
    };
  }
}

/**
 * Non-refundable policy — no refund at all.
 */
export class NonRefundablePolicy extends RefundPolicyStrategy {
  constructor() { super('Non-Refundable'); }

  calculateRefund(originalAmount, hoursBeforeDeparture) {
    return {
      refundAmount: 0,
      percentage: 0,
      fee: originalAmount,
      reason: 'Non-refundable fare — no refund available',
    };
  }
}

/**
 * Refund policy factory — returns the appropriate policy based on fare type.
 * @param {string} fareType — 'full' | 'tiered' | 'nonrefundable'
 * @returns {RefundPolicyStrategy}
 */
export function getRefundPolicy(fareType) {
  switch (fareType) {
    case 'full': return new FullRefundPolicy();
    case 'nonrefundable': return new NonRefundablePolicy();
    case 'tiered':
    default: return new TieredRefundPolicy();
  }
}

// ══════════════════════════════════════════════════════════
//  CUSTOM EXCEPTIONS (OOPJ Unit 4)
// ══════════════════════════════════════════════════════════

export class BookingException extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'BookingException';
    this.code = code;
    this.details = details;
  }
}

export class SeatUnavailableError extends BookingException {
  constructor(seatNo, flightId) {
    super(`Seat ${seatNo} is not available on flight ${flightId}`, 'SEAT_UNAVAILABLE', { seatNo, flightId });
    this.name = 'SeatUnavailableError';
  }
}

export class DoubleBookingError extends BookingException {
  constructor(seatNo, flightId) {
    super(`Seat ${seatNo} on flight ${flightId} is already booked — double-booking prevented`, 'DOUBLE_BOOKING', { seatNo, flightId });
    this.name = 'DoubleBookingError';
  }
}

export class LockTimeoutError extends BookingException {
  constructor(resource) {
    super(`Lock acquisition timed out for resource: ${resource}`, 'LOCK_TIMEOUT', { resource });
    this.name = 'LockTimeoutError';
  }
}

export class ValidationError extends BookingException {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR', { field });
    this.name = 'ValidationError';
  }
}

export class PaymentError extends BookingException {
  constructor(message) {
    super(message, 'PAYMENT_ERROR');
    this.name = 'PaymentError';
  }
}

export class CapacityExceededError extends BookingException {
  constructor(flightId, capacity, current) {
    super(`Flight ${flightId} capacity exceeded: ${current}/${capacity}`, 'CAPACITY_EXCEEDED', { flightId, capacity, current });
    this.name = 'CapacityExceededError';
  }
}
