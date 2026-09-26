const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Airports ─────────────────────────────────────────────
export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export async function searchAirports(query: string): Promise<Airport[]> {
  return request<Airport[]>(`/airports?search=${encodeURIComponent(query)}`);
}

// ─── Flights ──────────────────────────────────────────────
export interface PriceAdvice {
  route: string;
  recommendation: 'Book Now' | 'Wait 2-3 days' | 'Prices are rising – book soon';
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
  reason: string;
  currentMinPrice: number;
  historicalAvgPrice: number;
  priceDifference: number;
  priceTrend: 'rising' | 'falling' | 'stable';
  avgOccupancyPercent: number;
  daysToDeparture: number;
}

export interface PriceCalendarDay {
  date: string;
  displayDate: string;
  dayOfWeek: string;
  minPrice: number | null;
  flightCount: number;
  isLowestInWindow: boolean;
  isSearchedDate: boolean;
}

export interface FlightResult {
  id: number;
  flightNumber: string;
  origin: { code: string; city: string; country: string };
  destination: { code: string; city: string; country: string };
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  aircraft: { model: string; code: string };
  airline?: string;
  stops?: number;
  pricing: { economy: number; business: number | null; first: number | null };
  availability: {
    economy: { total: number; booked: number; available: number };
    business: { total: number; booked: number; available: number };
    first: { total: number; booked: number; available: number };
  };
  lockedSeats: number;
  status: string;
  // Smart Price Comparison extensions
  isCheapest?: boolean;
  priceDiffFromCheapest?: number;
  cheapestComparisonText?: string;
}

export interface FlightSearchResponse {
  flights: FlightResult[];
  total: number;
  priceAdvice?: PriceAdvice;
  priceCalendar?: PriceCalendarDay[];
  flexibleDays?: number;
}

export async function searchFlights(params: {
  origin: string;
  destination: string;
  date?: string;
  passengers?: number;
  fareClass?: string;
  flexibleDates?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'duration_asc' | 'departure_asc';
  airline?: string;
  maxDuration?: number;
  departureWindow?: 'morning' | 'afternoon' | 'evening' | 'night';
}): Promise<FlightSearchResponse> {
  const qs = new URLSearchParams();
  qs.set('origin', params.origin);
  qs.set('destination', params.destination);
  if (params.date) qs.set('date', params.date);
  if (params.passengers) qs.set('passengers', String(params.passengers));
  if (params.fareClass) qs.set('fareClass', params.fareClass);
  if (params.flexibleDates) qs.set('flexibleDates', 'true');
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.airline) qs.set('airline', params.airline);
  if (params.maxDuration) qs.set('maxDuration', String(params.maxDuration));
  if (params.departureWindow) qs.set('departureWindow', params.departureWindow);
  return request<FlightSearchResponse>(`/flights/search?${qs.toString()}`);
}

// ─── Round-Trip Search ────────────────────────────────────
export interface BestValueCombo {
  outboundFlight: FlightResult;
  returnFlight: FlightResult;
  combinedPrice: number;
  bundledSavings: number;
  score: number;
  valueRationale: string;
}

export interface RoundTripSearchResponse {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  fareClass: string;
  outboundFlights: FlightResult[];
  returnFlights: FlightResult[];
  bestValueCombo: BestValueCombo | null;
  outboundPriceCalendar?: PriceCalendarDay[];
  returnPriceCalendar?: PriceCalendarDay[];
  priceAdvice?: PriceAdvice;
}

export async function searchRoundTrip(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  passengers?: number;
  fareClass?: string;
  flexibleReturn?: boolean;
}): Promise<RoundTripSearchResponse> {
  const qs = new URLSearchParams();
  qs.set('origin', params.origin);
  qs.set('destination', params.destination);
  qs.set('departureDate', params.departureDate);
  qs.set('returnDate', params.returnDate);
  if (params.passengers) qs.set('passengers', String(params.passengers));
  if (params.fareClass) qs.set('fareClass', params.fareClass);
  if (params.flexibleReturn) qs.set('flexibleReturn', 'true');
  return request<RoundTripSearchResponse>(`/flights/roundtrip?${qs.toString()}`);
}

