import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Clock, Plane, AlertCircle, TrendingDown, TrendingUp, Calendar,
  Filter, Sparkles, Award, ArrowRight, ArrowLeftRight, Check,
  ChevronRight, RefreshCw, SlidersHorizontal, Info, ShieldCheck
} from 'lucide-react';
import {
  searchFlights, searchRoundTrip, formatINR,
  type FlightResult, type PriceAdvice, type PriceCalendarDay,
  type RoundTripSearchResponse, type BestValueCombo
} from '../api';

export function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Core URL Query Parameters
  const origin = searchParams.get('origin') || '';
  const destination = searchParams.get('destination') || '';
  const date = searchParams.get('date') || '';
  const returnDate = searchParams.get('returnDate') || '';
  const tripType = searchParams.get('tripType') || (returnDate ? 'roundtrip' : 'oneway');
  const passengers = searchParams.get('passengers') || '1';
  const fareClass = searchParams.get('fareClass') || 'economy';
  const flexibleDates = searchParams.get('flexibleDates') === 'true';
  const flexibleReturn = searchParams.get('flexibleReturn') === 'true';

  // Flight Data States
  const [flights, setFlights] = useState<FlightResult[]>([]);
  const [roundTripData, setRoundTripData] = useState<RoundTripSearchResponse | null>(null);
  const [priceAdvice, setPriceAdvice] = useState<PriceAdvice | null>(null);
  const [priceCalendar, setPriceCalendar] = useState<PriceCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Round-Trip Leg Selection
  const [activeLegTab, setActiveLegTab] = useState<'outbound' | 'return'>('outbound');
  const [selectedOutbound, setSelectedOutbound] = useState<FlightResult | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<FlightResult | null>(null);

  // Sorting & Filter States (Feature 1)
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'duration_asc' | 'departure_asc'>('price_asc');
  const [airlineFilter, setAirlineFilter] = useState<string>('all');
  const [maxDurationHours, setMaxDurationHours] = useState<number>(12);
  const [departureWindow, setDepartureWindow] = useState<'all' | 'morning' | 'afternoon' | 'evening' | 'night'>('all');
  const [nonStopOnly, setNonStopOnly] = useState<boolean>(false);
  const [showFiltersMobile, setShowFiltersMobile] = useState<boolean>(false);

  // Load flights based on tripType
  useEffect(() => {
    if (!origin || !destination) {
      setError('Please specify origin and destination airports');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    if (tripType === 'roundtrip' && returnDate) {
      // Execute Round-Trip Search (Feature 2)
      searchRoundTrip({
        origin,
        destination,
        departureDate: date,
        returnDate,
        passengers: parseInt(passengers),
        fareClass,
        flexibleReturn,
      })
        .then(data => {
          setRoundTripData(data);
          setFlights(data.outboundFlights);
          setPriceAdvice(data.priceAdvice || null);
          setPriceCalendar(data.outboundPriceCalendar || []);
          if (data.bestValueCombo) {
            // Default selected combo
            setSelectedOutbound(data.bestValueCombo.outboundFlight);
            setSelectedReturn(data.bestValueCombo.returnFlight);
          }
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || 'Failed to search round-trip flights');
          setLoading(false);
        });
    } else {
      // Execute One-Way Search with Price Advice & Flexible Calendar (Feature 1 & 3)
      searchFlights({
        origin,
        destination,
        date,
        passengers: parseInt(passengers),
        fareClass,
        flexibleDates: true,
        sortBy,
      })
        .then(data => {
          setFlights(data.flights);
          setPriceAdvice(data.priceAdvice || null);
          setPriceCalendar(data.priceCalendar || []);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || 'Failed to search flights');
          setLoading(false);
        });
    }
  }, [origin, destination, date, returnDate, tripType, passengers, fareClass, flexibleReturn, sortBy]);

  // Determine current active flight list for round-trip vs one-way
  const currentRawFlights = useMemo(() => {
    if (tripType === 'roundtrip' && roundTripData) {
      return activeLegTab === 'outbound' ? roundTripData.outboundFlights : roundTripData.returnFlights;
    }
    return flights;
  }, [tripType, roundTripData, activeLegTab, flights]);

  // Extract available airlines for filter pills
  const availableAirlines = useMemo(() => {
    const airlines = new Set<string>();
    currentRawFlights.forEach(f => {
      if (f.airline) airlines.add(f.airline);
    });
    return Array.from(airlines);
  }, [currentRawFlights]);

  // Helper to extract fare price
  function getPrice(flight: FlightResult): number {
    const p = flight.pricing;
    if (fareClass === 'first' && p.first) return p.first;
    if (fareClass === 'business' && p.business) return p.business;
    return p.economy;
  }

  // Filter and sort flights
  const filteredFlights = useMemo(() => {
    return currentRawFlights
      .filter(flight => {
        // Airline filter
        if (airlineFilter !== 'all' && flight.airline !== airlineFilter) {
          return false;
        }
        // Duration filter
        if (flight.durationMinutes > maxDurationHours * 60) {
          return false;
        }
        // Stops filter
        if (nonStopOnly && (flight.stops || 0) > 0) {
          return false;
        }
        // Departure window filter
        if (departureWindow !== 'all') {
          const depHour = new Date(flight.departureTime).getHours();
          if (departureWindow === 'morning' && (depHour < 6 || depHour >= 12)) return false;
          if (departureWindow === 'afternoon' && (depHour < 12 || depHour >= 18)) return false;
          if (departureWindow === 'evening' && (depHour < 18 || depHour >= 24)) return false;
          if (departureWindow === 'night' && depHour >= 6) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return getPrice(a) - getPrice(b);
        if (sortBy === 'price_desc') return getPrice(b) - getPrice(a);
        if (sortBy === 'duration_asc') return a.durationMinutes - b.durationMinutes;
        if (sortBy === 'departure_asc') {
          return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
        }
        return 0;
      });
  }, [currentRawFlights, airlineFilter, maxDurationHours, nonStopOnly, departureWindow, sortBy, fareClass]);

  // Identify lowest price in filtered list to compute live price difference
  const lowestPrice = useMemo(() => {
    if (filteredFlights.length === 0) return 0;
    return Math.min(...filteredFlights.map(f => getPrice(f)));
  }, [filteredFlights, fareClass]);

  // Formatters
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  // Date Strip Click handler
  const handleDateStripSelect = (newDateStr: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (tripType === 'roundtrip' && activeLegTab === 'return') {
      newParams.set('returnDate', newDateStr);
    } else {
      newParams.set('date', newDateStr);
    }
    setSearchParams(newParams);
  };

  // Single or Round-trip flight selection
  const handleSelectFlight = (flight: FlightResult) => {
    if (tripType === 'roundtrip') {
      if (activeLegTab === 'outbound') {
        setSelectedOutbound(flight);
        setActiveLegTab('return');
        window.scrollTo({ top: 350, behavior: 'smooth' });
      } else {
        setSelectedReturn(flight);
      }
    } else {
      // One-way direct proceed
      navigate(`/book/${flight.id}?fareClass=${fareClass}&passengers=${passengers}`);
    }
  };

  // Round-trip proceed to booking
  const handleProceedRoundTrip = () => {
    if (!selectedOutbound) {
      setActiveLegTab('outbound');
      return;
    }
    if (!selectedReturn) {
      setActiveLegTab('return');
      return;
    }
    // Navigate with both flight IDs
    navigate(
      `/book/${selectedOutbound.id}?returnFlightId=${selectedReturn.id}&fareClass=${fareClass}&passengers=${passengers}`
    );
  };

  // Book Best Value Combo in 1-click
  const handleBookBestCombo = (combo: BestValueCombo) => {
    navigate(
      `/book/${combo.outboundFlight.id}?returnFlightId=${combo.returnFlight.id}&fareClass=${fareClass}&passengers=${passengers}`
    );
  };

  return (
    <div style={{ padding: 'var(--space-6) 0 var(--space-16)', background: 'var(--color-gray-50)', minHeight: '90vh' }}>
      <div className="container">
        {/* Navigation Breadcrumb & Route Summary */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => navigate('/')}
            style={{ marginBottom: 'var(--space-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            ← Modify Search
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                <span className={`badge ${tripType === 'roundtrip' ? 'badge--info' : 'badge--primary'}`}>
                  {tripType === 'roundtrip' ? '🔄 Round-Trip' : '✈️ One-Way'}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {passengers} Passenger{parseInt(passengers) > 1 ? 's' : ''} · <span style={{ textTransform: 'capitalize' }}>{fareClass}</span>
                </span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {origin} {tripType === 'roundtrip' ? '⇄' : '→'} {destination}
              </h1>
            </div>

            {/* Price Sorting Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>Sort by:</span>
              <select
                className="form-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{ fontSize: 'var(--text-sm)', padding: '6px 12px', minWidth: 180, borderRadius: 'var(--radius-md)' }}
              >
                <option value="price_asc">Cheapest First (Recommended)</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="duration_asc">Shortest Duration</option>
                <option value="departure_asc">Earliest Departure</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FEATURE 3: When to Book Suggestions (Price Prediction / Advice Card)      */}
        {/* ========================================================================= */}
        {priceAdvice && (
          <div
            style={{
              background:
                priceAdvice.urgency === 'low'
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%)'
                  : priceAdvice.urgency === 'high'
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.04) 100%)',
              border: `1px solid ${
                priceAdvice.urgency === 'low'
                  ? 'rgba(34, 197, 94, 0.3)'
                  : priceAdvice.urgency === 'high'
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'rgba(245, 158, 11, 0.3)'
              }`,
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-4) var(--space-6)',
              marginBottom: 'var(--space-6)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background:
                      priceAdvice.urgency === 'low'
                        ? 'rgba(34, 197, 94, 0.2)'
                        : priceAdvice.urgency === 'high'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(245, 158, 11, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color:
                      priceAdvice.urgency === 'low'
                        ? '#16a34a'
                        : priceAdvice.urgency === 'high'
                        ? '#dc2626'
                        : '#d97706',
                  }}
                >
                  {priceAdvice.urgency === 'low' ? (
                    <TrendingDown size={22} />
                  ) : priceAdvice.urgency === 'high' ? (
                    <TrendingUp size={22} />
                  ) : (
                    <Sparkles size={22} />
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                      When to Book Advice
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background:
                          priceAdvice.urgency === 'low'
                            ? '#22c55e'
                            : priceAdvice.urgency === 'high'
                            ? '#ef4444'
                            : '#f59e0b',
                        color: '#ffffff',
                      }}
                    >
                      {priceAdvice.recommendation}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      ({priceAdvice.confidence}% AI Confidence)
                    </span>
                  </div>

                  <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {priceAdvice.reason}
                  </p>
                </div>
              </div>

              {/* Price Baseline Comparison Metric */}
              <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Current Min Fare</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-sky-600)' }}>
                    {formatINR(priceAdvice.currentMinPrice)}
                  </div>
                </div>
                <div style={{ width: 1, height: 32, background: 'var(--color-gray-200)' }} />
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>30-Day Avg Baseline</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {formatINR(priceAdvice.historicalAvgPrice)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FEATURE 1: 7-Day Flexible Dates Lowest Price Strip (±3 Days)              */}
        {/* ========================================================================= */}
        {priceCalendar.length > 0 && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                📅 Flexible Dates Fare Calendar (±3 Days)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-sky-600)' }}>
                Click any day to view lowest available fares
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${priceCalendar.length}, 1fr)`,
                gap: 'var(--space-2)',
                overflowX: 'auto',
                paddingBottom: 4,
              }}
            >
              {priceCalendar.map(day => {
                const isSelected = day.isSearchedDate;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => handleDateStripSelect(day.date)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-lg)',
                      border: isSelected
                        ? '2px solid var(--color-sky-500)'
                        : day.isLowestInWindow
                        ? '1.5px solid rgba(34, 197, 94, 0.6)'
                        : '1px solid var(--color-gray-200)',
                      background: isSelected
                        ? '#ffffff'
                        : day.isLowestInWindow
                        ? 'rgba(34, 197, 94, 0.05)'
                        : '#ffffff',
                      boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'center',
                      position: 'relative',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {day.isLowestInWindow && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -8,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#16a34a',
                          color: '#ffffff',
                          fontSize: '9px',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 8,
                          textTransform: 'uppercase',
                        }}
                      >
                        Cheapest
                      </span>
                    )}

                    <div style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? 'var(--color-sky-600)' : 'var(--text-secondary)' }}>
                      {day.dayOfWeek}, {day.displayDate}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 800,
                        color: day.minPrice ? (day.isLowestInWindow ? '#16a34a' : 'var(--text-primary)') : 'var(--text-tertiary)',
                        marginTop: 4,
                      }}
                    >
                      {day.minPrice ? formatINR(day.minPrice) : 'No flights'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FEATURE 2: Round-Trip Smart Planning (Best Value Combo Card)             */}
        {/* ========================================================================= */}
        {tripType === 'roundtrip' && roundTripData?.bestValueCombo && (
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              marginBottom: 'var(--space-8)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                  <span style={{ background: '#f59e0b', color: '#0f172a', fontWeight: 800, fontSize: '11px', padding: '2px 8px', borderRadius: 12, textTransform: 'uppercase' }}>
                    ★ Best Value Recommendation
                  </span>
                  <span style={{ background: 'rgba(34, 197, 94, 0.25)', color: '#4ade80', fontWeight: 700, fontSize: '11px', padding: '2px 8px', borderRadius: 12 }}>
                    Save {formatINR(roundTripData.bestValueCombo.bundledSavings)} Bundled!
                  </span>
                </div>
                <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  Optimal Outbound + Return Combination
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255, 255, 255, 0.7)', margin: '4px 0 0' }}>
                  {roundTripData.bestValueCombo.valueRationale}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>Combined Round-Trip Fare</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#38bdf8' }}>
                  {formatINR(roundTripData.bestValueCombo.combinedPrice)}
                </div>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => handleBookBestCombo(roundTripData.bestValueCombo!)}
                  style={{ marginTop: 'var(--space-2)', padding: '8px 18px', fontWeight: 700 }}
                >
                  Book Combo in 1-Click →
                </button>
              </div>
            </div>

            {/* Combo Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              {/* Outbound leg */}
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  1. Outbound · {roundTripData.bestValueCombo.outboundFlight.airline || 'SkyVoyage'} ({roundTripData.bestValueCombo.outboundFlight.flightNumber})
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                      {formatTime(roundTripData.bestValueCombo.outboundFlight.departureTime)}
                    </span>{' '}
                    <span style={{ fontSize: 'var(--text-xs)', color: 'rgba(255, 255, 255, 0.6)' }}>{origin}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {formatDuration(roundTripData.bestValueCombo.outboundFlight.durationMinutes)}
                  </span>
                  <div>
                    <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                      {formatTime(roundTripData.bestValueCombo.outboundFlight.arrivalTime)}
                    </span>{' '}
                    <span style={{ fontSize: 'var(--text-xs)', color: 'rgba(255, 255, 255, 0.6)' }}>{destination}</span>
                  </div>
                </div>
              </div>

              {/* Return leg */}
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  2. Return · {roundTripData.bestValueCombo.returnFlight.airline || 'SkyVoyage'} ({roundTripData.bestValueCombo.returnFlight.flightNumber})
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                      {formatTime(roundTripData.bestValueCombo.returnFlight.departureTime)}
                    </span>{' '}
                    <span style={{ fontSize: 'var(--text-xs)', color: 'rgba(255, 255, 255, 0.6)' }}>{destination}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {formatDuration(roundTripData.bestValueCombo.returnFlight.durationMinutes)}
                  </span>
                  <div>
                    <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                      {formatTime(roundTripData.bestValueCombo.returnFlight.arrivalTime)}
                    </span>{' '}
                    <span style={{ fontSize: 'var(--text-xs)', color: 'rgba(255, 255, 255, 0.6)' }}>{origin}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Round-Trip Leg Switcher Tabs (if round-trip) */}
        {tripType === 'roundtrip' && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <button
              type="button"
              onClick={() => setActiveLegTab('outbound')}
              className={`btn ${activeLegTab === 'outbound' ? 'btn--primary' : 'btn--ghost'}`}
              style={{
                flex: 1,
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-xl)',
                border: activeLegTab === 'outbound' ? '2px solid var(--color-sky-500)' : '1px solid var(--color-gray-200)',
                background: activeLegTab === 'outbound' ? 'var(--color-sky-600)' : '#ffffff',
                color: activeLegTab === 'outbound' ? '#ffffff' : 'var(--text-primary)',
                textAlign: 'left',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, opacity: 0.8 }}>
                Step 1: Select Outbound Leg
              </div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, marginTop: 2 }}>
                {origin} → {destination}
              </div>
              {selectedOutbound && (
                <div style={{ fontSize: '11px', marginTop: 4, opacity: 0.9 }}>
                  ✓ Selected: {selectedOutbound.flightNumber} ({formatTime(selectedOutbound.departureTime)}) - {formatINR(getPrice(selectedOutbound))}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveLegTab('return')}
              className={`btn ${activeLegTab === 'return' ? 'btn--primary' : 'btn--ghost'}`}
              style={{
                flex: 1,
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-xl)',
                border: activeLegTab === 'return' ? '2px solid var(--color-sky-500)' : '1px solid var(--color-gray-200)',
                background: activeLegTab === 'return' ? 'var(--color-sky-600)' : '#ffffff',
                color: activeLegTab === 'return' ? '#ffffff' : 'var(--text-primary)',
                textAlign: 'left',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, opacity: 0.8 }}>
                Step 2: Select Return Leg
              </div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, marginTop: 2 }}>
                {destination} → {origin}
              </div>
              {selectedReturn && (
                <div style={{ fontSize: '11px', marginTop: 4, opacity: 0.9 }}>
                  ✓ Selected: {selectedReturn.flightNumber} ({formatTime(selectedReturn.departureTime)}) - {formatINR(getPrice(selectedReturn))}
                </div>
              )}
            </button>
          </div>
        )}

        {/* Main Content Layout: Filters Sidebar + Flights List */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          {/* ========================================================================= */}
          {/* FEATURE 1: Comprehensive Filters Sidebar                                  */}
          {/* ========================================================================= */}
          <div
            className="card"
            style={{
              padding: 'var(--space-5)',
              borderRadius: 'var(--radius-xl)',
              background: '#ffffff',
              border: '1px solid var(--color-gray-200)',
              position: 'sticky',
              top: 'calc(var(--nav-height) + 16px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <Filter size={16} /> Filters
              </h3>
              {(airlineFilter !== 'all' || nonStopOnly || departureWindow !== 'all' || maxDurationHours < 12) && (
                <button
                  type="button"
                  onClick={() => {
                    setAirlineFilter('all');
                    setNonStopOnly(false);
                    setDepartureWindow('all');
                    setMaxDurationHours(12);
                  }}
                  style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--color-sky-600)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Reset all
                </button>
              )}
            </div>

            {/* Airline Filter */}
            <div style={{ marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-gray-100)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>
                Airlines
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="airline"
                    checked={airlineFilter === 'all'}
                    onChange={() => setAirlineFilter('all')}
                    style={{ accentColor: 'var(--color-sky-500)' }}
                  />
                  <span>All Airlines ({currentRawFlights.length})</span>
                </label>
                {availableAirlines.map(airline => {
                  const count = currentRawFlights.filter(f => f.airline === airline).length;
                  return (
                    <label key={airline} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="airline"
                        checked={airlineFilter === airline}
                        onChange={() => setAirlineFilter(airline)}
                        style={{ accentColor: 'var(--color-sky-500)' }}
                      />
                      <span>{airline} ({count})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Departure Window Filter */}
            <div style={{ marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-gray-100)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>
                Departure Time
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { id: 'all', label: 'Anytime' },
                  { id: 'morning', label: 'Morning (06-12)' },
                  { id: 'afternoon', label: 'Afternoon (12-18)' },
                  { id: 'evening', label: 'Evening (18-24)' },
                ].map(w => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setDepartureWindow(w.id as any)}
                    style={{
                      padding: '6px 8px',
                      fontSize: '11px',
                      borderRadius: 'var(--radius-md)',
                      border: departureWindow === w.id ? '1.5px solid var(--color-sky-500)' : '1px solid var(--color-gray-200)',
                      background: departureWindow === w.id ? 'rgba(14, 165, 233, 0.1)' : '#ffffff',
                      color: departureWindow === w.id ? 'var(--color-sky-700)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: departureWindow === w.id ? 700 : 500,
                    }}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Duration Slider */}
            <div style={{ marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-gray-100)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Max Duration
                </label>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-sky-600)' }}>
                  Up to {maxDurationHours}h
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={maxDurationHours}
                onChange={e => setMaxDurationHours(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-sky-500)', cursor: 'pointer' }}
              />
            </div>

            {/* Non-stop Checkbox */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={nonStopOnly}
                  onChange={e => setNonStopOnly(e.target.checked)}
                  style={{ accentColor: 'var(--color-sky-500)', cursor: 'pointer' }}
                />
                <span>Non-stop flights only</span>
              </label>
            </div>
          </div>

          {/* Flights Cards List */}
          <div>
            {/* Loading & Empty States */}
            {loading && (
              <div className="loading-overlay" style={{ minHeight: '300px', background: 'transparent' }}>
                <div className="spinner" />
                <p>Searching best fares and comparing flight prices...</p>
              </div>
            )}

            {error && (
              <div style={{ textAlign: 'center', padding: 'var(--space-12) 0', background: '#ffffff', borderRadius: 'var(--radius-xl)' }}>
                <AlertCircle size={48} style={{ color: 'var(--color-error)', margin: '0 auto var(--space-4)' }} />
                <p style={{ color: 'var(--color-error)', fontWeight: 600 }}>{error}</p>
              </div>
            )}

            {!loading && !error && filteredFlights.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-12) 0', background: '#ffffff', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-gray-200)' }}>
                <Plane size={48} style={{ color: 'var(--text-tertiary)', margin: '0 auto var(--space-4)' }} />
                <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>No flights match your filters</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                  Try resetting some filters or switching to another departure day.
                </p>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    setAirlineFilter('all');
                    setNonStopOnly(false);
                    setDepartureWindow('all');
                    setMaxDurationHours(12);
                  }}
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {/* Results Count & Current Leg Info */}
            {!loading && filteredFlights.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Showing {filteredFlights.length} flight{filteredFlights.length > 1 ? 's' : ''}{' '}
                  {tripType === 'roundtrip' && (
                    <strong style={{ color: 'var(--color-sky-600)' }}>
                      ({activeLegTab === 'outbound' ? 'Outbound Leg' : 'Return Leg'})
                    </strong>
                  )}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  Prices include all mandatory airport taxes & fees
                </span>
              </div>
            )}

            {/* Flight Cards Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {filteredFlights.map(flight => {
                const fare = getPrice(flight);
                const isFlightCheapest = flight.isCheapest || fare === lowestPrice;
                const priceDiff = fare - lowestPrice;
                const isSelectedThisLeg =
                  tripType === 'roundtrip' &&
                  ((activeLegTab === 'outbound' && selectedOutbound?.id === flight.id) ||
                    (activeLegTab === 'return' && selectedReturn?.id === flight.id));

                return (
                  <div
                    key={flight.id}
                    className={`card ${isFlightCheapest ? 'cheapest-flight-card' : ''}`}
                    onClick={() => handleSelectFlight(flight)}
                    style={{
                      padding: 'var(--space-5)',
                      borderRadius: 'var(--radius-xl)',
                      border: isSelectedThisLeg
                        ? '2px solid var(--color-sky-500)'
                        : isFlightCheapest
                        ? '2px solid #10b981'
                        : '1px solid var(--color-gray-200)',
                      background: isSelectedThisLeg
                        ? 'rgba(14, 165, 233, 0.04)'
                        : isFlightCheapest
                        ? 'linear-gradient(135deg, #ffffff 0%, rgba(16, 185, 129, 0.03) 100%)'
                        : '#ffffff',
                      boxShadow: isFlightCheapest
                        ? '0 4px 16px rgba(16, 185, 129, 0.15)'
                        : 'var(--shadow-sm)',
                      cursor: 'pointer',
                      transition: 'all 200ms ease',
                      position: 'relative',
                    }}
                  >
                    {/* FEATURE 1: Highlight Cheapest Flight Clearly */}
                    {isFlightCheapest && (
                      <div
                        style={{
                          position: 'absolute',
                          top: -10,
                          left: 24,
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 12px',
                          borderRadius: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        <Award size={12} /> CHEAPEST FLIGHT
                      </div>
                    )}

                    {isSelectedThisLeg && (
                      <div
                        style={{
                          position: 'absolute',
                          top: -10,
                          right: 24,
                          background: 'var(--color-sky-600)',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 12px',
                          borderRadius: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        ✓ SELECTED FOR {activeLegTab.toUpperCase()}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr', alignItems: 'center', gap: 'var(--space-4)' }}>
                      {/* Airline & Aircraft */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {flight.airline || 'SkyVoyage'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {flight.flightNumber} · {flight.aircraft.model}
                        </div>
                        <div style={{ marginTop: 'var(--space-2)' }}>
                          <span className="badge badge--success" style={{ fontSize: '10px' }}>
                            {flight.availability[fareClass as 'economy' | 'business' | 'first']?.available || 0} seats left
                          </span>
                        </div>
                      </div>

                      {/* Flight Timings & Duration */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {formatTime(flight.departureTime)}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {flight.origin.city} ({flight.origin.code})
                          </div>
                        </div>

                        <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                            {formatDuration(flight.durationMinutes)}
                          </div>
                          <div style={{ position: 'relative', height: 2, background: 'var(--color-gray-200)', margin: '6px 0' }}>
                            <div
                              style={{
                                position: 'absolute',
                                left: '50%',
                                top: -6,
                                transform: 'translateX(-50%)',
                                color: 'var(--color-sky-500)',
                              }}
                            >
                              ✈
                            </div>
                          </div>
                          <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>
                            {(flight.stops || 0) === 0 ? 'Non-stop' : `${flight.stops} stop`}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {formatTime(flight.arrivalTime)}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {flight.destination.city} ({flight.destination.code})
                          </div>
                        </div>
                      </div>

                      {/* Price & Action */}
                      <div style={{ textAlign: 'right', borderLeft: '1px solid var(--color-gray-100)', paddingLeft: 'var(--space-4)' }}>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: isFlightCheapest ? '#16a34a' : 'var(--color-sky-600)' }}>
                          {formatINR(fare)}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>per passenger</div>

                        {/* FEATURE 1: Show Price Difference compared to cheapest */}
                        {!isFlightCheapest && priceDiff > 0 && (
                          <div
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: 'var(--text-secondary)',
                              marginTop: 4,
                              background: 'var(--color-gray-100)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              display: 'inline-block',
                            }}
                          >
                            +{formatINR(priceDiff)} vs cheapest
                          </div>
                        )}

                        <button
                          type="button"
                          className={`btn ${isSelectedThisLeg ? 'btn--secondary' : isFlightCheapest ? 'btn--primary' : 'btn--outline'} btn--sm`}
                          style={{
                            marginTop: 'var(--space-2)',
                            width: '100%',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 700,
                            borderRadius: 'var(--radius-md)',
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            handleSelectFlight(flight);
                          }}
                        >
                          {tripType === 'roundtrip'
                            ? isSelectedThisLeg
                              ? '✓ Selected'
                              : 'Select Leg'
                            : 'Select Flight →'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Floating Bar for Round-Trip Selection */}
        {tripType === 'roundtrip' && (selectedOutbound || selectedReturn) && (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#0f172a',
              color: '#ffffff',
              padding: 'var(--space-4) 0',
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.25)',
              zIndex: 100,
            }}
          >
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#38bdf8', fontWeight: 700 }}>
                    1. Outbound Leg
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {selectedOutbound ? (
                      `${selectedOutbound.flightNumber} (${formatTime(selectedOutbound.departureTime)}) - ${formatINR(getPrice(selectedOutbound))}`
                    ) : (
                      <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Please choose an outbound flight</span>
                    )}
                  </div>
                </div>

                <div style={{ width: 1, height: 30, background: 'rgba(255, 255, 255, 0.2)' }} />

                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#4ade80', fontWeight: 700 }}>
                    2. Return Leg
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {selectedReturn ? (
                      `${selectedReturn.flightNumber} (${formatTime(selectedReturn.departureTime)}) - ${formatINR(getPrice(selectedReturn))}`
                    ) : (
                      <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Please choose a return flight</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                {selectedOutbound && selectedReturn && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>Total Round-Trip Fare</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#38bdf8' }}>
                      {formatINR((getPrice(selectedOutbound) + getPrice(selectedReturn)) * parseInt(passengers))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!selectedOutbound || !selectedReturn}
                  onClick={handleProceedRoundTrip}
                  style={{ padding: '10px 24px', fontWeight: 700 }}
                >
                  {!selectedOutbound
                    ? 'Pick Outbound Flight'
                    : !selectedReturn
                    ? 'Pick Return Flight'
                    : 'Proceed to Booking →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
