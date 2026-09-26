import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeftRight, Calendar, Users, Plane, Globe, Shield, Headphones, Sparkles, TrendingUp } from 'lucide-react';
import { searchAirports, formatINR, type Airport } from '../api';
import { PricePredictorWidget } from '../components/PricePredictorWidget';

export function HomePage() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCode, setOriginCode] = useState('');
  const [destCode, setDestCode] = useState('');
  const [date, setDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [tripType, setTripType] = useState<'oneway' | 'roundtrip'>('oneway');
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [flexibleReturn, setFlexibleReturn] = useState(true);
  const [passengers, setPassengers] = useState('1');
  const [fareClass, setFareClass] = useState('economy');
  const [allAirports, setAllAirports] = useState<Airport[]>([]);
  const [originSuggestions, setOriginSuggestions] = useState<Airport[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<Airport[]>([]);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  // Set default date to tomorrow and pre-fetch airports
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split('T')[0]);

    const defaultReturn = new Date();
    defaultReturn.setDate(defaultReturn.getDate() + 5);
    setReturnDate(defaultReturn.toISOString().split('T')[0]);

    // Pre-cache all airports for instantaneous client-side reactive filtering
    searchAirports('')
      .then(airports => setAllAirports(airports))
      .catch(() => setAllAirports([]));
  }, []);

  // Filter helper: matches code, city, name, country
  const getMatches = useCallback((query: string, airports: Airport[]): Airport[] => {
    const q = query.trim().toLowerCase();
    if (!q) return airports.slice(0, 8);
    return airports
      .filter(a =>
        a.code.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, []);

  const resolveAirportCode = (text: string, currentCode: string): string => {
    if (currentCode) return currentCode;
    const clean = text.trim();
    if (!clean) return '';

    // Check "(CODE)" or "CODE"
    const match = clean.match(/\(([A-Za-z]{3})\)/) || clean.match(/^([A-Za-z]{3})$/);
    if (match) return match[1].toUpperCase();

    // Match against cached airports
    const found = allAirports.find(
      a =>
        a.code.toLowerCase() === clean.toLowerCase() ||
        a.city.toLowerCase() === clean.toLowerCase() ||
        a.name.toLowerCase().includes(clean.toLowerCase())
    );
    return found ? found.code : clean.toUpperCase();
  };

  const handleOriginChange = (value: string) => {
    setOrigin(value);
    setShowOriginDropdown(true);

    // Auto-detect if user typed exact 3-letter code or full city name
    const clean = value.trim();
    const exactMatch = allAirports.find(
      a => a.code.toLowerCase() === clean.toLowerCase() || a.city.toLowerCase() === clean.toLowerCase()
    );
    if (exactMatch) {
      setOriginCode(exactMatch.code);
    } else {
      setOriginCode('');
    }

    const matches = getMatches(value, allAirports);
    setOriginSuggestions(matches);
  };

  const handleDestChange = (value: string) => {
    setDestination(value);
    setShowDestDropdown(true);

    const clean = value.trim();
    const exactMatch = allAirports.find(
      a => a.code.toLowerCase() === clean.toLowerCase() || a.city.toLowerCase() === clean.toLowerCase()
    );
    if (exactMatch) {
      setDestCode(exactMatch.code);
    } else {
      setDestCode('');
    }

    const matches = getMatches(value, allAirports);
    setDestSuggestions(matches);
  };

  const selectOrigin = (airport: Airport) => {
    setOrigin(`${airport.city} (${airport.code})`);
    setOriginCode(airport.code);
    setShowOriginDropdown(false);
  };

  const selectDest = (airport: Airport) => {
    setDestination(`${airport.city} (${airport.code})`);
    setDestCode(airport.code);
    setShowDestDropdown(false);
  };

  const swapCities = () => {
    const tempOrigin = origin;
    const tempOriginCode = originCode;
    setOrigin(destination);
    setOriginCode(destCode);
    setDestination(tempOrigin);
    setDestCode(tempOriginCode);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const finalOrigin = resolveAirportCode(origin, originCode);
    const finalDest = resolveAirportCode(destination, destCode);

    if (!finalOrigin || !finalDest) return;

    const params = new URLSearchParams({
      origin: finalOrigin,
      destination: finalDest,
      date,
      passengers,
      fareClass,
    });

    if (tripType === 'roundtrip') {
      params.set('tripType', 'roundtrip');
      params.set('returnDate', returnDate);
      if (flexibleReturn) params.set('flexibleReturn', 'true');
    }
    if (flexibleDates) {
      params.set('flexibleDates', 'true');
    }

    navigate(`/flights?${params.toString()}`);
  };

  const handleQuickBook = (origCode: string, origCity: string, dstCode: string, dstCity: string) => {
    setOrigin(`${origCity} (${origCode})`);
    setOriginCode(origCode);
    setDestination(`${dstCity} (${dstCode})`);
    setDestCode(dstCode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const recommendedRoutes = [
    {
      id: 'del-blr',
      origin: 'DEL',
      originCity: 'New Delhi',
      dest: 'BLR',
      destCity: 'Bengaluru',
      startingPrice: 5499,
      duration: '2h 45m',
      category: 'Tech Corridor',
      bestTimeToFly: 'Oct – Feb (Pleasant weather & off-peak lowest fares)',
    },
    {
      id: 'bom-dxb',
      origin: 'BOM',
      originCity: 'Mumbai',
      dest: 'DXB',
      destCity: 'Dubai',
      startingPrice: 21900,
      duration: '3h 30m',
      category: 'International Gateway',
      bestTimeToFly: 'Nov – Mar (Cooler desert climate & Dubai Shopping Festival)',
    },
    {
      id: 'hyd-vtz',
      origin: 'HYD',
      originCity: 'Hyderabad',
      dest: 'VTZ',
      destCity: 'Visakhapatnam',
      startingPrice: 3800,
      duration: '1h 15m',
      category: 'Coastal Express',
      bestTimeToFly: 'Sept – Dec (Scenic beach weather & hill festivals)',
    },
    {
      id: 'del-goi',
      origin: 'DEL',
      originCity: 'New Delhi',
      dest: 'GOI',
      destCity: 'Goa',
      startingPrice: 5800,
      duration: '2h 30m',
      category: 'Holiday Getaway',
      bestTimeToFly: 'Mid-week departures (35% cheaper than weekend rushes)',
    },
    {
      id: 'blr-hyd',
      origin: 'BLR',
      originCity: 'Bengaluru',
      dest: 'HYD',
      destCity: 'Hyderabad',
      startingPrice: 3100,
      duration: '1h 10m',
      category: 'Business Shuttle',
      bestTimeToFly: 'Early morning flights (98% on-time punctuality rating)',
    },
    {
      id: 'bom-del',
      origin: 'BOM',
      originCity: 'Mumbai',
      dest: 'DEL',
      destCity: 'New Delhi',
      startingPrice: 4900,
      duration: '2h 10m',
      category: 'Metro Trunk Route',
      bestTimeToFly: 'Book 14+ days ahead for lowest tier pricing',
    },
  ];

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      {/* Hero Section */}
      <section className="hero">
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 className="hero__title">
            Discover Your Next<br />
            <span style={{ color: 'var(--color-sky-400)' }}>Destination</span>
          </h1>
          <p className="hero__subtitle">
            Book flights to 22 destinations worldwide including Visakhapatnam, Hyderabad, Delhi, Mumbai, and Bengaluru with real-time seat availability and 3D cabin visualizer.
          </p>

          {/* Search Form */}
          <form className="search-form" onSubmit={handleSearch}>
            {/* Trip Type & Flexible Dates Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
              paddingBottom: 'var(--space-3)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setTripType('oneway')}
                  className={`btn btn--sm ${tripType === 'oneway' ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ borderRadius: '20px', padding: '6px 16px', fontSize: 'var(--text-xs)' }}
                >
                  ✈️ One Way
                </button>
                <button
                  type="button"
                  onClick={() => setTripType('roundtrip')}
                  className={`btn btn--sm ${tripType === 'roundtrip' ? 'btn--primary' : 'btn--ghost'}`}
                  style={{
                    borderRadius: '20px',
                    padding: '6px 16px',
                    fontSize: 'var(--text-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  🔄 Round Trip
                  <span style={{
                    fontSize: '10px',
                    background: 'rgba(34, 197, 94, 0.25)',
                    color: '#22c55e',
                    padding: '1px 6px',
                    borderRadius: '8px',
                    fontWeight: 700
                  }}>
                    Save up to 20%
                  </span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={flexibleDates}
                    onChange={e => setFlexibleDates(e.target.checked)}
                    style={{ accentColor: 'var(--color-sky-500)', cursor: 'pointer' }}
                  />
                  <span>Flexible Dates (±3 Days)</span>
                </label>

                {tripType === 'roundtrip' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--color-sky-400)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={flexibleReturn}
                      onChange={e => setFlexibleReturn(e.target.checked)}
                      style={{ accentColor: 'var(--color-sky-500)', cursor: 'pointer' }}
                    />
                    <span>Flexible Return (±3 Days)</span>
                  </label>
                )}
              </div>
            </div>

            <div className="search-form__grid" style={{ gridTemplateColumns: tripType === 'roundtrip' ? '2.2fr 1fr 1fr 1fr auto' : undefined }}>
              {/* Route Container: From, Swap, To */}
              <div className="search-form__route-group">
                <div className="form-group search-form__field" style={{ position: 'relative' }}>
                  <label className="form-label">From</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="City or code (e.g. VTZ, HYD, DEL)"
                    value={origin}
                    onChange={e => handleOriginChange(e.target.value)}
                    onFocus={() => {
                      setOriginSuggestions(getMatches(origin, allAirports));
                      setShowOriginDropdown(true);
                    }}
                    onBlur={() => setTimeout(() => setShowOriginDropdown(false), 200)}
                    required
                  />
                  {showOriginDropdown && originSuggestions.length > 0 && (
                    <AirportDropdown airports={originSuggestions} onSelect={selectOrigin} />
                  )}
                </div>

                <div className="search-form__swap-container">
                  <button
                    type="button"
                    className="search-form__swap"
                    onClick={swapCities}
                    aria-label="Swap origin and destination"
                    title="Swap From and To"
                  >
                    <ArrowLeftRight size={16} />
                  </button>
                </div>

                <div className="form-group search-form__field" style={{ position: 'relative' }}>
                  <label className="form-label">To</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="City or code (e.g. HYD, VTZ, BOM)"
                    value={destination}
                    onChange={e => handleDestChange(e.target.value)}
                    onFocus={() => {
                      setDestSuggestions(getMatches(destination, allAirports));
                      setShowDestDropdown(true);
                    }}
                    onBlur={() => setTimeout(() => setShowDestDropdown(false), 200)}
                    required
                  />
                  {showDestDropdown && destSuggestions.length > 0 && (
                    <AirportDropdown airports={destSuggestions} onSelect={selectDest} />
                  )}
                </div>
              </div>

              {/* Departure Date Field */}
              <div className="form-group">
                <label className="form-label">{tripType === 'roundtrip' ? 'Depart' : 'Date'}</label>
                <input
                  className="form-input"
                  type="date"
                  value={date}
                  onChange={e => {
                    setDate(e.target.value);
                    if (tripType === 'roundtrip' && returnDate && e.target.value > returnDate) {
                      setReturnDate(e.target.value);
                    }
                  }}
                  min={today}
                  required
                />
              </div>

              {/* Return Date Field (if Round Trip) */}
              {tripType === 'roundtrip' && (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>Return</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-sky-400)' }}>Combo</span>
                  </label>
                  <input
                    className="form-input"
                    type="date"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    min={date || today}
                    required={tripType === 'roundtrip'}
                  />
                </div>
              )}

              {/* Passengers Field */}
              <div className="form-group">
                <label className="form-label">Passengers</label>
                <select className="form-select" value={passengers} onChange={e => setPassengers(e.target.value)}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'Passenger' : 'Passengers'}</option>
                  ))}
                </select>
              </div>

              {/* Search Submit Button */}
              <button
                type="submit"
                className="btn btn--primary btn--lg"
                disabled={!origin.trim() || !destination.trim() || (tripType === 'roundtrip' && !returnDate)}
              >
                <Search size={18} />
                {tripType === 'roundtrip' ? 'Find Combo' : 'Search'}
              </button>
            </div>

            {/* Fare class selector */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)', justifyContent: 'center' }}>
              {['economy', 'business', 'first'].map(fc => (
                <button
                  key={fc}
                  type="button"
                  className={`btn ${fareClass === fc ? 'btn--primary btn--sm' : 'btn--ghost btn--sm'}`}
                  onClick={() => setFareClass(fc)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {fc}
                </button>
              ))}
            </div>
          </form>
        </div>
      </section>

      {/* 3–4 Months Ahead Trip Cost Forecaster & Carrier Recommender Widget */}
      <section style={{ padding: '0 0 var(--space-8)' }}>
        <div className="container">
          <PricePredictorWidget />
        </div>
      </section>

      {/* Recommended For You & Best Time to Fly (Feature 5) */}
      <section style={{ padding: '0 0 var(--space-12)' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-sky-600)' }}>
                  Tailored Flight Intelligence
                </span>
                <span className="badge badge--success" style={{ fontSize: '10px' }}>AI Curated</span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
                Recommended For You
              </h2>
            </div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Popular routes, real-time lowest fare baselines & optimal travel periods
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {recommendedRoutes.map(item => (
              <div
                key={item.id}
                className="card card--interactive"
                style={{
                  padding: 'var(--space-5)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--color-gray-200)',
                  transition: 'all 200ms ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                      {item.category}
                    </span>
                    <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{item.originCity}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>({item.origin})</span>
                      <span style={{ color: 'var(--color-sky-500)' }}>→</span>
                      <span>{item.destCity}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>({item.dest})</span>
                    </h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>from</div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-sky-600)' }}>
                      {formatINR(item.startingPrice)}
                    </div>
                  </div>
                </div>

                {/* Best time to fly tag */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
                  border: '1px solid rgba(14, 165, 233, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  marginBottom: 'var(--space-4)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{ fontSize: '14px' }}>💡</span>
                  <div>
                    <strong style={{ color: 'var(--color-sky-700)' }}>Best time to fly:</strong> {item.bestTimeToFly}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    ⏱ {item.duration} · Daily flights
                  </span>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => handleQuickBook(item.origin, item.originCity, item.dest, item.destCity)}
                    style={{ fontSize: 'var(--text-xs)' }}
                  >
                    Select & Book →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ padding: 'var(--space-16) 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
              Why Fly with SkyVoyage
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto' }}>
              Powered by intelligent technology for a smarter, smoother travel experience.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-6)' }}>
            <FeatureCard
              icon={<Plane size={24} />}
              title="3D Seat Selection"
              description="Walk through a realistic 3D cabin model. Choose your perfect seat with an interactive, immersive experience."
            />
            <FeatureCard
              icon={<Globe size={24} />}
              title="22 Global Destinations"
              description="Connect to major hubs across India, North America, Europe, Asia, and Australia with daily departures."
            />
            <FeatureCard
              icon={<Shield size={24} />}
              title="Secure Booking"
              description="Every seat selection is locked at the database level. No double-bookings, no surprises."
            />
            <FeatureCard
              icon={<Headphones size={24} />}
              title="AI Travel Assistant"
              description="Get instant answers about flights, policies, and bookings from our intelligent chatbot."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function AirportDropdown({ airports, onSelect }: { airports: Airport[]; onSelect: (a: Airport) => void }) {
  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      background: 'var(--surface-primary)',
      border: '1px solid var(--color-gray-200)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 50,
      marginTop: 4,
      overflow: 'hidden',
      maxHeight: 280,
      overflowY: 'auto',
    }}>
      {airports.map(airport => (
        <button
          key={airport.code}
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            onSelect(airport);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            width: '100%',
            padding: 'var(--space-3) var(--space-4)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-gray-50)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <span style={{
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
            color: 'var(--color-sky-600)',
            fontFamily: 'var(--font-mono)',
            minWidth: 38,
          }}>
            {airport.code}
          </span>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
              {airport.city} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>({airport.country})</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{airport.name}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div className="card__body" style={{ padding: 'var(--space-8)' }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-xl)',
          background: 'rgba(14, 165, 233, 0.1)',
          color: 'var(--color-sky-500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-4)',
        }}>
          {icon}
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
          {title}
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
    </div>
  );
}
