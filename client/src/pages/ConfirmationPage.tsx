import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle, Download, Copy, Sparkles, Building, Car,
  Luggage, Compass, ExternalLink, ShieldCheck, Clock
} from 'lucide-react';
import {
  getBooking, getSeatWaitlistStatus, formatINR,
  type BookingDetail, type SeatWaitlistEntry
} from '../api';

export function ConfirmationPage() {
  const { pnr } = useParams();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [waitlistEntries, setWaitlistEntries] = useState<SeatWaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pnr) return;
    Promise.all([
      getBooking(pnr),
      getSeatWaitlistStatus(pnr).catch(() => ({ entries: [] }))
    ])
      .then(([b, w]) => {
        setBooking(b);
        setWaitlistEntries(w.entries || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [pnr]);

  const copyPNR = () => {
    if (pnr) {
      navigator.clipboard.writeText(pnr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <p>Loading confirmation details...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: 'var(--space-16) 0' }}>
        <h2>Booking not found</h2>
        <Link to="/" className="btn btn--primary" style={{ marginTop: 'var(--space-4)' }}>
          Back to Home
        </Link>
      </div>
    );
  }

  const activeWaitlist = waitlistEntries.find(w => w.status === 'waiting' || w.status === 'notified');

  return (
    <div style={{ padding: 'var(--space-8) 0', background: 'var(--color-gray-50)', minHeight: '90vh' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        {/* Success Header */}
        <div className="confirmation" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="confirmation__icon">
            <CheckCircle size={40} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            Booking Confirmed!
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            Your flight reservation has been secured. Save your PNR ticket code below.
          </p>
          <div className="confirmation__pnr">
            {booking.pnr}
            <button
              onClick={copyPNR}
              style={{
                marginLeft: 'var(--space-3)',
                verticalAlign: 'middle',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
              title="Copy PNR"
            >
              {copied ? <CheckCircle size={20} style={{ color: '#16a34a' }} /> : <Copy size={20} />}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FEATURE 4: Active Seat Preference Waitlist Status Card                   */}
        {/* ========================================================================= */}
        {activeWaitlist && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)',
              border: '1.5px solid rgba(14, 165, 233, 0.3)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-5)',
              marginBottom: 'var(--space-6)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--color-sky-500)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Sparkles size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
                  <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, color: 'var(--color-sky-800)' }}>
                    🪟 Seat Preference Waitlist Active ({activeWaitlist.preferredSeatType.toUpperCase()})
                  </h3>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: activeWaitlist.status === 'notified' ? '#22c55e' : '#0284c7',
                      color: '#ffffff',
                    }}
                  >
                    {activeWaitlist.status === 'notified' ? 'Seat Opened!' : 'Waiting in Queue'}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                  {activeWaitlist.status === 'notified' ? (
                    <>
                      A preferred <strong>{activeWaitlist.preferredSeatType}</strong> seat (
                      <strong>{activeWaitlist.notifiedSeatNumber}</strong>) has opened up! Check the in-app alert banner
                      or click claim to complete your seat upgrade.
                    </>
                  ) : (
                    <>
                      You are priority waitlisted for a preferred{' '}
                      <strong style={{ textTransform: 'capitalize' }}>{activeWaitlist.preferredSeatType}</strong> seat. If
                      any passenger on Flight #{booking.flight.flightNumber} cancels or shifts seats, you will receive an
                      automatic priority notification at <strong>{booking.contactEmail}</strong> to claim the seat for free!
                    </>
                  )}
                </p>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  Current confirmed seat: <strong>{activeWaitlist.currentSeatNumber || 'Assigned'}</strong> · Passenger:{' '}
                  <strong>{activeWaitlist.passengerName}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Flight Details Card */}
        <div className="card" style={{ marginBottom: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card__body" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              Flight Details
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{formatTime(booking.flight.departureTime)}</div>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {booking.flight.origin.city} ({booking.flight.origin.code})
                </div>
              </div>
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{booking.flight.flightNumber}</div>
                <div style={{ color: 'var(--color-sky-500)', fontSize: 'var(--text-sm)', margin: '2px 0' }}>✈ ────── →</div>
                <div style={{ fontSize: 'var(--text-xs)' }}>
                  {Math.floor(booking.flight.durationMinutes / 60)}h {booking.flight.durationMinutes % 60}m
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{formatTime(booking.flight.arrivalTime)}</div>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {booking.flight.destination.city} ({booking.flight.destination.code})
                </div>
              </div>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {formatDate(booking.flight.departureTime)} · {booking.flight.aircraft.model} ·{' '}
              <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{booking.fareClass}</span> Class
            </div>
          </div>
        </div>

        {/* Passengers Card */}
        <div className="card" style={{ marginBottom: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card__body" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              Passengers & Assigned Seats
            </h3>
            {booking.passengers.map((pax, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-3) 0',
                  borderBottom: i < booking.passengers.length - 1 ? '1px solid var(--color-gray-100)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {pax.firstName} {pax.lastName}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'capitalize', display: 'flex', gap: 'var(--space-2)', marginTop: 2 }}>
                    <span>{pax.passengerType}</span>
                    {pax.nationality && <span>· {pax.nationality}</span>}
                    {pax.idType && pax.idNumber && (
                      <span style={{ color: 'var(--color-sky-600)', fontWeight: 500 }}>
                        · {pax.idType.toUpperCase()}: {pax.idNumber}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {pax.seat && (
                    <span className="badge badge--info" style={{ fontWeight: 700 }}>
                      Seat {pax.seat}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="card" style={{ marginBottom: 'var(--space-8)', borderRadius: 'var(--radius-xl)' }}>
          <div className="card__body" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              Payment Summary
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Status</span>
              <span className={`badge ${booking.payment?.status === 'completed' ? 'badge--success' : 'badge--warning'}`}>
                {booking.payment?.status || booking.status}
              </span>
            </div>
            {booking.payment?.method && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payment Method</span>
                <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{booking.payment.method}</span>
              </div>
            )}
            {booking.payment?.transactionId && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Transaction ID</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{booking.payment.transactionId}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 'var(--text-xl)', borderTop: '2px solid var(--color-gray-100)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
              <span>Total Paid</span>
              <span style={{ color: 'var(--color-sky-600)' }}>{formatINR(booking.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FEATURE 5: Post-Booking Recommendations (Hotel, Cab, Baggage, Guides)     */}
        {/* ========================================================================= */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-sky-600)' }}>
              Travel Perks & Recommendations
            </span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: 'var(--space-4)' }}>
            Complete Your Trip to {booking.flight.destination.city}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {/* 1. Hotel Partner Suggestion */}
            <div
              className="card"
              style={{
                padding: 'var(--space-5)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-gray-200)',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Building size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0 }}>
                    Partner Hotels in {booking.flight.destination.city}
                  </h4>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                    ✓ 20% SkyVoyage Passenger Discount
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 var(--space-4)' }}>
                Handpicked 4-star and 5-star properties near {booking.flight.destination.code} Airport with flexible
                cancellation and complimentary breakfast.
              </p>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                style={{ width: '100%', fontSize: 'var(--text-xs)', fontWeight: 700 }}
                onClick={() => alert(`Showing partner hotel deals in ${booking.flight.destination.city} with code SKYVOYAGE20`)}
              >
                View Hotel Deals (Save 20%) →
              </button>
            </div>

            {/* 2. Cab / Airport Transfer Suggestion */}
            <div
              className="card"
              style={{
                padding: 'var(--space-5)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-gray-200)',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(234, 179, 8, 0.12)',
                    color: '#ca8a04',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Car size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0 }}>
                    Airport Cabs & Express Pickup
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--color-sky-600)', fontWeight: 700 }}>
                    Driver tracking & Flight delay sync
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 var(--space-4)' }}>
                Pre-book your sanitized cab ride from {booking.flight.destination.code} Terminal directly to your hotel or
                meeting with guaranteed flat rates.
              </p>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                style={{ width: '100%', fontSize: 'var(--text-xs)', fontWeight: 700 }}
                onClick={() => alert(`Pre-booking cab for arrival at ${booking.flight.destination.code}`)}
              >
                Pre-Book Cab (Flat ₹150 Off) →
              </button>
            </div>

            {/* 3. Lounge & Baggage Pass */}
            <div
              className="card"
              style={{
                padding: 'var(--space-5)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-gray-200)',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Luggage size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0 }}>
                    Airport Lounge & Baggage Pass
                  </h4>
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                    Priority pass from ₹899
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 var(--space-4)' }}>
                Access plush lounge sofas, gourmet buffet dining, and shower rooms at {booking.flight.origin.code} and{' '}
                {booking.flight.destination.code} before takeoff.
              </p>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                style={{ width: '100%', fontSize: 'var(--text-xs)', fontWeight: 700 }}
                onClick={() => alert(`Lounge pass voucher added for PNR ${booking.pnr}`)}
              >
                Get Lounge Access Pass →
              </button>
            </div>

            {/* 4. Destination Guide & Attractions */}
            <div
              className="card"
              style={{
                padding: 'var(--space-5)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-gray-200)',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(168, 85, 247, 0.1)',
                    color: '#9333ea',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Compass size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0 }}>
                    {booking.flight.destination.city} Travel Guide
                  </h4>
                  <span style={{ fontSize: '11px', color: '#9333ea', fontWeight: 700 }}>
                    Curated Sightseeing & Weather
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 var(--space-4)' }}>
                Explore must-visit historic sights, cultural hotspots, top cafes, and live weather trends for your visit.
              </p>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                style={{ width: '100%', fontSize: 'var(--text-xs)', fontWeight: 700 }}
                onClick={() => alert(`Opening ${booking.flight.destination.city} local city guide`)}
              >
                Explore City Guide →
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
          <Link to="/" className="btn btn--primary">
            Book Another Flight
          </Link>
          <Link to="/manage" className="btn btn--secondary">
            Manage This Booking
          </Link>
        </div>
      </div>
    </div>
  );
}
