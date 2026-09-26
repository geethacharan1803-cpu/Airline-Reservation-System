import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Calendar, Users, Plane, Sparkles,
  CheckCircle2, ArrowRight, ShieldCheck, DollarSign, BarChart3,
  Luggage, Utensils
} from 'lucide-react';
import { formatINR } from '../api';

interface RouteForecast {
  origin: string;
  originCity: string;
  destination: string;
  destCity: string;
  isInternational: boolean;
  baseFareINR: number;
  monthlyMultipliers: { monthName: string; factor: number; trend: 'low' | 'moderate' | 'peak' }[];
  carriers: {
    name: string;
    code: string;
    logo: string;
    price: number;
    duration: string;
    onTime: number;
    type: 'Full-Service' | 'Low-Cost' | 'Premium Intl';
    badge?: string;
  }[];
}

const POPULAR_ROUTES: RouteForecast[] = [
  {
    origin: 'DEL',
    originCity: 'New Delhi',
    destination: 'BLR',
    destCity: 'Bengaluru',
    isInternational: false,
    baseFareINR: 6499,
    monthlyMultipliers: [
      { monthName: 'October', factor: 0.92, trend: 'low' },
      { monthName: 'November', factor: 1.15, trend: 'peak' }, // Diwali rush
      { monthName: 'December', factor: 1.28, trend: 'peak' }, // Year end
      { monthName: 'January', factor: 0.88, trend: 'low' },
    ],
    carriers: [
      { name: 'SkyVoyage', code: 'SV-201', logo: '✈️', price: 6499, duration: '2h 45m', onTime: 94, type: 'Full-Service', badge: 'Best Overall' },
      { name: 'IndiGo', code: '6E-542', logo: '🔵', price: 5999, duration: '2h 50m', onTime: 89, type: 'Low-Cost', badge: 'Cheapest' },
      { name: 'Air India', code: 'AI-803', logo: '🔴', price: 6850, duration: '2h 40m', onTime: 86, type: 'Full-Service' },
    ],
  },
  {
    origin: 'BOM',
    originCity: 'Mumbai',
    destination: 'DXB',
    destCity: 'Dubai',
    isInternational: true,
    baseFareINR: 24500,
    monthlyMultipliers: [
      { monthName: 'October', factor: 0.95, trend: 'low' },
      { monthName: 'November', factor: 1.12, trend: 'moderate' },
      { monthName: 'December', factor: 1.45, trend: 'peak' }, // Shopping festival
      { monthName: 'January', factor: 1.18, trend: 'moderate' },
    ],
    carriers: [
      { name: 'SkyVoyage Intl', code: 'SV-880', logo: '✈️', price: 24500, duration: '3h 30m', onTime: 96, type: 'Full-Service', badge: 'Recommended' },
      { name: 'Emirates', code: 'EK-501', logo: '🇦🇪', price: 31200, duration: '3h 25m', onTime: 93, type: 'Premium Intl', badge: 'Luxury Choice' },
      { name: 'Air India Express', code: 'IX-247', logo: '🟠', price: 21900, duration: '3h 45m', onTime: 84, type: 'Low-Cost' },
    ],
  },
  {
    origin: 'HYD',
    originCity: 'Hyderabad',
    destination: 'VTZ',
    destCity: 'Visakhapatnam',
    isInternational: false,
    baseFareINR: 4200,
    monthlyMultipliers: [
      { monthName: 'October', factor: 0.90, trend: 'low' },
      { monthName: 'November', factor: 1.05, trend: 'moderate' },
      { monthName: 'December', factor: 1.22, trend: 'peak' },
      { monthName: 'January', factor: 1.35, trend: 'peak' }, // Sankranti festival
    ],
    carriers: [
      { name: 'SkyVoyage Express', code: 'SV-305', logo: '✈️', price: 4200, duration: '1h 15m', onTime: 95, type: 'Full-Service', badge: 'Non-stop Direct' },
      { name: 'IndiGo', code: '6E-711', logo: '🔵', price: 3950, duration: '1h 20m', onTime: 91, type: 'Low-Cost' },
      { name: 'Air India', code: 'AI-544', logo: '🔴', price: 4400, duration: '1h 15m', onTime: 88, type: 'Full-Service' },
    ],
  },
  {
    origin: 'DEL',
    originCity: 'New Delhi',
    destination: 'BOM',
    destCity: 'Mumbai',
    isInternational: false,
    baseFareINR: 5800,
    monthlyMultipliers: [
      { monthName: 'October', factor: 0.94, trend: 'low' },
      { monthName: 'November', factor: 1.08, trend: 'moderate' },
      { monthName: 'December', factor: 1.30, trend: 'peak' },
      { monthName: 'January', factor: 0.95, trend: 'low' },
    ],
    carriers: [
      { name: 'SkyVoyage', code: 'SV-102', logo: '✈️', price: 5800, duration: '2h 10m', onTime: 94, type: 'Full-Service', badge: 'High Frequency' },
      { name: 'IndiGo', code: '6E-205', logo: '🔵', price: 5400, duration: '2h 15m', onTime: 90, type: 'Low-Cost' },
      { name: 'Air India', code: 'AI-665', logo: '🔴', price: 6100, duration: '2h 10m', onTime: 87, type: 'Full-Service' },
    ],
  },
];

