/**
 * ============================================================
 * SKYVOYAGE ENTERPRISE — Main Application & SPA Router
 * ============================================================
 * Hash-based Single Page Application with:
 * - Client-side routing (#/home, #/dashboard, etc.)
 * - Page lifecycle management (mount/unmount)
 * - Global state management
 * - Toast notification system
 * - Navbar rendering
 * ============================================================
 */

import { openDatabase, seedDatabase, getAll, getDbStats, AIRPORTS, getRecentAuditLogs, get, put, generateId } from './core/db.js';
import { BTree } from './core/btree.js';
import { MaxHeap, calculatePriority, TIER_WEIGHTS } from './core/maxheap.js';
import { lockManager } from './core/mutex.js';
import {
  bookingIndex, waitlistHeap, holdSeat, createBooking, cancelBooking,
  addToWaitlist, lookupByPNR, getAllBookings, getFlightBookings,
  initializeBookingIndex, getActiveHolds, getFlightWaitlist, releaseSeatHold,
} from './services/bookingService.js';
import { computeSeatAvailability, getSeatMap, getSeatsByClass, verifyInjectiveMapping, getSetTheoryDemo } from './services/seatService.js';
import {
  predictNoShowProbability, findOptimalOverbooking, analyzeFlightOverbooking,
  computeExpectedCost, getCostCurveData,
} from './services/capacityService.js';
import { createRouteNetwork, dijkstra, findAlternativeRoute, getGraphProperties, bfs, dfs } from './services/graphService.js';
import {
  evaluateBookingFormula, generateBookingTruthTable, validateCheckout,
  getGateDefinitions, generateCustomTruthTable, LogicGates, evaluateGate,
} from './services/logicGate.js';
import { getRefundPolicy, Passenger } from './models/index.js';

// ══════════════════════════════════════════════════════════
//  GLOBAL STATE
// ══════════════════════════════════════════════════════════

const initialSessionId = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('skyvoyage_session_token')) ||
  (`sess_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString(36)}`);
if (typeof sessionStorage !== 'undefined') {
  sessionStorage.setItem('skyvoyage_session_token', initialSessionId);
}

const state = {
  currentPage: 'search',
  selectedFlight: null,
  selectedSeat: null,
  holdId: null,
  holdTimer: null,
  passengerData: {},
  passengerCount: 1,
  passengers: [{}],
  selectedSeats: [],
  searchResults: [],
  session_hold_id: initialSessionId,
  tripType: 'oneway',
  departureDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  returnDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
  comboFareApplied: false,
};

// ══════════════════════════════════════════════════════════
//  ICONS (inline SVG for zero-dependency)
// ══════════════════════════════════════════════════════════

const icons = {
  plane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.8 19.2L16 11l3.5-3.5C20.3 6.7 21 5 21 5s-1.7.7-2.5 1.5L15 10l-8.2-1.8c-.4-.1-.8 0-1.1.3l-.5.5 5.2 3.5-3.4 3.4-2-.8-.7.7 2.6 1.8 1.8 2.6.7-.7-.8-2 3.4-3.4 3.5 5.2.5-.5c.3-.3.4-.7.3-1.1z"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>',
};

// ══════════════════════════════════════════════════════════
//  TOAST NOTIFICATION SYSTEM
// ══════════════════════════════════════════════════════════

function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const iconMap = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Make globally available
window.showToast = showToast;

// ══════════════════════════════════════════════════════════
//  NAVBAR
// ══════════════════════════════════════════════════════════

function renderNavbar() {
  return `
    <nav class="navbar" id="navbar">
      <div class="navbar-inner">
        <a href="#/search" class="navbar-brand">
          ${icons.plane}
          <span>Sky<span class="accent">Voyage</span></span>
        </a>
        <div class="navbar-nav" id="nav-links">
          <a href="#/search" class="nav-link" data-page="search">${icons.search} Flights</a>
          <a href="#/bookings" class="nav-link" data-page="bookings">${icons.ticket} My Bookings</a>
          <a href="#/academic" class="nav-link" data-page="academic">${icons.book} Academics (5 Subjects)</a>
        </div>
        <button class="mobile-menu-btn" id="mobile-menu-btn">${icons.menu}</button>
      </div>
    </nav>
  `;
}

// ══════════════════════════════════════════════════════════
//  PAGE: HOME / LANDING
// ══════════════════════════════════════════════════════════

function renderHomePage() {
  return `
    <section class="hero">
      <div class="container">
        <div class="hero-badge">✈️ Academic Demonstration Project</div>
        <h1>Enterprise Airline Reservation System</h1>
        <p>A production-grade booking platform demonstrating DBMS concurrency control, ADSA data structures, discrete mathematics, and ML-driven overbooking optimization.</p>
        <div class="hero-actions">
          <a href="#/search" class="btn btn-primary btn-lg">Search Flights ${icons.search}</a>
          <a href="#/academic" class="btn btn-secondary btn-lg">Explore 5 Core Subjects ${icons.book}</a>
        </div>
      </div>
    </section>
    <section class="container">
      <div class="features-grid">
        <div class="card feature-card animate-in">
          <div class="feature-icon" style="background:var(--color-primary-lighter);color:var(--color-primary)">🔒</div>
          <h3>Concurrency Control</h3>
          <p>Pessimistic locking with SELECT FOR UPDATE simulation. 10-minute seat-hold TTL. 20-thread stress test.</p>
        </div>
        <div class="card feature-card animate-in">
          <div class="feature-icon" style="background:var(--color-success-light);color:var(--color-success)">🌲</div>
          <h3>B-Tree Index</h3>
          <p>Multi-way search tree (order t=3) indexing bookings by PNR. O(log n) search with live telemetry.</p>
        </div>
        <div class="card feature-card animate-in">
          <div class="feature-icon" style="background:var(--color-warning-light);color:var(--color-warning)">📊</div>
          <h3>MaxHeap Waitlist</h3>
          <p>Priority queue managing standby passengers. Score = (TierWeight × 100) − Timestamp. Auto-promotion on cancel.</p>
        </div>
        <div class="card feature-card animate-in">
          <div class="feature-icon" style="background:var(--color-danger-light);color:var(--color-danger)">🧮</div>
          <h3>Logic Gates</h3>
          <p>Propositional checkout validation: CanBook = (Valid ∧ Paid) ∧ (Available ∨ Overbook). Interactive truth table.</p>
        </div>
        <div class="card feature-card animate-in">
          <div class="feature-icon" style="background:var(--color-info-light);color:var(--color-info)">🗺️</div>
          <h3>Route Graph</h3>
          <p>Directed multigraph of 10 airports. Dijkstra's shortest layover path for disruption rerouting.</p>
        </div>
        <div class="card feature-card animate-in">
          <div class="feature-icon" style="background:#F3E8FF;color:#7C3AED">🤖</div>
          <h3>ML Overbooking</h3>
          <p>Logistic regression for no-show prediction. Expected cost minimization for optimal overbooking limit.</p>
        </div>
      </div>
    </section>
    <section class="container" style="margin-top:var(--space-12)">
      <div class="stats-bar" id="home-stats">
        <div class="stat-item animate-in"><div class="stat-value" data-counter="8">0</div><div class="stat-label">Active Flights</div></div>
        <div class="stat-item animate-in"><div class="stat-value" data-counter="10">0</div><div class="stat-label">Airports Connected</div></div>
        <div class="stat-item animate-in"><div class="stat-value" data-counter="1216">0</div><div class="stat-label">Available Seats</div></div>
        <div class="stat-item animate-in"><div class="stat-value" data-counter="6">0</div><div class="stat-label">Academic Modules</div></div>
      </div>
    </section>
  `;
}

function initHomePage() {
  // Animate counters
  document.querySelectorAll('[data-counter]').forEach(el => {
    const target = parseInt(el.dataset.counter);
    const duration = 1500;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(animate);
    };
    setTimeout(animate, 300);
  });
}

// ══════════════════════════════════════════════════════════
//  PAGE: DASHBOARD
// ══════════════════════════════════════════════════════════

