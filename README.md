<p align="center">
  <img src="https://img.shields.io/badge/SkyVoyage-Airline%20Reservation%20System-0ea5e9?style=for-the-badge&logo=airplane&logoColor=white" alt="SkyVoyage" />
</p>

<h1 align="center">✈️ SkyVoyage Airlines — Reservation & Operational Management System</h1>

<p align="center">
  <strong>B.Tech II Year I Semester (R23 Curriculum) — Mini-Project #7</strong><br/>
  <em>Airline Reservation, Predictive Capacity, & Dynamic Yield Management Platform</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/SQLite-sql.js-003B57?style=flat-square&logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/Python-3.11-3776ab?style=flat-square&logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/Flask-3.1-000000?style=flat-square&logo=flask" alt="Flask" />
  <img src="https://img.shields.io/badge/scikit--learn-1.5-f7931e?style=flat-square&logo=scikitlearn" alt="scikit-learn" />
  <img src="https://img.shields.io/badge/Vite-5.4-646cff?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ed?style=flat-square&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/License-Academic-green?style=flat-square" alt="License" />
</p>

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Key Real-World Features](#-key-real-world-features)
- [System Architecture](#-system-architecture)
- [Subject-to-Code Mapping](#-detailed-subject-to-code-mapping)
- [Project Structure](#-project-structure)
- [Installation & Setup](#-installation--local-setup)
- [Running the Application](#-running-the-application)
- [API Reference](#-api-reference)
- [Database Schema](#-database-schema)
- [ML Service](#-ml-service-architecture)
- [Deployment Guide](#-deployment-guide)
- [Interactive Academic Demonstration](#-interactive-academic-demonstration-sequence)
- [Testing](#-testing)
- [Screenshots](#-screenshots)
- [Contributors](#-contributors)

---

## 🌟 Project Overview

**SkyVoyage Airlines** is a production-grade, full-stack airline reservation system that integrates five R23 curriculum subjects into a single cohesive platform. The system handles real-time flight search, seat selection with 2D/3D maps, ACID-guaranteed double-booking prevention, ML-powered no-show prediction, dynamic overbooking, and a priority waitlist engine.

### Academic Integration

| Subject | Key Contribution | Implementation |
|---------|-----------------|----------------|
| **DBMS** | Relational modeling, 3NF normalization, ACID transactions, indexing | SQLite schema, transactional booking engine |
| **DMGT** | Graph theory (route networks), set theory (seat availability), combinatorics (PNR), probability | Route search, availability math, PNR generation |
| **ADSA** | Hash maps, B-Tree indexes, BFS/Dijkstra, Max-Heap priority queue, sorting | Seat lookup, flight search, waitlist, ranking |
| **OOPJ** | Encapsulation, interfaces, composition, strategy/observer patterns | API layer, TypeScript types, payment processing |
| **Python/ML** | Logistic regression, feature engineering, train-test evaluation, overbooking | No-show predictor, flight recommender |

---

## 🚀 Key Real-World Features

### Core Booking Engine
- ✅ **ACID-Guaranteed Double-Booking Prevention** — `UNIQUE(flight_id, seat_number)` constraint + transactional locking
- ✅ **Pessimistic Seat Locking** — 5-minute hold window during booking with automatic cleanup
- ✅ **6-Character PNR Generation** — Collision-resistant codes from 32⁶ = 1,073,741,824 namespace
- ✅ **Multi-Passenger Bookings** — Family/group booking with individual seat assignments

### Intelligent Features
- 🧠 **ML No-Show Prediction** — Logistic regression model with feature engineering (lead time, fare class, group size)
- 📊 **Dynamic Overbooking** — ML-driven overbooking cap per flight: `⌊Capacity × P(no-show)⌋`
- 🔔 **SeatWatch Upgrade Alerts** — Real-time seat preference monitoring with auto-notification
- 📈 **Priority Waitlist (Max-Heap)** — Loyalty-tiered standby queue with automatic promotion on cancellation
- 💡 **Smart Price Comparison** — Cheapest flight finder with flexible date ±3 day calendar
- 🔄 **Round-Trip Smart Planning** — Best-value outbound + return combination engine
- 📅 **When to Book Advice** — Historical price trend analysis with booking recommendations

### User Experience
- 🪑 **Interactive 2D & 3D Seat Maps** — Real-time seat status with cabin class visualization
- 💳 **Indian Payment Gateway** — UPI, Net Banking, Card, RuPay with INR (₹) formatting
- 🤖 **AI Chatbot Assistant** — Ollama-powered conversational booking aid (optional)
- 🇮🇳 **India-Localized** — Indian airports (VTZ, HYD, BLR, BOM, DEL), Aadhaar/PAN/Voter ID support
- 📱 **Responsive Design** — Mobile-first UI with premium navy + sky blue + gold design system

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER (Client)                        │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐  │
│  │ HomePage │ │SearchPage │ │BookingPg │ │ConfirmPg  │ │ManagePg   │  │
│  │ (Search) │ │(Compare)  │ │(SeatMap) │ │  (PNR)    │ │(Retrieve) │  │
│  └─────┬────┘ └─────┬─────┘ └────┬─────┘ └─────┬─────┘ └─────┬─────┘  │
│        │            │            │              │             │         │
│  React 18 + TypeScript + Vite │  Component Composition (OOPJ)         │
│  Design System: Navy + Sky Blue + Gold │  Lucide Icons               │
├────────┼────────────┼────────────┼──────────────┼─────────────┼────────┤
│        │    HTTP REST API (JSON) │              │             │         │
│        ▼            ▼            ▼              ▼             ▼         │
├─────────────────────────────────────────────────────────────────────────┤
│                     APPLICATION ENGINE (Server)                        │
│  ┌──────────────┐ ┌────────────────┐ ┌──────────────────────────────┐  │
│  │ Express.js   │ │ ACID Tx Mgr    │ │ Business Logic               │  │
│  │ REST Router  │ │ BEGIN/COMMIT   │ │ PNR Gen │ Seat Lock │ Price  │  │
│  │ /api/v1/*    │ │ ROLLBACK       │ │ Waitlist│ SeatWatch │ Advise │  │
│  └──────┬───────┘ └───────┬────────┘ └─────────────┬────────────────┘  │
│         │                 │                        │                   │
│  Node.js 20+ │ TypeScript │  Strategy Pattern (OOPJ)                  │
├─────────┼─────────────────┼────────────────────────┼──────────────────┤
│         ▼                 ▼                        ▼                   │
├─────────────────────────────────────────────────────────────────────────┤
│                     PERSISTENCE LAYER (Database)                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  SQLite (via sql.js — in-memory with periodic disk flush)       │  │
│  │                                                                  │  │
│  │  Tables: airports │ aircraft │ flights │ bookings │ passengers  │  │
│  │          booking_seats │ seat_locks │ payments │ booking_addons │  │
│  │          seat_watchers │ upgrade_offers │ seat_waitlist         │  │
│  │          ml_predictions │ price_history                         │  │
│  │                                                                  │  │
│  │  Indexes: idx_flights_route │ idx_flights_departure             │  │
│  │           idx_bookings_pnr │ idx_booking_seats_flight           │  │
│  │           idx_seat_waitlist_flight │ idx_price_history_route     │  │
│  │                                                                  │  │
│  │  Constraints: UNIQUE(flight_id, seat_number) — double-booking   │  │
│  │               FOREIGN KEYS ON │ CHECK constraints               │  │
│  │               PRAGMA foreign_keys = ON                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                     ML SERVICE (Python)                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────────┐  │
│  │ Flask REST API │  │ NoShowPredictor│  │ Flight Recommender      │  │
│  │ /predict/*     │  │ LogisticRegres │  │ score_and_rank_flights  │  │
│  │ /recommend     │  │ + StandardScl  │  │ multi-signal ranking    │  │
│  └────────────────┘  └────────────────┘  └─────────────────────────┘  │
│  Python 3.11 │ Flask │ scikit-learn │ numpy │ pandas                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Service Communication

| From → To | Protocol | Endpoint | Purpose |
|-----------|----------|----------|---------|
| Client → Server | HTTP/REST | `localhost:5173 → localhost:3001` | All booking operations |
| Server → ML | HTTP/REST | `localhost:3001 → localhost:5001` | No-show prediction, ranking |
| Server → SQLite | In-process | sql.js library | All data persistence |
| Client → Ollama | HTTP/REST | `localhost:11434` | AI chatbot (optional) |

---

## 📚 Detailed Subject-to-Code Mapping

### 1. DBMS — Database Management Systems

| Concept | Unit | Implementation | File |
|---------|------|----------------|------|
| **ER Modeling** | I | 14 tables with full relational schema | `server/src/db/database.ts` |
| **3NF Normalization** | I | Airport codes as FK (no name duplication), aircraft as separate entity | `server/src/db/database.ts` |
| **ACID Transactions** | V | `BEGIN TRANSACTION` → insert booking → insert seats → insert payment → `COMMIT` or `ROLLBACK` | `server/src/routes/bookings.ts` |
| **Row Locking** | V | Pessimistic seat locks with expiry (`seat_locks` table, 5-min TTL) | `server/src/routes/seats.ts` |
| **Unique Constraints** | II | `UNIQUE(flight_id, seat_number)` prevents double-booking at engine level | `server/src/db/database.ts:156` |
| **Foreign Keys** | II | `REFERENCES` + `ON DELETE CASCADE` for referential integrity | All tables |
| **CHECK Constraints** | II | `CHECK(status IN ('scheduled','boarding',...))` for domain validation | `flights`, `bookings`, `payments` |
| **Indexing** | IV | B-tree indexes on `flights(origin, destination, departure_time)`, `bookings(pnr)` | `server/src/db/database.ts:99-100` |
| **WAL Journaling** | V | `PRAGMA foreign_keys = ON` (WAL via sql.js memory mode with disk flush) | `server/src/db/database.ts:26` |

### 2. DMGT — Discrete Mathematics & Graph Theory

| Concept | Unit | Implementation | File |
|---------|------|----------------|------|
| **Propositional Logic** | I | Identity validation: `(Indian ∧ GovtID) ∨ (Foreign ∧ Passport)` | `server/src/routes/bookings.ts` |
| **Set Theory** | II | `AvailableSeats = AllSeats ∖ BookedSeats ∖ LockedSeats` | `server/src/routes/flights.ts` |
| **Graph Theory** | III | Airport route network as weighted directed graph | `server/src/routes/flights.ts` |
| **Combinatorics** | IV | PNR space: 32⁶ = 1,073,741,824 unique codes | `server/src/routes/bookings.ts:10-29` |
| **Conditional Probability** | V | `P(no-show | features)` via Bayes' theorem underpinning | `ml-service/models/noshow_model.py` |

### 3. ADSA — Advanced Data Structures & Algorithms

| Concept | Unit | Time Complexity | Implementation | File |
|---------|------|----------------|----------------|------|
| **Hash Map** | I | O(1) lookup | `Map<string, string>` for seat status | `server/src/routes/seats.ts` |
| **B-Tree Index** | I | O(log n) search | SQLite B-tree on `(flight_id, seat_number)` | `server/src/db/database.ts:160` |
| **BFS / Dijkstra** | II | O((V+E) log V) | Route discovery through airport graph | `server/src/routes/flights.ts` |
| **Priority Queue (Max-Heap)** | II | O(log n) extract | Waitlist ordering by `(TierWeight×100) − Timestamp` | `server/src/routes/seatwaitlist.ts` |
| **Sorting (TimSort)** | III | O(n log n) | Flight ranking by composite ML score | `ml-service/models/recommender.py` |
| **Binary Search** | I | O(log n) | Internal SQLite index traversal for time-filtered queries | Database engine |

### 4. OOPJ — Object-Oriented Programming (in TypeScript / Java equivalent)

| Concept | Unit | Implementation | File |
|---------|------|----------------|------|
| **Encapsulation** | I | `api.ts` hides HTTP details behind clean function interfaces | `client/src/api.ts` |
| **Interfaces** | II | `FlightResult`, `BookingDetail`, `SeatInfo`, `PaymentRequest` TypeScript interfaces | `client/src/api.ts` |
| **Composition** | III | React components: `Header`, `Footer`, `SeatMap2D`, `ChatPanel` composed into pages | `client/src/App.tsx` |
| **Strategy Pattern** | IV | Payment method polymorphism: Card / UPI / NetBanking via common interface | `server/src/routes/payments.ts` |
| **Observer Pattern** | IV | React `useState`/`useEffect` — state changes auto-trigger UI re-renders | All React components |
| **Exception Handling** | III | `try-catch-finally` blocks around all DB transactions with `ROLLBACK` on failure | `server/src/routes/bookings.ts` |

### 5. Python / ML — Machine Learning

| Concept | Implementation | File |
|---------|----------------|------|
| **Logistic Regression** | `LogisticRegression(C=1.0, solver='lbfgs')` with L2 regularization | `ml-service/models/noshow_model.py` |
| **Feature Engineering** | Lead time, fare class (one-hot), is_weekend, group_size, flight_duration, has_checked_bag | `ml-service/models/noshow_model.py` |
| **Standard Scaling** | `StandardScaler` normalizes features before model input | `ml-service/models/noshow_model.py` |
| **Train-Test Split** | 80/20 split on 10,000 synthetic records | `ml-service/models/noshow_model.py` |
| **Model Evaluation** | Accuracy, precision, recall, F1-score, confusion matrix | `ml-service/app.py:/metrics` |
| **Sigmoid Function** | `S(z) = 1 / (1 + e^(-z))` maps linear output to probability [0,1] | Logistic regression internals |
| **Overbooking Strategy** | `Cap = min(⌊Capacity × P(no-show)⌋, Capacity × 0.05)` | `server/src/routes/flights.ts` |

---

## 📁 Project Structure

```
Airline Reservation System/
├── client/                          # React Frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── api.ts                   # API client — encapsulation (OOPJ)
│   │   ├── App.tsx                  # Root router — composition (OOPJ)
│   │   ├── index.css                # Design system (Navy + Sky Blue + Gold)
│   │   ├── main.tsx                 # React entry point
│   │   ├── components/
│   │   │   ├── Header.tsx           # Navigation bar
│   │   │   ├── Footer.tsx           # Footer with links
│   │   │   ├── ChatPanel.tsx        # AI chatbot interface
│   │   │   ├── MermaidViewer.tsx     # Diagram renderer
│   │   │   ├── PricePredictorWidget.tsx  # Price trend visualizer
│   │   │   ├── SeatMap2D.tsx        # 2D seat map component
│   │   │   ├── SeatMap3D.tsx        # 3D cabin visualization
│   │   │   └── SeatWatchBanner.tsx  # Upgrade alert notifications
│   │   └── pages/
│   │       ├── HomePage.tsx         # Flight search + round-trip
│   │       ├── SearchResultsPage.tsx # Smart price comparison
│   │       ├── BookingPage.tsx      # Multi-step booking + seat selection
│   │       ├── ConfirmationPage.tsx # PNR + booking summary
│   │       ├── ManageBookingPage.tsx # Retrieve/cancel bookings
│   │       └── SubjectsPage.tsx     # Curriculum + Blueprint + Simulator
│   ├── Dockerfile                   # Production Nginx container
│   ├── package.json
│   └── vite.config.ts
│
├── server/                          # Express Backend (TypeScript)
│   ├── src/
│   │   ├── index.ts                 # Server entry + middleware
│   │   ├── db/
│   │   │   ├── database.ts          # Schema + initialization + seeding
│   │   │   └── seed.ts              # Airport/aircraft/flight data
│   │   ├── routes/
│   │   │   ├── flights.ts           # Flight search + price advice + calendar
│   │   │   ├── bookings.ts          # ACID booking + PNR generation
│   │   │   ├── seats.ts             # Seat map + locking engine
│   │   │   ├── payments.ts          # Payment processing (UPI/Card/Net)
│   │   │   ├── airports.ts          # Airport search API
│   │   │   ├── chat.ts              # AI chatbot relay
│   │   │   ├── seatwatch.ts         # Seat preference monitoring
│   │   │   └── seatwaitlist.ts      # Priority waitlist + auto-upgrade
│   │   └── declarations.d.ts
│   ├── data/
│   │   └── skyvoyage.db             # SQLite database file
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── ml-service/                      # Python ML Microservice
│   ├── app.py                       # Flask API server
│   ├── models/
│   │   ├── __init__.py
│   │   ├── noshow_model.py          # Logistic regression predictor
│   │   └── recommender.py           # Flight ranking engine
│   ├── data/                        # Training data artifacts
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml               # Multi-container orchestration
├── package.json                     # Root workspace scripts
├── test_booking_flow.ps1            # PowerShell integration test
├── test_seatwatch.ps1               # SeatWatch test script
└── README.md                        # This file
```

---

## ⚙️ Installation & Local Setup

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | 18+ (recommended: 20 LTS) | Frontend + Backend runtime |
| **npm** | 9+ | Package management |
| **Python** | 3.9+ (recommended: 3.11) | ML service |
| **Git** | Latest | Version control |
| **Ollama** | Latest (optional) | AI chatbot |

### Step-by-Step Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/airline-reservation-system.git
cd "Airline Reservation System"

# 2. Install all Node.js dependencies (root + client + server)
npm run install:all

# 3. Set up Python ML service (one-time)
cd ml-service
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cd ..

# 4. (Optional) Install Ollama for AI chatbot
# Visit: https://ollama.com/download
# After install: ollama pull llama3.2
```

### Environment Variables (Optional)

```bash
# Server
PORT=3001                    # Backend API port (default: 3001)
ML_SERVICE_URL=http://localhost:5001  # ML service endpoint
NODE_ENV=development

# Client
VITE_API_URL=http://localhost:3001/api/v1  # API base URL
```

---

## ▶️ Running the Application

### Development Mode (Recommended)

```bash
# Start both frontend and backend simultaneously
npm run dev

# In a separate terminal — start the ML service
npm run dev:ml
```

| Service | URL | Status |
|---------|-----|--------|
| Frontend | http://localhost:5173 | React dev server with HMR |
| Backend API | http://localhost:3001 | Express REST API |
| ML Service | http://localhost:5001 | Flask prediction API |
| Health Check | http://localhost:3001/api/health | Server status |
| ML Health | http://localhost:5001/health | ML model status |

### Individual Services

```bash
# Frontend only
npm run dev:client

# Backend only
npm run dev:server

# ML service only
cd ml-service && .venv\Scripts\python app.py

# All three services together
npm run dev:all
```

### Production Build

```bash
# Build frontend for production
npm run build

# Output: client/dist/ (static files ready for Nginx/CDN)
```

---

## 📡 API Reference

### Flights

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/flights?origin=VTZ&destination=HYD&date=2026-10-15` | Search flights |
| `GET` | `/api/v1/flights/:id` | Get flight details |
| `GET` | `/api/v1/flights/price-advice?origin=VTZ&destination=HYD&date=2026-10-15` | When-to-book advice |
| `GET` | `/api/v1/flights/price-calendar?origin=VTZ&destination=HYD&date=2026-10-15` | Flexible date calendar |

### Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/bookings` | Create booking (ACID transaction) |
| `GET` | `/api/v1/bookings/:pnr` | Retrieve booking by PNR |
| `PATCH` | `/api/v1/bookings/:pnr/cancel` | Cancel booking + trigger waitlist |

### Seats

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/seats/:flightId` | Get seat map with availability |
| `POST` | `/api/v1/seats/lock` | Acquire pessimistic seat lock |
| `DELETE` | `/api/v1/seats/lock/:lockId` | Release seat lock |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/payments` | Process payment (UPI/Card/Net) |
| `GET` | `/api/v1/payments/:bookingId` | Get payment details |

### SeatWatch & Waitlist

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/seatwatch` | Register seat preference watch |
| `GET` | `/api/v1/seatwatch/:flightId` | Get active watchers |
| `POST` | `/api/v1/seat-waitlist/enroll` | Enroll in priority waitlist |
| `GET` | `/api/v1/seat-waitlist/active-notifications` | Poll for upgrade alerts |
| `POST` | `/api/v1/seat-waitlist/claim/:id` | Claim upgraded seat |

### ML Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/predict/no-show` | Predict no-show probability |
| `POST` | `/recommend` | Rank flights by composite score |
| `GET` | `/health` | Service health + model info |
| `GET` | `/metrics` | Model evaluation metrics |

---

## 🗄️ Database Schema

### Entity-Relationship Summary

```
airports ──┐                    ┌── passengers
            ├── flights ── bookings ──┤
aircraft ──┘        │          │      └── booking_addons
                    │          │
              seat_locks    payments
                    │
             booking_seats ────── UNIQUE(flight_id, seat_number)
                    │
              seat_watchers ── upgrade_offers
              seat_waitlist
              ml_predictions
              price_history
```

### Key Tables

| Table | Primary Key | Key Constraints | Purpose |
|-------|-------------|----------------|---------|
| `airports` | `code` (TEXT) | — | Global airport directory (30+ airports) |
| `aircraft` | `id` (AUTO) | `UNIQUE(code)` | Fleet definitions with cabin config |
| `flights` | `id` (AUTO) | `CHECK(status)`, FK to airports/aircraft | Scheduled flights with pricing |
| `bookings` | `id` (AUTO) | `UNIQUE(pnr)`, `CHECK(status)`, `CHECK(fare_class)` | Reservation records |
| `passengers` | `id` (AUTO) | FK to bookings, `CHECK(passenger_type)` | Individual traveler details |
| `booking_seats` | `id` (AUTO) | **`UNIQUE(flight_id, seat_number)`** ← double-booking guard | Seat assignments |
| `seat_locks` | `id` (AUTO) | `UNIQUE(flight_id, seat_number)` | Temporary 5-min seat holds |
| `payments` | `id` (AUTO) | `UNIQUE(transaction_id)`, `CHECK(method)`, `CHECK(status)` | Transaction records |
| `seat_waitlist` | `id` (AUTO) | FK to bookings/flights, `CHECK(status)` | Priority upgrade queue |
| `price_history` | `id` (AUTO) | Indexed on `(origin, destination)` | 30-day fare trend data |

---

## 🧠 ML Service Architecture

### No-Show Prediction Model

```
Input Features                    Model                     Output
┌─────────────────┐         ┌──────────────┐         ┌──────────────┐
│ lead_time: 14   │         │              │         │              │
│ fare_class: eco │ ──────► │  Logistic    │ ──────► │ P(no-show)   │
│ is_weekend: 0   │         │  Regression  │         │ = 0.082      │
│ group_size: 2   │         │  + L2 Reg    │         │              │
│ duration: 1.08h │         │  + StdScaler │         │ Confidence:  │
│ has_bag: 1      │         │              │         │ 87.3%        │
└─────────────────┘         └──────────────┘         └──────────────┘
                                    │
                            S(z) = 1/(1+e^(-z))
                            (Sigmoid Activation)
```

### Model Metrics

| Metric | Value | Description |
|--------|-------|-------------|
| Accuracy | ~88% | Overall correct predictions |
| Precision | ~85% | True positives / predicted positives |
| Recall | ~82% | True positives / actual positives |
| F1-Score | ~83% | Harmonic mean of precision and recall |
| Training Set | 8,000 records | 80% of synthetic dataset |
| Test Set | 2,000 records | 20% holdout evaluation |

---

## 🚢 Deployment Guide

### Docker Deployment (Recommended)

```bash
# Build and start all services
docker-compose up --build -d

# Services:
# - Frontend: http://localhost:80 (Nginx)
# - Backend:  http://localhost:3001
# - ML:       http://localhost:5001

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Manual Production Deployment

```bash
# 1. Build frontend
cd client && npm run build

# 2. Serve with Nginx or any static file server
# Copy client/dist/ to your web server

# 3. Start backend
cd server && NODE_ENV=production node dist/index.js

# 4. Start ML service
cd ml-service && python app.py
```

### Cloud Deployment Options

| Platform | Frontend | Backend | ML Service |
|----------|----------|---------|------------|
| **Vercel** | `client/` (auto) | — | — |
| **Render** | Static site | Web service | Web service |
| **Railway** | — | Node.js | Python |
| **Docker** | Nginx container | Node container | Python container |

---

## 🎓 Interactive Academic Demonstration Sequence

> **5-minute guided walkthrough for viva and project evaluation**

### Minute 1: System Overview & Architecture (0:00 – 1:00)
1. Open the app at `http://localhost:5173`
2. Navigate to **Curriculum** → **System Blueprint** tab
3. Show the 4-layer architecture diagram
4. Highlight the 7-step end-to-end passenger journey

### Minute 2: Live Booking Demonstration (1:00 – 2:30)
1. From **Home Page**, search: VTZ → HYD, October 15, 2026
2. Show **Smart Price Comparison** — cheapest flight highlighted, filters
3. Select a flight → Show **2D Seat Map** with real-time availability
4. Select seat 14A → Observe **seat lock** (5-min hold)
5. Fill passenger details: Rajesh Sharma, Aadhaar: 4829 1049 8821

### Minute 3: ACID Transaction & Payment (2:30 – 3:30)
1. Choose **UPI** payment → Enter UPI ID
2. Click **Confirm Booking** — observe atomic transaction
3. Show **Confirmation Page** with PNR
4. Open **Manage Booking** → Retrieve by PNR

### Minute 4: ML & Waitlist Demo (3:30 – 4:30)
1. Navigate to **Curriculum** → **Live Execution Trace** tab
2. Select "Rajesh Sharma" scenario → Click **Simulate Live Execution**
3. Watch the terminal trace through all 7 steps:
   - SQL queries (DBMS)
   - Boolean logic gates (DMGT)
   - B-Tree traversal (ADSA)
   - ML sigmoid calculation (Python)
   - Strategy pattern (OOPJ)

### Minute 5: Subject Mapping & Q&A (4:30 – 5:00)
1. Navigate to **Subject Curriculum** tab
2. Show DBMS → ACID Transactions topic → ER diagram
3. Show ADSA → BFS/Dijkstra diagram
4. Summarize: "5 subjects, 1 integrated system, production-grade code"

---

## 🧪 Testing

### Automated Integration Tests

```bash
# Run the comprehensive feature test suite (Python)
cd ml-service && .venv\Scripts\python ../test_all_features.py

# PowerShell booking flow test
.\test_booking_flow.ps1

# SeatWatch notification test
.\test_seatwatch.ps1
```

### Manual API Testing

```bash
# Health check
curl http://localhost:3001/api/health

# Search flights
curl "http://localhost:3001/api/v1/flights?origin=VTZ&destination=HYD&date=2026-10-15"

# Create booking
curl -X POST http://localhost:3001/api/v1/bookings \
  -H "Content-Type: application/json" \
  -d '{"flightId":1,"fareClass":"economy","contactEmail":"test@example.com","passengers":[{"firstName":"Test","lastName":"User"}]}'

# ML prediction
curl -X POST http://localhost:5001/predict/no-show \
  -H "Content-Type: application/json" \
  -d '{"lead_time":14,"fare_class":"economy","is_weekend":0,"group_size":1}'
```

---

## 🖼️ Screenshots

| Page | Description |
|------|-------------|
| Home Page | Flight search with round-trip support and flexible dates |
| Search Results | Smart price comparison with cheapest flight highlight |
| Booking Page | Multi-step wizard with 2D/3D seat map |
| Confirmation | PNR display with booking summary and add-on recommendations |
| Curriculum | Academic subject-to-code mapping with interactive diagrams |
| Live Simulator | Real-time execution trace with animated terminal output |

---

## 👥 Contributors

| Role | Contribution |
|------|-------------|
| **Full-Stack Development** | React frontend, Express backend, SQLite schema |
| **ML Engineering** | No-show prediction model, flight recommender |
| **Database Design** | ER modeling, 3NF normalization, ACID transactions |
| **UI/UX Design** | Premium design system, responsive layouts, animations |

---

## 📄 License

This project is developed for academic purposes as part of the B.Tech II Year I Semester (R23 Curriculum) mini-project evaluation.

---

<p align="center">
  <strong>Built with ❤️ for academic excellence</strong><br/>
  <em>SkyVoyage Airlines — Where Computer Science Meets Aviation</em>
</p>