export interface FlightDetail {
  id: number;
  flightNumber: string;
  origin: { code: string; city: string; name: string; country: string };
  destination: { code: string; city: string; name: string; country: string };
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  aircraft: {
    model: string;
    code: string;
    config: {
      rowsEconomy: number;
      rowsBusiness: number;
      rowsFirst: number;
      seatsPerRowEconomy: number;
      seatsPerRowBusiness: number;
      seatsPerRowFirst: number;
      aisleEconomy: string;
      aisleBusiness: string;
      aisleFirst: string;
    };
  };
  pricing: { economy: number; business: number | null; first: number | null };
  bookedSeats: { seatNumber: string; seatClass: string }[];
  lockedSeats: string[];
  status: string;
}

export async function getFlightDetails(id: number): Promise<FlightDetail> {
  return request<FlightDetail>(`/flights/${id}`);
}

// ─── Currency Formatter ────────────────────────────────────
export function formatINR(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

// ─── Seats ────────────────────────────────────────────────
export interface SeatInfo {
  number: string;
  row: number;
  column: number;
  letter: string;
  status: 'available' | 'booked' | 'locked' | 'waitlist';
  type: 'window' | 'aisle' | 'middle';
  lockedBySession: string | null;
}

export interface SeatSection {
  name: string;
  startRow: number;
  endRow: number;
  seatsPerRow: number;
  aislePositions: number[];
  seats: SeatInfo[];
}

export interface SeatMapResponse {
  flightId: number;
  aircraft: { model: string; code: string };
  sections: SeatSection[];
  stats?: {
    totalSeats: number;
    availableSeats: number;
    occupiedSeats: number;
    windowAvailable: number;
    aisleAvailable: number;
  };
}

export async function getSeatMap(flightId: number): Promise<SeatMapResponse> {
  return request<SeatMapResponse>(`/seats/${flightId}`);
}

export async function lockSeats(flightId: number, seatNumbers: string[], sessionId?: string) {
  return request<{ sessionId: string; lockedSeats: string[]; failedSeats: string[]; expiresAt: string }>(
    '/seats/lock',
    { method: 'POST', body: JSON.stringify({ flightId, seatNumbers, sessionId }) }
  );
}

export async function releaseSeats(flightId: number, sessionId: string, seatNumbers?: string[]) {
  return request('/seats/release', {
    method: 'POST',
    body: JSON.stringify({ flightId, seatNumbers, sessionId }),
  });
}

// ─── Bookings ─────────────────────────────────────────────
export interface CreateBookingRequest {
  flightId: number;
  fareClass: string;
  passengers: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    passportNumber?: string;
    nationality?: string;
    idType?: string;
    idNumber?: string;
    idExpiry?: string;
    issuingCountry?: string;
    passengerType?: string;
  }[];
  seats: { seatNumber: string; seatClass: string }[];
  contactEmail: string;
  contactPhone?: string;
  addons?: { type: string; name: string; price: number; quantity: number; passengerId?: number }[];
  preferredSeatType?: 'window' | 'aisle' | 'any';
}

export interface BookingResponse {
  pnr: string;
  bookingId: number;
  flightId: number;
  fareClass: string;
  passengers: { id: number; firstName: string; lastName: string; seat: string | null }[];
  totalAmount: number;
  currency: string;
  status: string;
  seatWaitlistEnrolled?: boolean;
  message: string;
}