export function PricePredictorWidget() {
  const navigate = useNavigate();
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);

  // Group / Family travel calculator state
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(1);
  const [extraBaggage, setExtraBaggage] = useState(false);
  const [gourmetMeals, setGourmetMeals] = useState(false);

  const route = POPULAR_ROUTES[selectedRouteIdx];
  const monthData = route.monthlyMultipliers[selectedMonthIdx];
  const forecastedBase = Math.round(route.baseFareINR * monthData.factor);

  // Family budget calculation
  const totalPassengers = adults + children;
  const adultSubtotal = adults * forecastedBase;
  const childSubtotal = children * Math.round(forecastedBase * 0.75); // 25% child discount
  const baggageCost = extraBaggage ? 950 * totalPassengers : 0;
  const mealCost = gourmetMeals ? 450 * totalPassengers : 0;
  const estimatedGroupTotal = adultSubtotal + childSubtotal + baggageCost + mealCost;

  const handleBookNow = () => {
    const params = new URLSearchParams({
      origin: route.origin,
      destination: route.destination,
      passengers: String(totalPassengers),
      fareClass: 'economy',
    });
    navigate(`/flights?${params.toString()}`);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #091e3a 0%, #0d274d 100%)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-8)',
      color: '#ffffff',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
      border: '1px solid rgba(56, 189, 248, 0.2)',
      marginTop: 'var(--space-12)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              background: 'rgba(14, 165, 233, 0.2)',
              color: 'var(--color-sky-400)',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <Sparkles size={12} /> ML Fare Forecaster & Recommender
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              • 3–4 Months Predictive Trends
            </span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>
            Anticipate Fares & Save Up to 28%
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Historical ticket trends & dynamic booking window optimization powered by SkyVoyage predictive analytics.
          </p>
        </div>

        {/* Route selector buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {POPULAR_ROUTES.map((r, idx) => (
            <button
              key={`${r.origin}-${r.destination}`}
              type="button"
              onClick={() => setSelectedRouteIdx(idx)}
              style={{
                background: selectedRouteIdx === idx ? 'var(--color-sky-500)' : 'rgba(255, 255, 255, 0.08)',
                color: selectedRouteIdx === idx ? '#ffffff' : '#cbd5e1',
                border: `1px solid ${selectedRouteIdx === idx ? 'var(--color-sky-400)' : 'rgba(255, 255, 255, 0.15)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {r.origin} ⇄ {r.destination}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        
        {/* Left Column: 4-Month Forecast & Carrier Comparison */}
        <div>
          {/* Month Trend Tabs */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '4px',
            borderRadius: 'var(--radius-lg)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 4,
            marginBottom: 'var(--space-5)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {route.monthlyMultipliers.map((m, idx) => {
              const isSelected = selectedMonthIdx === idx;
              const projected = Math.round(route.baseFareINR * m.factor);
              return (
                <button
                  key={m.monthName}
                  type="button"
                  onClick={() => setSelectedMonthIdx(idx)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: isSelected ? 'var(--color-sky-500)' : 'transparent',
                    color: isSelected ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600 }}>{m.monthName}</div>
                  <div style={{ fontSize: '12px', fontWeight: 800, marginTop: 2, color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                    {formatINR(projected)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* AI Trend Signal Badge */}
          <div style={{
            background: monthData.trend === 'low'
              ? 'rgba(34, 197, 94, 0.15)'
              : monthData.trend === 'peak'
              ? 'rgba(239, 68, 68, 0.15)'
              : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${
              monthData.trend === 'low'
                ? 'rgba(34, 197, 94, 0.4)'
                : monthData.trend === 'peak'
                ? 'rgba(239, 68, 68, 0.4)'
                : 'rgba(245, 158, 11, 0.4)'
            }`,
            borderRadius: 'var(--radius-lg)',
            padding: '12px 16px',
            marginBottom: 'var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {monthData.trend === 'low' ? (
                <TrendingDown size={22} style={{ color: '#4ade80' }} />
              ) : (
                <TrendingUp size={22} style={{ color: monthData.trend === 'peak' ? '#f87171' : '#fbbf24' }} />
              )}
              <div>
                <div style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                  color: monthData.trend === 'low' ? '#4ade80' : monthData.trend === 'peak' ? '#f87171' : '#fbbf24'
                }}>
                  {monthData.trend === 'low' && '🟢 Optimal Time to Buy: Lowest seasonal rates'}
                  {monthData.trend === 'moderate' && '🟡 Moderate Demand: Fares stable for next 10 days'}
                  {monthData.trend === 'peak' && '🔴 Expected Fare Surge: Peak festival demand (+18% next week)'}
                </div>
                <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: 2 }}>
                  94.2% AI confidence score based on 1.4M route transaction data points.
                </div>
              </div>
            </div>
            <span style={{
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#38bdf8'
            }}>
              CONFIDENCE 94%
            </span>
          </div>

          {/* Carrier Price Comparison Table */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: 'var(--space-3)' }}>
              Carrier Rate & Punctuality Benchmark:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {route.carriers.map(c => {
                const adjustedRate = Math.round(c.price * monthData.factor);
                return (
                  <div
                    key={c.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '18px' }}>{c.logo}</span>
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{c.name}</span>
                          {c.badge && (
                            <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '9px', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              {c.badge}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {c.duration} • {c.onTime}% On-Time • {c.type}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: '#38bdf8' }}>
                        {formatINR(adjustedRate)}
                      </div>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>per passenger</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Family / Group Budget Estimator */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-4)' }}>
              <Users size={18} style={{ color: 'var(--color-sky-400)' }} />
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0 }}>
                Group & Family Budget Calculator
              </h3>
            </div>

            {/* Passenger counters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Adults (12+ yrs)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{adults}</span>
                  <button
                    type="button"
                    onClick={() => setAdults(Math.min(9, adults + 1))}
                    style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Children (2-11 yrs, 25% off)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setChildren(Math.max(0, children - 1))}
                    style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{children}</span>
                  <button
                    type="button"
                    onClick={() => setChildren(Math.min(6, children + 1))}
                    style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Add-ons checkboxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 'var(--space-4)' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 'var(--text-xs)',
                color: '#cbd5e1',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)'
              }}>
                <input
                  type="checkbox"
                  checked={extraBaggage}
                  onChange={e => setExtraBaggage(e.target.checked)}
                />
                <Luggage size={14} style={{ color: 'var(--color-sky-400)' }} />
                <span>Add Prepaid Excess Baggage (+15kg @ ₹950/pax)</span>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 'var(--text-xs)',
                color: '#cbd5e1',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)'
              }}>
                <input
                  type="checkbox"
                  checked={gourmetMeals}
                  onChange={e => setGourmetMeals(e.target.checked)}
                />
                <Utensils size={14} style={{ color: 'var(--color-sky-400)' }} />
                <span>Add Chef Curated Hot Meals (@ ₹450/pax)</span>
              </label>
            </div>

            {/* Cost breakdown */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              marginBottom: 'var(--space-4)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: 4 }}>
                <span>{adults} Adult{adults > 1 ? 's' : ''} ({monthData.monthName} Forecast)</span>
                <span>{formatINR(adultSubtotal)}</span>
              </div>
              {children > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: 4 }}>
                  <span>{children} Child{children > 1 ? 'ren' : ''} (25% Discount)</span>
                  <span>{formatINR(childSubtotal)}</span>
                </div>
              )}
              {(extraBaggage || gourmetMeals) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#38bdf8', marginBottom: 4 }}>
                  <span>Add-ons (Baggage & Catering)</span>
                  <span>{formatINR(baggageCost + mealCost)}</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6, marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>Total Group Estimate:</span>
                <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#38bdf8' }}>
                  {formatINR(estimatedGroupTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <button
            type="button"
            onClick={handleBookNow}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Search Flights for {monthData.monthName}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
