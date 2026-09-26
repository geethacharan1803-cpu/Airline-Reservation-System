import { Router, Request, Response } from 'express';
import { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';

export const paymentsRouter = Router();

// Simulated payment processing with realistic behavior
function simulatePaymentProcessing(cardNumber: string, amount: number): {
  success: boolean;
  transactionId: string;
  message: string;
  processingTimeMs: number;
} {
  const transactionId = `TXN-${uuidv4().substring(0, 12).toUpperCase()}`;
  
  // Simulate different outcomes based on card number patterns
  // Cards ending in specific digits trigger test scenarios
  const lastDigit = cardNumber.replace(/\s/g, '').slice(-1);
  
  if (lastDigit === '1') {
    // Decline — insufficient funds
    return { success: false, transactionId, message: 'Payment declined: Insufficient funds', processingTimeMs: 1500 };
  }
  if (lastDigit === '2') {
    // Decline — card expired
    return { success: false, transactionId, message: 'Payment declined: Card expired', processingTimeMs: 800 };
  }
  if (amount > 500000) {
    // High amount flag for INR
    return { success: false, transactionId, message: 'Payment declined: Amount exceeds transaction limit (₹5,00,000). Please contact your bank.', processingTimeMs: 2000 };
  }
  
  // Success for all other cases
  return { success: true, transactionId, message: 'Payment processed successfully', processingTimeMs: 1200 + Math.random() * 800 };
}

// Validate card number using Luhn algorithm (real credit card validation)
function isValidCardNumber(cardNumber: string): boolean {
  const num = cardNumber.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(num)) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

// POST /api/v1/payments — Process payment
paymentsRouter.post('/', async (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const {
    bookingId,
    pnr,
    cardNumber,
    cardHolder,
    expiryMonth,
    expiryYear,
    cvv,
    method = 'card',
    bankName,
    upiId,
  } = req.body;

  // Resolve booking ID from PNR if needed
  let resolvedBookingId = bookingId;
  if (!resolvedBookingId && pnr) {
    const pnrResult = db.exec('SELECT id FROM bookings WHERE pnr = ?', [pnr.toUpperCase()]);
    if (pnrResult.length > 0 && pnrResult[0].values.length > 0) {
      resolvedBookingId = pnrResult[0].values[0][0] as number;
    }
  }

  if (!resolvedBookingId) {
    res.status(400).json({ error: 'Booking ID or PNR is required' });
    return;
  }

  // Get booking details
  const bookingResult = db.exec(
    'SELECT id, total_amount, status, currency FROM bookings WHERE id = ?',
    [resolvedBookingId]
  );
  if (bookingResult.length === 0 || bookingResult[0].values.length === 0) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  const booking = {
    id: bookingResult[0].values[0][0] as number,
    totalAmount: bookingResult[0].values[0][1] as number,
    status: bookingResult[0].values[0][2] as string,
    currency: bookingResult[0].values[0][3] as string,
  };

  if (booking.status === 'confirmed') {
    res.status(400).json({ error: 'This booking is already paid and confirmed' });
    return;
  }

  if (booking.status === 'cancelled') {
    res.status(400).json({ error: 'Cannot process payment for a cancelled booking' });
    return;
  }

  // Validate method-specific inputs
  if (method === 'card' || method === 'rupay') {
    if (!cardNumber || !cardHolder || !expiryMonth || !expiryYear || !cvv) {
      res.status(400).json({ error: 'Card details are required: cardNumber, cardHolder, expiryMonth, expiryYear, cvv' });
      return;
    }

    // Validate card format (allow test cards that pass Luhn)
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 13 || cleanCard.length > 19) {
      res.status(400).json({ error: 'Invalid card number length' });
      return;
    }

    // Validate expiry
    const now = new Date();
    const expMonth = parseInt(expiryMonth, 10);
    const expYear = parseInt(expiryYear, 10);
    if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
      res.status(400).json({ error: 'Card has expired' });
      return;
    }

    // Validate CVV
    if (!/^\d{3,4}$/.test(cvv)) {
      res.status(400).json({ error: 'Invalid CVV' });
      return;
    }
  } else if (method === 'upi') {
    if (!upiId && !req.body.qrScanned) {
      // allow default mock upi if not provided or require valid pattern if provided
      if (upiId && !upiId.includes('@')) {
        res.status(400).json({ error: 'Invalid UPI ID format. Expected format: username@bank' });
        return;
      }
    }
  } else if (method === 'netbanking') {
    if (!bankName) {
      res.status(400).json({ error: 'Bank selection is required for Net Banking' });
      return;
    }
  }

  try {
    // Create payment record in processing state
    const transactionIdTemp = `TXN-${uuidv4().substring(0, 12).toUpperCase()}`;
    const cardLastFour = (method === 'card' || method === 'rupay') && cardNumber
      ? cardNumber.replace(/\s/g, '').slice(-4)
      : null;

    const dbMethod = (method === 'rupay') ? 'card' : (method === 'apple_pay' || method === 'paypal') ? 'wallet' : method;

    db.run(
      `INSERT INTO payments (booking_id, amount, currency, method, status, transaction_id, card_last_four, bank_name, upi_id)
       VALUES (?, ?, ?, ?, 'processing', ?, ?, ?, ?)`,
      [booking.id, booking.totalAmount, booking.currency, dbMethod, transactionIdTemp, cardLastFour, bankName || null, upiId || null]
    );
    const paymentIdResult = db.exec('SELECT last_insert_rowid()');
    const paymentId = paymentIdResult[0].values[0][0] as number;

    // Simulate processing delay (realistic)
    const result = simulatePaymentProcessing(
      method === 'card' ? cardNumber : '0000000000000000',
      booking.totalAmount
    );

    await new Promise(resolve => setTimeout(resolve, Math.min(result.processingTimeMs, 3000)));

    if (result.success) {
      db.run('BEGIN TRANSACTION');
      try {
        // Update payment
        db.run(
          "UPDATE payments SET status = 'completed', transaction_id = ?, updated_at = datetime('now') WHERE id = ?",
          [result.transactionId, paymentId]
        );
        // Confirm booking
        db.run(
          "UPDATE bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?",
          [booking.id]
        );
        db.run('COMMIT');
        req.app.locals.saveDb();
      } catch (e) {
        db.run('ROLLBACK');
        throw e;
      }

      res.json({
        success: true,
        paymentId,
        transactionId: result.transactionId,
        amount: booking.totalAmount,
        currency: booking.currency,
        method,
        cardLastFour,
        bookingStatus: 'confirmed',
        message: result.message,
      });
    } else {
      // Update payment as failed
      db.run(
        "UPDATE payments SET status = 'failed', transaction_id = ?, updated_at = datetime('now') WHERE id = ?",
        [result.transactionId, paymentId]
      );
      req.app.locals.saveDb();

      res.status(402).json({
        success: false,
        paymentId,
        transactionId: result.transactionId,
        message: result.message,
      });
    }
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Payment processing failed. Please try again.' });
  }
});

// GET /api/v1/payments/:bookingId — Get payment status
paymentsRouter.get('/:bookingId', (req: Request, res: Response) => {
  const db: Database = req.app.locals.db;
  const bookingId = parseInt(req.params.bookingId, 10);

  try {
    const result = db.exec(
      'SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC',
      [bookingId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      res.status(404).json({ error: 'No payment found for this booking' });
      return;
    }

    const payments = result[0].values.map(row => {
      const payment: any = {};
      result[0].columns.forEach((col, i) => { payment[col] = row[i]; });
      return {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        transactionId: payment.transaction_id,
        cardLastFour: payment.card_last_four,
        bankName: payment.bank_name,
        upiId: payment.upi_id,
        createdAt: payment.created_at,
      };
    });

    res.json({ payments });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({ error: 'Failed to fetch payment details' });
  }
});