export async function createBooking(data: CreateBookingRequest): Promise<BookingResponse> {
  return request<BookingResponse>('/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface BookingDetail {
  pnr: string;
  status: string;
  fareClass: string;
  totalAmount: number;
  currency: string;
  contactEmail: string;
  contactPhone: string | null;
  createdAt: string;
  flight: {
    id: number;
    flightNumber: string;
    origin: { code: string; city: string };
    destination: { code: string; city: string };
    departureTime: string;
    arrivalTime: string;
    durationMinutes: number;
    aircraft: { model: string; code: string };
  };
  passengers: {
    id: number;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    gender: string | null;
    passportNumber: string | null;
    nationality: string | null;
    idType?: string | null;
    idNumber?: string | null;
    idExpiry?: string | null;
    issuingCountry?: string | null;
    passengerType: string;
    seat: string | null;
    seatClass: string | null;
  }[];
  payment: {
    status: string;
    amount: number;
    method: string;
    transactionId: string | null;
    cardLastFour: string | null;
    bankName?: string | null;
    upiId?: string | null;
  } | null;
  addons: { type: string; name: string; price: number; quantity: number }[];
}

export async function getBooking(pnr: string): Promise<BookingDetail> {
  return request<BookingDetail>(`/bookings/${pnr.toUpperCase()}`);
}

export async function cancelBooking(pnr: string): Promise<{ pnr: string; status: string; message: string }> {
  return request(`/bookings/${pnr.toUpperCase()}/cancel`, { method: 'PUT' });
}

// ─── Payments ─────────────────────────────────────────────
export interface PaymentRequest {
  bookingId: number;
  pnr?: string;
  method?: string; // 'card' | 'upi' | 'netbanking' | 'rupay' | 'apple_pay' | 'paypal'
  cardNumber?: string;
  cardHolder?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
  upiId?: string;
  bankName?: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentId?: number;
  transactionId: string;
  amount?: number;
  currency?: string;
  method?: string;
  cardLastFour?: string;
  bookingStatus?: string;
  message: string;
}

export async function processPayment(data: PaymentRequest): Promise<PaymentResponse> {
  return request<PaymentResponse>('/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Chat ─────────────────────────────────────────────────
export interface ChatResponse {
  reply: string;
  model?: string;
  isOffline?: boolean;
  isTimeout?: boolean;
}

export async function sendChatMessage(
  message: string,
  conversationHistory: { role: string; content: string }[] = []
): Promise<ChatResponse> {
  return request<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversationHistory }),
  });
}

export async function getChatStatus(): Promise<{ status: string; models?: string[]; provider?: string }> {
  return request('/chat/status');
}

// ─── Seat Preference Waitlist & Upgrades ──────────────────
export interface SeatWaitlistEntry {
  id: number;
  userId?: number;
  bookingId: number;
  pnr: string;
  flightId: number;
  passengerId?: number;
  passengerName: string;
  contactEmail: string;
  preferredSeatType: 'window' | 'aisle' | 'any';
  currentSeatNumber?: string | null;
  status: 'waiting' | 'notified' | 'claimed' | 'expired' | 'declined';
  notifiedSeatNumber?: string | null;
  notificationTime?: string | null;
  notificationMessage?: string | null;
  createdAt: string;
}

export interface SeatWaitlistAlert {
  waitlistId: number;
  bookingId: number;
  pnr: string;
  flightId: number;
  passengerName: string;
  preferredSeatType: string;
  currentSeatNumber: string | null;
  notifiedSeatNumber: string;
  notificationMessage: string;
  notificationTime: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
}

export async function enrollSeatWaitlist(data: {
  userId?: number;
  bookingId: number;
  pnr: string;
  flightId: number;
  passengerId?: number;
  passengerName: string;
  contactEmail: string;
  preferredSeatType: 'window' | 'aisle' | 'any';
  currentSeatNumber?: string;
}): Promise<{ success: boolean; waitlistId: number; message: string; alreadyEnrolled?: boolean }> {
  return request('/seat-waitlist', { method: 'POST', body: JSON.stringify(data) });
}

export async function getSeatWaitlistStatus(bookingIdOrPnr: string | number): Promise<{ entries: SeatWaitlistEntry[] }> {
  return request(`/seat-waitlist/status/${bookingIdOrPnr}`);
}

export async function getSeatWaitlistAlerts(email: string): Promise<{ alerts: SeatWaitlistAlert[] }> {
  return request(`/seat-waitlist/alerts/${encodeURIComponent(email)}`);
}

export async function claimSeatUpgrade(waitlistId: number): Promise<{ success: boolean; upgradedSeat: string; message: string }> {
  return request('/seat-waitlist/claim', { method: 'POST', body: JSON.stringify({ waitlistId }) });
}

export async function declineSeatUpgrade(waitlistId: number): Promise<{ success: boolean; message: string }> {
  return request('/seat-waitlist/decline', { method: 'POST', body: JSON.stringify({ waitlistId }) });
}