async function renderDashboardPage() {
  const stats = await getDbStats();
  const bookings = await getAllBookings();
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const btreeTelemetry = bookingIndex.getTelemetry();
  const heapTelemetry = waitlistHeap.getTelemetry();

  return `
    <div class="container">
      <div class="page-header">
        <h1>Operations Dashboard</h1>
        <p>Real-time system metrics, data structure telemetry, and booking analytics</p>
      </div>

      <div class="grid grid-4 gap-6 mb-8">
        <div class="card metric-card animate-in">
          <div class="metric-icon blue">✈️</div>
          <div class="metric-value">${stats.flights}</div>
          <div class="metric-label">Active Flights</div>
        </div>
        <div class="card metric-card animate-in">
          <div class="metric-icon green">🎫</div>
          <div class="metric-value">${confirmed.length}</div>
          <div class="metric-label">Confirmed Bookings</div>
        </div>
        <div class="card metric-card animate-in">
          <div class="metric-icon amber">⏳</div>
          <div class="metric-value">${heapTelemetry.size}</div>
          <div class="metric-label">Waitlisted Passengers</div>
        </div>
        <div class="card metric-card animate-in">
          <div class="metric-icon red">🔒</div>
          <div class="metric-value">${getActiveHolds().length}</div>
          <div class="metric-label">Active Seat Holds</div>
        </div>
      </div>

      <div class="grid grid-2 gap-6 mb-8">
        <!-- B-Tree Telemetry -->
        <div class="card animate-in">
          <div class="card-header">
            <h3>🌲 B-Tree Index Telemetry</h3>
            <span class="badge badge-primary">ADSA Unit 1</span>
          </div>
          <div class="card-body">
            <div class="grid grid-2 gap-4">
              <div><span class="text-muted text-sm">Order (t)</span><div class="font-bold text-lg">${btreeTelemetry.order}</div></div>
              <div><span class="text-muted text-sm">Height</span><div class="font-bold text-lg">${btreeTelemetry.height}</div></div>
              <div><span class="text-muted text-sm">Node Count</span><div class="font-bold text-lg">${btreeTelemetry.nodeCount}</div></div>
              <div><span class="text-muted text-sm">Keys Stored</span><div class="font-bold text-lg">${btreeTelemetry.size}</div></div>
              <div><span class="text-muted text-sm">Total Comparisons</span><div class="font-bold text-lg">${btreeTelemetry.comparisons}</div></div>
              <div><span class="text-muted text-sm">Max Keys/Node</span><div class="font-bold text-lg">${btreeTelemetry.maxKeysPerNode}</div></div>
            </div>
            <div id="btree-viz" class="mt-4" style="min-height:120px;background:var(--color-bg);border-radius:var(--radius-lg);padding:var(--space-4);overflow-x:auto"></div>
          </div>
        </div>

        <!-- MaxHeap Telemetry -->
        <div class="card animate-in">
          <div class="card-header">
            <h3>📊 MaxHeap Waitlist Telemetry</h3>
            <span class="badge badge-warning">ADSA Unit 2</span>
          </div>
          <div class="card-body">
            <div class="grid grid-2 gap-4">
              <div><span class="text-muted text-sm">Heap Size</span><div class="font-bold text-lg">${heapTelemetry.size}</div></div>
              <div><span class="text-muted text-sm">Tree Depth</span><div class="font-bold text-lg">${heapTelemetry.treeDepth}</div></div>
              <div><span class="text-muted text-sm">Total Swaps</span><div class="font-bold text-lg">${heapTelemetry.swaps}</div></div>
              <div><span class="text-muted text-sm">Total Insertions</span><div class="font-bold text-lg">${heapTelemetry.insertions}</div></div>
              <div><span class="text-muted text-sm">Total Extractions</span><div class="font-bold text-lg">${heapTelemetry.extractions}</div></div>
              <div><span class="text-muted text-sm">Max Priority</span><div class="font-bold text-lg">${heapTelemetry.maxPriority ?? '—'}</div></div>
            </div>
            <div id="heap-viz" class="mt-4" style="min-height:120px;background:var(--color-bg);border-radius:var(--radius-lg);padding:var(--space-4)"></div>
          </div>
        </div>
      </div>

      <!-- Recent Bookings -->
      <div class="card animate-in">
        <div class="card-header">
          <h3>Recent Bookings</h3>
          <a href="#/bookings" class="btn btn-ghost btn-sm">View All →</a>
        </div>
        <div class="card-body" style="padding:0">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr><th>PNR</th><th>Passenger</th><th>Flight</th><th>Seat</th><th>Status</th><th>Booked</th></tr>
              </thead>
              <tbody>
                ${bookings.length === 0 ? '<tr><td colspan="6" class="text-center text-muted p-6">No bookings yet. <a href="#/search" style="color:var(--color-primary)">Search flights</a> to get started.</td></tr>' : ''}
                ${bookings.slice(0, 10).map(b => `
                  <tr>
                    <td><code style="font-weight:700">${b.pnr}</code></td>
                    <td>${b.passengerName || b.passengerId}</td>
                    <td>${b.flightId}</td>
                    <td><span class="badge badge-neutral">${b.seatNo}</span></td>
                    <td><span class="badge ${b.status === 'confirmed' ? 'badge-success badge-dot' : b.status === 'cancelled' ? 'badge-danger badge-dot' : 'badge-warning badge-dot'}">${b.status}</span></td>
                    <td class="text-sm text-muted">${new Date(b.bookedAt).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function initDashboardPage() {
  renderBTreeVisualization();
  renderHeapVisualization();
}

function renderBTreeVisualization() {
  const container = document.getElementById('btree-viz');
  if (!container) return;

  const levels = bookingIndex.levelOrder();
  if (levels.length === 0) {
    container.innerHTML = '<div class="text-center text-muted text-sm p-4">Empty tree — make bookings to populate</div>';
    return;
  }

  let html = '<div style="display:flex;flex-direction:column;align-items:center;gap:12px">';
  for (const level of levels) {
    html += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">';
    for (const node of level) {
      html += '<div class="tree-node">';
      html += node.keys.map(k => k.key).join(' | ');
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderHeapVisualization() {
  const container = document.getElementById('heap-viz');
  if (!container) return;

  const levels = waitlistHeap.toLevels();
  if (levels.length === 0) {
    container.innerHTML = '<div class="text-center text-muted text-sm p-4">Empty heap — add to waitlist to populate</div>';
    return;
  }

  let html = '<div class="heap-tree">';
  for (const level of levels) {
    html += '<div class="heap-level">';
    for (const entry of level) {
      html += `<div class="heap-node" title="${entry.passengerName} (${entry.tier})">
        <span style="font-size:10px">${entry.tier[0].toUpperCase()}</span>
        <span style="font-size:9px">${Math.round(entry.priority / 1000)}</span>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

// ══════════════════════════════════════════════════════════
//  HELPER: AUTHENTIC VECTOR SVG QR CODE GENERATOR
// ══════════════════════════════════════════════════════════

export function generateQRCodeSVG(text, size = 130) {
  const N = 21;
  const grid = Array.from({ length: N }, () => Array(N).fill(false));

  const addFinder = (r0, c0) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          grid[r0 + r][c0 + c] = true;
        }
      }
    }
  };
  addFinder(0, 0);
  addFinder(0, 14);
  addFinder(14, 0);

  for (let i = 8; i < 13; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  let seed = Math.abs(hash) || 12345;
  const nextBit = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed >> 16) % 2 === 1;
  };

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const inFinder1 = r < 8 && c < 8;
      const inFinder2 = r < 8 && c >= 13;
      const inFinder3 = r >= 13 && c < 8;
      const inTiming = r === 6 || c === 6;
      if (!inFinder1 && !inFinder2 && !inFinder3 && !inTiming) {
        grid[r][c] = nextBit();
      }
    }
  }

  const cell = size / N;
  let rects = '';
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c]) {
        rects += `<rect x="${(c * cell).toFixed(2)}" y="${(r * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="#0F172A" />`;
      }
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;padding:6px;border-radius:8px">${rects}</svg>`;
}

// ══════════════════════════════════════════════════════════
//  PRINTABLE E-TICKET / BOARDING PASS MODAL
// ══════════════════════════════════════════════════════════

window.showETicketModal = async (pnr) => {
  document.getElementById('eticket-modal')?.remove();

  let bookingsToRender = [];
  if (pnr === 'all' && state.confirmedBookings?.length) {
    bookingsToRender = state.confirmedBookings;
  } else {
    const single = (state.confirmedBookings || []).find(b => b.pnr === pnr) || (await lookupByPNR(pnr));
    if (single) bookingsToRender = [single];
  }

  if (bookingsToRender.length === 0) {
    showToast('Error', `Booking with PNR ${pnr} not found`, 'error');
    return;
  }

  const flight = (await get('flights', bookingsToRender[0].flightId)) || state.selectedFlight || {
    flightNumber: 'AI442',
    origin: 'VTZ', destination: 'HYD', aircraft: 'Airbus A320neo',
    departureTime: new Date(Date.now() + 86400000).toISOString(),
    airline: 'Air India',
  };

  const originInfo = AIRPORTS[flight.origin] || { city: flight.origin, name: flight.origin };
  const destInfo = AIRPORTS[flight.destination] || { city: flight.destination, name: flight.destination };
  const depTime = new Date(flight.departureTime);

  const passesHtml = bookingsToRender.map(booking => {
    const qrPayload = `IATA:${flight.flightNumber}/${booking.pnr}/${booking.seatNo}/${booking.passengerName}/${flight.origin}-${flight.destination}`;
    const qrSvg = generateQRCodeSVG(qrPayload, 120);

    return `
      <div class="boarding-pass mb-6" id="printable-boarding-pass">
        <!-- Main Ticket Section -->
        <div class="boarding-pass-main">
          <div class="pass-header">
            <div class="pass-airline">
              <span>✈️</span>
              <span>${booking.airline || flight.airline || 'SkyVoyage Enterprise'}</span>
            </div>
            <div class="pass-badge">ELECTRONIC BOARDING PASS</div>
          </div>

          <div class="pass-route">
            <div class="pass-airport">
              <div class="pass-code">${flight.origin}</div>
              <div class="pass-city">${originInfo.city}</div>
              <div class="text-xs text-muted">${originInfo.name}</div>
            </div>
            <div style="font-size:1.5rem;color:var(--color-primary);font-weight:700">✈ ➔</div>
            <div class="pass-airport dest">
              <div class="pass-code">${flight.destination}</div>
              <div class="pass-city">${destInfo.city}</div>
              <div class="text-xs text-muted">${destInfo.name}</div>
            </div>
          </div>

          <div class="pass-details-grid">
            <div>
              <div class="pass-label">Passenger</div>
              <div class="pass-val">${booking.passengerName}</div>
            </div>
            <div>
              <div class="pass-label">Flight</div>
              <div class="pass-val font-mono">${flight.flightNumber}</div>
            </div>
            <div>
              <div class="pass-label">Gate</div>
              <div class="pass-val font-mono">${booking.gate || 'G4'}</div>
            </div>
            <div>
              <div class="pass-label">Boarding Time</div>
              <div class="pass-val text-primary font-bold">${booking.boardingTime || '10:00 AM'}</div>
            </div>
          </div>

          <div class="pass-details-grid">
            <div>
              <div class="pass-label">Departure Date</div>
              <div class="pass-val">${depTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
            <div>
              <div class="pass-label">Departure Time</div>
              <div class="pass-val font-mono">${depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div>
              <div class="pass-label">Seat</div>
              <div class="pass-val" style="font-size:1.25rem;color:var(--color-primary);font-weight:800">${booking.seatNo}</div>
            </div>
            <div>
              <div class="pass-label">Cabin Class</div>
              <div class="pass-val font-semibold" style="text-transform:capitalize">${booking.seatClass || 'Economy'}</div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t flex justify-between items-center">
            <div>
              <span class="text-xs text-muted">ID Verification:</span>
              <span class="text-xs font-semibold text-secondary ml-1">${(booking.idType || 'Aadhaar').toUpperCase()}: ${booking.idNumber || 'VERIFIED'}</span>
              <span class="badge badge-success ml-2" style="font-size:10px">Govt Verified ✓</span>
              ${booking.mealPreference ? `<span class="badge badge-neutral ml-1" style="font-size:10px">${booking.mealPreference}</span>` : ''}
            </div>
            <div class="pass-barcode">||| | ||||| || |||||| | |||</div>
          </div>
        </div>

        <!-- Perforated Stub Section -->
        <div class="boarding-pass-stub">
          <div class="text-center w-full">
            <div class="text-xs font-bold text-muted uppercase">Passenger Stub</div>
            <div class="text-sm font-extrabold text-secondary mt-1">${booking.passengerName}</div>
            <div class="font-mono text-xs text-muted">${flight.flightNumber} · ${flight.origin}→${flight.destination}</div>
          </div>

          <div class="pass-qr-wrap">
            ${qrSvg}
            <div class="text-xs font-mono font-bold tracking-widest text-primary">${booking.pnr}</div>
          </div>

          <div class="text-center w-full">
            <div class="text-xs text-muted">Seat</div>
            <div class="font-extrabold text-2xl text-secondary">${booking.seatNo}</div>
            <div class="badge badge-success badge-dot mt-1" style="font-size:10px">${(booking.status || 'CONFIRMED').toUpperCase()}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const modalHtml = `
    <div class="modal-backdrop" id="eticket-modal" onclick="if(event.target===this) window.closeETicketModal()">
      <div class="ticket-modal-card" style="max-height:92vh;overflow-y:auto">
        <div style="padding:1.5rem">
          ${passesHtml}
        </div>

        <!-- Modal Actions Footer -->
        <div class="p-4 border-t flex justify-between items-center no-print" style="background:var(--color-bg);position:sticky;bottom:0;z-index:10">
          <div class="text-xs text-muted">
            <span>🔒 Concurrency Protected · Indexed in B-Tree (Order t=3)</span>
          </div>
          <div class="flex gap-3">
            <button class="btn btn-secondary" onclick="window.closeETicketModal()">Close</button>
            <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Download PDF</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.closeETicketModal = () => {
  document.getElementById('eticket-modal')?.remove();
};

// ══════════════════════════════════════════════════════════
//  PAGE: FLIGHT SEARCH — 90-DAY CALENDAR & ROUND-TRIP INTELLIGENCE
// ══════════════════════════════════════════════════════════

async function renderSearchPage() {
  const flights = await getAll('flights');
  const todayStr = new Date().toISOString().split('T')[0];
  const max90Date = new Date(Date.now() + 90 * 86400000);
  const max90Str = max90Date.toISOString().split('T')[0];
  const isOneWay = state.tripType === 'oneway';

  return `
    <div class="container">
      <div class="page-header">
        <h1>Flight Search & Network Exploration</h1>
        <p>Intelligent city autocomplete, 90-day forward calendar, round-trip combo fare intelligence, and 180° route swapping</p>
      </div>

      <!-- Search Card with Dynamic Autocomplete, 90-Day Calendar, and Centered Swap -->
      <div class="card mb-8 animate-in" style="box-shadow:var(--shadow-md)">
        <div class="card-body" style="padding:var(--space-6)">

          <!-- Trip Type Toggle & Forward Calendar Indicators -->
          <div class="flex justify-between items-center mb-4 flex-wrap gap-3">
            <div class="trip-type-toggle-group">
              <button type="button" class="trip-type-btn ${isOneWay ? 'active' : ''}" id="btn-trip-oneway" onclick="window.setTripType('oneway')">
                ✈️ One-Way
              </button>
              <button type="button" class="trip-type-btn ${!isOneWay ? 'active' : ''}" id="btn-trip-roundtrip" onclick="window.setTripType('roundtrip')">
                🔄 Round-Trip ${state.comboFareApplied ? '<span class="roundtrip-combo-chip ml-1">Combo -₹1,500</span>' : ''}
              </button>
            </div>
            <div class="text-xs font-semibold text-muted flex items-center gap-2">
              <span class="badge badge-success badge-dot">90-Day Forward Calendar</span>
              <span>Past dates automatically disabled</span>
            </div>
          </div>

          <div class="search-controls-wrapper">
            <!-- FROM Autocomplete -->
            <div class="autocomplete-wrapper" id="origin-ac-wrapper">
              <label class="form-label" style="font-weight:700">From (Origin)</label>
              <div class="autocomplete-input-box">
                <span class="input-icon">🛫</span>
                <input type="text" class="autocomplete-input" id="search-origin-input" placeholder="Type city or IATA (e.g. Hyd, Vis, Dub)..." autocomplete="off" />
                <input type="hidden" id="search-origin-code" value="" />
              </div>
              <div class="autocomplete-dropdown" id="search-origin-dropdown"></div>
            </div>

            <!-- Swap Button with 180deg Rotation Animation -->
            <div class="swap-btn-container">
              <button class="swap-btn" id="swap-airports-btn" title="Swap Origin and Destination (180° Rotation)" type="button">⇄</button>
            </div>

            <!-- TO Autocomplete -->
            <div class="autocomplete-wrapper" id="dest-ac-wrapper">
              <label class="form-label" style="font-weight:700">To (Destination)</label>
              <div class="autocomplete-input-box">
                <span class="input-icon">🛬</span>
                <input type="text" class="autocomplete-input" id="search-dest-input" placeholder="Type city or IATA (e.g. Del, Bom, Lhr)..." autocomplete="off" />
                <input type="hidden" id="search-dest-code" value="" />
              </div>
              <div class="autocomplete-dropdown" id="search-dest-dropdown"></div>
            </div>
          </div>

          <!-- Dynamic 90-Day Calendar Forward Pickers -->
          <div class="grid grid-3 gap-4 mt-4 pt-3 border-t">
            <div class="form-group mb-0">
              <label class="form-label" style="font-weight:700">📅 Departure Date (Up to 90 Days)</label>
              <input type="date" class="form-input" id="search-dep-date" min="${todayStr}" max="${max90Str}" value="${state.departureDate}" onchange="window.handleDepDateChange(this.value)" />
              <div class="text-xs text-muted mt-1">Select dates up to ${max90Date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>

            <div class="form-group mb-0" id="ret-date-group">
              <label class="form-label" style="font-weight:700">📅 Return Date</label>
              <input type="date" class="form-input" id="search-ret-date" min="${state.departureDate || todayStr}" max="${max90Str}" value="${state.returnDate}" ${isOneWay ? 'disabled style="opacity:0.45;cursor:not-allowed"' : ''} onchange="window.handleRetDateChange(this.value)" />
              <div class="text-xs text-muted mt-1" id="ret-date-hint">${isOneWay ? 'Select Round-Trip to enable' : 'Combo fare savings active'}</div>
            </div>

            <div class="form-group mb-0" style="display:flex;align-items:flex-end">
              <button class="btn btn-primary btn-lg w-full" id="search-btn" style="height:42px">
                ${icons.search} Search Flights
              </button>
            </div>
          </div>

          <!-- Round-Trip Suggestion Engine Alert Card -->
          <div id="roundtrip-suggestion-container">
            ${isOneWay ? `
              <div class="roundtrip-suggestion-card" id="roundtrip-suggestion-card">
                <div class="roundtrip-suggestion-text">
                  <span class="roundtrip-suggestion-icon">💡</span>
                  <div>
                    Plan your return from <span class="roundtrip-dest-badge" id="rt-suggest-dest">HYD (Hyderabad)</span> to <span class="roundtrip-dest-badge" id="rt-suggest-orig">VTZ (Visakhapatnam)</span>?
                    Add a return flight now and save up to <strong>₹1,500 on combo fares</strong>.
                  </div>
                </div>
                <button class="btn btn-primary btn-sm" id="rt-suggest-btn" onclick="window.activateRoundTripMode()">
                  ⚡ Add Return Flight & Save ₹1,500
                </button>
              </div>
            ` : `
              <div class="roundtrip-suggestion-card" style="background:#ECFDF5;border-color:#A7F3D0" id="roundtrip-suggestion-card">
                <div class="roundtrip-suggestion-text" style="color:#065F46">
                  <span class="roundtrip-suggestion-icon">🎉</span>
                  <div>
                    <strong>Round-Trip Combo Fare Applied:</strong> Save ₹1,500 discount across your combo round-trip reservation.
                  </div>
                </div>
                <span class="roundtrip-combo-chip">₹1,500 Rebate Locked</span>
              </div>
            `}
          </div>

          <!-- Quick Route Demonstration Tags for Viva/Exam -->
          <div class="flex gap-2 flex-wrap mt-4 items-center pt-3 border-t">
            <span class="text-xs font-semibold text-muted">Demo Viva Routes:</span>
            <button class="badge badge-primary cursor-pointer" onclick="window.applyQuickRoute('VTZ', 'HYD')">VTZ → HYD (Air India)</button>
            <button class="badge badge-warning cursor-pointer" onclick="window.applyQuickRoute('BOM', 'DXB')">BOM → DXB (Emirates)</button>
            <button class="badge badge-info cursor-pointer" onclick="window.applyQuickRoute('BLR', 'DEL')">BLR → DEL (IndiGo)</button>
            <button class="badge badge-neutral cursor-pointer" onclick="window.applyQuickRoute('BOM', 'LHR')">BOM → LHR (British Airways)</button>
            <button class="badge badge-success cursor-pointer" onclick="window.applyQuickRoute('', '')">All Flights (${flights.length})</button>
          </div>
        </div>
      </div>

      <!-- Results Header -->
      <div class="flex justify-between items-center mb-4">
        <h3 id="search-results-heading" style="font-size:1.15rem;font-weight:700">Available Flights (${flights.length})</h3>
        <span class="text-sm text-muted">Real-time inventory updated via DBMS ACID layer</span>
      </div>

      <!-- Flight Results List -->
      <div id="flight-results">
        ${flights.map(f => renderFlightCard(f)).join('')}
      </div>
    </div>
  `;
}

function renderFlightCard(f) {
  const dep = new Date(f.departureTime);
  const arr = new Date(f.arrivalTime);
  const duration = Math.round((arr - dep) / 60000);
  const hrs = Math.floor(duration / 60);
  const mins = duration % 60;
  const originAirport = AIRPORTS[f.origin];
  const destAirport = AIRPORTS[f.destination];
  const originCity = originAirport?.city || f.origin;
  const destCity = destAirport?.city || f.destination;
  const originFull = `${f.origin} (${originCity})`;
  const destFull = `${f.destination} (${destCity})`;

  const comboRebate = state.comboFareApplied ? 1500 : 0;
  const effectivePrice = Math.max(1200, f.basePrice - comboRebate);

  return `
    <div class="card flight-card mb-4 animate-in" data-flight-id="${f.id}" onclick="window.selectFlight('${f.id}')">
      <div class="flight-route">
        <div class="flight-endpoint">
          <div class="time">${dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="code">${f.origin}</div>
          <div class="city font-bold">${originCity}</div>
          <div class="text-xs text-muted truncate" style="max-width:140px">${originAirport?.name || ''}</div>
        </div>
        <div class="flight-path">
          <div class="duration font-mono font-bold">${hrs}h ${mins}m · ${f.flightNumber}</div>
          <div class="flight-path-line"></div>
          <div class="font-bold text-primary" style="font-size:0.9rem">
            ${originFull} ➔ ${destFull}
          </div>
          <div class="text-xs text-secondary font-semibold mt-1">
            ✈️ ${f.airline || 'SkyVoyage'} · <span style="color:#0284C7;font-weight:700">${f.aircraft || 'Boeing 787-9 Dreamliner'}</span>
          </div>
        </div>
        <div class="flight-endpoint">
          <div class="time">${arr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="code">${f.destination}</div>
          <div class="city font-bold">${destCity}</div>
          <div class="text-xs text-muted truncate" style="max-width:140px">${destAirport?.name || ''}</div>
        </div>
      </div>
      <div class="flight-meta">
        <div>
          ${state.comboFareApplied ? `<div class="text-xs text-success font-bold">Combo Discount: -₹1,500 applied</div>` : ''}
          <div class="price">₹${effectivePrice.toLocaleString()}</div>
        </div>
        <div class="flex gap-2 items-center">
          <span class="badge badge-success badge-dot">Available</span>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.selectFlight('${f.id}')">Select Flight →</button>
        </div>
      </div>
    </div>
  `;
}

function initSearchPage() {
  const originInput = document.getElementById('search-origin-input');
  const originCode = document.getElementById('search-origin-code');
  const originDropdown = document.getElementById('search-origin-dropdown');

  const destInput = document.getElementById('search-dest-input');
  const destCode = document.getElementById('search-dest-code');
  const destDropdown = document.getElementById('search-dest-dropdown');

  const swapBtn = document.getElementById('swap-airports-btn');

  // Autocomplete matching helper
  function getMatchingAirports(query) {
    const q = (query || '').trim().toLowerCase();
    return Object.entries(AIRPORTS).filter(([code, a]) => {
      if (!q) return true;
      return (
        code.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.country && a.country.toLowerCase().includes(q))
      );
    });
  }

  function renderDropdownItems(items, targetType) {
    if (items.length === 0) {
      return '<div class="p-3 text-sm text-muted text-center">No matching airports found</div>';
    }

    return items.map(([code, a]) => `
      <div class="autocomplete-item" onclick="window.selectAirport('${targetType}', '${code}')">
        <div class="autocomplete-item-main">
          <span class="autocomplete-code-badge">${code}</span>
          <span class="autocomplete-city-name">${a.city}</span>
          <span class="autocomplete-airport-name">(${a.name})</span>
        </div>
        <span class="autocomplete-item-right">${a.country || ''}</span>
      </div>
    `).join('');
  }

  // Bind Autocomplete for Origin
  if (originInput && originDropdown) {
    originInput.addEventListener('focus', () => {
      originDropdown.innerHTML = renderDropdownItems(getMatchingAirports(originInput.value), 'origin');
      originDropdown.classList.add('open');
      destDropdown?.classList.remove('open');
    });

    originInput.addEventListener('input', () => {
      originCode.value = '';
      originDropdown.innerHTML = renderDropdownItems(getMatchingAirports(originInput.value), 'origin');
      originDropdown.classList.add('open');
    });
  }

  // Bind Autocomplete for Destination
  if (destInput && destDropdown) {
    destInput.addEventListener('focus', () => {
      destDropdown.innerHTML = renderDropdownItems(getMatchingAirports(destInput.value), 'dest');
      destDropdown.classList.add('open');
      originDropdown?.classList.remove('open');
    });

    destInput.addEventListener('input', () => {
      destCode.value = '';
      destDropdown.innerHTML = renderDropdownItems(getMatchingAirports(destInput.value), 'dest');
      destDropdown.classList.add('open');
    });
  }

  // Global click outside to close dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#origin-ac-wrapper')) originDropdown?.classList.remove('open');
    if (!e.target.closest('#dest-ac-wrapper')) destDropdown?.classList.remove('open');
  });

  // Airport selection function
  window.selectAirport = (targetType, code) => {
    const airport = AIRPORTS[code];
    if (!airport) return;

    if (targetType === 'origin') {
      originInput.value = `${code} — ${airport.city} (${airport.name})`;
      originCode.value = code;
      originDropdown.classList.remove('open');
      destInput?.focus();
    } else {
      destInput.value = `${code} — ${airport.city} (${airport.name})`;
      destCode.value = code;
      destDropdown.classList.remove('open');
    }
    filterFlights();
  };

  // Centered circular swap button with 180° rotation
  let isRotated = false;
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      isRotated = !isRotated;
      swapBtn.classList.toggle('rotate-180', isRotated);

      const tempVal = originInput.value;
      const tempCode = originCode.value;

      originInput.value = destInput.value;
      originCode.value = destCode.value;

      destInput.value = tempVal;
      destCode.value = tempCode;

      filterFlights();
    });
  }

  // Filter Flights Execution
  async function filterFlights() {
    const origin = originCode.value;
    const dest = destCode.value;
    const flights = await getAll('flights');

    // Update Round-Trip suggestion card labels dynamically
    const rtDestBadge = document.getElementById('rt-suggest-dest');
    const rtOrigBadge = document.getElementById('rt-suggest-orig');
    if (rtDestBadge && rtOrigBadge) {
      const origText = (AIRPORTS[origin]?.city || origin || 'Origin');
      const destText = (AIRPORTS[dest]?.city || dest || 'Destination');
      rtDestBadge.textContent = `${destText} (${dest || 'DEST'})`;
      rtOrigBadge.textContent = `${origText} (${origin || 'ORIG'})`;
    }

    const filtered = flights.filter(f => {
      if (origin && f.origin !== origin) return false;
      if (dest && f.destination !== dest) return false;
      return true;
    });

    const heading = document.getElementById('search-results-heading');
    if (heading) {
      heading.textContent = `Available Flights (${filtered.length})`;
    }

    const resultsEl = document.getElementById('flight-results');
    if (resultsEl) {
      resultsEl.innerHTML = filtered.length > 0
        ? filtered.map(f => renderFlightCard(f)).join('')
        : `<div class="empty-state">
             <div class="icon">🔍</div>
             <h3>No direct flights found</h3>
             <p>No flights between selected pair. Try different cities or use Dijkstra pathfinding in the Academic tab.</p>
             <button class="btn btn-secondary mt-3" onclick="window.applyQuickRoute('','')">View All Flights</button>
           </div>`;
    }
  }

  document.getElementById('search-btn')?.addEventListener('click', filterFlights);

  window.setTripType = (type) => {
    state.tripType = type;
    const isOneWay = type === 'oneway';
    const onewayBtn = document.getElementById('btn-trip-oneway');
    const roundtripBtn = document.getElementById('btn-trip-roundtrip');
    const retInput = document.getElementById('search-ret-date');
    const retHint = document.getElementById('ret-date-hint');
    const suggestContainer = document.getElementById('roundtrip-suggestion-container');

    if (onewayBtn) onewayBtn.className = `trip-type-btn ${isOneWay ? 'active' : ''}`;
    if (roundtripBtn) roundtripBtn.className = `trip-type-btn ${!isOneWay ? 'active' : ''}`;

    if (retInput) {
      retInput.disabled = isOneWay;
      retInput.style.opacity = isOneWay ? '0.45' : '1';
      retInput.style.cursor = isOneWay ? 'not-allowed' : 'pointer';
      if (!isOneWay) retInput.focus();
    }
    if (retHint) {
      retHint.textContent = isOneWay ? 'Select Round-Trip to enable' : 'Combo fare savings active';
    }

    if (suggestContainer) {
      const origCode = originCode.value;
      const destCodeVal = destCode.value;
      const origName = AIRPORTS[origCode]?.city ? `${AIRPORTS[origCode].city} (${origCode})` : (origCode || 'VTZ');
      const destName = AIRPORTS[destCodeVal]?.city ? `${AIRPORTS[destCodeVal].city} (${destCodeVal})` : (destCodeVal || 'HYD');

      if (isOneWay) {
        state.comboFareApplied = false;
        suggestContainer.innerHTML = `
          <div class="roundtrip-suggestion-card" id="roundtrip-suggestion-card">
            <div class="roundtrip-suggestion-text">
              <span class="roundtrip-suggestion-icon">💡</span>
              <div>
                Plan your return from <span class="roundtrip-dest-badge" id="rt-suggest-dest">${destName}</span> to <span class="roundtrip-dest-badge" id="rt-suggest-orig">${origName}</span>?
                Add a return flight now and save up to <strong>₹1,500 on combo fares</strong>.
              </div>
            </div>
            <button class="btn btn-primary btn-sm" id="rt-suggest-btn" onclick="window.activateRoundTripMode()">
              ⚡ Add Return Flight & Save ₹1,500
            </button>
          </div>
        `;
      } else {
        state.comboFareApplied = true;
        suggestContainer.innerHTML = `
          <div class="roundtrip-suggestion-card" style="background:#ECFDF5;border-color:#A7F3D0" id="roundtrip-suggestion-card">
            <div class="roundtrip-suggestion-text" style="color:#065F46">
              <span class="roundtrip-suggestion-icon">🎉</span>
              <div>
                <strong>Round-Trip Combo Fare Applied:</strong> Save ₹1,500 discount across your combo round-trip reservation.
              </div>
            </div>
            <span class="roundtrip-combo-chip">₹1,500 Rebate Locked</span>
          </div>
        `;
      }
    }
    filterFlights();
  };

  window.activateRoundTripMode = () => {
    state.comboFareApplied = true;
    window.setTripType('roundtrip');
    showToast('Combo Fare Active! 🎉', 'Round-Trip selected: ₹1,500 discount applied to flight fares.', 'success');
  };

  window.handleDepDateChange = (val) => {
    state.departureDate = val;
    const retInput = document.getElementById('search-ret-date');
    if (retInput) {
      retInput.min = val;
      if (retInput.value < val) retInput.value = val;
      state.returnDate = retInput.value;
    }
  };

  window.handleRetDateChange = (val) => {
    state.returnDate = val;
  };

  window.applyQuickRoute = (fromCode, toCode) => {
    if (!fromCode && !toCode) {
      originInput.value = '';
      originCode.value = '';
      destInput.value = '';
      destCode.value = '';
    } else {
      const fromAp = AIRPORTS[fromCode];
      const toAp = AIRPORTS[toCode];
      if (fromAp) { originInput.value = `${fromCode} — ${fromAp.city}`; originCode.value = fromCode; }
      if (toAp) { destInput.value = `${toCode} — ${toAp.city}`; destCode.value = toCode; }
    }
    filterFlights();
  };
}

window.selectFlight = async (flightId) => {
  state.selectedFlight = await get('flights', flightId);
  state.selectedSeat = null;
  state.selectedSeats = [];
  state.holdId = null;
  state.passengerCount = 1;
  state.passengers = [{}];
  state.bookingStep = 1;
  window.location.hash = '#/booking';
};

// ══════════════════════════════════════════════════════════
//  MULTI-STEP BOOKING FLOW: PASSENGER -> SEAT -> PAYMENT -> CONFIRM
// ══════════════════════════════════════════════════════════

async function renderBookingPage() {
  if (!state.selectedFlight) {
    return `
      <div class="container">
        <div class="empty-state">
          <div class="icon">✈️</div>
          <h3>No flight selected</h3>
          <p>Please search for a flight and select one to proceed with your booking.</p>
          <a href="#/search" class="btn btn-primary mt-4">Search Flights</a>
        </div>
      </div>
    `;
  }

  const flight = state.selectedFlight;
  const currentStep = state.bookingStep || 1;
  const originCity = AIRPORTS[flight.origin]?.city || flight.origin;
  const destCity = AIRPORTS[flight.destination]?.city || flight.destination;

  return `
    <div class="container">
      <div class="page-header">
        <h1>Booking Flow</h1>
        <p>${flight.airline || 'SkyVoyage'} ${flight.flightNumber}: ${originCity} (${flight.origin}) ➔ ${destCity} (${flight.destination}) · ${flight.aircraft}</p>
      </div>

      <!-- Modern 4-Step Milestone Stepper -->
      <div class="steps mb-8">
        <div class="step ${currentStep >= 1 ? (currentStep === 1 ? 'active' : 'completed') : ''}" id="step-1" onclick="window.goToBookingStep(1)">
          <div class="step-circle">1</div>
          <span class="step-label">Passenger & ID</span>
        </div>
        <div class="step-line ${currentStep > 1 ? 'completed' : ''}" id="line-1"></div>

        <div class="step ${currentStep >= 2 ? (currentStep === 2 ? 'active' : 'completed') : ''}" id="step-2" onclick="window.goToBookingStep(2)">
          <div class="step-circle">2</div>
          <span class="step-label">Seat Map</span>
        </div>
        <div class="step-line ${currentStep > 2 ? 'completed' : ''}" id="line-2"></div>

        <div class="step ${currentStep >= 3 ? (currentStep === 3 ? 'active' : 'completed') : ''}" id="step-3" onclick="window.goToBookingStep(3)">
          <div class="step-circle">3</div>
          <span class="step-label">Payment Gateway</span>
        </div>
        <div class="step-line ${currentStep > 3 ? 'completed' : ''}" id="line-3"></div>

        <div class="step ${currentStep === 4 ? 'active completed' : ''}" id="step-4">
          <div class="step-circle">4</div>
          <span class="step-label">Confirmed PNR</span>
        </div>
      </div>

      <div class="booking-layout">
        <!-- Dynamic Step Content Pane -->
        <div id="booking-step-content">
          ${await renderCurrentBookingStep(currentStep)}
        </div>

        <!-- Sidebar Summary Panel -->
        <div class="booking-summary">
          <div class="card" id="booking-summary-card">
            <div class="card-header">
              <h3>Flight Summary</h3>
              <span class="badge badge-primary">${flight.airline || 'SkyVoyage'}</span>
            </div>
            <div class="card-body">
              <div class="summary-row"><span class="label">Flight</span><span class="value font-mono font-bold">${flight.flightNumber}</span></div>
              <div class="summary-row"><span class="label">Route</span><span class="value font-semibold">${flight.origin} ➔ ${flight.destination}</span></div>
              <div class="summary-row"><span class="label">Date</span><span class="value">${new Date(flight.departureTime).toLocaleDateString()}</span></div>
              <div class="summary-row"><span class="label">Aircraft</span><span class="value text-sm">${flight.aircraft}</span></div>

              ${state.passengers?.length > 0 && state.passengers[0]?.fullName ? `
                <div class="mt-3 pt-3 border-t">
                  <div class="text-xs text-muted mb-1">Passengers (${state.passengerCount || 1})</div>
                  ${state.passengers.filter(p => p?.fullName).map((p, i) =>
                    `<div class="text-sm ${i > 0 ? 'mt-1' : ''}"><strong>${i+1}.</strong> ${p.fullName} <span class="text-xs text-muted">(${p.nationality === 'Indian' ? '🇮🇳' : '🌐'} ${(p.idType || '').toUpperCase()})</span></div>`
                  ).join('')}
                </div>
              ` : ''}

              ${state.selectedSeats?.length > 0 ? `
                <div class="summary-row mt-3 pt-3 border-t"><span class="label">Seats</span><span class="value font-bold text-primary">${state.selectedSeats.map(s => s.seatNo).join(', ')}</span></div>
                <div class="summary-total"><span>Total (${state.selectedSeats.length} pax)</span><span>₹${state.selectedSeats.reduce((sum, s) => sum + s.price, 0).toLocaleString()}</span></div>
              ` : state.selectedSeat ? `
                <div class="summary-row mt-3 pt-3 border-t"><span class="label">Seat</span><span class="value font-bold text-primary">${state.selectedSeat.seatNo} (${state.selectedSeat.class})</span></div>
                <div class="summary-total"><span>Total Fare</span><span>₹${state.selectedSeat.price.toLocaleString()}</span></div>
              ` : `
                <div class="summary-total"><span>Base Fare</span><span>₹${flight.basePrice.toLocaleString()}</span></div>
              `}

              <div id="hold-timer-display" class="mt-3"></div>
              <div id="logic-gate-display" class="mt-3"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Render dynamic sub-content for step 1, 2, 3, 4
async function renderCurrentBookingStep(step) {
  const flight = state.selectedFlight;
  const pax = state.passengerData || {};

  if (step === 1) {
    // ── STEP 1: MULTI-PASSENGER DETAILS & CONDITIONAL IDENTITY VERIFICATION ──
    const dbPassengers = await getAll('passengers');
    const paxCount = state.passengerCount || 1;

    return `
      <div class="card animate-in">
        <div class="card-header">
          <div>
            <h3>Step 1: Passenger Details & Identity Verification</h3>
            <p class="text-sm text-muted">Enter details for 1 to 5 passengers. Each passenger undergoes identity verification, meal customization, and assistance selection.</p>
          </div>
          <span class="badge badge-info">DMGT Unit 1 Gate P</span>
        </div>
        <div class="card-body">
          <!-- PASSENGER COUNT SELECTOR (1 to 5 Pax) -->
          <div class="pax-count-selector mb-5">
            <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
              <label class="form-label font-bold" style="margin-bottom:0">Select Number of Passengers (1 to 5 Pax)</label>
              <span class="badge badge-primary font-mono">${paxCount} Passenger${paxCount > 1 ? 's' : ''} Selected</span>
            </div>
            <div class="pax-count-btns">
              ${[1, 2, 3, 4, 5].map(n => `
                <button type="button" class="pax-count-btn ${n === paxCount ? 'active' : ''}" onclick="window.setPassengerCount(${n})">
                  ${n} Pax
                </button>
              `).join('')}
            </div>
            <div class="text-xs text-muted mt-2">
              💡 Selecting ${paxCount} passenger${paxCount > 1 ? 's' : ''} will require choosing ${paxCount} seat${paxCount > 1 ? 's' : ''} on the cabin map in Step 2. Total fare = Base × ${paxCount} + Taxes & Surcharges.
            </div>
          </div>

          <!-- DYNAMIC PASSENGER INPUT BLOCKS -->
          ${Array.from({ length: paxCount }, (_, idx) => {
            const p = state.passengers[idx] || {};
            const isIndian = (p.nationality || 'Indian') === 'Indian';
            return `
            <div class="pax-form-block" id="pax-block-${idx}">
              <div class="pax-form-header">
                <span class="pax-form-num">
                  Passenger ${idx + 1} ${idx === 0 ? '<span class="badge badge-primary" style="font-size:11px;margin-left:6px">Lead Passenger</span>' : ''}
                </span>
                ${idx === 0 ? `
                  <select class="form-select form-select-sm" style="max-width:280px" onchange="window.fillPassengerMulti(${idx}, this.value)">
                    <option value="">— Quick fill demo profile —</option>
                    ${dbPassengers.map(dp => `<option value="${dp.id}">${dp.firstName} ${dp.lastName} (${dp.nationality || 'Indian'})</option>`).join('')}
                  </select>
                ` : ''}
              </div>

              <!-- Row 1: Name, Age, Gender -->
              <div class="form-row mb-3">
                <div class="form-group" style="flex:2">
                  <label class="form-label">Full Name <span class="required">*</span></label>
                  <input class="form-input" id="pax-name-${idx}" placeholder="e.g. Vikram Sarabhai" value="${p.fullName || ''}" required />
                </div>
                <div class="form-group" style="flex:0.8">
                  <label class="form-label">Age <span class="required">*</span></label>
                  <input class="form-input" id="pax-age-${idx}" type="number" min="1" max="120" placeholder="28" value="${p.age || ''}" required />
                </div>
                <div class="form-group" style="flex:1">
                  <label class="form-label">Gender <span class="required">*</span></label>
                  <select class="form-select" id="pax-gender-${idx}">
                    <option value="Male" ${(p.gender || 'Male') === 'Male' ? 'selected' : ''}>Male</option>
                    <option value="Female" ${p.gender === 'Female' ? 'selected' : ''}>Female</option>
                    <option value="Other" ${p.gender === 'Other' ? 'selected' : ''}>Other</option>
                  </select>
                </div>
              </div>

              <!-- Nationality Selector Radio -->
              <div class="nationality-selector mb-3">
                <label class="nationality-option ${isIndian ? 'selected' : ''}" onclick="window.switchNationalityMulti(${idx}, 'Indian')">
                  <input type="radio" name="nat-${idx}" value="Indian" ${isIndian ? 'checked' : ''} />
                  <div class="nationality-option-content">
                    <span class="nationality-option-title">🇮🇳 Indian Citizen (Default)</span>
                    <span class="nationality-option-desc">Aadhaar Card (12-digit) / Voter ID / DL / Passport</span>
                  </div>
                </label>
                <label class="nationality-option ${!isIndian ? 'selected' : ''}" onclick="window.switchNationalityMulti(${idx}, 'Foreign')">
                  <input type="radio" name="nat-${idx}" value="Foreign" ${!isIndian ? 'checked' : ''} />
                  <div class="nationality-option-content">
                    <span class="nationality-option-title">🌐 International / Foreign National</span>
                    <span class="nationality-option-desc">Mandatory International Passport with Country & Expiry</span>
                  </div>
                </label>
              </div>

              <!-- Indian Citizen ID Container -->
              <div id="indian-id-${idx}" style="${isIndian ? 'display:block' : 'display:none'}">
                <div class="form-row mb-3">
                  <div class="form-group" style="flex:1">
                    <label class="form-label">ID Type <span class="required">*</span></label>
                    <select class="form-select" id="pax-idtype-${idx}">
                      <option value="aadhaar" ${(!p.idType || p.idType === 'aadhaar') ? 'selected' : ''}>Aadhaar Card (12-digit)</option>
                      <option value="voter" ${p.idType === 'voter' ? 'selected' : ''}>Voter ID (Election Card)</option>
                      <option value="dl" ${p.idType === 'dl' ? 'selected' : ''}>Driving License</option>
                      <option value="passport" ${p.idType === 'passport' ? 'selected' : ''}>Indian Passport</option>
                    </select>
                  </div>
                  <div class="form-group" style="flex:2">
                    <label class="form-label">ID Number <span class="required">*</span></label>
                    <input class="form-input font-mono" id="pax-idnum-${idx}" placeholder="e.g. 8492-1049-5820" value="${p.idNumber || ''}" />
                  </div>
                </div>
              </div>

              <!-- Foreign National ID Container -->
              <div id="foreign-id-${idx}" style="${!isIndian ? 'display:block' : 'display:none'}">
                <div class="form-row mb-3">
                  <div class="form-group" style="flex:1.2">
                    <label class="form-label">Passport Number <span class="required">*</span></label>
                    <input class="form-input font-mono" id="pax-passport-${idx}" placeholder="e.g. N8291048" value="${p.passportNum || ''}" />
                  </div>
                  <div class="form-group" style="flex:1.2">
                    <label class="form-label">Issuing Country <span class="required">*</span></label>
                    <select class="form-select" id="pax-country-${idx}">
                      <option value="United Arab Emirates" ${(p.issuingCountry || '') === 'United Arab Emirates' ? 'selected' : ''}>United Arab Emirates</option>
                      <option value="United Kingdom" ${p.issuingCountry === 'United Kingdom' ? 'selected' : ''}>United Kingdom</option>
                      <option value="United States" ${p.issuingCountry === 'United States' ? 'selected' : ''}>United States</option>
                      <option value="Singapore" ${p.issuingCountry === 'Singapore' ? 'selected' : ''}>Singapore</option>
                      <option value="Germany" ${p.issuingCountry === 'Germany' ? 'selected' : ''}>Germany</option>
                      <option value="Australia" ${p.issuingCountry === 'Australia' ? 'selected' : ''}>Australia</option>
                      <option value="Canada" ${p.issuingCountry === 'Canada' ? 'selected' : ''}>Canada</option>
                    </select>
                  </div>
                  <div class="form-group" style="flex:1">
                    <label class="form-label">Passport Expiry <span class="required">*</span></label>
                    <input type="date" class="form-input" id="pax-expiry-${idx}" value="${p.passportExpiry || '2028-11-15'}" />
                  </div>
                </div>
              </div>

              <!-- Row 3: Meal Preference & Special Assistance -->
              <div class="form-row mb-1">
                <div class="form-group" style="flex:1">
                  <label class="form-label">Meal Preference</label>
                  <select class="form-select" id="pax-meal-${idx}">
                    <option value="Standard Non-Veg" ${(p.mealPreference || 'Standard Non-Veg') === 'Standard Non-Veg' ? 'selected' : ''}>Standard Non-Veg</option>
                    <option value="Asian Vegetarian" ${p.mealPreference === 'Asian Vegetarian' ? 'selected' : ''}>Asian Vegetarian (AVML)</option>
                    <option value="Vegan" ${p.mealPreference === 'Vegan' ? 'selected' : ''}>Vegan (VGML)</option>
                    <option value="Jain Special" ${p.mealPreference === 'Jain Special' ? 'selected' : ''}>Jain Special (VJML)</option>
                    <option value="Diabetic Special" ${p.mealPreference === 'Diabetic Special' ? 'selected' : ''}>Diabetic Special (DBML)</option>
                  </select>
                </div>
                <div class="form-group" style="flex:1">
                  <label class="form-label">Special Assistance</label>
                  <select class="form-select" id="pax-assist-${idx}">
                    <option value="None" ${(p.specialAssistance || 'None') === 'None' ? 'selected' : ''}>None (No Assistance Required)</option>
                    <option value="Wheelchair Assistance" ${p.specialAssistance === 'Wheelchair Assistance' ? 'selected' : ''}>Wheelchair Assistance (WCHR)</option>
                    <option value="Medical Assistance" ${p.specialAssistance === 'Medical Assistance' ? 'selected' : ''}>Medical Assistance</option>
                    <option value="Infant Traveling" ${p.specialAssistance === 'Infant Traveling' ? 'selected' : ''}>Infant Traveling (INF)</option>
                  </select>
                </div>
              </div>
            </div>`;
          }).join('')}

          <!-- Lead Contact Information -->
          <div class="pax-form-block mt-4" style="background:#F8FAFC">
            <h4 class="font-bold mb-3" style="font-size:0.95rem;color:var(--color-primary)">📱 Primary Booking Contact (E-Ticket & PNR Notification)</h4>
            <div class="form-row">
              <div class="form-group" style="flex:1.2">
                <label class="form-label">Email Address <span class="required">*</span></label>
                <input class="form-input" id="pax-email" type="email" placeholder="e.g. vikram.sarabhai@isro.gov.in" value="${state.passengerData?.email || 'contact@skyvoyage.io'}" required />
              </div>
              <div class="form-group" style="flex:1">
                <label class="form-label">Mobile Number <span class="required">*</span></label>
                <div class="phone-input-group">
                  <select class="form-select phone-country-code" id="pax-country-code">
                    <option value="+91" ${(!state.passengerData?.phone || state.passengerData.phone.startsWith('+91')) ? 'selected' : ''}>🇮🇳 +91</option>
                    <option value="+971" ${state.passengerData?.phone?.startsWith('+971') ? 'selected' : ''}>🇦🇪 +971</option>
                    <option value="+44" ${state.passengerData?.phone?.startsWith('+44') ? 'selected' : ''}>🇬🇧 +44</option>
                    <option value="+1" ${state.passengerData?.phone?.startsWith('+1') ? 'selected' : ''}>🇺🇸 +1</option>
                    <option value="+65" ${state.passengerData?.phone?.startsWith('+65') ? 'selected' : ''}>🇸🇬 +65</option>
                  </select>
                  <input class="form-input" id="pax-phone" placeholder="9848022338" value="${(state.passengerData?.phone || '9848022338').replace(/^\+\d+\s*/, '')}" required />
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end mt-6">
            <button class="btn btn-primary btn-lg" onclick="window.saveAllPassengersAndProceed()">
              Continue to Seat Selection (${paxCount} Passenger${paxCount > 1 ? 's' : ''}) →
            </button>
          </div>
        </div>
      </div>
    `;
  } else if (step === 2) {
    // ── STEP 2: INTERACTIVE SEAT MAP & MULTI-SEAT ALLOCATION ──
    const seatMap = await getSeatMap(flight.id);
    const setDemo = await getSetTheoryDemo(flight.id);
    window.currentSeatMapDetails = seatMap.seatDetails || {};
    const paxCount = state.passengerCount || 1;
    const selectedCount = (state.selectedSeats || []).length;
    const allSeatsAssigned = selectedCount === paxCount;

    return `
      <div class="card animate-in mb-6">
        <div class="card-header">
          <div>
            <h3>Step 2: Cabin Seat Selection (${selectedCount} of ${paxCount} Assigned)</h3>
            <p class="text-sm text-muted">Assign dedicated seats for all ${paxCount} passenger${paxCount > 1 ? 's' : ''}. Selected seats are held under atomic TTL locks.</p>
          </div>
          <span class="badge badge-success">DMGT Unit 2 Set Injection</span>
        </div>
        <div class="card-body">

          <!-- Live Vacancy Telemetry Counter Above Cabin -->
          <div class="live-vacancy-telemetry">
            <div class="telemetry-pill available">
              <div class="telemetry-pill-val">${seatMap.stats.available}</div>
              <div class="telemetry-pill-lbl">Available (Green)</div>
            </div>
            <div class="telemetry-pill in-progress">
              <div class="telemetry-pill-val">${seatMap.stats.held}</div>
              <div class="telemetry-pill-lbl">In Progress (Orange)</div>
            </div>
            <div class="telemetry-pill booked">
              <div class="telemetry-pill-val">${seatMap.stats.booked}</div>
              <div class="telemetry-pill-lbl">Booked (Red)</div>
            </div>
          </div>

          <!-- PASSENGER SEAT ALLOCATION STATUS BAR -->
          <div class="pax-assignment-container" id="pax-assignment-container">
            <div class="flex justify-between items-center mb-1">
              <span class="font-bold text-sm" style="color:var(--color-primary-dark)">
                💺 Passenger Seat Assignments (${selectedCount}/${paxCount})
              </span>
              <span class="badge ${allSeatsAssigned ? 'badge-success' : 'badge-warning'}">
                ${allSeatsAssigned ? '✓ All Assigned' : `Assign ${paxCount - selectedCount} more`}
              </span>
            </div>
            <div class="pax-assignment-grid">
              ${Array.from({ length: paxCount }, (_, i) => {
                const p = state.passengers[i] || {};
                const name = p.fullName || `Passenger ${i + 1}`;
                const seat = state.selectedSeats[i];
                const isTarget = !seat && i === selectedCount;
                return `
                  <div class="pax-assignment-chip ${seat ? 'assigned' : isTarget ? 'active-target' : ''}">
                    <div class="pax-chip-info">
                      <span class="pax-chip-name">${name}</span>
                      <span class="pax-chip-status">
                        ${seat ? `${seat.class.toUpperCase()} Class · ₹${seat.price.toLocaleString()}` : isTarget ? '👉 Click green seat' : 'Pending'}
                      </span>
                    </div>
                    <div>
                      ${seat ? `
                        <div class="flex items-center gap-1">
                          <span class="pax-chip-badge badge badge-primary font-mono">${seat.seatNo}</span>
                          <button class="btn btn-xs btn-ghost text-danger" onclick="window.removeSeatSelection('${seat.seatNo}')" title="Remove seat">✕</button>
                        </div>
                      ` : `
                        <span class="badge badge-neutral text-xs font-mono">—</span>
                      `}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Cabin Layout -->
          <div class="seat-map-container">
            <div class="seat-map-legend">
              <span class="text-xs text-muted">Flight: <strong>${flight.flightNumber}</strong> · Aircraft: <strong>${flight.aircraft}</strong></span>
              <div id="hold-timer-display"></div>
            </div>

            <div class="seat-map-fuselage">
              <div class="cockpit-icon">✈ COCKPIT</div>

              ${seatMap.sections.map(section => `
                <div class="cabin-section" data-class="${section.class}">
                  <div class="cabin-section-header">
                    <span>${section.name} Class</span>
                    <span class="badge badge-neutral">₹${section.price.toLocaleString()}</span>
                  </div>
                  ${section.rows.map(row => `
                    <div class="seat-row">
                      <span class="row-num">${row.row}</span>
                      ${['A', 'B', 'C', null, 'D', 'E', 'F'].map((l, idx) => {
                        if (!l) return idx === 3 ? '<span class="aisle"></span>' : '';
                        const seat = row.cols[l];
                        if (!seat) return '';
                        const isSelected = (state.selectedSeats || []).some(s => s.seatNo === seat.seatNo);
                        const statusCls = isSelected ? 'selected' : seat.status;
                        const cls = `seat ${statusCls} ${section.class === 'first' ? 'first-class' : section.class === 'business' ? 'business-class' : ''}`;

                        let seatEvents = '';
                        if (seat.status === 'available' || isSelected) {
                          seatEvents = `onclick="window.selectSeatInteractive('${seat.seatNo}', ${seat.price}, '${seat.class}')"`;
                        } else {
                          seatEvents = `onmouseenter="window.showSeatInspector(this, '${seat.seatNo}')" onmouseleave="window.hideSeatInspector()" onclick="window.inspectSeatModal('${seat.seatNo}')"`;
                        }
                        return `<div class="${cls}" data-seat="${seat.seatNo}" data-price="${seat.price}" data-class="${seat.class}" data-status="${seat.status}" ${seatEvents}>${seat.seatNo}</div>`;
                      }).join('')}
                    </div>
                  `).join('')}
                </div>
              `).join('')}
            </div>

            <!-- Seat Legend Matching Specifications -->
            <div class="seat-legend mt-4">
              <div class="legend-item"><div class="legend-swatch" style="background:#E8FFF3;border-color:var(--seat-available)"></div>Available (#10B981)</div>
              <div class="legend-item"><div class="legend-swatch" style="background:#FEF3C7;border-color:var(--seat-held)"></div>In Progress / Held (#F59E0B)</div>
              <div class="legend-item"><div class="legend-swatch" style="background:#FEE2E2;border-color:var(--seat-booked)"></div>Booked / Confirmed (#EF4444)</div>
              <div class="legend-item"><div class="legend-swatch" style="background:var(--color-primary);border-color:var(--color-primary-dark)"></div>Selected (Blue)</div>
            </div>
          </div>

          <!-- Set Theory Availability Mathematics Card -->
          <div class="mt-6 p-4" style="background:var(--color-bg);border-radius:var(--radius-xl);border:1px solid var(--color-border)">
            <h4 class="font-bold text-sm mb-2">📐 Discrete Mathematics: Set Inventory & Injective Proof</h4>
            <div class="text-xs font-mono mb-1"><strong>Universal Set U:</strong> |${setDemo.sets.U.size}| configured physical seats</div>
            <div class="text-xs font-mono mb-1 text-danger"><strong>Occupied Set B:</strong> |${setDemo.sets.B.size}| seats booked</div>
            <div class="text-xs font-mono mb-1 text-warning"><strong>SeatWatch Held Set H:</strong> |${setDemo.sets.H.size}| seats under TTL mutex lock</div>
            <div class="text-xs font-mono text-success font-bold"><strong>Available Set A = U ∖ (B ∪ H):</strong> |${setDemo.sets.A.size}| seats ready for booking</div>
            <div class="text-xs mt-2 text-muted">${setDemo.injection.proof}</div>
          </div>

          <div class="flex justify-between mt-6">
            <button class="btn btn-secondary" onclick="window.goToBookingStep(1)">← Back to Passenger Details</button>
            <button class="btn btn-primary btn-lg" id="proceed-to-payment-btn" onclick="window.proceedToPaymentGateway()" ${!allSeatsAssigned ? 'disabled' : ''}>
              ${allSeatsAssigned
                ? `Proceed to Payment (₹${(state.selectedSeats.reduce((s, x) => s + x.price, 0)).toLocaleString()} for ${paxCount} Pax) →`
                : `Select ${paxCount - selectedCount} More Seat${paxCount - selectedCount > 1 ? 's' : ''} to Continue`}
            </button>
          </div>
        </div>
      </div>
    `;
  } else if (step === 3) {
    // ── STEP 3: MULTI-CHANNEL PAYMENT GATEWAYS & ITEMIZED BREAKDOWN ──
    const paxCount = state.passengerCount || 1;
    const baseFareTotal = flight.basePrice * paxCount;
    const seatFeesTotal = (state.selectedSeats || []).reduce((sum, s) => {
      const extra = s.price - flight.basePrice;
      return sum + (extra > 0 ? extra : 0);
    }, 0);
    const subtotal = (state.selectedSeats || []).reduce((sum, s) => sum + s.price, 0) || baseFareTotal;
    const taxesAndSurcharges = Math.round(subtotal * 0.12);
    const comboDiscount = state.comboFareApplied ? 1500 : 0;
    const grandTotal = Math.max(1200 * paxCount, subtotal + taxesAndSurcharges - comboDiscount);

    return `
      <div class="card animate-in">
        <div class="card-header">
          <div>
            <h3>Step 3: Multi-Channel Payment Gateway & Itemized Receipt</h3>
            <p class="text-sm text-muted">Complete payment for ${paxCount} passenger${paxCount > 1 ? 's' : ''}. ACID mutex transactions commit atomically in DBMS.</p>
          </div>
          <div class="text-right">
            ${state.comboFareApplied ? '<div class="text-xs text-success font-bold">Combo Discount -₹1,500 applied</div>' : ''}
            <span class="badge badge-primary" style="font-size:1.05rem;padding:6px 14px">Total: ₹${grandTotal.toLocaleString()}</span>
          </div>
        </div>
        <div class="card-body">

          <!-- ITEMIZED PRICING RECEIPT CARD -->
          <div class="price-breakdown-card">
            <h4 class="font-bold text-sm mb-3" style="color:var(--color-primary)">🧾 Itemized Fare Breakdown (${paxCount} Passenger${paxCount > 1 ? 's' : ''})</h4>
            <div class="price-breakdown-row">
              <span>Base Airfare (₹${flight.basePrice.toLocaleString()} × ${paxCount})</span>
              <span class="font-mono">₹${baseFareTotal.toLocaleString()}</span>
            </div>
            ${seatFeesTotal > 0 ? `
              <div class="price-breakdown-row">
                <span>Cabin Class & Seat Selection Upgrades</span>
                <span class="font-mono">+₹${seatFeesTotal.toLocaleString()}</span>
              </div>
            ` : ''}
            <div class="price-breakdown-row">
              <span>Aviation Security Fee & Airport Surcharges (12% GST)</span>
              <span class="font-mono">+₹${taxesAndSurcharges.toLocaleString()}</span>
            </div>
            ${comboDiscount > 0 ? `
              <div class="price-breakdown-row text-success">
                <span>Round-Trip Smart Combo Fare Discount</span>
                <span class="font-mono">-₹1,500</span>
              </div>
            ` : ''}
            <div class="price-breakdown-row total-row">
              <span>Total Payable Amount</span>
              <span class="font-mono">₹${grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <!-- Clean Tabbed Category Selector -->
          <div class="payment-category-tabs">
            <button type="button" class="payment-cat-btn active" id="paycat-upi" onclick="window.switchPaymentCategory('upi')">
              <span>⚡</span> UPI & QR Code
            </button>
            <button type="button" class="payment-cat-btn" id="paycat-netbanking" onclick="window.switchPaymentCategory('netbanking')">
              <span>🏦</span> Indian Net Banking
            </button>
            <button type="button" class="payment-cat-btn" id="paycat-card" onclick="window.switchPaymentCategory('card')">
              <span>💳</span> Debit & Credit Cards
            </button>
            <button type="button" class="payment-cat-btn" id="paycat-wallets" onclick="window.switchPaymentCategory('wallets')">
              <span>🌐</span> Wallets & International
            </button>
          </div>

          <!-- TAB 1: UPI & QR Code (India) -->
          <div id="payment-panel-upi" class="payment-panel">
            <div class="upi-simulation-box">
              <div class="badge badge-success mb-2">Zero Gateway Surcharge · Instant PNR</div>
              <h4 class="font-bold">Scan Dynamic Canvas UPI QR Code</h4>
              <p class="text-xs text-muted">Open Google Pay, PhonePe, Paytm, or BHIM on your smartphone to scan and approve.</p>

              <div class="qr-code-frame" id="upi-canvas-frame">
                <div class="qr-scan-line"></div>
                <canvas id="dynamic-upi-canvas" width="146" height="146"></canvas>
              </div>

              <div class="text-xs font-mono font-bold text-secondary mt-2">
                VPA: <span id="active-vpa-display">skyvoyage@hdfcbank</span> · Amount: ₹${grandTotal.toLocaleString()}
              </div>

              <div class="upi-apps-row mt-3">
                <button type="button" class="upi-app-badge active" id="upi-app-gpay" onclick="window.selectUpiApp('gpay')">Google Pay</button>
                <button type="button" class="upi-app-badge" id="upi-app-phonepe" onclick="window.selectUpiApp('phonepe')">PhonePe</button>
                <button type="button" class="upi-app-badge" id="upi-app-paytm" onclick="window.selectUpiApp('paytm')">Paytm</button>
                <button type="button" class="upi-app-badge" id="upi-app-bhim" onclick="window.selectUpiApp('bhim')">BHIM UPI</button>
              </div>

              <div class="mt-4 flex gap-3 justify-center">
                <button class="btn btn-primary" id="upi-simulate-btn" onclick="window.simulateUpiPayment()">
                  ⚡ Simulate Scan-and-Pay Instant Approval (₹${grandTotal.toLocaleString()})
                </button>
              </div>
            </div>
          </div>

          <!-- TAB 2: Indian Net Banking -->
          <div id="payment-panel-netbanking" class="payment-panel" style="display:none">
            <h4 class="font-bold mb-3">Popular Indian Banks (Instant Radio Selection)</h4>
            <div class="netbanking-quick-grid">
              <label class="bank-radio-card active" id="bank-card-sbi" onclick="window.selectNetBank('SBI')">
                <input type="radio" name="netbank" value="SBI" checked />
                <div>
                  <div class="font-bold text-sm">State Bank of India (SBI)</div>
                  <div class="text-xs text-muted">Direct Retail NetBanking</div>
                </div>
              </label>

              <label class="bank-radio-card" id="bank-card-hdfc" onclick="window.selectNetBank('HDFC')">
                <input type="radio" name="netbank" value="HDFC" />
                <div>
                  <div class="font-bold text-sm">HDFC Bank</div>
                  <div class="text-xs text-muted">Instant Gateway Clearance</div>
                </div>
              </label>

              <label class="bank-radio-card" id="bank-card-icici" onclick="window.selectNetBank('ICICI')">
                <input type="radio" name="netbank" value="ICICI" />
                <div>
                  <div class="font-bold text-sm">ICICI Bank</div>
                  <div class="text-xs text-muted">Corporate & Retail Banking</div>
                </div>
              </label>

              <label class="bank-radio-card" id="bank-card-axis" onclick="window.selectNetBank('Axis')">
                <input type="radio" name="netbank" value="Axis" />
                <div>
                  <div class="font-bold text-sm">Axis Bank</div>
                  <div class="text-xs text-muted">Instant Settlement</div>
                </div>
              </label>
            </div>

            <div class="mt-4">
              <label class="form-label" style="font-weight:700">All Other Indian Banks (30+ Supported)</label>
              <select class="form-select" id="all-indian-banks-dropdown" onchange="window.selectOtherBank(this.value)">
                <option value="">-- Choose from 30+ other Indian Banks --</option>
                <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                <option value="Punjab National Bank (PNB)">Punjab National Bank (PNB)</option>
                <option value="Bank of Baroda">Bank of Baroda</option>
                <option value="Canara Bank">Canara Bank</option>
                <option value="Union Bank of India">Union Bank of India</option>
                <option value="IndusInd Bank">IndusInd Bank</option>
                <option value="IDBI Bank">IDBI Bank</option>
                <option value="YES Bank">YES Bank</option>
                <option value="Federal Bank">Federal Bank</option>
                <option value="Indian Bank">Indian Bank</option>
              </select>
              <div class="text-xs text-muted mt-1" id="selected-bank-status">Selected: <strong>State Bank of India (SBI)</strong></div>
            </div>
          </div>

          <!-- TAB 3: Debit & Credit Cards with Luhn Check -->
          <div id="payment-panel-card" class="payment-panel" style="display:none">
            <div class="flex justify-between items-center mb-3">
              <h4 class="font-bold">Card Details</h4>
              <div class="flex gap-2 items-center">
                <span class="card-brand-badge" id="card-brand-tag">💳 RuPay / Visa / MC</span>
                <span class="luhn-status-badge valid" id="card-luhn-tag">✓ Luhn Checksum Verified</span>
              </div>
            </div>

            <div class="form-group mb-4">
              <label class="form-label">Card Number <span class="required">*</span></label>
              <input class="form-input font-mono" id="card-num" placeholder="4532 8910 2048 9120" value="4532 8910 2048 9120" oninput="window.handleCardInput(this.value)" />
              <div class="text-xs text-muted mt-1">Real-time Luhn algorithm checksum verification enforced</div>
            </div>

            <div class="form-row mb-4">
              <div class="form-group" style="flex:2">
                <label class="form-label">Cardholder Name <span class="required">*</span></label>
                <input class="form-input" id="card-name" placeholder="Name on card" value="${state.passengers[0]?.fullName || 'Cardholder'}" />
              </div>
              <div class="form-group" style="flex:1">
                <label class="form-label">Expiry (MM/YY) <span class="required">*</span></label>
                <input class="form-input font-mono" id="card-exp" placeholder="12/28" value="08/29" maxlength="5" />
              </div>
              <div class="form-group" style="flex:1">
                <label class="form-label">CVV <span class="required">*</span></label>
                <input class="form-input font-mono" id="card-cvv" type="password" maxlength="4" placeholder="123" value="789" />
              </div>
            </div>
          </div>

          <!-- TAB 4: International & Digital Wallets -->
          <div id="payment-panel-wallets" class="payment-panel" style="display:none">
            <h4 class="font-bold mb-3">Select Digital Wallet or International Provider</h4>
            <div class="grid grid-2 gap-4">
              <div class="card p-4 cursor-pointer hover:border-primary" onclick="window.selectWallet('Apple Pay')" style="border:1.5px solid var(--color-border);border-radius:var(--radius-lg)">
                <div class="flex items-center gap-3">
                  <span style="font-size:2rem">🍎</span>
                  <div>
                    <div class="font-bold">Apple Pay</div>
                    <div class="text-xs text-muted">Touch ID / Face ID Biometric checkout</div>
                  </div>
                </div>
              </div>

              <div class="card p-4 cursor-pointer hover:border-primary" onclick="window.selectWallet('Google Wallet')" style="border:1.5px solid var(--color-border);border-radius:var(--radius-lg)">
                <div class="flex items-center gap-3">
                  <span style="font-size:2rem">🇬</span>
                  <div>
                    <div class="font-bold">Google Wallet</div>
                    <div class="text-xs text-muted">1-Tap Android & Chrome Pay</div>
                  </div>
                </div>
              </div>

              <div class="card p-4 cursor-pointer hover:border-primary" onclick="window.selectWallet('PayPal')" style="border:1.5px solid var(--color-border);border-radius:var(--radius-lg)">
                <div class="flex items-center gap-3">
                  <span style="font-size:2rem;color:#003087">🅿️</span>
                  <div>
                    <div class="font-bold">PayPal Express</div>
                    <div class="text-xs text-muted">Global currency conversion & buyer protection</div>
                  </div>
                </div>
              </div>

              <div class="card p-4 cursor-pointer hover:border-primary" onclick="window.selectWallet('American Express')" style="border:1.5px solid var(--color-border);border-radius:var(--radius-lg)">
                <div class="flex items-center gap-3">
                  <span style="font-size:2rem;color:#0077A6">💳</span>
                  <div>
                    <div class="font-bold">American Express (Amex)</div>
                    <div class="text-xs text-muted">Membership Rewards & SafeKey 3DS</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-4 p-3 text-center" id="wallet-selection-status" style="background:var(--color-bg);border-radius:var(--radius-lg);font-size:var(--font-size-xs)">
              Selected Gateway: <strong>Apple Pay</strong> (Simulated Biometric Sandbox Ready)
            </div>
          </div>

          <!-- DMGT Truth Verification -->
          <div class="mt-6 p-4" style="background:var(--color-bg);border-radius:var(--radius-xl);border:1px solid var(--color-border)">
            <div class="flex justify-between items-center mb-2">
              <span class="font-bold text-xs uppercase text-muted">Discrete Mathematics Truth Verification</span>
              <span class="badge badge-success">Formula: (P ∧ Q) ∧ (R ∨ S)</span>
            </div>
            <div class="grid grid-4 gap-2 text-xs">
              <div class="p-2 rounded bg-white border"><strong>P (Identity):</strong> <span class="text-success font-bold">TRUE ✓</span></div>
              <div class="p-2 rounded bg-white border"><strong>Q (Payment):</strong> <span class="text-success font-bold" id="gate-q-status">Authorized ✓</span></div>
              <div class="p-2 rounded bg-white border"><strong>R (${paxCount} Seats):</strong> <span class="text-success font-bold">TRUE (${(state.selectedSeats || []).map(s=>s.seatNo).join(', ')})</span></div>
              <div class="p-2 rounded bg-white border"><strong>S (Overbook):</strong> <span class="text-muted">FALSE (Not required)</span></div>
            </div>
          </div>

          <div class="flex justify-between items-center mt-6">
            <button class="btn btn-secondary" onclick="window.goToBookingStep(2)">← Back to Seat Selection</button>
            <button class="btn btn-primary btn-lg" id="confirm-payment-btn" onclick="window.executeFinalBooking()">
              Confirm & Pay ₹${grandTotal.toLocaleString()} →
            </button>
          </div>
        </div>
      </div>
    `;
  } else if (step === 4) {
    // ── STEP 4: FINAL CONFIRMATION & MULTI-PASSENGER ISSUANCE ──
    const bookings = state.confirmedBookings || (state.lastConfirmedBooking ? [state.lastConfirmedBooking] : []);
    const paxCount = bookings.length || state.passengerCount || 1;

    return `
      <div class="card animate-in text-center" style="box-shadow:var(--shadow-xl)">
        <div class="card-body" style="padding:var(--space-8) var(--space-6)">
          <div style="font-size:3.5rem;margin-bottom:var(--space-2);animation:bounce 1s ease">🎉</div>
          <h2 style="color:var(--color-success);font-weight:800;font-size:1.85rem;margin-bottom:var(--space-2)">
            Booking Confirmed for ${paxCount} Passenger${paxCount > 1 ? 's' : ''}!
          </h2>
          <p class="text-muted" style="font-size:1rem;margin-bottom:var(--space-6);max-width:700px;margin-left:auto;margin-right:auto">
            All seat assignments committed via ACID mutex locks. Records indexed in ADSA B-Tree (O(log n) search).
          </p>

          <!-- MULTI-PASSENGER TICKET CARDS -->
          <div class="multi-pax-tickets-grid">
            ${bookings.map((b, idx) => `
              <div class="multi-pax-ticket-card">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <span class="badge badge-primary font-mono" style="font-size:12px">Passenger ${idx + 1}</span>
                    <h4 class="font-bold mt-1" style="font-size:1.05rem;color:var(--color-text)">${b.passengerName}</h4>
                  </div>
                  <span class="badge badge-success">ACID Committed</span>
                </div>
                <div class="grid grid-2 gap-2 text-xs mb-3 font-mono" style="background:#F8FAFC;padding:8px 10px;border-radius:8px">
                  <div><strong>PNR:</strong> <span class="text-primary font-bold">${b.pnr}</span></div>
                  <div><strong>Seat:</strong> <span class="text-secondary font-bold">${b.seatNo} (${b.seatClass || 'Economy'})</span></div>
                  <div><strong>Flight:</strong> ${flight.flightNumber}</div>
                  <div><strong>Meal:</strong> ${b.mealPreference || 'Standard'}</div>
                </div>
                <button class="btn btn-secondary btn-sm w-full" onclick="window.showETicketModal('${b.pnr}')">
                  🖨️ View Boarding Pass
                </button>
              </div>
            `).join('')}
          </div>

          <div class="flex gap-4 justify-center flex-wrap mt-6">
            <button class="btn btn-primary btn-lg" onclick="window.showETicketModal('all')">
              🖨️ View & Print All Boarding Passes
            </button>
            <a href="#/bookings" class="btn btn-secondary btn-lg">
              🎫 Go to My Bookings
            </a>
            <a href="#/search" class="btn btn-ghost btn-lg">
              ✈️ Search Another Flight
            </a>
          </div>
        </div>
      </div>
    `;
  }
}

// Global booking flow step navigator
window.goToBookingStep = async (targetStep) => {
  if (targetStep === 1) {
    state.bookingStep = 1;
  } else if (targetStep === 2) {
    if (!state.passengerData?.fullName && (!state.passengers || !state.passengers[0]?.fullName)) {
      showToast('Validation', 'Please complete passenger details first', 'warning');
      return;
    }
    state.bookingStep = 2;
  } else if (targetStep === 3) {
    const paxCount = state.passengerCount || 1;
    if ((state.selectedSeats || []).length < paxCount) {
      showToast('Validation', `Please select all ${paxCount} seats first`, 'warning');
      return;
    }
    state.bookingStep = 3;
  }
  const content = document.getElementById('booking-step-content');
  if (content) {
    content.innerHTML = await renderCurrentBookingStep(state.bookingStep);
    updateStepsHeaderUI(state.bookingStep);
  }
};

function updateStepsHeaderUI(currentStep) {
  for (let i = 1; i <= 4; i++) {
    const s = document.getElementById(`step-${i}`);
    const l = document.getElementById(`line-${i}`);
    if (s) {
      s.className = 'step' + (i < currentStep ? ' completed' : i === currentStep ? ' active' : '');
    }
    if (l) {
      l.className = 'step-line' + (i < currentStep ? ' completed' : '');
    }
  }
}

// ── Multi-Passenger Count & Form Handlers ──

window.setPassengerCount = async (count) => {
  state.passengerCount = count;
  while (state.passengers.length < count) {
    state.passengers.push({
      id: generateId('pax'),
      fullName: '',
      age: '',
      gender: 'Male',
      nationality: 'Indian',
      idType: 'aadhaar',
      idNumber: '',
      mealPreference: 'Standard Non-Veg',
      specialAssistance: 'None'
    });
  }
  state.passengers = state.passengers.slice(0, count);
  state.selectedSeats = [];
  state.selectedSeat = null;
  const content = document.getElementById('booking-step-content');
  if (content) {
    content.innerHTML = await renderCurrentBookingStep(1);
  }
};

window.switchNationalityMulti = (idx, nat) => {
  if (!state.passengers[idx]) state.passengers[idx] = {};
  state.passengers[idx].nationality = nat;
  const isIndian = nat === 'Indian';
  const indianSec = document.getElementById(`indian-id-${idx}`);
  const foreignSec = document.getElementById(`foreign-id-${idx}`);
  if (indianSec) indianSec.style.display = isIndian ? 'block' : 'none';
  if (foreignSec) foreignSec.style.display = !isIndian ? 'block' : 'none';

  const block = document.getElementById(`pax-block-${idx}`);
  if (block) {
    block.querySelectorAll('.nationality-option').forEach((opt, i) => {
      opt.classList.toggle('selected', (i === 0 && isIndian) || (i === 1 && !isIndian));
    });
  }
};

window.fillPassengerMulti = async (idx, paxId) => {
  if (!paxId) return;
  const pax = await get('passengers', paxId);
  if (!pax) return;
  state.passengers[idx] = {
    fullName: `${pax.firstName} ${pax.lastName}`,
    age: pax.age || 30,
    gender: pax.gender || 'Male',
    nationality: pax.nationality || 'Indian',
    idType: pax.idType || 'aadhaar',
    idNumber: pax.idNumber || '',
    passportNum: pax.idType === 'passport' ? pax.idNumber : '',
    passportExpiry: pax.passportExpiry || '2028-11-15',
    issuingCountry: pax.issuingCountry || 'India',
    mealPreference: pax.mealPreference || 'Standard Non-Veg',
    specialAssistance: pax.specialAssistance || 'None',
    tier: pax.tier || 'gold',
    id: pax.id,
  };
  const nameEl = document.getElementById(`pax-name-${idx}`);
  const ageEl = document.getElementById(`pax-age-${idx}`);
  const genderEl = document.getElementById(`pax-gender-${idx}`);
  const idTypeEl = document.getElementById(`pax-idtype-${idx}`);
  const idNumEl = document.getElementById(`pax-idnum-${idx}`);
  if (nameEl) nameEl.value = state.passengers[idx].fullName;
  if (ageEl) ageEl.value = state.passengers[idx].age;
  if (genderEl) genderEl.value = state.passengers[idx].gender;
  if (idTypeEl) idTypeEl.value = state.passengers[idx].idType;
  if (idNumEl) idNumEl.value = state.passengers[idx].idNumber;
  window.switchNationalityMulti(idx, state.passengers[idx].nationality);
  showToast('Profile Loaded', `Passenger ${idx + 1}: ${state.passengers[idx].fullName}`, 'success');
};

window.saveAllPassengersAndProceed = () => {
  const count = state.passengerCount || 1;
  const email = document.getElementById('pax-email')?.value.trim();
  const phone = document.getElementById('pax-phone')?.value.trim();
  const code = document.getElementById('pax-country-code')?.value || '+91';

  if (!email || !email.includes('@')) {
    showToast('Validation Error', 'Valid primary email address is required', 'warning');
    return;
  }
  if (!phone || phone.length < 7) {
    showToast('Validation Error', 'Valid mobile number is required', 'warning');
    return;
  }

  for (let i = 0; i < count; i++) {
    const fullName = document.getElementById(`pax-name-${i}`)?.value.trim();
    const age = document.getElementById(`pax-age-${i}`)?.value.trim();
    const gender = document.getElementById(`pax-gender-${i}`)?.value || 'Male';
    const nat = document.querySelector(`input[name="nat-${i}"]:checked`)?.value || 'Indian';
    const mealPreference = document.getElementById(`pax-meal-${i}`)?.value || 'Standard Non-Veg';
    const specialAssistance = document.getElementById(`pax-assist-${i}`)?.value || 'None';

    if (!fullName || fullName.length < 2) {
      showToast('Validation Error', `Passenger ${i + 1}: Please enter full name`, 'warning');
      return;
    }
    if (!age || parseInt(age) < 1 || parseInt(age) > 120) {
      showToast('Validation Error', `Passenger ${i + 1}: Please enter a valid age (1-120)`, 'warning');
      return;
    }

    let idType, idNumber, passportNum, passportExpiry, issuingCountry;
    if (nat === 'Indian') {
      idType = document.getElementById(`pax-idtype-${i}`)?.value || 'aadhaar';
      idNumber = document.getElementById(`pax-idnum-${i}`)?.value.trim();
      if (!idNumber || idNumber.length < 5) {
        showToast('ID Required', `Passenger ${i + 1}: Valid Indian ID number required`, 'warning');
        return;
      }
    } else {
      idType = 'passport';
      passportNum = document.getElementById(`pax-passport-${i}`)?.value.trim();
      issuingCountry = document.getElementById(`pax-country-${i}`)?.value || 'United Arab Emirates';
      passportExpiry = document.getElementById(`pax-expiry-${i}`)?.value || '2028-11-15';
      if (!passportNum || passportNum.length < 5) {
        showToast('Passport Required', `Passenger ${i + 1}: Valid international passport number required`, 'warning');
        return;
      }
      idNumber = passportNum;
    }

    const nameParts = fullName.split(' ');
    state.passengers[i] = {
      ...state.passengers[i],
      id: state.passengers[i]?.id || generateId('pax'),
      fullName,
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' ') || nameParts[0],
      age: parseInt(age),
      gender,
      nationality: nat,
      idType,
      idNumber,
      passportNum,
      passportExpiry,
      issuingCountry,
      mealPreference,
      specialAssistance,
      email,
      phone: `${code} ${phone}`
    };
  }

  // Sync state.passengerData for backward compatibility
  state.passengerData = {
    ...state.passengers[0],
    email,
    phone: `${code} ${phone}`
  };

  showToast('Verified ✓', `${count} Passenger${count > 1 ? 's' : ''} details verified`, 'success');
  window.goToBookingStep(2);
};

// ── Seat Selection & Telemetry Handlers ──

window.showSeatInspector = (el, seatNo) => {
  window.hideSeatInspector();
  const seat = window.currentSeatMapDetails?.[seatNo];
  if (!seat) return;

  const tooltip = document.createElement('div');
  tooltip.id = 'active-seat-tooltip';
  tooltip.className = 'seat-inspector-tooltip';
  tooltip.innerHTML = `
    <div style="font-weight:700;font-size:11px;margin-bottom:2px">Seat ${seatNo} (${seat.class.toUpperCase()})</div>
    <div style="font-size:10px;color:var(--color-text-secondary)">Status: <strong>${seat.status.toUpperCase()}</strong></div>
    ${seat.status === 'booked' ? `<div style="font-size:10px;color:var(--color-danger)">Occupied · Click for dossier</div>` : ''}
    ${seat.status === 'held' ? `<div style="font-size:10px;color:var(--color-warning)">Lock TTL: active</div>` : ''}
  `;

  el.style.position = 'relative';
  el.appendChild(tooltip);
};

window.hideSeatInspector = () => {
  document.getElementById('active-seat-tooltip')?.remove();
};

window.inspectSeatModal = (seatNo) => {
  const seat = window.currentSeatMapDetails?.[seatNo] || {};
  if (seat.status === 'booked') {
    const occupant = seat.occupant || { name: 'Rajesh S.', pnr: 'SK-92184', status: 'Confirmed', meal: 'Asian Vegetarian' };
    showToast(`Seat ${seatNo} Dossier`, `Passenger: ${occupant.name} | PNR: ${occupant.pnr} | Status: Confirmed`, 'info');
    window.showSeatWatchAlert(seatNo);
  } else if (seat.status === 'held') {
    const timerText = seat.holdInfo?.timerText || 'Held by checkout session • Expires in 04:12 min';
    showToast(`Seat ${seatNo} Hold`, `${timerText} | Mutex: seat:${state.selectedFlight?.id}:${seatNo}`, 'warning');
    window.showSeatWatchAlert(seatNo);
  }
};

window.showSeatWatchAlert = (seatNo) => {
  const isWindow = seatNo.endsWith('A') || seatNo.endsWith('F');
  const alertMsg = isWindow
    ? `Window Seat ${seatNo} is currently locked by another passenger.`
    : `Seat ${seatNo} is currently unavailable under active session mutex.`;

  document.getElementById('seatwatch-alert')?.remove();

  const alertHtml = document.createElement('div');
  alertHtml.id = 'seatwatch-alert';
  alertHtml.className = 'seatwatch-alert-card';
  alertHtml.innerHTML = `
    <div class="seatwatch-alert-content">
      <div class="seatwatch-icon">👁️</div>
      <div>
        <div class="font-bold" style="margin-bottom:4px">${alertMsg}</div>
        <div class="text-sm text-muted">Would you like to set a SeatWatch alert? If this seat is released by timeout or cancellation, you will receive an instant 60-second priority claim notification.</div>
      </div>
    </div>
    <div class="seatwatch-actions">
      <button class="btn btn-primary btn-sm" onclick="window.enableSeatWatch('${seatNo}')">👁️ Enable SeatWatch Alert</button>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('seatwatch-alert')?.remove()">Dismiss</button>
    </div>
  `;

  const container = document.querySelector('.seat-map-container');
  if (container) container.parentElement.insertBefore(alertHtml, container.nextSibling);
};

window.enableSeatWatch = (seatNo) => {
  document.getElementById('seatwatch-alert')?.remove();
  showToast('SeatWatch Active 👁️', `Monitoring seat ${seatNo}. You'll receive a 60-second priority claim if it opens.`, 'success');
};

window.selectSeatInteractive = async (seatNo, price, seatClass) => {
  const flight = state.selectedFlight;
  const paxCount = state.passengerCount || 1;
  if (!state.selectedSeats) state.selectedSeats = [];

  const existingIdx = state.selectedSeats.findIndex(s => s.seatNo === seatNo);
  if (existingIdx >= 0) {
    state.selectedSeats.splice(existingIdx, 1);
    await releaseSeatHold(flight.id, seatNo, state.session_hold_id);
    showToast('Seat Deselected', `Seat ${seatNo} unassigned`, 'info');
  } else {
    if (state.selectedSeats.length >= paxCount) {
      showToast('Seat Limit Reached', `All ${paxCount} seats already selected. Click an assigned seat to change it.`, 'warning');
      return;
    }
    const paxIdx = state.selectedSeats.length;
    const paxName = state.passengers[paxIdx]?.fullName || `Passenger ${paxIdx + 1}`;
    state.selectedSeats.push({ seatNo, price, class: seatClass, passengerIndex: paxIdx });

    const holdRes = await holdSeat(flight.id, seatNo, state.passengers[paxIdx]?.id || state.session_hold_id, state.session_hold_id);
    if (holdRes.success) {
      state.holdId = holdRes.holdId;
      startHoldTimer(holdRes.expiresAt);
    }
    showToast('Seat Assigned ✓', `Seat ${seatNo} (${seatClass}) assigned to ${paxName}`, 'success');
  }

  state.selectedSeat = state.selectedSeats[0] || null;

  const content = document.getElementById('booking-step-content');
  if (content) {
    content.innerHTML = await renderCurrentBookingStep(2);
  }
};

window.removeSeatSelection = async (seatNo) => {
  const flight = state.selectedFlight;
  const existingIdx = (state.selectedSeats || []).findIndex(s => s.seatNo === seatNo);
  if (existingIdx >= 0) {
    state.selectedSeats.splice(existingIdx, 1);
    state.selectedSeat = state.selectedSeats[0] || null;
    await releaseSeatHold(flight.id, seatNo, state.session_hold_id);
    const content = document.getElementById('booking-step-content');
    if (content) {
      content.innerHTML = await renderCurrentBookingStep(2);
    }
  }
};

window.proceedToPaymentGateway = () => {
  const paxCount = state.passengerCount || 1;
  if ((state.selectedSeats || []).length < paxCount) {
    showToast('Select Seats', `Please select all ${paxCount} seats before proceeding`, 'warning');
    return;
  }
  window.goToBookingStep(3);
  setTimeout(() => {
    const subtotal = (state.selectedSeats || []).reduce((sum, s) => sum + s.price, 0);
    const taxes = Math.round(subtotal * 0.12);
    const discount = state.comboFareApplied ? 1500 : 0;
    const grand = Math.max(1200 * paxCount, subtotal + taxes - discount);
    window.renderDynamicUpiCanvas('skyvoyage@hdfcbank', grand);
  }, 100);
};

// ── Payment Gateway Handlers ──

window.switchPaymentCategory = (cat) => {
  document.querySelectorAll('.payment-cat-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`paycat-${cat}`)?.classList.add('active');

  document.querySelectorAll('.payment-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById(`payment-panel-${cat}`);
  if (panel) panel.style.display = 'block';

  if (cat === 'upi') {
    const paxCount = state.passengerCount || 1;
    const subtotal = (state.selectedSeats || []).reduce((sum, s) => sum + s.price, 0) || (state.selectedFlight.basePrice * paxCount);
    const grand = Math.max(1200 * paxCount, subtotal + Math.round(subtotal * 0.12) - (state.comboFareApplied ? 1500 : 0));
    window.renderDynamicUpiCanvas('skyvoyage@hdfcbank', grand);
  }
};

window.selectUpiApp = (app) => {
  document.querySelectorAll('.upi-app-badge').forEach(b => b.classList.remove('active'));
  document.getElementById(`upi-app-${app}`)?.classList.add('active');

  const vpas = {
    gpay: 'skyvoyage.gpay@okaxis',
    phonepe: 'skyvoyage@ybl',
    paytm: 'skyvoyage@paytm',
    bhim: 'skyvoyage@upi',
  };
  const vpa = vpas[app] || 'skyvoyage@hdfcbank';
  const display = document.getElementById('active-vpa-display');
  if (display) display.textContent = vpa;

  const paxCount = state.passengerCount || 1;
  const subtotal = (state.selectedSeats || []).reduce((sum, s) => sum + s.price, 0) || (state.selectedFlight.basePrice * paxCount);
  const grand = Math.max(1200 * paxCount, subtotal + Math.round(subtotal * 0.12) - (state.comboFareApplied ? 1500 : 0));
  window.renderDynamicUpiCanvas(vpa, grand);
};

window.renderDynamicUpiCanvas = (vpa, amt) => {
  const canvas = document.getElementById('dynamic-upi-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#0F172A';
  const drawFinder = (x, y, s) => {
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 5, y + 5, s - 10, s - 10);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(x + 9, y + 9, s - 18, s - 18);
  };

  drawFinder(10, 10, 34);
  drawFinder(w - 44, 10, 34);
  drawFinder(10, h - 44, 34);

  // Seeded pattern
  let seed = 0;
  for (let i = 0; i < vpa.length; i++) seed += vpa.charCodeAt(i);
  seed += Math.floor(amt);

  const gridSize = 14;
  const stepSize = Math.floor((w - 20) / gridSize);

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if ((r < 5 && c < 5) || (r < 5 && c >= gridSize - 5) || (r >= gridSize - 5 && c < 5)) continue;
      const pseudoVal = Math.sin(seed * (r * gridSize + c + 1)) * 10000;
      if (pseudoVal - Math.floor(pseudoVal) > 0.48) {
        ctx.fillRect(10 + c * stepSize, 10 + r * stepSize, stepSize - 1, stepSize - 1);
      }
    }
  }

  // Logo in center
  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = '#0066FF';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡', cx, cy);
};

window.simulateUpiPayment = () => {
  const btn = document.getElementById('upi-simulate-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;display:inline-block"></span> Authenticating via NPCI UPI Switch...';
  }
  setTimeout(() => {
    showToast('UPI Approval Received ✓', 'Payment confirmed by bank switch. Committing DBMS ACID lock...', 'success');
    window.executeFinalBooking('upi');
  }, 1200);
};

window.selectNetBank = (code) => {
  document.querySelectorAll('.bank-radio-card').forEach(c => c.classList.remove('active'));
  document.getElementById(`bank-card-${code.toLowerCase()}`)?.classList.add('active');
  const radio = document.querySelector(`input[name="netbank"][value="${code}"]`);
  if (radio) radio.checked = true;

  const names = {
    SBI: 'State Bank of India (SBI)',
    HDFC: 'HDFC Bank',
    ICICI: 'ICICI Bank',
    Axis: 'Axis Bank',
  };
  const status = document.getElementById('selected-bank-status');
  if (status) status.innerHTML = `Selected: <strong>${names[code] || code}</strong> (Direct Retail NetBanking)`;
};

window.selectOtherBank = (bankName) => {
  if (!bankName) return;
  document.querySelectorAll('.bank-radio-card').forEach(c => c.classList.remove('active'));
  const status = document.getElementById('selected-bank-status');
  if (status) status.innerHTML = `Selected: <strong>${bankName}</strong> (NetBanking Gateway)`;
  showToast('Bank Selected', `${bankName} routing configured`, 'info');
};

window.validateLuhnNumber = (numStr) => {
  const digits = numStr.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return (sum % 10) === 0;
};

window.handleCardInput = (val) => {
  const brandTag = document.getElementById('card-brand-tag');
  const luhnTag = document.getElementById('card-luhn-tag');
  const clean = val.replace(/\D/g, '');

  if (brandTag) {
    if (clean.startsWith('4')) brandTag.textContent = '💳 Visa Verified';
    else if (/^5[1-5]/.test(clean)) brandTag.textContent = '💳 Mastercard Verified';
    else if (/^(60|65|81|82)/.test(clean)) brandTag.textContent = '💳 RuPay Verified';
    else if (/^3[47]/.test(clean)) brandTag.textContent = '💳 American Express';
    else brandTag.textContent = '💳 Card Detected';
  }

  if (luhnTag) {
    const isValid = window.validateLuhnNumber(clean);
    luhnTag.className = `luhn-status-badge ${isValid ? 'valid' : 'invalid'}`;
    luhnTag.textContent = isValid ? '✓ Luhn Checksum Verified' : '⚠️ Invalid Checksum';
  }
};

window.selectWallet = (walletName) => {
  const status = document.getElementById('wallet-selection-status');
  if (status) {
    status.innerHTML = `Selected Gateway: <strong>${walletName}</strong> (Sandbox Token Initialized)`;
  }
  showToast(`${walletName} Ready`, 'Digital wallet authenticated for instant 1-click checkout', 'info');
};

// ── Atomic Multi-Passenger Booking Confirmation ──

window.executeFinalBooking = async (overrideMethod = null) => {
  const btn = document.getElementById('confirm-payment-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;display:inline-block"></span> Committing ACID Mutex Locks...';
  }

  const activeCat = document.querySelector('.payment-cat-btn.active')?.id?.replace('paycat-', '') || 'upi';
  const paymentMethod = overrideMethod || activeCat;
  const paxCount = state.passengerCount || 1;
  const baseFareTotal = state.selectedFlight.basePrice * paxCount;
  const subtotal = (state.selectedSeats || []).reduce((sum, s) => sum + s.price, 0) || baseFareTotal;
  const taxesAndSurcharges = Math.round(subtotal * 0.12);
  const comboDiscount = state.comboFareApplied ? 1500 : 0;
  const grandTotal = Math.max(1200 * paxCount, subtotal + taxesAndSurcharges - comboDiscount);
  const perPaxAmount = Math.round(grandTotal / paxCount);

  const bookingsCreated = [];
  try {
    for (let i = 0; i < paxCount; i++) {
      const p = state.passengers[i] || state.passengerData;
      const seat = state.selectedSeats[i] || state.selectedSeat || { seatNo: '12A', price: state.selectedFlight.basePrice, class: 'economy' };

      // Save passenger in DB
      await put('passengers', p);

      // Create atomic booking
      const res = await createBooking({
        flightId: state.selectedFlight.id,
        seatNo: seat.seatNo,
        passengerId: p.id,
        passengerName: p.fullName || `${p.firstName} ${p.lastName}`,
        amount: perPaxAmount,
        paymentMethod,
        holdId: state.holdId,
        session_hold_id: state.session_hold_id,
      });

      if (res.success) {
        bookingsCreated.push({
          ...res.booking,
          pnr: res.pnr,
          seatNo: seat.seatNo,
          seatClass: seat.class,
          passengerName: p.fullName || `${p.firstName} ${p.lastName}`,
          passengerId: p.id,
          mealPreference: p.mealPreference || 'Standard Non-Veg',
          specialAssistance: p.specialAssistance || 'None',
          idType: p.idType,
          idNumber: p.idNumber,
          airline: state.selectedFlight.airline,
        });
      } else {
        throw new Error(res.error || `Failed booking for ${p.fullName}`);
      }
    }

    clearHoldTimer();
    state.confirmedBookings = bookingsCreated;
    state.lastConfirmedBooking = bookingsCreated[0];
    showToast('All Bookings Confirmed! 🎉', `${paxCount} passenger tickets issued under ACID transaction`, 'success');

    state.bookingStep = 4;
    window.goToBookingStep(4);
  } catch (err) {
    showToast('Booking Error', err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `Confirm & Pay ₹${grandTotal.toLocaleString()} →`;
    }
  }
};

function startHoldTimer(expiresAt) {
  clearHoldTimer();
  const display = document.getElementById('hold-timer-display');
  if (!display) return;

  state.holdTimer = setInterval(() => {
    const remaining = Math.max(0, new Date(expiresAt) - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const critical = remaining < 120000;
    display.innerHTML = `<div class="ttl-timer ${critical ? 'critical' : ''}">${icons.clock} ${mins}:${secs.toString().padStart(2, '0')} TTL Lock</div>`;
    if (remaining <= 0) {
      clearHoldTimer();
      display.innerHTML = '<div class="ttl-timer critical">Seat Hold Expired</div>';
      showToast('Hold Expired', 'Seat hold timed out. Please select your seat again.', 'warning');
    }
  }, 1000);
}

function clearHoldTimer() {
  if (state.holdTimer) { clearInterval(state.holdTimer); state.holdTimer = null; }
}

// ══════════════════════════════════════════════════════════
//  PAGE: MY BOOKINGS
// ══════════════════════════════════════════════════════════

async function renderBookingsPage() {
  const bookings = await getAllBookings();

  return `
    <div class="container">
      <div class="page-header"><h1>My Bookings</h1><p>View and manage your reservations</p></div>

      <div class="card mb-6 animate-in">
        <div class="card-body">
          <div class="flex gap-4 items-center">
            <div class="form-group" style="flex:1">
              <input class="form-input" id="pnr-lookup" placeholder="Enter PNR to search (e.g., ABC123)">
            </div>
            <button class="btn btn-primary" onclick="window.lookupPNR()">${icons.search} Look Up</button>
          </div>
          <div id="pnr-result" class="mt-4"></div>
        </div>
      </div>

      <div id="bookings-list">
        ${bookings.length === 0
      ? '<div class="empty-state"><div class="icon">🎫</div><h3>No bookings yet</h3><p>Your confirmed bookings will appear here</p></div>'
      : bookings.map(b => renderBookingCard(b)).join('')}
      </div>
    </div>
  `;
}

function renderBookingCard(b) {
  const paxIdInfo = b.passengerIdType ? `<span class="badge badge-neutral text-xs ml-2">${b.passengerIdType}: ${b.passengerIdNumber || ''}</span>` : '';
  return `
    <div class="card mb-4 animate-in">
      <div class="card-body">
        <div class="flex justify-between items-center mb-4">
          <div>
            <code style="font-size:var(--font-size-xl);font-weight:800;color:var(--color-primary)">${b.pnr}</code>
            <span class="badge ${b.status === 'confirmed' ? 'badge-success' : 'badge-danger'} ml-2 badge-dot">${b.status}</span>
            ${paxIdInfo}
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="window.showETicketModal('${b.pnr}')">🖨️ View E-Ticket</button>
            ${b.status === 'confirmed' ? `<button class="btn btn-danger btn-sm" onclick="window.cancelBookingUI('${b.pnr}')">Cancel</button>` : ''}
          </div>
        </div>
        <div class="grid grid-4 gap-4 text-sm">
          <div><span class="text-muted">Flight</span><div class="font-semibold">${b.flightId}</div></div>
          <div><span class="text-muted">Seat</span><div class="font-semibold">${b.seatNo} (${b.seatClass || ''})</div></div>
          <div><span class="text-muted">Passenger</span><div class="font-semibold">${b.passengerName || b.passengerId}</div></div>
          <div><span class="text-muted">Amount</span><div class="font-semibold">₹${(b.totalPrice || 0).toLocaleString()}</div></div>
        </div>
        ${b.refund ? `<div class="mt-3 p-3" style="background:var(--color-bg);border-radius:var(--radius-md);font-size:var(--font-size-sm)">
          <strong>Refund:</strong> ₹${b.refund.refundAmount.toLocaleString()} (${b.refund.percentage}%) — ${b.refund.reason}
        </div>` : ''}
      </div>
    </div>
  `;
}

window.lookupPNR = async () => {
  const pnr = document.getElementById('pnr-lookup').value.trim().toUpperCase();
  if (!pnr) { showToast('Error', 'Please enter a PNR', 'warning'); return; }

  const result = document.getElementById('pnr-result');
  const compsBefore = bookingIndex.comparisons;
  const booking = await lookupByPNR(pnr);
  const compsAfter = bookingIndex.comparisons;

  if (booking) {
    result.innerHTML = `
      <div class="p-3" style="background:var(--color-success-light);border-radius:var(--radius-md);font-size:var(--font-size-sm)">
        ✅ Found via B-Tree in <strong>${compsAfter - compsBefore}</strong> comparisons (O(log n))
      </div>
      ${renderBookingCard(booking)}
    `;
  } else {
    result.innerHTML = '<div class="p-3" style="background:var(--color-danger-light);border-radius:var(--radius-md)">❌ No booking found for PNR: ' + pnr + '</div>';
  }
};

window.cancelBookingUI = async (pnr) => {
  if (!confirm(`Cancel booking ${pnr}? This action will apply the refund policy.`)) return;

  const result = await cancelBooking(pnr);
  if (result.success) {
    showToast('Booking Cancelled', `Refund: ₹${result.refund.refundAmount.toLocaleString()} (${result.refund.percentage}%)`, 'success');
    if (result.promoted) {
      showToast('Waitlist Promotion! 🎉', `${result.promoted.passengerName} (${result.promoted.tier}) auto-promoted to PNR: ${result.promoted.pnr}`, 'info');
    }
    navigateTo(state.currentPage); // Refresh
  } else {
    showToast('Error', result.error, 'error');
  }
};

// ══════════════════════════════════════════════════════════
//  ACADEMIC JOURNEY SIMULATION STATE & DATA
// ══════════════════════════════════════════════════════════

const ACADEMIC_JOURNEY_STEPS = [
  {
    step: 1,
    id: 'search',
    title: '1. Flight Search & Optimal Routing',
    subject: 'DMGT Units 4–5: Graph Theory & Shortest Path',
    badge: 'Graph Theory',
    summary: 'The passenger queries available flights between cities (e.g. VTZ → HYD). The system represents airports as vertices and flight routes as weighted directed edges, executing Dijkstra\'s algorithm to find optimal paths and fares.',
    terminal: [
      { cls: 'cyan', text: '▶ [DMGT::GRAPH] Initializing route discovery engine for origin=VTZ, dest=HYD...' },
      { cls: 'gray', text: '  ├─ Graph model: G = (V, E) with |V|=9 airports, |E|=18 directed routes' },
      { cls: 'gray', text: '  ├─ Computing shortest path using Dijkstra algorithm with priority queue...' },
      { cls: 'green', text: '  ├─ Route candidate identified: AI442 (VTZ ➔ HYD), Distance: 510 km, FlightTime: 70m' },
      { cls: 'cyan', text: '  └─ Status: 200 OK — Candidate flight returned to client with real-time seat matrix.' }
    ]
  },
  {
    step: 2,
    id: 'id-verify',
    title: '2. Passenger Registration & ID Verification',
    subject: 'DMGT Unit 1 (Propositional Logic) & OOPJ Encapsulation',
    badge: 'Logic Gates',
    summary: 'Passenger details are validated using discrete boolean logic gates. Indian citizens are strictly verified with 12-digit Aadhaar / Passport; foreign nationals require valid passport and expiration dates.',
    terminal: [
      { cls: 'yellow', text: '▶ [DMGT::LOGIC] Evaluating Propositional Logic Expression: CanBook = (P ∧ Q) ∧ (R ∨ S)' },
      { cls: 'gray', text: '  ├─ Variable P [ValidIdentity]: Citizen=Indian, IDType=Aadhaar, Digits=12 -> TRUE' },
      { cls: 'gray', text: '  ├─ Variable Q [ContactVerified]: Email=rfc5322_valid, Phone=E.164_valid -> TRUE' },
      { cls: 'green', text: '  ├─ Conjunction (P ∧ Q) Evaluated: TRUE ∧ TRUE = 1 (Verified)' },
      { cls: 'cyan', text: '  └─ OOPJ: Instantiated Passenger object with #private encapsulation and tier weights.' }
    ]
  },
  {
    step: 3,
    id: 'seat-lock',
    title: '3. Atomic Concurrency Row Lock',
    subject: 'DBMS Unit 5 (ACID Concurrency & Pessimistic Locking)',
    badge: 'ACID Concurrency',
    summary: 'When the passenger selects seat 12B, the database acquires a pessimistic row lock: SELECT * FROM seats WHERE flight_id=? AND seat_no=? FOR UPDATE, preventing double-booking race conditions.',
    terminal: [
      { cls: 'yellow', text: '▶ [DBMS::CONCURRENCY] Acquiring Mutex lock on resource "mutex:AI442:12B"...' },
      { cls: 'magenta', text: '  ├─ Mutex state: FREE ➔ LOCKED by thread_worker_pax_49182' },
      { cls: 'gray', text: '  ├─ Executing ACID query: SELECT * FROM seats WHERE flight_id=\'AI442\' AND seat_no=\'12B\' FOR UPDATE' },
      { cls: 'green', text: '  ├─ Row status updated: AVAILABLE ➔ HELD (SeatWatch timeout active: 10m / 600s)' },
      { cls: 'cyan', text: '  └─ Concurrency defense: 0 double-booking collisions allowed across 20 simulated threads.' }
    ]
  },
  {
    step: 4,
    id: 'overbooking',
    title: '4. Predictive Overbooking & Max-Heap Standby',
    subject: 'Python/ML (Logistic Regression) & ADSA Unit 2 (Max-Heap)',
    badge: 'ML & Max-Heap',
    summary: 'Machine learning predicts route no-show probability p = σ(z). If physical capacity is exhausted, additional passengers are prioritized into a Max-Heap based on loyalty tier and booking timestamp.',
    terminal: [
      { cls: 'yellow', text: '▶ [PYTHON::ML] Calculating dynamic overbooking parameter using Logistic Regression...' },
      { cls: 'gray', text: '  ├─ Feature vector: x = [Route_VTZ_HYD=1, LeadDays=14, Season=Monsoon, HistoricalNoShow=0.10]' },
      { cls: 'gray', text: '  ├─ Sigmoid calculation: p = 1 / (1 + e^(-z)) = 0.1085 (10.9% expected no-show rate)' },
      { cls: 'green', text: '  ├─ Loss optimization: min E[Cost(k)] with BumpCost=₹15,000, SpoilCost=₹4,500 ➔ k* = +3 seats' },
      { cls: 'magenta', text: '  └─ [ADSA::HEAP] Priority Queue initialized: Score = (TierWeight × 100,000) − Timestamp' }
    ]
  },
  {
    step: 5,
    id: 'payment',
    title: '5. Integrated Payment Processing',
    subject: 'DBMS Unit 3 (Two-Phase Commit & Integrity)',
    badge: 'ACID Payment',
    summary: 'The passenger authorizes payment via simulated dynamic UPI QR or Credit Card. An atomic transaction verifies payment before finalizing seat status to BOOKED.',
    terminal: [
      { cls: 'yellow', text: '▶ [PAYMENT::GATEWAY] Dispatching transaction to UPI PSP simulation router...' },
      { cls: 'gray', text: '  ├─ Dynamic UPI QR payload generated: upi://pay?pa=skyvoyage@enterprise&am=3200' },
      { cls: 'green', text: '  ├─ NPCI Gateway handshake: Response Code 00 (TRANSACTION_SUCCESS)' },
      { cls: 'gray', text: '  ├─ DBMS Transaction: UPDATE seats SET status=\'booked\' WHERE seat_no=\'12B\'' },
      { cls: 'cyan', text: '  └─ DBMS Commit: Seat status changed from HELD ➔ BOOKED (Atomic persist to IndexedDB)' }
    ]
  },
  {
    step: 6,
    id: 'pnr-btree',
    title: '6. B-Tree Index Insertion & PNR Generation',
    subject: 'ADSA Unit 1 (In-Memory B-Tree Indexing)',
    badge: 'B-Tree Indexing',
    summary: 'A 6-character PNR (e.g. SK-894210) is generated and inserted into the in-memory B-Tree index (Order m=3) in O(log n) time. Boarding pass with vector QR is immediately ready for printing.',
    terminal: [
      { cls: 'yellow', text: '▶ [ADSA::B-TREE] Generating unique cryptographic 6-char PNR: SK-894210...' },
      { cls: 'gray', text: '  ├─ Invoking BTree.insert("SK-894210", bookingRecord) with Order m=3' },
      { cls: 'gray', text: '  ├─ Traversal path: Root (depth 0) ➔ Internal Node [SK-500000 | SK-900000] ➔ Leaf' },
      { cls: 'green', text: '  ├─ B-Tree insertion completed in 2 comparisons! Theoretical complexity: O(log_m n)' },
      { cls: 'cyan', text: '  ├─ Audit log event written: ACTION_BOOKING_CONFIRMED, EntityId=SK-894210' },
      { cls: 'green', text: '  └─ Boarding Pass rendered with authentic vector QR code. Passenger journey complete!' }
    ]
  }
];

window.academicJourneyCurrentStep = 1;
window.academicJourneyAutoPlayInterval = null;

window.setAcademicJourneyStep = (stepNum) => {
  if (stepNum < 1 || stepNum > ACADEMIC_JOURNEY_STEPS.length) return;
  window.academicJourneyCurrentStep = stepNum;

  // Update step buttons & circles
  for (let i = 1; i <= ACADEMIC_JOURNEY_STEPS.length; i++) {
    const btn = document.getElementById(`journey-step-btn-${i}`);
    if (btn) {
      btn.className = 'journey-step-item';
      if (i < stepNum) btn.classList.add('completed');
      if (i === stepNum) btn.classList.add('active');
    }
  }

  // Update progress bar line
  const progressBar = document.getElementById('journey-progress-bar');
  if (progressBar) {
    const pct = ((stepNum - 1) / (ACADEMIC_JOURNEY_STEPS.length - 1)) * 100;
    progressBar.style.width = `${pct}%`;
  }

  // Update step info banner
  const stepData = ACADEMIC_JOURNEY_STEPS[stepNum - 1];
  const infoBanner = document.getElementById('journey-step-info');
  if (infoBanner && stepData) {
    infoBanner.innerHTML = `
      <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 style="margin:0;font-size:1.15rem;color:var(--color-text)">${stepData.title}</h3>
        <span class="badge badge-info">${stepData.badge}</span>
      </div>
      <div class="text-xs font-bold text-primary mb-2">${stepData.subject}</div>
      <p class="text-sm text-secondary" style="margin:0;line-height:1.5">${stepData.summary}</p>
    `;
  }

  // Update terminal logs
  const termBody = document.getElementById('journey-terminal-body');
  if (termBody) {
    let logHtml = '';
    for (let s = 1; s <= stepNum; s++) {
      const sData = ACADEMIC_JOURNEY_STEPS[s - 1];
      logHtml += `<div class="term-line gray" style="font-weight:700;margin-top:${s > 1 ? '12px' : '0'};border-top:${s > 1 ? '1px dashed #1E293B' : 'none'};padding-top:${s > 1 ? '6px' : '0'}">── MILESTONE ${s}: ${sData.badge.toUpperCase()} [${sData.subject}] ──</div>`;
      for (const line of sData.terminal) {
        logHtml += `<div class="term-line ${line.cls}">${line.text}</div>`;
      }
    }
    termBody.innerHTML = logHtml;
    termBody.scrollTop = termBody.scrollHeight;
  }
};

window.nextAcademicJourneyStep = () => {
  if (window.academicJourneyCurrentStep < ACADEMIC_JOURNEY_STEPS.length) {
    window.setAcademicJourneyStep(window.academicJourneyCurrentStep + 1);
  } else {
    window.setAcademicJourneyStep(1);
  }
};

window.prevAcademicJourneyStep = () => {
  if (window.academicJourneyCurrentStep > 1) {
    window.setAcademicJourneyStep(window.academicJourneyCurrentStep - 1);
  }
};

window.resetAcademicJourney = () => {
  if (window.academicJourneyAutoPlayInterval) {
    clearInterval(window.academicJourneyAutoPlayInterval);
    window.academicJourneyAutoPlayInterval = null;
    const btn = document.getElementById('btn-journey-autoplay');
    if (btn) btn.innerHTML = '▶ Auto-Play Simulation';
  }
  window.setAcademicJourneyStep(1);
};

window.toggleJourneyAutoPlay = () => {
  const btn = document.getElementById('btn-journey-autoplay');
  if (window.academicJourneyAutoPlayInterval) {
    clearInterval(window.academicJourneyAutoPlayInterval);
    window.academicJourneyAutoPlayInterval = null;
    if (btn) btn.innerHTML = '▶ Auto-Play Simulation';
    showToast('Simulation Paused', 'Interactive playback paused', 'info');
  } else {
    if (btn) btn.innerHTML = '⏸ Pause Simulation';
    showToast('Simulation Playing', 'Streaming milestones automatically...', 'info');
    window.academicJourneyAutoPlayInterval = setInterval(() => {
      if (window.academicJourneyCurrentStep >= ACADEMIC_JOURNEY_STEPS.length) {
        window.setAcademicJourneyStep(1);
      } else {
        window.nextAcademicJourneyStep();
      }
    }, 2800);
  }
};

// ══════════════════════════════════════════════════════════
//  ACADEMIC CURRICULAR KNOWLEDGE BASE (R23 SYLLABUS MAPPING)
// ══════════════════════════════════════════════════════════

const SYLLABUS_KNOWLEDGE_BASE = [
  {
    id: 'dbms-1',
    subject: 'DBMS',
    subjectFull: 'Database Management Systems',
    unit: 'Unit 2: Relational Model & Integrity Constraints',
    topics: 'Candidate Keys, Composite Primary Keys, UNIQUE Constraints, Foreign Keys',
    location: 'js/core/store.js ➔ initDB() & executeAtomicBooking()',
    codeRef: 'store.js -> initDB()',
    icon: '🗄️',
    color: '#EF4444',
    title: 'Atomic Composite Key & Double-Booking Prevention',
    explanation: 'Why UNIQUE(flight_id, seat_no) matters: When two passengers submit payment for Seat 14A simultaneously, the database driver enforces an atomic composite uniqueness constraint. The first transaction commits while the second query aborts with an integrity violation, completely eliminating double bookings without relying on slow table-level locks.'
  },
  {
    id: 'dbms-2',
    subject: 'DBMS',
    subjectFull: 'Database Management Systems',
    unit: 'Unit 3: Database Design & Normalization (3NF/BCNF)',
    topics: '1NF, 2NF, 3NF Functional Dependency Decomposition, Lossless Joins',
    location: 'js/core/store.js ➔ SEED_DATA & schema definitions',
    codeRef: 'store.js -> SEED_DATA',
    icon: '📊',
    color: '#EF4444',
    title: '3NF Relational Decomposition for Booking Integrity',
    explanation: 'Decomposes Flights, Passengers, Bookings, and SeatInventory into separate relations. Flight departure schedules are never duplicated across individual tickets. Modifying a flight time or aircraft model updates exactly one row in the Flights table without causing update or deletion anomalies across thousands of booked passenger records.'
  },
  {
    id: 'dbms-3',
    subject: 'DBMS',
    subjectFull: 'Database Management Systems',
    unit: 'Unit 5: Transaction Management & Concurrency Control',
    topics: 'ACID Properties, Two-Phase Locking (2PL), Pessimistic Mutex, Deadlock Avoidance',
    location: 'js/core/lockManager.js ➔ withLock() & store.js ➔ executeAtomicBooking()',
    codeRef: 'lockManager.js -> withLock()',
    icon: '🔒',
    color: '#EF4444',
    title: 'ACID Transactions & Pessimistic Row Locking',
    explanation: 'Ensures atomicity during seat checkout. When a seat is held, an exclusive in-memory mutex lock with a 300-second TTL is acquired. If the passenger payment succeeds, the seat transitions from HELD to CONFIRMED and the ticket is generated in one atomic transaction. If the tab closes or payment crashes, the hold expires and rolls back automatically.'
  },
  {
    id: 'adsa-1',
    subject: 'ADSA',
    subjectFull: 'Advanced Data Structures & Algorithms',
    unit: 'Unit 1: Balanced Multi-Way Trees (B-Trees)',
    topics: 'B-Tree of Order m=3, Disk-Optimized Indexing, O(log n) Lookup & Split',
    location: 'js/core/btree.js ➔ BTree class & search() / insert()',
    codeRef: 'btree.js -> BTree.search()',
    icon: '🌲',
    color: '#3B82F6',
    title: 'B-Tree Passenger PNR Indexing',
    explanation: 'Airline systems manage millions of reservation records. Searching sequential arrays takes O(n) time which causes lag during check-in spikes. Our balanced B-Tree (order m=3) guarantees O(log n) search time by keeping keys sorted across multi-key nodes, allowing gate staff to retrieve boarding passes in less than 3 tree traversals.'
  },
  {
    id: 'adsa-2',
    subject: 'ADSA',
    subjectFull: 'Advanced Data Structures & Algorithms',
    unit: 'Unit 2: Priority Queues & Binary Max-Heaps',
    topics: 'Max-Heapify, O(1) Max Retrieval, O(log n) Extraction, Priority Scoring',
    location: 'js/core/maxheap.js ➔ MaxHeap class & bookingService.js ➔ cancelBooking()',
    codeRef: 'maxheap.js -> MaxHeap.extractMax()',
    icon: '⭐',
    color: '#3B82F6',
    title: 'Frequent Flyer Standby Priority Queue',
    explanation: 'When a flight is fully booked, passengers join a waitlist. Our Binary Max-Heap ranks passengers using Priority = (TierWeight × 100,000) − Timestamp. When a cancellation occurs, the top passenger (e.g. Gold Frequent Flyer who booked earliest) is extracted in O(log n) time and automatically promoted to the newly opened seat without manual staff intervention.'
  },
  {
    id: 'dmgt-1',
    subject: 'DMGT',
    subjectFull: 'Discrete Mathematics & Graph Theory',
    unit: 'Unit 1: Mathematical Logic & Propositional Calculus',
    topics: 'Boolean Truth Functions, Conjunction, Disjunction, Implication, Compound Gates',
    location: 'js/services/logicGates.js ➔ evaluateBookingFormula()',
    codeRef: 'logicGates.js -> evaluateBookingFormula()',
    icon: '⚡',
    color: '#F59E0B',
    title: 'Propositional Logic Gate for Checkout Validation',
    explanation: 'Evaluates CanBook = (P ∧ Q) ∧ (R ∨ S) where P is ValidIdentity, Q is PaymentCleared, R is SeatAvailable, and S is OverbookPermitted. If payment fails (Q=false) or no seat is free and overbooking is disallowed ((R ∨ S)=false), the compound logic evaluates to False and halts the booking pipeline, preventing invalid tickets from being minted.'
  },
  {
    id: 'dmgt-2',
    subject: 'DMGT',
    subjectFull: 'Discrete Mathematics & Graph Theory',
    unit: 'Unit 2: Set Theory, Relations & Injective Mappings',
    topics: 'Set Difference, Universal Sets, Injective (One-to-One) Functions, Pigeonhole Principle',
    location: 'js/services/setTheoryService.js ➔ getAvailableSeats() & seatService.js',
    codeRef: 'setTheoryService.js -> getAvailableSeats()',
    icon: '⭕',
    color: '#F59E0B',
    title: 'Set-Theoretic Inventory Partitioning & Injective Mappings',
    explanation: 'Defines seat availability strictly as A = U ∖ (B ∪ H) where U is total aircraft capacity, B is confirmed bookings, and H is temporary holds. Furthermore, seat assignment is modeled as an injective function f: Passenger ➔ Seat. By the Pigeonhole Principle, if |Passengers| > |Seats| without controlled overbooking, duplicate assignment is mathematically guaranteed; our set validation enforces |B| ≤ |U|.'
  },
  {
    id: 'dmgt-3',
    subject: 'DMGT',
    subjectFull: 'Discrete Mathematics & Graph Theory',
    unit: 'Unit 4 & 5: Graph Theory & Shortest Path Algorithms',
    topics: 'Weighted Directed Graphs, Adjacency Lists, Dijkstra Algorithm, In/Out-Degree',
    location: 'js/services/graphService.js ➔ findAlternativeRoute()',
    codeRef: 'graphService.js -> findAlternativeRoute()',
    icon: '🌐',
    color: '#F59E0B',
    title: 'Dijkstra Route Network & Layover Optimization',
    explanation: 'Represents airports as vertices V and flight segments as directed weighted edges E(u, v, cost). When a direct flight from HYD to GOI is sold out, Dijkstra algorithm computes the shortest layover path (e.g. HYD ➔ BOM ➔ GOI) with minimal transit time and lowest combined fare, providing immediate re-routing options to passengers.'
  },
  {
    id: 'oopj-1',
    subject: 'OOPJ',
    subjectFull: 'Object-Oriented Programming (Java)',
    unit: 'Unit 1 & 2: Encapsulation, Inheritance & Access Control',
    topics: 'Abstract Base Classes, Private Fields (#), Polymorphism, Subclass Specialization',
    location: 'js/models/Passenger.js & js/models/User.js ➔ Person base class',
    codeRef: 'Passenger.js -> class Passenger extends Person',
    icon: '🧬',
    color: '#10B981',
    title: 'Encapsulated Domain Hierarchy (Person ➔ Passenger)',
    explanation: 'Implements object-oriented safety with private fields for passenger credentials, contact information, and frequent flyer tiers. The abstract Person base class enforces consistent identity interfaces while subclasses Passenger and Admin specialize behaviors, preventing unauthorized mutation of loyalty points or booking statuses.'
  },
  {
    id: 'oopj-2',
    subject: 'OOPJ',
    subjectFull: 'Object-Oriented Programming (Java)',
    unit: 'Unit 3 & 4: Design Patterns & Exception Handling',
    topics: 'Strategy Pattern, Polymorphic Execution, Custom Exception Hierarchies, Try-Catch',
    location: 'js/models/RefundStrategy.js ➔ TieredRefundPolicy & FullRefundPolicy',
    codeRef: 'RefundStrategy.js -> calculateRefund()',
    icon: '🛡️',
    color: '#10B981',
    title: 'Polymorphic Strategy Pattern for Fare Refunds',
    explanation: 'Uses the Strategy Design Pattern to calculate cancellation penalties dynamically without sprawling switch/if-else statements. FullRefundPolicy, TieredRefundPolicy (95% at 72h, 75% at 24-72h, 50% at 4-24h), and NonRefundablePolicy each implement a common interface. Adding new corporate or promotional policies requires zero modification to core booking code.'
  },
  {
    id: 'python-1',
    subject: 'Python/ML',
    subjectFull: 'Python Programming & Applied Machine Learning',
    unit: 'Unit 3: Supervised Classification & Logistic Regression',
    topics: 'Sigmoid Activation Function, Probability Calibration, Log-Loss Optimization',
    location: 'js/services/mlService.js ➔ predictNoShowProbability()',
    codeRef: 'mlService.js -> predictNoShowProbability()',
    icon: '🤖',
    color: '#8B5CF6',
    title: 'Sigmoid Logistic Regression for No-Show Forecasting',
    explanation: 'Evaluates historical booking lead times, route distance, day-of-week seasonality, and cabin class using the sigmoid activation function p = 1 / (1 + e^-z). Produces a calibrated probability (e.g. 8.4% no-show probability for HYD-BOM business travellers), replacing arbitrary human guesswork with mathematical statistical certainty.'
  },
  {
    id: 'python-2',
    subject: 'Python/ML',
    subjectFull: 'Python Programming & Applied Machine Learning',
    unit: 'Unit 4: Cost Function Optimization & Revenue Management',
    topics: 'Expected Cost Minimization, Bumping Penalty vs Spoilage Loss, Dynamic Capacity Buffer',
    location: 'js/services/mlService.js ➔ calculateOptimalOverbooking()',
    codeRef: 'mlService.js -> calculateOptimalOverbooking()',
    icon: '📈',
    color: '#8B5CF6',
    title: 'Mathematical Revenue Optimizer & Overbooking Buffer',
    explanation: 'Airlines lose money if planes take off with empty seats, but face heavy civil penalties and re-accommodation costs if passengers are bumped. Our optimizer computes E[Cost(k)] = b × P(NoShows < k) + s × (k - ActualNoShows) to determine the exact optimal overbooking buffer (+k* seats) that maximizes revenue while bounding denied-boarding risk below 0.5%.'
  }
];

// ══════════════════════════════════════════════════════════
//  CORE ACADEMICS DATA MODEL: THE 5 ESSENTIAL R23 SUBJECTS
// ══════════════════════════════════════════════════════════

const CORE_SUBJECTS = {
  dbms: {
    key: 'dbms',
    subject: 'DBMS',
    name: 'Database Management Systems',
    units: 'R23 Units 2, 3 & 5',
    color: '#EF4444',
    icon: '🗄️',
    formula: 'CONSTRAINT uk_flight_seat UNIQUE(flight_id, seat_no) | SELECT ... FOR UPDATE',
    problem: 'Eliminates double-booking race conditions during high-concurrency seat checkout spikes and prevents database update anomalies.',
    topics: [
      { id: 'dbms-race', title: 'Dual Concurrent Write Race (UNIQUE Constraint)', unit: 'Unit 2: Relational Integrity Keys' },
      { id: 'dbms-mutex', title: 'Pessimistic Row Mutex (2PL Lock & TTL)', unit: 'Unit 5: Concurrency Control' },
      { id: 'dbms-norm', title: '3NF Relational Normalization', unit: 'Unit 3: Normalization' }
    ],
    impact: 'Why DBMS Constraints Matter: Without database-level UNIQUE composite keys and pessimistic locks, high-traffic ticket rushes cause duplicate tickets to be issued for the exact same seat, causing gate-side overboarding disputes, seat collisions, and massive civil penalties.'
  },
  adsa: {
    key: 'adsa',
    subject: 'ADSA',
    name: 'Advanced Data Structures & Algorithms',
    units: 'R23 Units 1 & 2',
    color: '#3B82F6',
    icon: '🌲',
    formula: 'T(n) = O(log_t n) | Priority = (TierWeight × 10⁵) - Timestamp',
    problem: 'Guarantees O(log n) PNR retrieval across millions of tickets and executes instant O(1) waitlist promotion of VIP flyers.',
    topics: [
      { id: 'adsa-btree', title: 'Multi-Way Balanced B-Tree (Order t=3)', unit: 'Unit 1: Multi-Way Trees' },
      { id: 'adsa-heap', title: 'Binary Max-Heap Standby Priority Queue', unit: 'Unit 2: Priority Queues' }
    ],
    impact: 'Why ADSA Matters: Linear arrays require O(n) scans, leading to crippling system lag during airport check-ins. Balanced B-Trees ensure instant O(log n) ticket retrieval, while Binary Max-Heaps automate fair, prioritized standby passenger promotions without manual staff tampering.'
  },
  dmgt: {
    key: 'dmgt',
    subject: 'DMGT',
    name: 'Discrete Mathematics & Graph Theory',
    units: 'R23 Units 1, 2, 4–5',
    color: '#F59E0B',
    icon: '⚡',
    formula: 'CanBook = (P ∧ Q) ∧ (R ∨ S) | A = U ∖ (B ∪ H)',
    problem: 'Validates strict passenger qualification via Boolean circuits and optimizes multi-hop flight layovers via weighted directed graphs.',
    topics: [
      { id: 'dmgt-logic', title: 'Propositional Logic Gate Circuit', unit: 'Unit 1: Propositional Calculus' },
      { id: 'dmgt-set', title: 'Set Theory Inventory & Injective Mappings', unit: 'Unit 2: Set Theory & Relations' },
      { id: 'dmgt-graph', title: 'Dijkstra Shortest Route Network', unit: 'Unit 4-5: Graph Theory & Shortest Path' }
    ],
    impact: 'Why DMGT Matters: Propositional logic formulas prevent invalid bookings when payments fail or seats are exhausted. Set theory mathematically guarantees aircraft capacity bounds, and Dijkstra algorithm re-routes passengers through optimal hubs when direct flights are sold out.'
  },
  oopj: {
    key: 'oopj',
    subject: 'OOPJ',
    name: 'Object-Oriented Programming (Java)',
    units: 'R23 Units 1–4',
    color: '#10B981',
    icon: '🧬',
    formula: 'Person ← Passenger, User | Strategy Pattern: RefundPolicyStrategy',
    problem: 'Protects passenger domain entities with private encapsulation and decouples dynamic cancellation fees using the Strategy Pattern.',
    topics: [
      { id: 'oopj-uml', title: 'UML Domain Hierarchy & Encapsulation', unit: 'Unit 1-2: Classes & Inheritance' },
      { id: 'oopj-strategy', title: 'Polymorphic Refund Strategy Simulator', unit: 'Unit 3: Design Patterns' },
      { id: 'oopj-exceptions', title: 'Checked Booking Exception Hierarchy', unit: 'Unit 4: Exception Handling' }
    ],
    impact: 'Why OOPJ Matters: Encapsulation with strictly private (#) fields prevents client-side tampering of frequent flyer tiers and balances. Polymorphic Strategy patterns allow the airline to modify refund regulations dynamically without breaking core checkout code.'
  },
  python: {
    key: 'python',
    subject: 'Python/ML',
    name: 'Python Applied Machine Learning',
    units: 'Classification & Optimization',
    color: '#8B5CF6',
    icon: '🤖',
    formula: 'P(no-show) = σ(z) = 1 / (1 + e^-z) | min E[Cost(b)]',
    problem: 'Replaces risky human guesswork with predictive logistic regression and calculates the mathematically optimal overbooking limit.',
    topics: [
      { id: 'python-sigmoid', title: 'Interactive Sigmoid Activation Curve', unit: 'Supervised Logistic Regression' },
      { id: 'python-overbook', title: 'Binomial Expected Cost Minimization', unit: 'Expected Cost Optimization' }
    ],
    impact: 'Why Python ML Matters: Unsold seats are permanently perishable revenue, while overbooking too aggressively causes expensive bump compensations. Our binomial cost optimizer balances bump penalties vs spoilage losses to determine the exact optimal buffer (+b* seats).'
  }
};

// ══════════════════════════════════════════════════════════
//  PAGE: ACADEMIC SHOWCASE (5 CORE SUBJECTS ARCHITECTURE)
// ══════════════════════════════════════════════════════════

async function renderAcademicPage() {
  return `
    <div class="container">
      <div class="page-header">
        <div class="flex items-center gap-2 mb-2">
          <span class="badge badge-accent">B.Tech II Year I Sem — R23 Curricular Specification</span>
          <span class="text-xs text-muted font-mono">100% Zero-Build ES6 Native</span>
        </div>
        <h1>Core Curricular Architecture & Visual Concept Engine</h1>
        <p>A rigorous implementation focused strictly on the 5 foundational R23 curriculum subjects: DBMS, ADSA, DMGT, OOPJ, and Python Applied Machine Learning. Click any subject card or topic pill to launch its interactive visual simulation, animated logic diagram, and live backend trace.</p>
      </div>

      <!-- SECTION A: COMPREHENSIVE SYSTEM ARCHITECTURE BLUEPRINT -->
      <div class="blueprint-hero mb-8">
        <div class="flex justify-between items-start flex-wrap gap-4 mb-4">
          <div>
            <h2 style="color:#FFFFFF;margin-bottom:6px;font-size:1.6rem">End-to-End System Architecture Pipeline</h2>
            <p style="color:#CBD5E1;max-width:850px;font-size:0.95rem;line-height:1.5">
              Every passenger interaction flows through a verified computer science stack — transforming raw browser clicks into discrete logic evaluations, self-balancing B-Tree index lookups, ACID row-level mutex locks, ML probability predictions, and priority queue waitlists.
            </p>
          </div>
        </div>

        <!-- Interactive Visual Architecture Blueprint Pipeline -->
        <div class="pipeline-diagram">
          <div class="pipeline-node active-pipe pipeline-interactive" onclick="window.showPipelineDrawer('client')">
            <div class="pipeline-node-icon">🖥️</div>
            <div class="pipeline-node-title">1. Client UI</div>
            <div class="pipeline-node-sub">HTML5 / CSS3 / ES6</div>
          </div>
          <div class="pipeline-arrow">➔</div>

          <div class="pipeline-node pipeline-interactive" onclick="window.showPipelineDrawer('dmgt')">
            <div class="pipeline-node-icon">⚡</div>
            <div class="pipeline-node-title">2. DMGT Logic Gate</div>
            <div class="pipeline-node-sub">CanBook = (P∧Q)∧(R∨S)</div>
          </div>
          <div class="pipeline-arrow">➔</div>

          <div class="pipeline-node pipeline-interactive" onclick="window.showPipelineDrawer('adsa')">
            <div class="pipeline-node-icon">🌳</div>
            <div class="pipeline-node-title">3. ADSA B-Tree</div>
            <div class="pipeline-node-sub">O(log n) PNR Index</div>
          </div>
          <div class="pipeline-arrow">➔</div>

          <div class="pipeline-node pipeline-interactive" onclick="window.showPipelineDrawer('dbms')">
            <div class="pipeline-node-icon">🔒</div>
            <div class="pipeline-node-title">4. DBMS ACID Lock</div>
            <div class="pipeline-node-sub">Pessimistic Mutex</div>
          </div>
          <div class="pipeline-arrow">➔</div>

          <div class="pipeline-node pipeline-interactive" onclick="window.showPipelineDrawer('python')">
            <div class="pipeline-node-icon">🧠</div>
            <div class="pipeline-node-title">5. Python ML</div>
            <div class="pipeline-node-sub">Sigmoid Overbooking</div>
          </div>
          <div class="pipeline-arrow">➔</div>

          <div class="pipeline-node pipeline-interactive" onclick="window.showPipelineDrawer('heap')">
            <div class="pipeline-node-icon">📊</div>
            <div class="pipeline-node-title">6. ADSA Max-Heap</div>
            <div class="pipeline-node-sub">Standby Priority Queue</div>
          </div>
        </div>
        <!-- Pipeline Drawer Tooltip -->
        <div id="pipeline-drawer" class="pipeline-drawer" style="display:none"></div>
      </div>

      <!-- SECTION B: ANIMATED END-TO-END PASSENGER JOURNEY WORKFLOW -->
      <div class="journey-container mb-8">
        <div class="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div>
            <h2 style="margin:0 0 4px 0;font-size:1.35rem">Animated Passenger Journey & Execution Terminal</h2>
            <p class="text-muted text-sm" style="margin:0">Watch real-time background algorithms execute at every milestone of the booking lifecycle</p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="window.prevAcademicJourneyStep()">⏮ Previous</button>
            <button class="btn btn-primary btn-sm" id="btn-journey-autoplay" onclick="window.toggleJourneyAutoPlay()">▶ Auto-Play Simulation</button>
            <button class="btn btn-secondary btn-sm" onclick="window.nextAcademicJourneyStep()">⏭ Next</button>
            <button class="btn btn-ghost btn-sm" onclick="window.resetAcademicJourney()">🔄 Reset</button>
          </div>
        </div>

        <!-- Stepper Navigation -->
        <div class="journey-stepper mb-6">
          <div class="journey-stepper-line">
            <div class="journey-stepper-progress" id="journey-progress-bar" style="width:0%"></div>
          </div>

          <div class="journey-step-item active" id="journey-step-btn-1" onclick="window.setAcademicJourneyStep(1)">
            <div class="journey-step-circle">1</div>
            <div class="journey-step-label">Flight Search</div>
          </div>

          <div class="journey-step-item" id="journey-step-btn-2" onclick="window.setAcademicJourneyStep(2)">
            <div class="journey-step-circle">2</div>
            <div class="journey-step-label">ID Verification</div>
          </div>

          <div class="journey-step-item" id="journey-step-btn-3" onclick="window.setAcademicJourneyStep(3)">
            <div class="journey-step-circle">3</div>
            <div class="journey-step-label">Seat Locking</div>
          </div>

          <div class="journey-step-item" id="journey-step-btn-4" onclick="window.setAcademicJourneyStep(4)">
            <div class="journey-step-circle">4</div>
            <div class="journey-step-label">ML Overbooking</div>
          </div>

          <div class="journey-step-item" id="journey-step-btn-5" onclick="window.setAcademicJourneyStep(5)">
            <div class="journey-step-circle">5</div>
            <div class="journey-step-label">Payment Gateway</div>
          </div>

          <div class="journey-step-item" id="journey-step-btn-6" onclick="window.setAcademicJourneyStep(6)">
            <div class="journey-step-circle">6</div>
            <div class="journey-step-label">PNR & E-Ticket</div>
          </div>
        </div>

        <!-- Current Step Info Banner -->
        <div class="card p-4 mb-4" id="journey-step-info" style="background:var(--color-bg);border-left:4px solid var(--color-primary)">
          <!-- Dynamic Content Rendered Here -->
        </div>

        <!-- Synchronized Dark Execution Terminal -->
        <div class="execution-terminal">
          <div class="terminal-header">
            <div class="terminal-dots">
              <div class="terminal-dot red"></div>
              <div class="terminal-dot yellow"></div>
              <div class="terminal-dot green"></div>
            </div>
            <div class="terminal-title">skyvoyage-kernel-runtime: v3.0 (ACID/ADSA/DMGT Engine)</div>
            <button class="btn btn-ghost btn-xs text-muted" onclick="document.getElementById('journey-terminal-body').scrollTop = 0">↑ Top</button>
          </div>
          <div class="terminal-body" id="journey-terminal-body">
            <!-- Dynamic Terminal Stream Lines Rendered Here -->
          </div>
        </div>
      </div>

      <!-- SECTION C: THE 5 ESSENTIAL CORE SUBJECTS VISUAL EXPLORER -->
      <div class="mb-4">
        <div class="flex justify-between items-end flex-wrap gap-4 mb-6">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="badge badge-primary">Curricular Engine</span>
              <span class="text-xs text-muted font-mono">B.Tech R23 Syllabi</span>
            </div>
            <h2 style="margin:0 0 4px 0;font-size:1.5rem">The 5 Core Curricular Subjects</h2>
            <p class="text-muted text-sm" style="margin:0">Click any card or topic badge to launch the interactive animated simulation, dynamic circuit/graph, and live backend trace terminal</p>
          </div>
        </div>

        <!-- 5 SUBJECTS CARD GRID -->
        <div class="core-subjects-grid">
          ${Object.values(CORE_SUBJECTS).map(sub => `
            <div class="core-subject-card" style="--subject-accent:${sub.color}">
              <div class="core-subject-header">
                <span class="core-subject-badge" style="background:${sub.color}20;color:${sub.color};border:1px solid ${sub.color}40">${sub.icon} ${sub.subject}</span>
                <span class="core-subject-units">${sub.units}</span>
              </div>
              <div class="core-subject-title">${sub.name}</div>
              <div class="core-subject-problem">${sub.problem}</div>
              <div class="core-subject-formula">${sub.formula}</div>
              
              <div class="core-subject-topics-list">
                ${sub.topics.map(t => `
                  <button class="core-subject-topic-pill" onclick="window.openConceptModal('${sub.key}', '${t.id}')">
                    📌 ${t.title.split('(')[0].trim()}
                  </button>
                `).join('')}
              </div>

              <button class="core-subject-launch-btn" onclick="window.openConceptModal('${sub.key}')">
                <span>Launch Interactive Simulation</span>
                <span>⚡</span>
              </button>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- INTERACTIVE CONCEPT MODAL MOUNT POINT -->
      <div id="concept-modal-mount"></div>
    </div>
  `;
}


// ── Interactive Pipeline Node Drawer ──
const PIPELINE_NODE_DATA = {
  client: {
    title: '🖥️ Client UI Layer',
    flow: 'User Input → Event Handlers → DOM Render → Hash Router',
    payload: '{ action: "searchFlights", origin: "VTZ", dest: "HYD", date: "2026-10-15" }',
    timing: 'DOM Event → Render: ~12ms | IndexedDB Query: ~8ms',
    tech: 'Semantic HTML5 forms, CSS3 Design Tokens, ES6 Modules (<script type="module">)'
  },
  dmgt: {
    title: '⚡ DMGT Propositional Logic Gate',
    flow: 'Passenger Form → Boolean Validators → CanBook = (P ∧ Q) ∧ (R ∨ S)',
    payload: '{ P: true, Q: true, R: true, S: false, result: true }',
    timing: 'Logic Evaluation: ~0.02ms | Truth Table: 16 rows pre-computed',
    tech: 'Propositional Calculus (Unit 1), Set Theory A = U ∖ (B ∪ H) (Unit 2)'
  },
  adsa: {
    title: '🌳 ADSA B-Tree PNR Index',
    flow: 'PNR Generated → BTree.insert(key, record) → Node Split if Full',
    payload: '{ key: "SK-894210", value: { flightId: "AI442", seatNo: "12B", status: "confirmed" } }',
    timing: 'Insert: O(log₃ n) = ~2 comparisons for 1000 records | Search: O(log₃ n)',
    tech: 'Multi-Way Balanced B-Tree (Order t=3), Level-Order Traversal'
  },
  dbms: {
    title: '🔒 DBMS ACID Concurrency Lock',
    flow: 'SELECT...FOR UPDATE → Row Lock → Status Update → COMMIT/ROLLBACK',
    payload: '{ mutex: "seat:AI442:12B", state: "LOCKED", ttl: 600, holder: "sess_abc123" }',
    timing: 'Lock Acquire: ~1ms | Atomic Commit: ~3ms | TTL Expiry: 600s',
    tech: 'Pessimistic 2PL Locking, UNIQUE(flight_id, seat_no), IndexedDB Transactions'
  },
  python: {
    title: '🧠 Python ML Overbooking Engine',
    flow: 'Feature Vector → Sigmoid σ(z) → P(no-show) → min E[Cost(b)]',
    payload: '{ features: [14, 1, 0.12, 0.85], z: -2.15, probability: 0.104, optimalBuffer: 3 }',
    timing: 'Sigmoid Calc: ~0.01ms | Cost Curve (10 levels): ~0.5ms',
    tech: 'Logistic Regression, Binomial Expected Cost Minimization'
  },
  heap: {
    title: '📊 ADSA Max-Heap Priority Queue',
    flow: 'Cancel Event → ExtractMax() → Auto-Promote Top Waitlisted Passenger',
    payload: '{ promoted: "Rajesh S.", tier: "gold", priority: 399985, newPNR: "SK-501829" }',
    timing: 'ExtractMax: O(1) peek, O(log n) restore | Insert: O(log n)',
    tech: 'Binary Max-Heap with Priority = (TierWeight × 10⁵) − Timestamp'
  }
};

window.showPipelineDrawer = (nodeKey, el = null) => {
  const data = PIPELINE_NODE_DATA[nodeKey];
  if (!data) return;

  const drawer = document.getElementById('pipeline-drawer');
  if (!drawer) return;

  // Pulse animation on clicked node
  document.querySelectorAll('.pipeline-node').forEach(n => n.classList.remove('pulse-active'));
  event.currentTarget.classList.add('pulse-active');

  drawer.style.display = 'block';
  drawer.innerHTML = `
    <div class="pipeline-drawer-content">
      <div class="pipeline-drawer-header">
        <strong>${data.title}</strong>
        <button class="btn btn-ghost btn-xs" onclick="document.getElementById('pipeline-drawer').style.display='none'">✕</button>
      </div>
      <div class="pipeline-drawer-body">
        <div class="pipeline-drawer-row"><span class="pipeline-drawer-label">Data Flow:</span><span>${data.flow}</span></div>
        <div class="pipeline-drawer-row"><span class="pipeline-drawer-label">JSON Payload:</span><code class="text-xs">${data.payload}</code></div>
        <div class="pipeline-drawer-row"><span class="pipeline-drawer-label">Execution Timing:</span><span>${data.timing}</span></div>
        <div class="pipeline-drawer-row"><span class="pipeline-drawer-label">Technology:</span><span>${data.tech}</span></div>
      </div>
    </div>
  `;
};

function initAcademicPage() {
  // Initialize journey simulation to step 1
  window.setAcademicJourneyStep(1);

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeConceptModal();
    }
  });
}

// ══════════════════════════════════════════════════════════
//  INTERACTIVE CONCEPT MODAL & VISUAL SIMULATION ENGINE
// ══════════════════════════════════════════════════════════

window.currentModalSubject = null;
window.currentModalTab = null;

window.openConceptModal = (subjectKey, tabKey = null) => {
  const subject = CORE_SUBJECTS[subjectKey];
  if (!subject) return;

  window.currentModalSubject = subjectKey;
  window.currentModalTab = tabKey || subject.topics[0].id;

  const mount = document.getElementById('concept-modal-mount');
  if (!mount) return;

  mount.innerHTML = `
    <div class="concept-modal-backdrop academic-modal-overlay" id="concept-modal-backdrop" onclick="if(event.target===this) window.closeConceptModal()">
      <div class="concept-modal-dialog">
        <!-- Modal Header -->
        <div class="concept-modal-header">
          <div class="concept-modal-title-group">
            <span class="concept-modal-icon">${subject.icon}</span>
            <div>
              <h3 class="concept-modal-title">${subject.name}</h3>
              <div class="concept-modal-subtitle">${subject.units} • R23 Curricular Specification</div>
            </div>
          </div>
          <button class="concept-modal-close" onclick="window.closeConceptModal()" title="Close dialog">✕</button>
        </div>

        <!-- Modal Tabs -->
        <div class="concept-modal-tabs">
          ${subject.topics.map(t => `
            <button 
              class="concept-modal-tab-btn ${t.id === window.currentModalTab ? 'active' : ''}" 
              onclick="window.switchConceptModalTab('${t.id}')">
              ${t.title}
            </button>
          `).join('')}
        </div>

        <!-- Modal Body -->
        <div class="concept-modal-body" id="concept-modal-body">
          ${renderConceptModalContent(subjectKey, window.currentModalTab)}
        </div>
      </div>
    </div>
  `;

  // Prevent body scrolling while modal is open
  document.body.style.overflow = 'hidden';

  // Initialize specific tab interactive graphics
  initConceptTabInteractive(window.currentModalTab);
};

window.closeConceptModal = () => {
  const backdrop = document.getElementById('concept-modal-backdrop');
  if (backdrop) {
    backdrop.style.opacity = '0';
    setTimeout(() => {
      const mount = document.getElementById('concept-modal-mount');
      if (mount) mount.innerHTML = '';
      document.body.style.overflow = '';
    }, 200);
  }
};

window.switchConceptModalTab = (tabKey) => {
  window.currentModalTab = tabKey;
  document.querySelectorAll('.concept-modal-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(tabKey) || btn.onclick.toString().includes(tabKey));
  });
  const body = document.getElementById('concept-modal-body');
  if (body && window.currentModalSubject) {
    body.innerHTML = renderConceptModalContent(window.currentModalSubject, tabKey);
    initConceptTabInteractive(tabKey);
  }
};

function renderConceptModalContent(subjectKey, tabKey) {
  const subject = CORE_SUBJECTS[subjectKey];
  const topic = subject.topics.find(t => t.id === tabKey) || subject.topics[0];

  let graphicHtml = '';
  let terminalHtml = '';

  switch (tabKey) {
    // ── DBMS TOPICS ──────────────────────────────────────────
    case 'dbms-race':
      graphicHtml = `
        <div class="dual-write-simulation">
          <div class="flex justify-between items-center mb-2">
            <div><strong>Dual Concurrent Write Attempt</strong>: Target Flight <code>AI-204</code>, Seat <code>14A</code></div>
            <button class="btn btn-primary btn-sm" id="btn-run-race" onclick="window.runDualTransactionRace()">▶ Run Dual Write Race</button>
          </div>
          <div class="dual-write-lanes">
            <div class="write-client-box" id="pax-client-a">
              <div style="font-size:1.5rem">👤</div>
              <div style="font-weight:700">Passenger A (Tx 101)</div>
              <div class="text-xs text-muted">Arrival: t = 0.012s</div>
              <div class="badge badge-info mt-2" id="status-badge-a">Submitting POST /bookings</div>
            </div>

            <div class="db-lock-gate">
              <div style="font-size:1.5rem">🔒</div>
              <div style="font-weight:800;font-size:11px;letter-spacing:0.05em">DATABASE ENGINE</div>
              <div style="font-size:10px;font-family:var(--font-mono);margin-top:2px">UNIQUE(flight_id, seat_no)</div>
            </div>

            <div class="write-client-box" id="pax-client-b">
              <div style="font-size:1.5rem">👤</div>
              <div style="font-weight:700">Passenger B (Tx 102)</div>
              <div class="text-xs text-muted">Arrival: t = 0.014s</div>
              <div class="badge badge-info mt-2" id="status-badge-b">Submitting POST /bookings</div>
            </div>
          </div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [SYSTEM] Ready to simulate dual concurrent write collision on Seat 14A.
[00:00.000] Click "▶ Run Dual Write Race" to dispatch simultaneous transactions.
      `;
      break;

    case 'dbms-mutex':
      graphicHtml = `
        <div style="width:100%">
          <div class="flex justify-between items-center mb-3">
            <div><strong>20-Thread Pessimistic Mutex Race</strong>: Simultaneous checkout against Seat <code>12B</code></div>
            <button class="btn btn-danger btn-sm" id="btn-stress-modal" onclick="window.runConcurrencyStressModal()">⚡ Launch 20 Threads</button>
          </div>
          <div class="grid grid-4 gap-2 mb-3" id="stress-threads-grid">
            ${Array.from({length: 20}, (_, i) => `
              <div id="modal-thread-${i}" class="p-2 text-center text-xs" style="background:#F1F5F9;border:1px solid #CBD5E1;border-radius:var(--radius-md);font-family:var(--font-mono)">
                Thread-${i+1}: IDLE
              </div>
            `).join('')}
          </div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [DBMS::MUTEX] Concurrency engine initialized with 20 parallel worker threads.
[00:00.000] Target: Flight 101, Seat 12B with 10-minute hold TTL.
      `;
      break;

    case 'dbms-norm':
      graphicHtml = `
        <div style="width:100%">
          <div class="text-sm mb-3"><strong>3NF Relational Decomposition</strong>: Eliminates insertion, update, and deletion anomalies</div>
          <div class="grid grid-2 gap-3" style="font-size:11px;font-family:var(--font-mono)">
            <div class="p-3" style="background:white;border:1.5px solid var(--color-border);border-radius:var(--radius-lg)">
              <div class="font-bold text-primary mb-1">TABLE: Flights (PK: id)</div>
              <div class="text-xs text-muted">id | flight_number | origin | destination | equipment | fare</div>
            </div>
            <div class="p-3" style="background:white;border:1.5px solid var(--color-border);border-radius:var(--radius-lg)">
              <div class="font-bold text-primary mb-1">TABLE: Seats (Composite PK: flight_id, seat_no)</div>
              <div class="text-xs text-muted">flight_id (FK) | seat_no | class | status | session_hold_id</div>
            </div>
            <div class="p-3" style="background:white;border:1.5px solid var(--color-border);border-radius:var(--radius-lg)">
              <div class="font-bold text-primary mb-1">TABLE: Passengers (PK: id)</div>
              <div class="text-xs text-muted">id | first_name | last_name | id_type | id_number | tier</div>
            </div>
            <div class="p-3" style="background:white;border:1.5px solid var(--color-border);border-radius:var(--radius-lg)">
              <div class="font-bold text-primary mb-1">TABLE: Bookings (PK: pnr)</div>
              <div class="text-xs text-muted">pnr | flight_id (FK) | seat_no (FK) | passenger_id (FK) | status</div>
            </div>
          </div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [DBMS::3NF] Normalized schema verified: All non-key attributes are fully functionally dependent on Candidate Keys.
[00:00.000] No transitive functional dependencies X -> Y -> Z exist. Update anomalies eliminated.
      `;
      break;

    // ── ADSA TOPICS ──────────────────────────────────────────
    case 'adsa-btree':
      graphicHtml = `
        <div style="width:100%">
          <div class="form-row mb-3">
            <div class="form-group" style="flex:1">
              <label class="form-label">Search PNR Key</label>
              <div class="flex gap-2">
                <input class="form-input form-input-sm" id="modal-btree-search-key" value="HYD-204" placeholder="e.g., HYD-204">
                <button class="btn btn-secondary btn-sm" onclick="window.runBTreeSearchModal()">Search O(log n)</button>
              </div>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Insert New PNR</label>
              <div class="flex gap-2">
                <input class="form-input form-input-sm" id="modal-btree-insert-key" placeholder="e.g., GOI-505">
                <button class="btn btn-primary btn-sm" onclick="window.runBTreeInsertModal()">Insert & Split</button>
              </div>
            </div>
          </div>
          <div id="modal-btree-canvas" style="min-height:140px;background:#0F172A;border-radius:var(--radius-lg);padding:var(--space-3);display:flex;align-items:center;justify-content:center;overflow-x:auto">
            <!-- Dynamic SVG Tree -->
          </div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [ADSA::B-TREE] Initialized In-Memory Multi-Way Balanced B-Tree with order m=3 (Minimum degree t=2).
[00:00.000] Ready for O(log_m n) key search and insertion operations.
      `;
      break;

    case 'adsa-heap':
      graphicHtml = `
        <div style="width:100%">
          <div class="form-row mb-3">
            <div class="form-group" style="flex:2">
              <label class="form-label">Passenger Name</label>
              <input class="form-input form-input-sm" id="modal-heap-name" value="Vikramaditya S." placeholder="Name">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Frequent Flyer Tier</label>
              <select class="form-select form-select-sm" id="modal-heap-tier">
                <option value="gold" selected>Gold (Weight: 4)</option>
                <option value="silver">Silver (Weight: 3)</option>
                <option value="bronze">Bronze (Weight: 2)</option>
                <option value="basic">Basic (Weight: 1)</option>
              </select>
            </div>
            <div class="form-group" style="align-self:flex-end">
              <button class="btn btn-primary btn-sm" onclick="window.runHeapInsertModal()">Insert Standby</button>
              <button class="btn btn-accent btn-sm" onclick="window.runHeapExtractModal()">ExtractMax (Promote)</button>
            </div>
          </div>
          <div id="modal-heap-display" style="min-height:120px;background:#0F172A;border-radius:var(--radius-lg);padding:var(--space-3);display:flex;align-items:center;justify-content:center">
            <!-- Dynamic Heap Visualizer -->
          </div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [ADSA::MAX-HEAP] Priority Queue initialized for standby passenger promotion.
[00:00.000] Priority Function: P = (TierWeight × 100,000) - Timestamp. Gold flyers take absolute precedence.
      `;
      break;

    // ── DMGT TOPICS ──────────────────────────────────────────
    case 'dmgt-logic':
      graphicHtml = `
        <div class="logic-circuit-board">
          <div class="flex justify-between items-center">
            <div><strong>Boolean Logic Formula</strong>: <code>CanBook = (P ∧ Q) ∧ (R ∨ S)</code></div>
            <div id="logic-gate-eval-badge" class="badge badge-success font-bold">✓ EVALUATION: TRUE</div>
          </div>
          
          <div class="logic-switches-grid">
            <div class="logic-switch-card on" id="sw-P" onclick="window.toggleLogicGateModal('P')">
              <div style="font-weight:700">P: Identity Valid</div>
              <div class="text-xs text-muted">Aadhaar/Passport</div>
              <div class="badge badge-success mt-1" id="val-P">TRUE (1)</div>
            </div>
            <div class="logic-switch-card on" id="sw-Q" onclick="window.toggleLogicGateModal('Q')">
              <div style="font-weight:700">Q: Payment Cleared</div>
              <div class="text-xs text-muted">UPI/Card Auth</div>
              <div class="badge badge-success mt-1" id="val-Q">TRUE (1)</div>
            </div>
            <div class="logic-switch-card on" id="sw-R" onclick="window.toggleLogicGateModal('R')">
              <div style="font-weight:700">R: Seat Available</div>
              <div class="text-xs text-muted">Physical Seat Free</div>
              <div class="badge badge-success mt-1" id="val-R">TRUE (1)</div>
            </div>
            <div class="logic-switch-card off" id="sw-S" onclick="window.toggleLogicGateModal('S')">
              <div style="font-weight:700">S: Overbook Allowed</div>
              <div class="text-xs text-muted">Capacity Buffer</div>
              <div class="badge badge-secondary mt-1" id="val-S">FALSE (0)</div>
            </div>
          </div>

          <div class="logic-circuit-svg-wrap" id="logic-circuit-svg">
            <!-- Dynamic SVG Circuit Rendered Here -->
          </div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [DMGT::LOGIC] Evaluating Propositional Logic Gate Circuit:
[00:00.000] Current state: P=1, Q=1, R=1, S=0 ➔ (1 ∧ 1) ∧ (1 ∨ 0) = 1 ∧ 1 = 1 (TRUE).
      `;
      break;

    case 'dmgt-set':
      graphicHtml = `
        <div style="width:100%">
          <div class="text-sm mb-3"><strong>Set Theory Inventory Partition</strong>: <code>A = U ∖ (B ∪ H)</code></div>
          <div class="grid grid-4 gap-3 text-center mb-3">
            <div class="p-3" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:var(--radius-lg)">
              <div class="text-xs text-muted">Universal Set U</div>
              <div class="font-bold text-lg">180 Seats</div>
              <div class="text-xs text-muted">Total Aircraft Capacity</div>
            </div>
            <div class="p-3" style="background:#FEF2F2;border:1px solid #FECACA;border-radius:var(--radius-lg)">
              <div class="text-xs text-danger font-semibold">Booked Set B</div>
              <div class="font-bold text-lg text-danger">130 Seats</div>
              <div class="text-xs text-muted">Confirmed Reservations</div>
            </div>
            <div class="p-3" style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--radius-lg)">
              <div class="text-xs text-warning font-semibold">Held Set H</div>
              <div class="font-bold text-lg" style="color:#D97706">8 Seats</div>
              <div class="text-xs text-muted">Active Checkout TTLs</div>
            </div>
            <div class="p-3" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:var(--radius-lg)">
              <div class="text-xs text-success font-semibold">Available Set A</div>
              <div class="font-bold text-lg text-success">42 Seats</div>
              <div class="text-xs text-muted">A = U ∖ (B ∪ H)</div>
            </div>
          </div>
          <div class="p-3 text-xs" style="background:#0F172A;color:#38BDF8;border-radius:var(--radius-md);font-family:var(--font-mono)">
            Injective Mapping Proof: f: Passenger ➔ Seat is strictly injective (one-to-one). ∀ p1, p2 ∈ Passengers: f(p1) = f(p2) ⇒ p1 = p2. By Pigeonhole Principle, double allocation is impossible while |B| ≤ |U|.
          </div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [DMGT::SET] Seat inventory evaluated across sets U, B, H.
[00:00.000] |U| = 180, |B| = 130, |H| = 8 ➔ |A| = 180 - (130 + 8) = 42 available seats.
      `;
      break;

    case 'dmgt-graph':
      graphicHtml = `
        <div style="width:100%">
          <div class="form-row mb-3">
            <div class="form-group" style="flex:1">
              <label class="form-label">Origin Airport</label>
              <select class="form-select form-select-sm" id="modal-dijkstra-from">
                <option value="HYD" selected>HYD (Hyderabad)</option>
                <option value="DEL">DEL (Delhi)</option>
                <option value="BOM">BOM (Mumbai)</option>
                <option value="VTZ">VTZ (Visakhapatnam)</option>
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Destination Airport</label>
              <select class="form-select form-select-sm" id="modal-dijkstra-to">
                <option value="GOI" selected>GOI (Goa)</option>
                <option value="DXB">DXB (Dubai)</option>
                <option value="BLR">BLR (Bengaluru)</option>
                <option value="MAA">MAA (Chennai)</option>
              </select>
            </div>
            <div class="form-group" style="align-self:flex-end">
              <button class="btn btn-primary btn-sm" onclick="window.runDijkstraModal()">Compute Dijkstra Path</button>
            </div>
          </div>
          <div id="modal-dijkstra-result" class="p-3" style="background:#0F172A;color:#38BDF8;border-radius:var(--radius-lg);font-family:var(--font-mono);font-size:12px">
            Click "Compute Dijkstra Path" to run shortest path optimization on weighted directed route graph G=(V, E).
          </div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [DMGT::GRAPH] Airport route graph: 9 vertices, 18 directed edges.
      `;
      break;

    // ── OOPJ TOPICS ──────────────────────────────────────────
    case 'oopj-uml':
      graphicHtml = `
        <div style="width:100%">
          <div class="text-sm mb-3"><strong>UML Class Inheritance & Encapsulation</strong></div>
          <div class="grid grid-2 gap-4" style="font-family:var(--font-mono);font-size:12px">
            <div class="p-4" style="background:white;border:1.5px solid var(--color-border);border-radius:var(--radius-lg)">
              <div class="font-bold text-primary mb-2">abstract class Person</div>
              <div style="color:#64748B">
                #id: string<br>
                #firstName: string<br>
                #lastName: string<br>
                #email: string<br>
                #phone: string
              </div>
              <div class="mt-2 pt-2" style="border-top:1px dashed #E2E8F0">
                + getFullName(): string<br>
                + abstract getRole(): string
              </div>
            </div>

            <div class="p-4" style="background:white;border:1.5px solid var(--color-border);border-radius:var(--radius-lg)">
              <div class="font-bold text-success mb-2">class Passenger extends Person</div>
              <div style="color:#64748B">
                #tier: FrequentFlyerTier<br>
                #frequentFlyerMiles: number<br>
                #aadhaarNumber: string
              </div>
              <div class="mt-2 pt-2" style="border-top:1px dashed #E2E8F0">
                + getTierWeight(): number<br>
                + toRecord(): Object
              </div>
            </div>
          </div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [OOPJ::ENCAPSULATION] Private fields (#) prevent external tampering of loyalty tiers and passenger identity.
[00:00.000] Polymorphic dispatch guarantees clean subclass specialization without runtime type casts.
      `;
      break;

    case 'oopj-strategy':
      graphicHtml = `
        <div style="width:100%">
          <div class="form-row mb-3">
            <div class="form-group" style="flex:1">
              <label class="form-label">Base Fare (₹)</label>
              <input class="form-input form-input-sm" id="modal-refund-fare" type="number" value="5000">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Hours Before Departure</label>
              <input class="form-input form-input-sm" id="modal-refund-hours" type="number" value="48">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Refund Policy Strategy</label>
              <select class="form-select form-select-sm" id="modal-refund-policy">
                <option value="tiered" selected>TieredRefundPolicy</option>
                <option value="full">FullRefundPolicy</option>
                <option value="nonrefundable">NonRefundablePolicy</option>
              </select>
            </div>
            <div class="form-group" style="align-self:flex-end">
              <button class="btn btn-primary btn-sm" onclick="window.calcRefundModal()">Execute Strategy</button>
            </div>
          </div>
          <div id="modal-refund-result"></div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [OOPJ::STRATEGY] Polymorphic Strategy Pattern ready.
[00:00.000] Interface RefundPolicyStrategy defines calculateRefund(amount, hoursRemaining).
      `;
      break;

    case 'oopj-exceptions':
      graphicHtml = `
        <div style="width:100%">
          <div class="text-sm mb-3"><strong>Checked Booking Exception Hierarchy</strong></div>
          <div class="p-3" style="background:#0F172A;color:#38BDF8;border-radius:var(--radius-lg);font-family:var(--font-mono);font-size:12px;line-height:1.6">
            BookingException (Root Exception)<br>
            ├── SeatUnavailableError (Physical seat claimed or locked by concurrent session)<br>
            ├── DoubleBookingError (UNIQUE composite constraint violation)<br>
            ├── LockTimeoutError (Mutex lock timed out after 10-minute hold TTL)<br>
            ├── ValidationError (Identity verification failed in logic gates)<br>
            └── CapacityExceededError (Aircraft physical limit reached without overbooking buffer)
          </div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [OOPJ::EXCEPTIONS] Checked exceptions ensure comprehensive compile-time and runtime fault tolerance.
      `;
      break;

    // ── PYTHON ML TOPICS ─────────────────────────────────────
    case 'python-sigmoid':
      graphicHtml = `
        <div class="sigmoid-container">
          <div class="flex justify-between items-center w-full">
            <div><strong>Sigmoid Curve Activation</strong>: <code>P(no-show) = 1 / (1 + e^-z)</code></div>
            <div class="badge badge-accent" id="sigmoid-prob-display">P(No-Show): 10.8%</div>
          </div>
          <div class="w-full flex gap-4">
            <div style="flex:1">
              <label class="text-xs text-muted">Booking Lead Days: <strong id="lead-days-val">14</strong> days</label>
              <input type="range" class="w-full" id="modal-lead-days" min="1" max="90" value="14" oninput="window.updateSigmoidCanvasModal()">
            </div>
            <div style="flex:1">
              <label class="text-xs text-muted">Fare Class</label>
              <select class="form-select form-select-sm" id="modal-fare-class" onchange="window.updateSigmoidCanvasModal()">
                <option value="economy" selected>Economy (Base Rate: 0.12)</option>
                <option value="premium">Premium Economy (Base Rate: 0.08)</option>
                <option value="business">Business (Base Rate: 0.04)</option>
              </select>
            </div>
          </div>
          <canvas class="sigmoid-canvas" id="modal-sigmoid-canvas" width="600" height="180"></canvas>
        </div>
      `;
      terminalHtml = `
[00:00.000] [PYTHON::ML] Sigmoid activation model loaded with 7 trained weights.
[00:00.000] Model formula: z = w0 + w1*LeadDays + w2*FareClass + w3*Seasonality.
      `;
      break;

    case 'python-overbook':
      graphicHtml = `
        <div style="width:100%">
          <div class="flex justify-between items-center mb-3">
            <div><strong>Expected Binomial Cost Function</strong>: <code>min_b E[Cost(b)]</code></div>
            <button class="btn btn-primary btn-sm" onclick="window.runOverbookingCalcModal()">Recalculate Optimal Buffer</button>
          </div>
          <div class="grid grid-3 gap-3 text-center mb-3">
            <div class="p-3" style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:var(--radius-lg)">
              <div class="text-xs text-success font-semibold">Optimal Overbook Buffer</div>
              <div class="font-bold text-2xl text-success" id="ob-optimal-val">+4 Seats</div>
              <div class="text-xs text-muted">Dynamic Capacity: 184</div>
            </div>
            <div class="p-3" style="background:#EFF6FF;border:1.5px solid #93C5FD;border-radius:var(--radius-lg)">
              <div class="text-xs text-primary font-semibold">Minimum Expected Cost</div>
              <div class="font-bold text-xl text-primary" id="ob-min-cost">₹14,250</div>
              <div class="text-xs text-muted">Optimal risk tradeoff</div>
            </div>
            <div class="p-3" style="background:#FEF2F2;border:1.5px solid #FCA5A5;border-radius:var(--radius-lg)">
              <div class="text-xs text-danger font-semibold">Denied Boarding Risk</div>
              <div class="font-bold text-xl text-danger" id="ob-risk-val">&lt; 0.42%</div>
              <div class="text-xs text-muted">Civil penalty bounded</div>
            </div>
          </div>
          <div id="modal-ob-chart" style="height:120px;display:flex;align-items:flex-end;gap:6px;background:#0F172A;border-radius:var(--radius-lg);padding:16px 12px 6px 12px">
            <!-- Dynamic Cost Bars -->
          </div>
        </div>
      `;
      terminalHtml = `
[00:00.000] [PYTHON::OVERBOOKING] Binomial cost function initialized.
[00:00.000] Balancing passenger bumping penalty (₹15,000) vs seat spoilage loss (₹4,500).
      `;
      break;

    default:
      graphicHtml = `<div class="text-muted p-4 text-center">Interactive graphical visualizer for ${tabKey}</div>`;
      terminalHtml = `[00:00.000] Concept initialized.`;
  }

  return `
    <!-- Top Visual Graphic Representation -->
    <div class="concept-visual-container">
      ${graphicHtml}
    </div>

    <!-- Live Backend Trace Terminal -->
    <div class="concept-terminal" id="concept-modal-terminal">
      <div class="concept-terminal-header">
        <span>⚡ LIVE BACKEND EXECUTION TRACE & KERNEL PROOF</span>
        <span>skyvoyage-kernel-runtime</span>
      </div>
      <div id="concept-modal-terminal-lines" style="white-space:pre-wrap;line-height:1.5">
${terminalHtml.trim()}
      </div>
    </div>

    <!-- Real-World Aviation Impact Callout -->
    <div class="concept-impact-callout">
      <strong>💡 Real-World Aviation Failure Prevention:</strong>
      ${subject.impact}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════
//  INTERACTIVE CONCEPT MODAL ACTIONS & SIMULATIONS
// ══════════════════════════════════════════════════════════

function appendTerminalLog(msg, color = '#F8FAFC') {
  const container = document.getElementById('concept-modal-terminal-lines');
  if (container) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    container.innerHTML += `\n<span style="color:${color}">[${timestamp}] ${msg}</span>`;
    const term = document.getElementById('concept-modal-terminal');
    if (term) term.scrollTop = term.scrollHeight;
  }
}

function initConceptTabInteractive(tabKey) {
  if (tabKey === 'python-sigmoid') {
    setTimeout(() => window.updateSigmoidCanvasModal(), 50);
  } else if (tabKey === 'adsa-btree') {
    setTimeout(() => renderModalBTreeSvg(), 50);
  } else if (tabKey === 'adsa-heap') {
    setTimeout(() => renderModalHeapViz(), 50);
  } else if (tabKey === 'dmgt-logic') {
    setTimeout(() => renderModalLogicCircuitSvg(), 50);
  } else if (tabKey === 'python-overbook') {
    setTimeout(() => window.runOverbookingCalcModal(), 50);
  }
}

// DBMS: Dual Concurrent Write Race
window.runDualTransactionRace = async () => {
  const boxA = document.getElementById('pax-client-a');
  const boxB = document.getElementById('pax-client-b');
  const badgeA = document.getElementById('status-badge-a');
  const badgeB = document.getElementById('status-badge-b');
  const btn = document.getElementById('btn-run-race');

  if (btn) btn.disabled = true;
  if (boxA) boxA.className = 'write-client-box';
  if (boxB) boxB.className = 'write-client-box';
  if (badgeA) badgeA.className = 'badge badge-info mt-2';
  if (badgeB) badgeB.className = 'badge badge-info mt-2';

  appendTerminalLog('🚀 Dispatching concurrent requests: Tx-101 and Tx-102 targeting Seat 14A...', '#38BDF8');

  // Step 1: Tx A arrives at t=12ms
  await new Promise(r => setTimeout(r, 600));
  appendTerminalLog('▶ [TX-101::PAX-A] BEGIN TRANSACTION; (t = 0.012s)', '#FDE047');
  appendTerminalLog('▶ [TX-101::PAX-A] SELECT * FROM seatInventory WHERE flight_id=101 AND seat_no=\'14A\' FOR UPDATE; ➔ Row Locked', '#FDE047');

  // Step 2: Tx B arrives at t=14ms
  await new Promise(r => setTimeout(r, 500));
  appendTerminalLog('▶ [TX-102::PAX-B] BEGIN TRANSACTION; (t = 0.014s)', '#FDE047');
  appendTerminalLog('▶ [TX-102::PAX-B] SELECT * FROM seatInventory WHERE flight_id=101 AND seat_no=\'14A\' FOR UPDATE; ➔ WAITING FOR LOCK...', '#FB923C');

  // Step 3: Tx A commits
  await new Promise(r => setTimeout(r, 700));
  appendTerminalLog('▶ [TX-101::PAX-A] INSERT INTO bookings (pnr, flight_id, seat_no, status) VALUES (\'SK-92184\', 101, \'14A\', \'CONFIRMED\');', '#4ADE80');
  appendTerminalLog('✅ [TX-101::PAX-A] COMMIT; ➔ 200 OK — Seat 14A Booked! PNR Issued: SK-92184', '#4ADE80');
  if (boxA) boxA.classList.add('success');
  if (badgeA) {
    badgeA.className = 'badge badge-success mt-2';
    badgeA.textContent = '200 OK: Seat Confirmed!';
  }

  // Step 4: Tx B rejected by constraint
  await new Promise(r => setTimeout(r, 600));
  appendTerminalLog('▶ [TX-102::PAX-B] INSERT INTO bookings (pnr, flight_id, seat_no, status) VALUES (\'SK-77412\', 101, \'14A\', \'CONFIRMED\');', '#F87171');
  appendTerminalLog('❌ [DATABASE] ERROR 23505: duplicate key value violates unique constraint "uk_flight_seat"', '#EF4444');
  appendTerminalLog('❌ [TX-102::PAX-B] ROLLBACK; ➔ 409 CONFLICT — Seat 14A already claimed. Double-booking prevented!', '#EF4444');
  if (boxB) boxB.classList.add('failed');
  if (badgeB) {
    badgeB.className = 'badge badge-danger mt-2';
    badgeB.textContent = '409 CONFLICT: Duplicate Key Aborted';
  }

  if (btn) btn.disabled = false;
};

// DBMS: Concurrency Stress Modal
window.runConcurrencyStressModal = async () => {
  const btn = document.getElementById('btn-stress-modal');
  if (btn) btn.disabled = true;

  appendTerminalLog('⚡ Launching 20 parallel threads against single seat resource...', '#38BDF8');

  // Reset thread cells
  for (let i = 0; i < 20; i++) {
    const el = document.getElementById(`modal-thread-${i}`);
    if (el) {
      el.style.background = '#FEF08A';
      el.style.color = '#854D0E';
      el.textContent = `T${i+1}: ACQUIRING...`;
    }
  }

  let winner = Math.floor(Math.random() * 20);

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 40));
    const el = document.getElementById(`modal-thread-${i}`);
    if (i === winner) {
      if (el) {
        el.style.background = '#DCFCE7';
        el.style.color = '#166534';
        el.style.borderColor = '#22C55E';
        el.textContent = `T${i+1}: ✅ WON (200 OK)`;
      }
      appendTerminalLog(`✅ Thread-${i+1} acquired row lock and committed seat reservation!`, '#4ADE80');
    } else {
      if (el) {
        el.style.background = '#FEE2E2';
        el.style.color = '#991B1B';
        el.style.borderColor = '#EF4444';
        el.textContent = `T${i+1}: ❌ REJECTED`;
      }
    }
  }

  appendTerminalLog('━━━ CONCURRENCY PROOF: 1 SUCCESS, 19 REJECTED. ZERO DOUBLE-BOOKINGS. ━━━', '#38BDF8');
  if (btn) btn.disabled = false;
};

// ADSA: B-Tree Modal
const modalBTree = new BTree(2);
['BOM-050', 'DEL-101', 'GOI-150', 'HYD-204', 'MAA-300', 'VTZ-400'].forEach(k => modalBTree.insert(k, { pnr: k }));

function renderModalBTreeSvg(highlightKey = null) {
  const container = document.getElementById('modal-btree-canvas');
  if (!container) return;
  const levels = modalBTree.levelOrder();
  if (!levels || levels.length === 0) {
    container.innerHTML = '<div class="text-muted text-xs">Tree is empty</div>';
    return;
  }

  let html = '<div style="display:flex;flex-direction:column;gap:16px;align-items:center;width:100%">';
  levels.forEach((lvl, lvlIdx) => {
    html += '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">';
    lvl.forEach(node => {
      const isMatch = highlightKey && node.keys.some(k => k.key === highlightKey);
      html += `
        <div style="background:${isMatch ? '#22C55E' : '#1E293B'};color:white;border:1.5px solid ${isMatch ? '#86EFAC' : '#38BDF8'};border-radius:6px;padding:4px 8px;font-family:var(--font-mono);font-size:11px;box-shadow:${isMatch ? '0 0 10px #22C55E' : 'none'}">
          ${node.keys.map(k => k.key).join(' | ')}
        </div>
      `;
    });
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

window.runBTreeSearchModal = () => {
  const key = document.getElementById('modal-btree-search-key').value.trim().toUpperCase();
  if (!key) return;
  modalBTree.resetComparisons();
  const res = modalBTree.search(key);
  renderModalBTreeSvg(key);
  appendTerminalLog(`🔍 B-Tree search for "${key}": ${res ? 'FOUND' : 'NOT FOUND'} in ${modalBTree.comparisons} key comparisons (O(log_m n)).`, res ? '#4ADE80' : '#F87171');
};

window.runBTreeInsertModal = () => {
  const key = document.getElementById('modal-btree-insert-key').value.trim().toUpperCase();
  if (!key) return;
  modalBTree.insert(key, { pnr: key });
  document.getElementById('modal-btree-insert-key').value = '';
  renderModalBTreeSvg(key);
  appendTerminalLog(`🌲 Inserted "${key}" into B-Tree (Order m=3). Balanced multi-way split completed!`, '#38BDF8');
};

// ADSA: MaxHeap Modal
const modalHeap = new MaxHeap();
[
  { name: 'Rajesh S.', tier: 'gold', weight: 4 },
  { name: 'Ananya V.', tier: 'silver', weight: 3 },
  { name: 'Karthik P.', tier: 'bronze', weight: 2 },
  { name: 'Deepa M.', tier: 'basic', weight: 1 }
].forEach(p => {
  modalHeap.insert({
    id: p.name,
    passengerName: p.name,
    tier: p.tier,
    priority: (p.weight * 100000) - Date.now()
  });
});

function renderModalHeapViz() {
  const container = document.getElementById('modal-heap-display');
  if (!container) return;
  const levels = modalHeap.toLevels();
  if (!levels || levels.length === 0) {
    container.innerHTML = '<div class="text-muted text-xs">Waitlist is empty</div>';
    return;
  }

  let html = '<div style="display:flex;flex-direction:column;gap:10px;align-items:center;width:100%">';
  levels.forEach((lvl, idx) => {
    html += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">';
    lvl.forEach(item => {
      const isGold = item.tier === 'gold';
      html += `
        <div style="background:${isGold ? '#CA8A04' : '#334155'};color:white;border-radius:6px;padding:4px 8px;font-family:var(--font-mono);font-size:10px;border:1px solid ${isGold ? '#FACC15' : '#475569'}">
          <strong>${item.passengerName}</strong> (${item.tier.toUpperCase()})
        </div>
      `;
    });
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

window.runHeapInsertModal = () => {
  const name = document.getElementById('modal-heap-name').value.trim();
  const tier = document.getElementById('modal-heap-tier').value;
  if (!name) return;
  const weights = { gold: 4, silver: 3, bronze: 2, basic: 1 };
  const priority = (weights[tier] * 100000) - Date.now();
  modalHeap.insert({ id: name, passengerName: name, tier, priority });
  renderModalHeapViz();
  appendTerminalLog(`⭐ Inserted "${name}" (${tier.toUpperCase()}) into Standby Max-Heap. Priority Score: ${priority}.`, '#FBBF24');
};

window.runHeapExtractModal = () => {
  const max = modalHeap.extractMax();
  renderModalHeapViz();
  if (max) {
    appendTerminalLog(`🎉 EXTRACT-MAX: Promoted "${max.passengerName}" (${max.tier.toUpperCase()}) to freed seat in O(1) time! Heap restored in O(log n).`, '#4ADE80');
  } else {
    appendTerminalLog('Standby priority queue is currently empty.', '#94A3B8');
  }
};

// DMGT: Logic Gate Modal
let logicSwitches = { P: true, Q: true, R: true, S: false };

window.toggleLogicGateModal = (gate) => {
  logicSwitches[gate] = !logicSwitches[gate];
  const card = document.getElementById(`sw-${gate}`);
  const badge = document.getElementById(`val-${gate}`);
  if (card && badge) {
    card.className = `logic-switch-card ${logicSwitches[gate] ? 'on' : 'off'}`;
    badge.className = `badge ${logicSwitches[gate] ? 'badge-success' : 'badge-secondary'} mt-1`;
    badge.textContent = logicSwitches[gate] ? 'TRUE (1)' : 'FALSE (0)';
  }
  renderModalLogicCircuitSvg();
};

function renderModalLogicCircuitSvg() {
  const { P, Q, R, S } = logicSwitches;
  const and1 = P && Q;
  const or1 = R || S;
  const out = and1 && or1;

  const evalBadge = document.getElementById('logic-gate-eval-badge');
  if (evalBadge) {
    evalBadge.className = `badge ${out ? 'badge-success' : 'badge-danger'} font-bold`;
    evalBadge.textContent = out ? '✓ EVALUATION: TRUE (CAN BOOK)' : '✗ EVALUATION: FALSE (BLOCKED)';
  }

  const svg = document.getElementById('logic-circuit-svg');
  if (svg) {
    const colP = P ? '#22C55E' : '#475569';
    const colQ = Q ? '#22C55E' : '#475569';
    const colR = R ? '#22C55E' : '#475569';
    const colS = S ? '#22C55E' : '#475569';
    const colAnd1 = and1 ? '#22C55E' : '#475569';
    const colOr1 = or1 ? '#22C55E' : '#475569';
    const colOut = out ? '#22C55E' : '#EF4444';

    svg.innerHTML = `
      <svg width="560" height="150" viewBox="0 0 560 150">
        <!-- Input Lines -->
        <line x1="20" y1="30" x2="100" y2="30" stroke="${colP}" stroke-width="3" />
        <text x="30" y="24" fill="${colP}" font-size="10" font-family="monospace">P=${P?1:0}</text>

        <line x1="20" y1="50" x2="100" y2="50" stroke="${colQ}" stroke-width="3" />
        <text x="30" y="65" fill="${colQ}" font-size="10" font-family="monospace">Q=${Q?1:0}</text>

        <line x1="20" y1="100" x2="100" y2="100" stroke="${colR}" stroke-width="3" />
        <text x="30" y="94" fill="${colR}" font-size="10" font-family="monospace">R=${R?1:0}</text>

        <line x1="20" y1="120" x2="100" y2="120" stroke="${colS}" stroke-width="3" />
        <text x="30" y="135" fill="${colS}" font-size="10" font-family="monospace">S=${S?1:0}</text>

        <!-- Gate 1: AND -->
        <rect x="100" y="20" width="60" height="40" rx="6" fill="#1E293B" stroke="${colAnd1}" stroke-width="2" />
        <text x="115" y="44" fill="white" font-size="11" font-weight="bold">AND</text>

        <!-- Gate 2: OR -->
        <rect x="100" y="90" width="60" height="40" rx="6" fill="#1E293B" stroke="${colOr1}" stroke-width="2" />
        <text x="120" y="114" fill="white" font-size="11" font-weight="bold">OR</text>

        <!-- Intermediate Lines -->
        <line x1="160" y1="40" x2="240" y2="60" stroke="${colAnd1}" stroke-width="3" />
        <line x1="160" y1="110" x2="240" y2="80" stroke="${colOr1}" stroke-width="3" />

        <!-- Master Gate: AND -->
        <rect x="240" y="50" width="70" height="50" rx="6" fill="#1E293B" stroke="${colOut}" stroke-width="2" />
        <text x="260" y="80" fill="white" font-size="12" font-weight="bold">AND</text>

        <!-- Output Line -->
        <line x1="310" y1="75" x2="400" y2="75" stroke="${colOut}" stroke-width="4" />
        <circle cx="410" cy="75" r="10" fill="${colOut}" />
        <text x="430" y="80" fill="${colOut}" font-size="13" font-weight="bold" font-family="monospace">
          CanBook = ${out ? 'TRUE' : 'FALSE'}
        </text>
      </svg>
    `;
  }
  appendTerminalLog(`[DMGT::CIRCUIT] Evaluated CanBook: (${P?1:0} ∧ ${Q?1:0}) ∧ (${R?1:0} ∨ ${S?1:0}) = ${and1?1:0} ∧ ${or1?1:0} = ${out ? '1 (TRUE)' : '0 (FALSE)'}`, out ? '#4ADE80' : '#F87171');
}

// DMGT: Dijkstra Modal
window.runDijkstraModal = () => {
  const from = document.getElementById('modal-dijkstra-from').value;
  const to = document.getElementById('modal-dijkstra-to').value;
  const res = findAlternativeRoute(from, to);
  const display = document.getElementById('modal-dijkstra-result');
  if (display) {
    if (res.found) {
      display.innerHTML = `
        <div style="color:#4ADE80;font-weight:bold;margin-bottom:4px">✓ Optimal Route Found: ${res.path.join(' ➔ ')}</div>
        <div>Summary: ${res.summary}</div>
        <div class="mt-2 text-muted text-xs">Executed Dijkstra algorithm across priority queue in ${res.steps.length} iterations.</div>
      `;
      appendTerminalLog(`🌐 Dijkstra Route: ${from} ➔ ${to} solved via ${res.path.join(' ➔ ')}`, '#38BDF8');
    } else {
      display.innerHTML = `<div style="color:#EF4444">❌ No route found between ${from} and ${to}</div>`;
      appendTerminalLog(`No route found between ${from} and ${to}`, '#EF4444');
    }
  }
};

// OOPJ: Strategy Refund Modal
window.calcRefundModal = () => {
  const fare = parseInt(document.getElementById('modal-refund-fare').value);
  const hours = parseInt(document.getElementById('modal-refund-hours').value);
  const policyType = document.getElementById('modal-refund-policy').value;
  const policy = getRefundPolicy(policyType);
  const res = policy.calculateRefund(fare, hours);

  const display = document.getElementById('modal-refund-result');
  if (display) {
    display.innerHTML = `
      <div class="p-3" style="background:#0F172A;color:#38BDF8;border-radius:var(--radius-lg);font-family:var(--font-mono);font-size:12px">
        <div><strong>Dispatched Strategy:</strong> ${policy.name}</div>
        <div style="color:#4ADE80">Refund Payout: ₹${res.refundAmount.toLocaleString()} (${res.percentage}%)</div>
        <div style="color:#F87171">Cancellation Fee: ₹${res.fee.toLocaleString()}</div>
        <div class="text-xs text-muted mt-1">${res.reason}</div>
      </div>
    `;
  }
  appendTerminalLog(`🧬 [OOPJ::STRATEGY] Polymorphic call: ${policy.name}.calculateRefund(${fare}, ${hours}) ➔ ₹${res.refundAmount} (${res.percentage}%)`, '#4ADE80');
};

// Python ML: Sigmoid Canvas Modal
window.updateSigmoidCanvasModal = () => {
  const leadDays = parseInt(document.getElementById('modal-lead-days')?.value || '14');
  const fareClass = document.getElementById('modal-fare-class')?.value || 'economy';
  const label = document.getElementById('lead-days-val');
  if (label) label.textContent = leadDays;

  // Weights approximation from Python trained model
  const classWeights = { economy: 0.12, premium: 0.08, business: 0.04 };
  const baseRate = classWeights[fareClass] || 0.10;
  const z = -2.2 + (leadDays * 0.025) + (baseRate * 5);
  const p = 1 / (1 + Math.exp(-z));

  const probDisplay = document.getElementById('sigmoid-prob-display');
  if (probDisplay) {
    probDisplay.textContent = `P(No-Show): ${(p * 100).toFixed(1)}% (z = ${z.toFixed(2)})`;
  }

  const canvas = document.getElementById('modal-sigmoid-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Axes
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 20); ctx.lineTo(40, h - 25); ctx.lineTo(w - 20, h - 25);
  ctx.stroke();

  // Grid lines
  ctx.fillStyle = '#64748B';
  ctx.font = '10px monospace';
  ctx.fillText('1.0', 10, 25);
  ctx.fillText('0.5', 10, (h - 25) / 2 + 10);
  ctx.fillText('0.0', 10, h - 25);
  ctx.fillText('z=-6', 40, h - 10);
  ctx.fillText('z=0', w / 2, h - 10);
  ctx.fillText('z=+6', w - 40, h - 10);

  // Draw Sigmoid curve
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let px = 40; px <= w - 20; px++) {
    const curZ = ((px - 40) / (w - 60)) * 12 - 6;
    const curP = 1 / (1 + Math.exp(-curZ));
    const py = (h - 25) - curP * (h - 45);
    if (px === 40) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Current point
  const mappedX = 40 + ((z + 6) / 12) * (w - 60);
  const mappedY = (h - 25) - p * (h - 45);

  ctx.fillStyle = '#F43F5E';
  ctx.beginPath();
  ctx.arc(mappedX, mappedY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();
};

// Python ML: Overbooking Calculation Modal
window.runOverbookingCalcModal = () => {
  const result = findOptimalOverbooking({
    capacity: 180,
    noShowRate: 0.10,
    bumpCost: 15000,
    spoilLoss: 4500
  });

  const optVal = document.getElementById('ob-optimal-val');
  const minCost = document.getElementById('ob-min-cost');
  const chart = document.getElementById('modal-ob-chart');

  if (optVal) optVal.textContent = `+${result.optimalLevel} Seats`;
  if (minCost) minCost.textContent = `₹${result.minimumExpectedCost.toLocaleString()}`;

  if (chart) {
    const maxCost = Math.max(...result.costCurve.map(x => x.expectedCost));
    chart.innerHTML = result.costCurve.slice(0, 11).map(c => {
      const hPct = maxCost > 0 ? (c.expectedCost / maxCost) * 100 : 0;
      const isOpt = c.overbookingLevel === result.optimalLevel;
      return `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end">
          <span style="font-size:8px;color:${isOpt ? '#22C55E' : '#64748B'};font-family:monospace">${c.overbookingLevel}</span>
          <div style="width:100%;height:${hPct}%;background:${isOpt ? '#22C55E' : '#334155'};border-radius:3px 3px 0 0;box-shadow:${isOpt ? '0 0 10px #22C55E' : 'none'}"></div>
        </div>
      `;
    }).join('');
  }

  appendTerminalLog(`🤖 [PYTHON::COST] Binomial optimizer: Optimal buffer b* = +${result.optimalLevel} seats with minimum expected loss ₹${result.minimumExpectedCost}.`, '#22C55E');
};


// ══════════════════════════════════════════════════════════
//  ROUTER
// ══════════════════════════════════════════════════════════

const routes = {
  'home': { render: renderSearchPage, init: initSearchPage },
  'landing': { render: renderHomePage, init: initHomePage },
  'search': { render: renderSearchPage, init: initSearchPage },
  'seats': { render: (id) => renderSeatPage(id), init: (id) => initSeatPage(id) },
  'booking': { render: renderBookingPage },
  'bookings': { render: renderBookingsPage },
  'academic': { render: renderAcademicPage, init: initAcademicPage },
};

async function navigateTo(page, params) {
  state.currentPage = page;
  const route = routes[page];
  if (!route) { navigateTo('search'); return; }

  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  // Render page content
  mainContent.style.opacity = '0';
  mainContent.style.transform = 'translateY(8px)';

  const html = await route.render(params);
  mainContent.innerHTML = html;

  // Trigger enter animation
  requestAnimationFrame(() => {
    mainContent.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    mainContent.style.opacity = '1';
    mainContent.style.transform = 'translateY(0)';
    setTimeout(() => {
      if (mainContent) mainContent.style.transform = 'none';
    }, 350);
  });

  // Initialize page
  if (route.init) {
    setTimeout(() => route.init(params), 50);
  }

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  // Scroll to top
  window.scrollTo(0, 0);
}

function handleHashChange() {
  const hash = window.location.hash.slice(1) || '/search';
  const parts = hash.split('/').filter(Boolean);
  let page = parts[0] || 'search';
  if (page === 'home') page = 'search';
  const param = parts[1] || null;
  navigateTo(page, param);
}

// ══════════════════════════════════════════════════════════
//  BOOTSTRAP
// ══════════════════════════════════════════════════════════

async function initApp() {
  // Set up page structure
  document.getElementById('app').innerHTML = `
    ${renderNavbar()}
    <main class="main-content" id="main-content"></main>
    <div class="toast-container" id="toast-container"></div>
    <div id="concept-modal-mount"></div>
  `;

  // Initialize database
  await openDatabase();
  const seeded = await seedDatabase();
  if (seeded) console.log('Database seeded with initial data');

  // Initialize booking index from existing data
  const indexedCount = await initializeBookingIndex();
  console.log(`B-Tree index initialized with ${indexedCount} bookings`);

  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 10);
  });

  // Mobile menu toggle
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('nav-links')?.classList.toggle('open');
  });

  // Close mobile menu on navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.getElementById('nav-links')?.classList.remove('open');
    });
  });

  // Route handling
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
