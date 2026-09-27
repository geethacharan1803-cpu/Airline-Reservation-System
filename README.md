# SkyVoyage Enterprise — Airline Reservation System

> **Academic Project #7** · B.Tech II Year I Semester · R23 Curriculum  
> Integrated Airline Reservation, Concurrency Defense, Algorithmic Operations & Academic Verification Suite

## 🚀 Quick Start

### Option 1: Static File Server (Recommended)
```bash
# Python 3
python -m http.server 8000

# Then open http://localhost:8000
```

### Option 2: VS Code Live Server
Right-click `index.html` → "Open with Live Server"

### Option 3: Direct File
Open `index.html` directly in any modern browser.

---

## 📁 Project Structure

```
├── index.html                    # Main SPA entry point
├── css/
│   └── styles.css                # Complete design system
├── js/
│   ├── app.js                    # Main app, router, all pages
│   ├── core/
│   │   ├── btree.js              # B-Tree index (ADSA Unit 1)
│   │   ├── maxheap.js            # Max-Heap waitlist (ADSA Unit 2)
│   │   ├── mutex.js              # Async mutex & locks (DBMS Unit 5)
│   │   └── db.js                 # IndexedDB ACID layer (DBMS Unit 1-2)
│   ├── models/
│   │   └── index.js              # OOP classes (OOPJ Units 1-4)
│   └── services/
│       ├── bookingService.js     # Booking engine
│       ├── seatService.js        # Set theory operations (DMGT Unit 2)
│       ├── capacityService.js    # ML overbooking mirror (Python/ML)
│       ├── graphService.js       # Route graph & Dijkstra (DMGT Unit 4-5)
│       └── logicGate.js          # Propositional logic (DMGT Unit 1)
├── ml-service/
│   ├── models/
│   │   └── noshow_model.py       # Logistic regression model
│   └── api/
│       └── overbooking.py        # Python API server
└── README.md
```

## 🎓 Academic Curriculum Mapping

| Subject | Unit | Implementation |
|---------|------|---------------|
| **DBMS** | Unit 1-2 | Normalized IndexedDB schema, ER model, integrity constraints |
| **DBMS** | Unit 5 | Pessimistic locking simulation, SELECT FOR UPDATE, 10-min TTL |
| **DMGT** | Unit 1 | Propositional logic checkout gates, truth table evaluator |
| **DMGT** | Unit 2 | Set theory seat availability, injective mapping proof |
| **DMGT** | Unit 4-5 | Directed route graph, Dijkstra's shortest path |
| **ADSA** | Unit 1 | B-Tree (order t=3) booking index with live telemetry |
| **ADSA** | Unit 2 | Max-Heap priority queue for waitlist management |
| **OOPJ** | Units 1-4 | Abstract classes, inheritance, Strategy pattern, exceptions |
| **Python/ML** | — | Logistic regression, expected cost optimization |

## 🔧 Python ML Service

```bash
# Train the no-show prediction model
python ml-service/models/noshow_model.py

# Start the API server (optional — JS mirror works offline)
python ml-service/api/overbooking.py
```

## 🏗️ Architecture

- **Zero-Build**: No Node.js, no bundler, no transpiler
- **ES6 Modules**: Native `<script type="module">` imports
- **IndexedDB**: Client-side persistent storage with ACID simulation
- **SPA Router**: Hash-based client-side routing

## 📜 License

Academic use only — B.Tech R23 Curriculum Project.
