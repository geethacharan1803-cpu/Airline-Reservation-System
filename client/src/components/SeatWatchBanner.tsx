import React, { useState, useEffect } from 'react';
import { Sparkles, Clock, CheckCircle2, X, Award } from 'lucide-react';
import { formatINR } from '../api';

interface SeatWatchAlert {
  offerId?: number;
  waitlistId?: number;
  flightNumber: string;
  flightId: number;
  seatNumber: string;
  seatType: string;
  seatClass?: string;
  upgradeFee?: number;
  secondsRemaining?: number;
  message?: string;
  isFreeWaitlistUpgrade?: boolean;
  passengerName?: string;
  pnr?: string;
}

interface Props {
  passengerId?: number;
  apiUrl?: string;
}

export function SeatWatchBanner({ passengerId = 1, apiUrl = '/api/v1/seatwatch' }: Props) {
  const [activeAlert, setActiveAlert] = useState<SeatWatchAlert | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Listen for real-time alerts via SSE and Poll both SeatWatch & SeatWaitlist endpoints
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${apiUrl}/events/${passengerId}`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SEAT_OPENED') {
            setActiveAlert(data);
            setTimeLeft(data.secondsRemaining || 60);
            setDismissed(false);
            setClaimed(false);
          }
        } catch (e) {
          // ignore parsing error
        }
      };
    } catch (e) {
      console.warn('SSE connection failed, falling back to polling');
    }

    // Polling fallback every 4 seconds
    const interval = setInterval(async () => {
      if (dismissed || claimed) return;

      // 1. Check priority SeatWaitlist notifications (Window / Aisle cancellations)
      try {
        const waitlistRes = await fetch('/api/v1/seat-waitlist/active-notifications');
        if (waitlistRes.ok) {
          const waitlistData = await waitlistRes.json();
          if (waitlistData.alerts && waitlistData.alerts.length > 0) {
            const top = waitlistData.alerts[0];
            setActiveAlert({
              waitlistId: top.waitlistId,
              flightNumber: top.flightNumber || 'SkyVoyage',
              flightId: top.flightId,
              seatNumber: top.notifiedSeatNumber,
              seatType: top.preferredSeatType,
              upgradeFee: 0,
              secondsRemaining: 120,
              isFreeWaitlistUpgrade: true,
              passengerName: top.passengerName,
              pnr: top.pnr,
              message: top.notificationMessage,
            });
            setTimeLeft(120);
            return;
          }
        }
      } catch (err) {
        // Silently ignore
      }

      // 2. Check SeatWatch bidder alerts
      try {
        const res = await fetch(`${apiUrl}/alerts/${passengerId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.alerts && data.alerts.length > 0) {
            const top = data.alerts[0];
            setActiveAlert(top);
            setTimeLeft(top.secondsRemaining);
          }
        }
      } catch (err) {
        // Silently handle
      }
    }, 4000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, [passengerId, apiUrl, dismissed, claimed]);

  // Countdown timer effect
  useEffect(() => {
    if (!activeAlert || timeLeft <= 0 || claimed) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setActiveAlert(null); // Offer expired
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeAlert, timeLeft, claimed]);

  const handleClaim = async () => {
    if (!activeAlert || claiming) return;
    setClaiming(true);

    try {
      if (activeAlert.isFreeWaitlistUpgrade && activeAlert.waitlistId) {
        // Claim via SeatWaitlist endpoint (Feature 4)
        const res = await fetch('/api/v1/seat-waitlist/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waitlistId: activeAlert.waitlistId }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setClaimed(true);
          setTimeout(() => {
            setActiveAlert(null);
            setClaimed(false);
          }, 5000);
        } else {
          console.error(data.error || 'Failed to claim waitlist seat');
          setActiveAlert(null);
        }
      } else {
        // Claim via SeatWatch endpoint
        const res = await fetch(`${apiUrl}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offerId: activeAlert.offerId, passengerId }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setClaimed(true);
          setTimeout(() => {
            setActiveAlert(null);
            setClaimed(false);
          }, 5000);
        } else {
          console.error(data.error || 'Failed to claim seat');
          setActiveAlert(null);
        }
      }
    } catch (err: any) {
      console.error(err.message || 'Error processing claim');
    } finally {
      setClaiming(false);
    }
  };

  if (!activeAlert || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        maxWidth: 440,
        width: 'calc(100% - 48px)',
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 58, 138, 0.98) 100%)',
        backdropFilter: 'blur(12px)',
        border: activeAlert.isFreeWaitlistUpgrade
          ? '1.5px solid rgba(52, 211, 153, 0.6)'
          : '1px solid rgba(56, 189, 248, 0.4)',
        boxShadow: activeAlert.isFreeWaitlistUpgrade
          ? '0 20px 40px -15px rgba(16, 185, 129, 0.5), 0 0 25px rgba(52, 211, 153, 0.3)'
          : '0 20px 40px -15px rgba(2, 132, 199, 0.5), 0 0 20px rgba(56, 189, 248, 0.2)',
        color: '#ffffff',
        padding: '18px 20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              background: activeAlert.isFreeWaitlistUpgrade ? '#10b981' : '#38bdf8',
              color: '#0f172a',
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            {activeAlert.isFreeWaitlistUpgrade ? 'Seat Preference Waitlist' : 'SeatWatch Alert'}
          </span>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            Flight {activeAlert.flightNumber || 'SV-201'}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Alert Body */}
      {claimed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', color: '#34d399' }}>
          <CheckCircle2 size={24} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Seat Upgrade Confirmed!</div>
            <div style={{ fontSize: 12, color: '#cbd5e1' }}>
              Seat {activeAlert.seatNumber} has been updated on your booking.
            </div>
          </div>
        </div>
      ) : (
        <>
          <p style={{ margin: '0 0 14px 0', fontSize: 14, lineHeight: 1.5, color: '#f8fafc' }}>
            {activeAlert.isFreeWaitlistUpgrade ? (
              <>
                🎉 Great news <strong>{activeAlert.passengerName}</strong>! A preferred{' '}
                <strong style={{ color: '#34d399', textTransform: 'capitalize' }}>{activeAlert.seatType}</strong> seat (
                {activeAlert.seatNumber}) just became available from a cancellation.
              </>
            ) : (
              <>
                A <strong style={{ color: '#38bdf8', textTransform: 'capitalize' }}>{activeAlert.seatType}</strong> seat (
                {activeAlert.seatNumber}) just opened on your flight!
              </>
            )}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: 'rgba(2, 6, 23, 0.5)',
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Upgrade Fee</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: activeAlert.isFreeWaitlistUpgrade ? '#34d399' : '#38bdf8' }}>
                {activeAlert.isFreeWaitlistUpgrade ? 'FREE (Waitlist Benefit)' : formatINR(450)}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: timeLeft <= 15 ? '#f87171' : '#fbbf24' }}>
              <Clock size={16} />
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.8 }}>Claim Window</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>
                  {timeLeft}s
                </div>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <button
            onClick={handleClaim}
            disabled={claiming || timeLeft <= 0}
            style={{
              width: '100%',
              background: activeAlert.isFreeWaitlistUpgrade
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 700,
              cursor: claiming ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: activeAlert.isFreeWaitlistUpgrade
                ? '0 4px 12px rgba(16, 185, 129, 0.4)'
                : '0 4px 12px rgba(2, 132, 199, 0.4)',
            }}
          >
            <Sparkles size={16} />
            {claiming
              ? 'Upgrading Seat...'
              : activeAlert.isFreeWaitlistUpgrade
              ? `Claim ${activeAlert.seatNumber} Window Seat Upgrade`
              : `Claim ${activeAlert.seatNumber}`}
          </button>
        </>
      )}
    </div>
  );
}
