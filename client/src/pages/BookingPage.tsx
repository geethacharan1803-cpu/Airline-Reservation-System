import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Check, CreditCard, User, MapPin, Box, LayoutGrid, ShieldCheck,
  QrCode, Smartphone, Building2, CheckCircle2, AlertTriangle, Sparkles,
  Zap, Info, Globe, ArrowRight
} from 'lucide-react';
import {
  getFlightDetails, getSeatMap, createBooking, processPayment, lockSeats,
  formatINR, type FlightDetail, type SeatMapResponse, type SeatInfo
} from '../api';
import { SeatMap2D } from '../components/SeatMap2D';
import { SeatMap3D } from '../components/SeatMap3D';

const STEPS = ['Passengers', 'Seats', 'Payment', 'Confirmation'];

interface PassengerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: 'Indian' | 'Foreign';
  idType: 'aadhaar' | 'passport' | 'voter' | 'driving_license';
  idNumber: string;
  idExpiry?: string;
  issuingCountry?: string;
}

export function BookingPage() {
  const { flightId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fareClass = searchParams.get('fareClass') || 'economy';
  const numPassengers = parseInt(searchParams.get('passengers') || '1');

  const [step, setStep] = useState(0);
  const [flight, setFlight] = useState<FlightDetail | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [seatViewMode, setSeatViewMode] = useState<'2d' | '3d'>('2d');
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengers, setPassengers] = useState<PassengerForm[]>(
    Array.from({ length: numPassengers }, () => ({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      nationality: 'Indian',
      idType: 'aadhaar',
      idNumber: '',
      idExpiry: '',
      issuingCountry: '',
    }))
  );

  // Seat notification & SeatWatch trigger
  const [occupiedNotice, setOccupiedNotice] = useState<string | null>(null);
  const [seatWatchEnrolled, setSeatWatchEnrolled] = useState(false);
  const [preferredSeatType, setPreferredSeatType] = useState<'window' | 'aisle' | 'any'>('window');

  // Payment Method States
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'netbanking' | 'card' | 'wallet'>('upi');
  const [upiProvider, setUpiProvider] = useState<'gpay' | 'phonepe' | 'paytm' | 'bhim'>('gpay');
  const [upiId, setUpiId] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [walletProvider, setWalletProvider] = useState<'apple_pay' | 'paypal' | 'google_wallet'>('apple_pay');

  // Card details
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    if (!flightId) return;
    Promise.all([
      getFlightDetails(parseInt(flightId)),
      getSeatMap(parseInt(flightId)),
    ]).then(([f, s]) => {
      setFlight(f);
      setSeatMap(s);
      setLoading(false);
    }).catch(err => {
      setError(err.message);
      setLoading(false);
    });
  }, [flightId]);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const formatDuration = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

  const getPrice = (): number => {
    if (!flight) return 0;
    if (fareClass === 'first' && flight.pricing.first) return flight.pricing.first;
    if (fareClass === 'business' && flight.pricing.business) return flight.pricing.business;
    return flight.pricing.economy;
  };

  const totalPrice = getPrice() * numPassengers;

  const handleSeatToggle = async (seatNumber: string) => {
    setOccupiedNotice(null);
    if (selectedSeats.includes(seatNumber)) {
      setSelectedSeats(prev => prev.filter(s => s !== seatNumber));
    } else {
      if (selectedSeats.length >= numPassengers) return;
      setSelectedSeats(prev => [...prev, seatNumber]);
      
      // Lock the seat
      if (flightId) {
        try {
          const result = await lockSeats(parseInt(flightId), [seatNumber], sessionId || undefined);
          if (!sessionId) setSessionId(result.sessionId);
        } catch { /* ignore lock failures */ }
      }
    }
  };

  const handleOccupiedSeatClick = (seatNumber: string, status: string) => {
    setOccupiedNotice(`Seat ${seatNumber} is currently ${status === 'waitlist' ? 'held on priority waitlist' : 'occupied and confirmed to another passenger'}. Please select an available green seat.`);
  };

  const updatePassenger = (index: number, field: keyof PassengerForm, value: string) => {
    setPassengers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Reset ID type when switching nationality
      if (field === 'nationality') {
        if (value === 'Foreign') {
          updated[index].idType = 'passport';
        } else {
          updated[index].idType = 'aadhaar';
          updated[index].issuingCountry = 'India';
        }
      }
      return updated;
    });
  };

  // Validation
  const validatePassengerId = (pax: PassengerForm) => {
    if (!pax.firstName.trim() || !pax.lastName.trim()) return false;
    if (pax.nationality === 'Indian') {
      const cleanId = pax.idNumber.replace(/\s|-/g, '');
      if (pax.idType === 'aadhaar') return /^\d{12}$/.test(cleanId);
      if (pax.idType === 'passport') return /^[A-Za-z0-9]{8}$/.test(cleanId);
      if (pax.idType === 'voter') return /^[A-Za-z0-9]{10}$/.test(cleanId);
      if (pax.idType === 'driving_license') return cleanId.length >= 8;
      return false;
    } else {
      // Foreign
      return pax.idNumber.trim().length >= 6 && !!pax.issuingCountry?.trim() && !!pax.idExpiry;
    }
  };

  const isPassengersValid = passengers.every(validatePassengerId) && passengers[0].email.includes('@');
  const isSeatsValid = selectedSeats.length === numPassengers;

  const isPaymentValid = () => {
    if (paymentMethod === 'upi') {
      return qrScanned || (upiId.trim().length > 3 && upiId.includes('@'));
    }
    if (paymentMethod === 'netbanking') {
      return !!selectedBank;
    }
    if (paymentMethod === 'wallet') {
      return true;
    }
    // Card
    return cardNumber.replace(/\s/g, '').length >= 13 && cardHolder.trim() && expiryMonth && expiryYear && cvv.length >= 3;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handlePayAndConfirm = async () => {
    if (!flight || processing) return;
    setProcessing(true);
    setError('');

    try {
      // 1. Create booking with passenger IDs
      const booking = await createBooking({
        flightId: flight.id,
        fareClass,
        passengers: passengers.map(p => ({
          firstName: p.firstName,
          lastName: p.lastName,
          nationality: p.nationality,
          idType: p.nationality === 'Foreign' ? 'passport' : p.idType,
          idNumber: p.idNumber.trim(),
          idExpiry: p.idExpiry || undefined,
          issuingCountry: p.nationality === 'Foreign' ? p.issuingCountry : 'India',
        })),
        seats: selectedSeats.map(s => ({ seatNumber: s, seatClass: fareClass })),
        contactEmail: passengers[0].email,
        contactPhone: passengers[0].phone || undefined,
        preferredSeatType,
      });

      // 2. Process payment via selected channel
      const payment = await processPayment({
        bookingId: booking.bookingId,
        method: paymentMethod,
        cardNumber: paymentMethod === 'card' ? cardNumber.replace(/\s/g, '') : undefined,
        cardHolder: paymentMethod === 'card' ? cardHolder : undefined,
        expiryMonth: paymentMethod === 'card' ? expiryMonth : undefined,
        expiryYear: paymentMethod === 'card' ? expiryYear : undefined,
        cvv: paymentMethod === 'card' ? cvv : undefined,
        bankName: paymentMethod === 'netbanking' ? selectedBank : undefined,
        upiId: paymentMethod === 'upi' ? (qrScanned ? 'qr_scan@upi' : upiId) : undefined,
      });

      if (payment.success) {
        navigate(`/confirmation/${booking.pnr}`);
      } else {
        setError(payment.message || 'Payment failed. Please try again.');
        setProcessing(false);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').substring(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <p>Loading flight details...</p>
      </div>
    );
  }

  if (!flight) {
    return (
      <div className="container" style={{ padding: 'var(--space-16) 0', textAlign: 'center' }}>
        <h2>Flight not found</h2>
        <button className="btn btn--primary" onClick={() => navigate('/')} style={{ marginTop: 'var(--space-4)' }}>
          Back to Search
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-6) 0 var(--space-12)' }}>
      <div className="container">
        {/* Flight Summary Bar */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{formatTime(flight.departureTime)}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{flight.origin.code}</div>
              </div>
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                <div>{formatDuration(flight.durationMinutes)}</div>
                <div style={{ width: 80, height: 2, background: 'var(--color-gray-200)', margin: '4px 0', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'var(--color-sky-500)' }}>✈</span>
                </div>
                <div>{flight.flightNumber}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{formatTime(flight.arrivalTime)}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{flight.destination.code}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{formatDate(flight.departureTime)}</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-sky-600)', fontFamily: 'var(--font-display)' }}>
                {formatINR(totalPrice)}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                {numPassengers} pax × {formatINR(getPrice())} · <span style={{ textTransform: 'capitalize' }}>{fareClass}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Steps Indicator */}
        <div className="booking-steps">
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div className={`booking-step ${i === step ? 'booking-step--active' : i < step ? 'booking-step--completed' : ''}`}>
                <div className="booking-step__number">
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                {s}
              </div>
              {i < STEPS.length - 1 && <div className="booking-step__connector" />}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)', color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>
            {error}
          </div>
        )}

        {/* Step Content */}
        <div className="card">
          <div className="card__body">
            {/* STEP 0: Passenger Details with Identity Verification */}
            {step === 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600 }}>
                    <User size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                    Passenger Details & Mandatory Identity Verification
                  </h2>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={14} style={{ color: '#10b981' }} /> DGCA & ICAO Compliant Verification
                  </span>
                </div>

                {passengers.map((pax, i) => {
                  const isValidId = validatePassengerId(pax);
                  return (
                    <div key={i} style={{ padding: 'var(--space-5)', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', background: 'var(--surface-color, #ffffff)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                        <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Passenger {i + 1}
                        </div>
                        {isValidId ? (
                          <span style={{ fontSize: 'var(--text-xs)', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={14} /> ID Verified
                          </span>
                        ) : (
                          <span style={{ fontSize: 'var(--text-xs)', color: '#f59e0b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={14} /> Verification Required
                          </span>
                        )}
                      </div>

                      {/* Name fields */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group">
                          <label className="form-label">First Name (as on ID) *</label>
                          <input className="form-input" placeholder="e.g. Rahul" value={pax.firstName} onChange={e => updatePassenger(i, 'firstName', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Last Name (as on ID) *</label>
                          <input className="form-input" placeholder="e.g. Sharma" value={pax.lastName} onChange={e => updatePassenger(i, 'lastName', e.target.value)} />
                        </div>
                      </div>

                      {/* Nationality Dropdown */}
                      <div style={{ padding: 'var(--space-4)', background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)', marginBottom: 'var(--space-4)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Globe size={14} style={{ color: 'var(--color-sky-500)' }} /> Nationality *
                            </label>
                            <select
                              className="form-select"
                              value={pax.nationality}
                              onChange={e => updatePassenger(i, 'nationality', e.target.value as 'Indian' | 'Foreign')}
                            >
                              <option value="Indian">🇮🇳 Indian National</option>
                              <option value="Foreign">🌐 Foreign / Non-Indian Citizen</option>
                            </select>
                          </div>

                          {/* Indian National ID Section */}
                          {pax.nationality === 'Indian' ? (
                            <>
                              <div className="form-group">
                                <label className="form-label">Identity Document Type *</label>
                                <select
                                  className="form-select"
                                  value={pax.idType}
                                  onChange={e => updatePassenger(i, 'idType', e.target.value as any)}
                                >
                                  <option value="aadhaar">Aadhaar Card (12-Digit UIDAI)</option>
                                  <option value="passport">Indian Passport</option>
                                  <option value="voter">Voter ID Card (EPIC)</option>
                                  <option value="driving_license">Driving License</option>
                                </select>
                              </div>

                              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label className="form-label">
                                  {pax.idType === 'aadhaar' ? 'Aadhaar Number (12 Digits) *' :
                                   pax.idType === 'passport' ? 'Passport Number (8 Alphanumeric) *' :
                                   pax.idType === 'voter' ? 'Voter ID (10 Alphanumeric) *' :
                                   'Driving License Number *'}
                                </label>
                                <input
                                  className="form-input"
                                  placeholder={
                                    pax.idType === 'aadhaar' ? 'e.g. 5678 1234 9012' :
                                    pax.idType === 'passport' ? 'e.g. Z1234567' :
                                    pax.idType === 'voter' ? 'e.g. ABC1234567' :
                                    'e.g. DL-0420110012345'
                                  }
                                  value={pax.idNumber}
                                  onChange={e => updatePassenger(i, 'idNumber', e.target.value.toUpperCase())}
                                  maxLength={pax.idType === 'aadhaar' ? 14 : 20}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 4 }}>
                                  {pax.idType === 'aadhaar' && 'Format: 12 numeric digits. Digits are encrypted and verified under DigiLocker API standards.'}
                                  {pax.idType === 'passport' && 'Format: 1 letter followed by 7 numbers (e.g., A1234567).'}
                                  {pax.idType === 'voter' && 'Format: 3 letters followed by 7 numbers (e.g., WXZ1234567).'}
                                  {pax.idType === 'driving_license' && 'Standard state-issued smart driving license number.'}
                                </div>
                              </div>
                            </>
                          ) : (
                            /* Foreign Citizen ID Section */
                            <>
                              <div className="form-group">
                                <label className="form-label">Issuing Country *</label>
                                <input
                                  className="form-input"
                                  placeholder="e.g. United States, United Kingdom"
                                  value={pax.issuingCountry || ''}
                                  onChange={e => updatePassenger(i, 'issuingCountry', e.target.value)}
                                />
                              </div>

                              <div className="form-group">
                                <label className="form-label">Passport Number *</label>
                                <input
                                  className="form-input"
                                  placeholder="e.g. A98765432"
                                  value={pax.idNumber}
                                  onChange={e => updatePassenger(i, 'idNumber', e.target.value.toUpperCase())}
                                  maxLength={15}
                                />
                              </div>

                              <div className="form-group">
                                <label className="form-label">Passport Expiry Date *</label>
                                <input
                                  className="form-input"
                                  type="date"
                                  min={new Date().toISOString().split('T')[0]}
                                  value={pax.idExpiry || ''}
                                  onChange={e => updatePassenger(i, 'idExpiry', e.target.value)}
                                />
                              </div>

                              <div style={{ gridColumn: 'span 2', fontSize: '11px', color: '#0284c7', background: 'rgba(2, 132, 199, 0.08)', padding: '8px 12px', borderRadius: 6 }}>
                                ℹ International Travel Notice: Passport must be valid for at least 6 months beyond travel date. A valid Indian visa or OCI/PIO card is mandatory at boarding.
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Contact fields for primary passenger */}
                      {i === 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                          <div className="form-group">
                            <label className="form-label">Contact Email (for Ticket & PNR) *</label>
                            <input className="form-input" type="email" placeholder="rahul.sharma@example.com" value={pax.email} onChange={e => updatePassenger(i, 'email', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Mobile Number (SMS Updates) *</label>
                            <input className="form-input" type="tel" placeholder="+91 98765 43210" value={pax.phone} onChange={e => updatePassenger(i, 'phone', e.target.value)} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 1: Seat Selection with Live Vacancy Stats & Urgency */}
            {step === 1 && seatMap && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                      <MapPin size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                      Select Your Seats
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                      Choose {numPassengers} seat{numPassengers > 1 ? 's' : ''} · {selectedSeats.length} of {numPassengers} selected
                      {selectedSeats.length > 0 && (
                        <span style={{ marginLeft: 'var(--space-3)', fontWeight: 700, color: 'var(--color-sky-600)' }}>
                          ({selectedSeats.join(', ')})
                        </span>
                      )}
                    </p>
                  </div>

                  {/* 3D / 2D View Switcher */}
                  <div style={{
                    display: 'flex',
                    background: 'var(--color-gray-100)',
                    padding: '4px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-gray-200)',
                    gap: 4,
                  }}>
                    <button
                      type="button"
                      onClick={() => setSeatViewMode('2d')}
                      className={`btn btn--sm ${seatViewMode === '2d' ? 'btn--primary' : ''}`}
                      style={{
                        padding: '6px 14px',
                        fontSize: 'var(--text-xs)',
                        border: 'none',
                        background: seatViewMode === '2d' ? 'var(--color-sky-600)' : 'transparent',
                        color: seatViewMode === '2d' ? '#ffffff' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: seatViewMode === '2d' ? '0 2px 6px rgba(14, 165, 233, 0.3)' : 'none',
                      }}
                    >
                      <LayoutGrid size={14} /> 2D Plan View
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeatViewMode('3d')}
                      className={`btn btn--sm ${seatViewMode === '3d' ? 'btn--primary' : ''}`}
                      style={{
                        padding: '6px 14px',
                        fontSize: 'var(--text-xs)',
                        border: 'none',
                        background: seatViewMode === '3d' ? 'var(--color-sky-600)' : 'transparent',
                        color: seatViewMode === '3d' ? '#ffffff' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: seatViewMode === '3d' ? '0 2px 6px rgba(14, 165, 233, 0.3)' : 'none',
                      }}
                    >
                      <Box size={14} /> 3D Cabin Walkthrough
                    </button>
                  </div>
                </div>

                {/* FEATURE 4: Preferred Seat Type & Automatic Upgrade Waitlist */}
                <div style={{
                  background: '#ffffff',
                  border: '1.5px solid var(--color-sky-200)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-4) var(--space-5)',
                  marginBottom: 'var(--space-4)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-sky-600)' }}>
                          Seat Preference & Free Upgrade Waitlist
                        </span>
                        <span className="badge badge--primary" style={{ fontSize: '10px' }}>Automated</span>
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        Choose your preferred seat type below. If no matching seat is open, you will be auto-enrolled on the priority upgrade waitlist!
                      </p>
                    </div>

                    {/* Radio / Pill Options */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      {[
                        { id: 'window', label: '🪟 Window' },
                        { id: 'aisle', label: '🚶 Aisle' },
                        { id: 'any', label: '✨ Any' },
                      ].map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPreferredSeatType(option.id as any)}
                          style={{
                            padding: '6px 14px',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 700,
                            borderRadius: 'var(--radius-lg)',
                            border: preferredSeatType === option.id ? '2px solid var(--color-sky-500)' : '1px solid var(--color-gray-200)',
                            background: preferredSeatType === option.id ? 'var(--color-sky-50)' : '#ffffff',
                            color: preferredSeatType === option.id ? 'var(--color-sky-700)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 150ms ease',
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Explanation Pill */}
                  <div style={{
                    background: 'rgba(14, 165, 233, 0.05)',
                    border: '1px dashed rgba(14, 165, 233, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span style={{ fontSize: '14px' }}>ℹ️</span>
                    <span>
                      {preferredSeatType === 'window' ? (
                        <>
                          <strong>Window Seat Preference Active:</strong> Select an available window seat (A or F). If unavailable or you choose an aisle/middle seat, you will be auto-enrolled in the <strong>Seat Preference Waitlist</strong>. When another passenger cancels, you'll be notified immediately to claim your free window upgrade!
                        </>
                      ) : preferredSeatType === 'aisle' ? (
                        <>
                          <strong>Aisle Seat Preference Active:</strong> Select any available aisle seat (C or D). You will be given first priority alerts if premium aisle seats become available.
                        </>
                      ) : (
                        <>
                          <strong>Any Seat:</strong> You can select any green available seat on the cabin map below.
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Live Vacancy Counter Bar */}
                {(() => {
                  const total = seatMap.stats?.totalSeats || 180;
                  const available = seatMap.stats?.availableSeats || 42;
                  const occupied = seatMap.stats?.occupiedSeats || (total - available);
                  const windowLeft = seatMap.stats?.windowAvailable ?? 2;
                  const pctOccupied = Math.round((occupied / total) * 100);

                  return (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.03) 0%, rgba(14, 165, 233, 0.05) 100%)',
                      border: '1px solid var(--color-gray-200)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-4)',
                      marginBottom: 'var(--space-4)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                            📊 Cabin Status:
                          </span>
                          <span style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: 20, padding: '2px 10px', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                            {available} Seats Available
                          </span>
                          <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 20, padding: '2px 10px', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                            {occupied} Occupied ({pctOccupied}%)
                          </span>
                          {windowLeft <= 4 && (
                            <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 20, padding: '2px 10px', fontSize: 'var(--text-xs)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Zap size={12} /> Only {windowLeft} Window Seats Left!
                            </span>
                          )}
                        </div>

                        {/* SeatWatch trigger button */}
                        <button
                          type="button"
                          onClick={() => setSeatWatchEnrolled(!seatWatchEnrolled)}
                          style={{
                            background: seatWatchEnrolled ? '#10b981' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            padding: '6px 12px',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                          }}
                        >
                          <Sparkles size={14} />
                          {seatWatchEnrolled ? '✓ SeatWatch Active (₹450)' : 'Activate SeatWatch™ (₹450)'}
                        </button>
                      </div>

                      {/* Visual occupancy bar */}
                      <div style={{ height: 6, width: '100%', background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctOccupied}%`, background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)', borderRadius: 99 }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Occupied Seat Notification Toast / Banner */}
                {occupiedNotice && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    marginBottom: 'var(--space-4)',
                    color: '#b91c1c',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    animation: 'fadeIn 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                      <span>{occupiedNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOccupiedNotice(null)}
                      style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}
                    >
                      ×
                    </button>
                  </div>
                )}

                {seatViewMode === '3d' ? (
                  <SeatMap3D
                    seatMap={seatMap}
                    selectedSeats={selectedSeats}
                    fareClass={fareClass}
                    onSeatToggle={handleSeatToggle}
                  />
                ) : (
                  <SeatMap2D
                    seatMap={seatMap}
                    selectedSeats={selectedSeats}
                    fareClass={fareClass}
                    onSeatToggle={handleSeatToggle}
                    onOccupiedClick={handleOccupiedSeatClick}
                  />
                )}
              </div>
            )}

            {/* STEP 2: Multi-Channel Indian Payment Gateway */}
            {step === 2 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600 }}>
                    <CreditCard size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                    Secure Multi-Channel Payment Gateway
                  </h2>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={14} style={{ color: '#10b981' }} /> RBI & PCI-DSS 256-Bit Encrypted
                  </span>
                </div>

                {/* Payment Channel Selection Tabs */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-6)',
                }}>
                  {[
                    { id: 'upi', label: 'UPI / QR', icon: QrCode, badge: 'Instant' },
                    { id: 'netbanking', label: 'Net Banking', icon: Building2, badge: 'Popular' },
                    { id: 'card', label: 'RuPay / Cards', icon: CreditCard, badge: 'Domestic/Intl' },
                    { id: 'wallet', label: 'Wallets', icon: Smartphone, badge: 'Apple/PayPal' },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = paymentMethod === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(tab.id as any);
                          setError('');
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-lg)',
                          border: `2px solid ${isActive ? 'var(--color-sky-500)' : 'var(--color-gray-200)'}`,
                          background: isActive ? 'rgba(14, 165, 233, 0.08)' : 'var(--surface-color, #ffffff)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Icon size={20} style={{ color: isActive ? 'var(--color-sky-600)' : 'var(--text-secondary)' }} />
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: isActive ? 'var(--color-sky-700)' : 'var(--text-primary)' }}>
                          {tab.label}
                        </span>
                        <span style={{ fontSize: '10px', color: isActive ? 'var(--color-sky-600)' : 'var(--text-tertiary)' }}>
                          {tab.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-8)' }}>
                  {/* Left Column: Method Specific Form */}
                  <div>
                    {/* 1. UPI TAB */}
                    {paymentMethod === 'upi' && (
                      <div style={{ background: 'var(--color-gray-50)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)' }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <QrCode size={18} style={{ color: 'var(--color-sky-600)' }} />
                          Instant UPI Fast-Pay (0% Surcharge)
                        </div>

                        {/* UPI App Selection Chips */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 'var(--space-4)' }}>
                          {[
                            { id: 'gpay', name: 'Google Pay', color: '#4285F4' },
                            { id: 'phonepe', name: 'PhonePe', color: '#5f259f' },
                            { id: 'paytm', name: 'Paytm', color: '#00baf2' },
                            { id: 'bhim', name: 'BHIM UPI', color: '#f37021' },
                          ].map(app => (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => setUpiProvider(app.id as any)}
                              style={{
                                padding: '8px 4px',
                                borderRadius: 'var(--radius-md)',
                                border: `1px solid ${upiProvider === app.id ? app.color : 'var(--color-gray-200)'}`,
                                background: upiProvider === app.id ? '#ffffff' : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: upiProvider === app.id ? app.color : 'var(--text-secondary)',
                                boxShadow: upiProvider === app.id ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                              }}
                            >
                              {app.name}
                            </button>
                          ))}
                        </div>

                        {/* UPI ID Input */}
                        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                          <label className="form-label">Enter Virtual Payment Address (VPA / UPI ID)</label>
                          <input
                            className="form-input"
                            placeholder="e.g. rahulsharma@okhdfcbank"
                            value={upiId}
                            onChange={e => setUpiId(e.target.value)}
                          />
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                            {['@okhdfcbank', '@okaxis', '@ybl', '@paytm'].map(sfx => (
                              <button
                                key={sfx}
                                type="button"
                                onClick={() => {
                                  const base = upiId.split('@')[0] || 'passenger';
                                  setUpiId(`${base}${sfx}`);
                                }}
                                style={{
                                  background: 'var(--color-gray-100)',
                                  border: '1px solid var(--color-gray-300)',
                                  borderRadius: 4,
                                  fontSize: '10px',
                                  padding: '2px 8px',
                                  cursor: 'pointer',
                                  color: 'var(--text-secondary)'
                                }}
                              >
                                {sfx}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Simulated QR Code preview toggle */}
                        <div style={{ borderTop: '1px dashed var(--color-gray-200)', paddingTop: 'var(--space-4)', textAlign: 'center' }}>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>
                            — OR SCAN SIMULATED DYNAMIC QR CODE —
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowQrModal(!showQrModal);
                              setQrScanned(true);
                            }}
                            className="btn btn--secondary btn--sm"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                          >
                            <QrCode size={16} />
                            {showQrModal ? 'Hide Dynamic QR Code' : 'Generate UPI QR Code'}
                          </button>

                          {showQrModal && (
                            <div style={{ marginTop: 'var(--space-3)', background: '#ffffff', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)', display: 'inline-block', textAlign: 'center' }}>
                              <div style={{ width: 140, height: 140, margin: '0 auto', background: '#0f172a', padding: 8, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                                <QrCode size={96} style={{ color: '#38bdf8' }} />
                                <span style={{ fontSize: '9px', letterSpacing: '0.1em', marginTop: 4, color: '#94a3b8' }}>SCAN WITH ANY UPI APP</span>
                              </div>
                              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-sky-600)', marginTop: 8 }}>
                                SkyVoyage Merchant Pay: {formatINR(totalPrice)}
                              </div>
                              <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600, marginTop: 4 }}>
                                ✓ Simulated QR Ready — Auto-Approved
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. NET BANKING TAB */}
                    {paymentMethod === 'netbanking' && (
                      <div style={{ background: 'var(--color-gray-50)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)' }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 size={18} style={{ color: 'var(--color-sky-600)' }} />
                          Select Your Bank for Direct Debit
                        </div>

                        {/* Top Indian Banks Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 'var(--space-4)' }}>
                          {[
                            'State Bank of India (SBI)',
                            'HDFC Bank',
                            'ICICI Bank',
                            'Axis Bank',
                            'Kotak Mahindra Bank',
                            'Punjab National Bank',
                          ].map(bank => (
                            <button
                              key={bank}
                              type="button"
                              onClick={() => setSelectedBank(bank)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: `1px solid ${selectedBank === bank ? 'var(--color-sky-500)' : 'var(--color-gray-200)'}`,
                                background: selectedBank === bank ? '#ffffff' : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: 'var(--text-xs)',
                                fontWeight: selectedBank === bank ? 700 : 500,
                                color: selectedBank === bank ? 'var(--color-sky-700)' : 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                boxShadow: selectedBank === bank ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                              }}
                            >
                              <span>{bank}</span>
                              {selectedBank === bank && <Check size={14} style={{ color: 'var(--color-sky-500)' }} />}
                            </button>
                          ))}
                        </div>

                        <div className="form-group">
                          <label className="form-label">Or choose other Indian Scheduled Bank</label>
                          <select className="form-select" value={selectedBank} onChange={e => setSelectedBank(e.target.value)}>
                            <option value="HDFC Bank">HDFC Bank</option>
                            <option value="State Bank of India (SBI)">State Bank of India (SBI)</option>
                            <option value="ICICI Bank">ICICI Bank</option>
                            <option value="Axis Bank">Axis Bank</option>
                            <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                            <option value="Bank of Baroda">Bank of Baroda</option>
                            <option value="Canara Bank">Canara Bank</option>
                            <option value="Union Bank of India">Union Bank of India</option>
                            <option value="IndusInd Bank">IndusInd Bank</option>
                            <option value="Yes Bank">Yes Bank</option>
                          </select>
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 8 }}>
                          🔒 You will be securely connected to {selectedBank} payment gateway with two-factor OTP authorization.
                        </div>
                      </div>
                    )}

                    {/* 3. CARD TAB (RuPay / Visa / Mastercard) */}
                    {paymentMethod === 'card' && (
                      <div>
                        {/* Card Preview */}
                        <div className="payment-card-preview" style={{ marginBottom: 'var(--space-4)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.85 }}>
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>SkyVoyage Airlines</span>
                            <span style={{ fontSize: '11px', fontWeight: 800, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 4 }}>
                              {cardNumber.startsWith('6') ? 'RUPAY' : cardNumber.startsWith('4') ? 'VISA' : 'MASTERCARD'}
                            </span>
                          </div>
                          <div className="payment-card-preview__number">
                            {cardNumber || '•••• •••• •••• ••••'}
                          </div>
                          <div className="payment-card-preview__details">
                            <div>
                              <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>CARD HOLDER</div>
                              {cardHolder || 'YOUR NAME'}
                            </div>
                            <div>
                              <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>EXPIRES</div>
                              {expiryMonth || 'MM'}/{expiryYear ? expiryYear.slice(-2) : 'YY'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                          <div className="form-group">
                            <label className="form-label">Card Number (RuPay, Visa, Mastercard)</label>
                            <input className="form-input" placeholder="4242 4242 4242 4242" value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} maxLength={19} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Cardholder Name (as on card)</label>
                            <input className="form-input" placeholder="Rahul Sharma" value={cardHolder} onChange={e => setCardHolder(e.target.value)} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                            <div className="form-group">
                              <label className="form-label">Month</label>
                              <select className="form-select" value={expiryMonth} onChange={e => setExpiryMonth(e.target.value)}>
                                <option value="">MM</option>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                  <option key={m} value={String(m).padStart(2, '0')}>{String(m).padStart(2, '0')}</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Year</label>
                              <select className="form-select" value={expiryYear} onChange={e => setExpiryYear(e.target.value)}>
                                <option value="">YY</option>
                                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(y => (
                                  <option key={y} value={String(y)}>{y}</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">CVV</label>
                              <input className="form-input" type="password" placeholder="•••" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, '').substring(0, 4))} maxLength={4} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. WALLETS TAB */}
                    {paymentMethod === 'wallet' && (
                      <div style={{ background: 'var(--color-gray-50)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)' }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                          International & Mobile Digital Wallets
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                          {[
                            { id: 'apple_pay', name: ' Apple Pay', desc: 'Touch ID / Face ID 1-Touch Checkout' },
                            { id: 'paypal', name: 'PayPal Checkout', desc: 'Buyer protection & multi-currency billing' },
                            { id: 'google_wallet', name: 'Google Wallet', desc: 'Saved Google payment methods' },
                          ].map(w => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => setWalletProvider(w.id as any)}
                              style={{
                                padding: '12px 14px',
                                borderRadius: 'var(--radius-md)',
                                border: `1px solid ${walletProvider === w.id ? 'var(--color-sky-500)' : 'var(--color-gray-200)'}`,
                                background: walletProvider === w.id ? '#ffffff' : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{w.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{w.desc}</div>
                              </div>
                              {walletProvider === w.id && <Check size={16} style={{ color: 'var(--color-sky-500)' }} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Fare Breakdown & Confirmation */}
                  <div style={{ background: 'var(--color-gray-50)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-gray-200)', paddingBottom: 'var(--space-2)' }}>
                        Price Summary (INR)
                      </h3>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Base fare × {numPassengers} pax</span>
                        <span style={{ fontWeight: 600 }}>{formatINR(totalPrice)}</span>
                      </div>

                      {seatWatchEnrolled && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', color: 'var(--color-sky-600)' }}>
                          <span>SeatWatch™ Auto-Upgrade Hold</span>
                          <span style={{ fontWeight: 600 }}>{formatINR(450)}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Airport User Dev Fee & GST (5%)</span>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>Included</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Selected Seats</span>
                        <span style={{ fontWeight: 600 }}>{selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None'}</span>
                      </div>

                      <div style={{ borderTop: '2px solid var(--color-gray-200)', paddingTop: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total Amount Due</div>
                          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-sky-600)' }}>
                            {formatINR(totalPrice + (seatWatchEnrolled ? 450 : 0))}
                          </div>
                        </div>
                        <span className="badge badge--success" style={{ fontSize: '11px' }}>
                          Guaranteed Rate
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: 'var(--space-6)', fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      By clicking Pay, you agree to SkyVoyage Airlines Conditions of Carriage, DGCA baggage restrictions, and refund policies.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-6)' }}>
          <button className="btn btn--secondary" onClick={step === 0 ? () => navigate(-1) : handleBack}>
            {step === 0 ? 'Back to Results' : '← Previous'}
          </button>

          {step < 2 && (
            <button
              className="btn btn--primary btn--lg"
              onClick={handleNext}
              disabled={step === 0 ? !isPassengersValid : !isSeatsValid}
            >
              Continue to {step === 0 ? 'Seats' : 'Payment'} →
            </button>
          )}

          {step === 2 && (
            <button
              className="btn btn--primary btn--lg"
              onClick={handlePayAndConfirm}
              disabled={!isPaymentValid() || processing}
              style={{ minWidth: 220 }}
            >
              {processing ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Securing Booking...
                </>
              ) : (
                `Pay ${formatINR(totalPrice + (seatWatchEnrolled ? 450 : 0))} & Confirm`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
