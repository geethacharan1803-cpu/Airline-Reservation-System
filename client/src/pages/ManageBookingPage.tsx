import { useState } from 'react';
import { Search, AlertCircle, XCircle, CheckCircle2, CreditCard } from 'lucide-react';
import { getBooking, cancelBooking, formatINR, type BookingDetail } from '../api';

const DEMO_PNRS = [
  { pnr: 'SK-784210', label: 'DEL → BLR (Rahul Sharma, Aadhaar)' },
  { pnr: 'SK-619043', label: 'BOM → DXB (Priya Patel, Passport)' },
  { pnr: 'SK-902341', label: 'BLR → MAA (Vikram Reddy, Business)' },
  { pnr: 'SK-331298', label: 'HYD → VTZ (Ananya Rao, Economy)' },
  { pnr: 'SK-458129', label: 'DEL → BOM (Amit Kumar, RuPay)' },
  { pnr: 'SK-821940', label: 'MAA → DEL (Sneha Iyer, UPI Paid)' },
];

export function ManageBookingPage() {
  const [pnrInput, setPnrInput] = useState('');
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState('');

  const lookupPNR = async (targetPnr: string) => {
    if (!targetPnr.trim()) return;
    setPnrInput(targetPnr.trim().toUpperCase());
    setLoading(true);
    setError('');
    setBooking(null);
    setCancelSuccess('');

    try {
      const b = await getBooking(targetPnr.trim());
      setBooking(b);
    } catch (err: any) {
      setError(err.message || 'Booking not found');
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    lookupPNR(pnrInput);
  };

  const handleCancel = async () => {
    if (!booking || cancelling) return;
    if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) return;

    setCancelling(true);
    try {
      const result = await cancelBooking(booking.pnr);
      setCancelSuccess(result.message);
      // Refresh booking
      const updated = await getBooking(booking.pnr);
      setBooking(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
          Manage Your Booking
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
          Enter your PNR (booking reference) to view, modify, or cancel your reservation.
        </p>

        {/* Quick Demo PNR Chips */}
        <div style={{
          background: 'var(--surface-color, #ffffff)',
          border: '1px solid var(--color-gray-200)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
            ⚡ Instant Evaluation — 1-Click Demo Bookings:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {DEMO_PNRS.map(item => (
              <button
                key={item.pnr}
                type="button"
                onClick={() => lookupPNR(item.pnr)}
                style={{
                  background: pnrInput === item.pnr ? 'var(--color-sky-500)' : 'var(--color-gray-100)',
                  color: pnrInput === item.pnr ? '#ffffff' : 'var(--text-primary)',
                  border: `1px solid ${pnrInput === item.pnr ? 'var(--color-sky-600)' : 'var(--color-gray-300)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 12px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{item.pnr}</span>
                <span style={{ opacity: 0.8, fontSize: '11px' }}>({item.label.split('(')[0].trim()})</span>
              </button>
            ))}
          </div>
        </div>

        {/* PNR Lookup Form */}
        <form onSubmit={handleLookup} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
          <input
            className="form-input"
            type="text"
            placeholder="Enter PNR (e.g. SK-784210)"
            value={pnrInput}
            onChange={e => setPnrInput(e.target.value.toUpperCase())}
            maxLength={12}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', letterSpacing: '0.15em', textTransform: 'uppercase' }}
          />
          <button type="submit" className="btn btn--primary" disabled={loading || pnrInput.trim().length < 4}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Search size={18} />}
            Retrieve
          </button>
        </form>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <AlertCircle size={20} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
            <span style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</span>
          </div>
        )}

        {cancelSuccess && (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)', color: '#16a34a', fontSize: 'var(--text-sm)' }}>
            {cancelSuccess}
          </div>
        )}

        {/* Booking Details */}
        {booking && (
          <div>
            {/* Status Banner */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-4) var(--space-6)',
              background: booking.status === 'confirmed' ? 'rgba(34,197,94,0.08)' :
                          booking.status === 'cancelled' ? 'rgba(239,68,68,0.08)' :
                          'rgba(245,158,11,0.08)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--space-6)',
              border: `1px solid ${
                booking.status === 'confirmed' ? 'rgba(34,197,94,0.2)' :
                booking.status === 'cancelled' ? 'rgba(239,68,68,0.2)' :
                'rgba(245,158,11,0.2)'
              }`
            }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Booking Status</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', textTransform: 'capitalize' }}>{booking.status}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xl)', fontWeight: 700, letterSpacing: '0.15em', color: 'var(--color-sky-600)' }}>
                {booking.pnr}
              </div>
            </div>

            {/* Flight Card */}
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="card__body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{formatTime(booking.flight.departureTime)}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{booking.flight.origin.city} ({booking.flight.origin.code})</div>
                  </div>
                  <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                    {booking.flight.flightNumber} · ✈ · {Math.floor(booking.flight.durationMinutes / 60)}h {booking.flight.durationMinutes % 60}m
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{formatTime(booking.flight.arrivalTime)}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{booking.flight.destination.city} ({booking.flight.destination.code})</div>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 'var(--space-3)' }}>
                  {formatDate(booking.flight.departureTime)} · {booking.flight.aircraft.model} · <span style={{ textTransform: 'capitalize' }}>{booking.fareClass}</span>
                </div>
              </div>
            </div>

            {/* Passengers & Verification Details */}
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="card__body">
                <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>Passenger Verification & Seating</h3>
                {booking.passengers.map((pax, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', borderBottom: i < booking.passengers.length - 1 ? '1px solid var(--color-gray-100)' : 'none' }}>
                    <div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{pax.firstName} {pax.lastName}</span>
                        <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 3 }}>
                        <span style={{ textTransform: 'capitalize' }}>{pax.passengerType}</span>
                        {pax.nationality && <span>· Nationality: <strong>{pax.nationality}</strong></span>}
                        {pax.idType && pax.idNumber && (
                          <span style={{ color: 'var(--color-sky-600)', background: 'rgba(14, 165, 233, 0.1)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                            {pax.idType.toUpperCase()}: {pax.idNumber}
                          </span>
                        )}
                        {pax.issuingCountry && <span>· Country: {pax.issuingCountry}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {pax.seat ? (
                        <span className="badge badge--info" style={{ fontWeight: 600 }}>Seat {pax.seat}</span>
                      ) : (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>No seat assigned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment & Cancellation Actions */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="card__body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Total Paid</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-sky-600)' }}>
                      {formatINR(booking.totalAmount)}
                    </div>
                    {booking.payment && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                        Method: {booking.payment.method?.toUpperCase()}
                        {booking.payment.upiId && ` (${booking.payment.upiId})`}
                        {booking.payment.bankName && ` (${booking.payment.bankName})`}
                        {booking.payment.cardLastFour && ` (•••• ${booking.payment.cardLastFour})`}
                      </div>
                    )}
                  </div>
                  {booking.status !== 'cancelled' && (
                    <button className="btn btn--danger" onClick={handleCancel} disabled={cancelling}>
                      {cancelling ? (
                        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: 'white' }} />
                      ) : (
                        <XCircle size={16} />
                      )}
                      Cancel Booking
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
