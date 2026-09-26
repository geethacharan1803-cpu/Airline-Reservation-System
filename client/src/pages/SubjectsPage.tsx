import { useState, useEffect, useRef, useCallback } from 'react';
import { Database, GitBranch, Binary, Code, Brain, ChevronDown, ChevronRight, Play, RotateCcw, Zap, Terminal, ArrowRight, CheckCircle, Clock, Shield, Users, CreditCard, Layers, Activity } from 'lucide-react';
import { MermaidViewer } from '../components/MermaidViewer';

/* ================================================================
   SECTION 1: EXISTING ACADEMIC CURRICULUM DATA
   (Preserved exactly from original SubjectsPage)
   ================================================================ */

interface SubjectData {
  id: string;
  icon: React.ReactNode;
  name: string;
  fullName: string;
  color: string;
  topics: TopicData[];
}

interface TopicData {
  title: string;
  where: string;
  how: string;
  why: string;
  realWorld: string;
  diagram?: string;
}

const subjects: SubjectData[] = [
  {
    id: 'dbms',
    icon: <Database size={24} />,
    name: 'DBMS',
    fullName: 'Database Management Systems',
    color: '#3b82f6',
    topics: [
      {
        title: 'Entity-Relationship (ER) Modeling',
        where: 'Database schema design — the tables airports, flights, bookings, passengers, booking_seats, and payments are all derived from an ER model.',
        how: 'We identified real-world entities (Airport, Flight, Passenger, Booking) and their relationships (a Booking has many Passengers, a Flight operates from an Airport). Each entity became a table. Relationships are represented through foreign keys — for example, bookings.flight_id references flights.id.',
        why: 'ER modeling ensures the database accurately represents the real-world domain. Without it, we might create tables that duplicate data, miss relationships, or make queries unnecessarily complex.',
        realWorld: 'Every airline reservation system (Amadeus, Sabre, Travelport) begins with ER modeling. When you book on an airline\'s website, behind the scenes these same entity relationships are at work — your passenger record links to your booking, which links to your flight.',
        diagram: `erDiagram
    AIRPORT ||--o{ FLIGHT : "departure from"
    AIRPORT ||--o{ FLIGHT : "arrival to"
    AIRCRAFT ||--o{ FLIGHT : "operated by"
    FLIGHT ||--o{ BOOKING : "booked on"
    BOOKING ||--o{ PASSENGER : "includes"
    BOOKING ||--o{ BOOKING_SEATS : "assigns"
    PASSENGER ||--o{ BOOKING_SEATS : "sits in"
    BOOKING ||--o{ PAYMENT : "paid via"`,
      },
      {
        title: 'Normalization (Third Normal Form)',
        where: 'All database tables are in 3NF — no data is redundantly stored.',
        how: 'Instead of storing the airport name in every flight row, we store only the airport code (a foreign key) and look up the full name from the airports table when needed. Similarly, aircraft details live in the aircraft table, not repeated in every flight.',
        why: '3NF eliminates data anomalies. If an airport changes its name, we update it in one place, not in thousands of flight rows. This prevents inconsistencies where one flight says "John F. Kennedy Airport" and another says "JFK International."',
        realWorld: 'Imagine a spreadsheet where you copy-paste the airport name into every row. If the airport renames, you\'d have to update hundreds of rows and inevitably miss some. Normalization is like using a dropdown list instead — change it once, it updates everywhere.',
      },
      {
        title: 'ACID Transactions & Seat Locking',
        where: 'Booking creation in server/src/routes/bookings.ts — the entire booking (passenger records, seat assignments, payment) is wrapped in a SQL transaction.',
        how: 'When you book, the system starts a transaction (BEGIN TRANSACTION). It inserts the booking, passengers, and seat assignments. If any step fails (e.g., the seat was taken by someone else milliseconds earlier), the entire transaction rolls back — nothing is half-saved. The UNIQUE constraint on (flight_id, seat_number) makes double-booking physically impossible.',
        why: 'Without transactions, two people booking the same seat simultaneously could both succeed, creating a conflict. ACID (Atomicity, Consistency, Isolation, Durability) guarantees that either the entire booking succeeds or nothing happens.',
        realWorld: 'This is exactly how real airline systems work. When 200 people try to book the last seat on a popular flight, only one succeeds. The others get "seat no longer available." Banks use the same principle — when you transfer money, it either completes fully or not at all.',
      },
      {
        title: 'Indexing for Fast Search',
        where: 'Database schema — CREATE INDEX on flights(origin, destination, departure_time) and bookings(pnr).',
        how: 'An index is like a book\'s index — instead of reading every page (row) to find what you want, you look up the index and jump directly to the right page. Our flight search index lets the database find "JFK to LHR on October 5th" instantly among 1,800+ flights.',
        why: 'Without indexing, every search would scan all flight rows sequentially. With 1,800 flights, that\'s fine. With 1.8 million (a real airline), it would be unacceptably slow.',
        realWorld: 'Google doesn\'t read every webpage when you search — it uses an index. Similarly, when you search flights on any booking site, indexes make the results appear in milliseconds instead of seconds.',
      },
    ],
  },
  {
    id: 'dmgt',
    icon: <GitBranch size={24} />,
    name: 'DMGT',
    fullName: 'Discrete Mathematics & Graph Theory',
    color: '#8b5cf6',
    topics: [
      {
        title: 'Graph Theory — Route Network',
        where: 'The flight network is modeled as a directed graph where airports are nodes and flights are edges.',
        how: 'Each airport (JFK, LHR, SIN, etc.) is a vertex. Each flight route is a directed edge with a weight (price, duration). Finding connections from Delhi to San Francisco via Dubai uses graph traversal — specifically Dijkstra\'s algorithm could find the cheapest path through the network.',
        why: 'Graph theory is the natural way to model transportation networks. It enables finding connecting flights, identifying hub airports (nodes with high degree), and optimizing routes.',
        realWorld: 'Google Flights uses graph algorithms to find connections. When you search Delhi to San Francisco and it shows you options via Dubai, London, or Tokyo — that\'s graph traversal exploring different paths through the airline network.',
        diagram: `graph LR
    DEL[Delhi] -->|SV-402| DXB[Dubai]
    DEL -->|SV-605| SFO[San Francisco]
    DXB -->|SV-401| LHR[London]
    LHR -->|SV-202| JFK[New York]
    JFK -->|SV-101| LAX[Los Angeles]
    LAX -->|SV-107| SFO
    DXB -->|SV-604| JFK
    style DEL fill:#22c55e,color:#fff
    style SFO fill:#3b82f6,color:#fff`,
      },
      {
        title: 'Set Theory — Seat Availability',
        where: 'Seat availability calculation in the flights search API.',
        how: 'Total seats is the universal set U. Booked seats form set B. Locked (held) seats form set L. Available seats = U - B - L (set difference). When you see "342 seats available," that\'s |U| - |B| - |L|.',
        why: 'Set operations provide a clean, mathematical way to reason about seat states. A seat can only be in one state (available, booked, or locked) — these are disjoint sets, and their union equals the total.',
        realWorld: 'Every inventory system uses set theory. Amazon tracking "12 left in stock" is doing the same calculation: total inventory minus sold units minus reserved units.',
      },
      {
        title: 'Combinatorics — PNR Generation',
        where: 'PNR generation in server/src/routes/bookings.ts.',
        how: 'A PNR is a 6-character code using 32 characters (A-Z minus confusing letters, plus digits 2-9). That\'s 32⁶ = 1,073,741,824 possible PNRs — over a billion unique codes. The probability of collision on any single generation is vanishingly small.',
        why: 'Combinatorics tells us whether our PNR space is large enough. With a billion possible codes, even an airline with millions of bookings has virtually zero collision risk.',
        realWorld: 'Real airlines use the same 6-character PNR system (also called "record locator"). When you see "ABCDEF" on your boarding pass, that\'s the same combinatorial space we\'re using.',
      },
      {
        title: 'Probability — No-Show Prediction',
        where: 'ML service no-show prediction model.',
        how: 'The no-show probability P(no-show | features) is estimated using logistic regression. Features include booking lead time, fare class, and day of week. The model outputs a probability between 0 and 1.',
        why: 'Probability theory underpins the ML model. Bayes\' theorem and conditional probability help us understand why a business-class passenger booked 2 weeks ahead has a different no-show probability than an economy passenger booked yesterday.',
        realWorld: 'Airlines use no-show probability to decide overbooking levels. If a flight has a 5% historical no-show rate, they might sell 105% of seats — this is standard practice at every major airline worldwide.',
      },
    ],
  },
  {
    id: 'adsa',
    icon: <Binary size={24} />,
    name: 'ADSA',
    fullName: 'Advanced Data Structures & Algorithms',
    color: '#f59e0b',
    topics: [
      {
        title: 'Hash Maps — Seat Status Lookup',
        where: 'Seat map API in server/src/routes/seats.ts — booked and locked seats are stored in JavaScript Maps.',
        how: 'When building the seat map, booked seats are loaded into a Map<string, string> (seat number → seat class). Checking if seat "12A" is booked is an O(1) lookup instead of scanning an array. For 396 seats on a B777, this means instant status checks.',
        why: 'Hash maps provide constant-time (O(1)) lookups. Without them, checking each seat\'s status would require scanning a list (O(n)) — slow and wasteful.',
        realWorld: 'DNS servers use hash maps to translate domain names to IP addresses. Every time you visit a website, a hash map lookup happens in microseconds. Our seat lookup works the same way.',
      },
      {
        title: 'Binary Search — Flight Time Filtering',
        where: 'Database indexing enables binary search internally when querying flights by departure time.',
        how: 'SQLite\'s B-tree index on departure_time works like binary search. To find flights on October 5th among 1,800+ flights, the database doesn\'t scan sequentially — it bisects the sorted index, narrowing down in O(log n) steps.',
        why: 'Binary search reduces search from O(n) to O(log n). For 1,800 flights, that\'s ~11 comparisons instead of 1,800.',
        realWorld: 'When you open a dictionary to find a word, you don\'t read from page 1 — you open to the middle and decide which half to search. That\'s binary search. Database indexes work the same way.',
      },
      {
        title: 'Graph Traversal — Connecting Flights (BFS/Dijkstra)',
        where: 'The flight route network enables graph-based pathfinding for multi-leg journeys.',
        how: 'The airport network forms a weighted directed graph. To find routes from Delhi to San Francisco, BFS finds the fewest stops, while Dijkstra\'s algorithm finds the cheapest or shortest-duration path by exploring edges ordered by cumulative weight.',
        why: 'Direct flights aren\'t always available. Graph algorithms systematically explore all possible connections without missing options or getting stuck in loops.',
        realWorld: 'Google Maps uses Dijkstra\'s algorithm (and its variant A*) to find driving directions. The same principle applies to flight connections — finding the optimal path through a network of airports.',
        diagram: `graph TD
    A[Start: Delhi DEL] --> B{Explore neighbors}
    B --> C[Dubai DXB - $229]
    B --> D[San Francisco SFO - $749 direct]
    C --> E{Explore from DXB}
    E --> F[London LHR - $229+$449]
    E --> G[New York JFK - $229+$649]
    F --> H{Explore from LHR}
    H --> I[JFK - $229+$449+$479]
    G --> J{Compare paths to JFK}
    J --> K[Best: DEL→DXB→JFK $878]
    D --> L[Direct: DEL→SFO $749 ✓]
    style L fill:#22c55e,color:#fff
    style K fill:#3b82f6,color:#fff`,
      },
      {
        title: 'Sorting — Flight Ranking',
        where: 'Search results are sorted by departure time, and the ML recommender produces a ranked ordering.',
        how: 'The ML recommendation engine assigns a composite score to each flight (weighing price, duration, departure time, and availability). Flights are then sorted by this score. Internally, JavaScript\'s Array.sort uses TimSort — a hybrid merge sort + insertion sort — with O(n log n) complexity.',
        why: 'Users expect results in a meaningful order. Sorting by a composite ML score gives better results than simple price or time sorting.',
        realWorld: 'Google search results are ranked by a scoring algorithm (PageRank + many other signals), then sorted. Our flight ranking works the same way — multiple signals combined into a single score, then sorted.',
      },
    ],
  },
  {
    id: 'oopj',
    icon: <Code size={24} />,
    name: 'OOPJ',
    fullName: 'Object-Oriented Programming',
    color: '#ef4444',
    topics: [
      {
        title: 'Encapsulation — API Service Layer',
        where: 'Backend route handlers encapsulate database logic. The frontend API client (client/src/api.ts) encapsulates HTTP details.',
        how: 'The api.ts module exposes clean functions like searchFlights() and createBooking(). Internally, it handles URL construction, JSON parsing, error handling, and authentication. The rest of the app doesn\'t know or care about HTTP — it just calls functions.',
        why: 'Encapsulation hides complexity. If we switch from REST to GraphQL, we change only api.ts — every component that uses it continues working unchanged.',
        realWorld: 'When you use a TV remote, you press "Volume Up" without knowing the infrared signal encoding. The remote encapsulates the complexity. Our API client does the same for HTTP requests.',
      },
      {
        title: 'Interfaces & Type Safety (TypeScript)',
        where: 'TypeScript interfaces throughout: FlightResult, BookingDetail, SeatInfo, PaymentRequest, etc.',
        how: 'Every data structure has a TypeScript interface defining its shape. FlightResult specifies that pricing.economy is a number and origin.city is a string. The compiler catches errors at build time — if you try to access flight.prce (typo), it\'s caught immediately.',
        why: 'Interfaces are contracts. They guarantee that data flowing between frontend and backend has the expected shape. Without them, a renamed API field could silently break the UI.',
        realWorld: 'USB is an interface standard — any USB device works in any USB port because both sides follow the same contract. TypeScript interfaces work the same way for data.',
      },
      {
        title: 'Component Composition (React)',
        where: 'React components: Header, Footer, ChatPanel, SeatMap2D, FlightCard — each is a self-contained, reusable unit.',
        how: 'Each component manages its own state and rendering. The SeatMap2D component receives seat data as props and handles click events internally. It can be used in the booking flow, in a standalone viewer, or embedded in any other page.',
        why: 'Composition over inheritance. Instead of one massive page, we build small, focused components and compose them together. Each can be tested, modified, and reused independently.',
        realWorld: 'LEGO bricks are the perfect analogy. Each brick (component) is simple on its own, but combining them creates complex structures. React\'s component model works exactly like this.',
      },
      {
        title: 'Design Patterns — Observer & Strategy',
        where: 'React\'s state management (useState/useEffect) implements the Observer pattern. The payment system uses the Strategy pattern.',
        how: 'When selectedSeats state changes, every component observing it (seat map, price breakdown, step indicator) automatically re-renders — that\'s the Observer pattern. The payment processor can handle different methods (card, UPI) through a common interface — that\'s Strategy.',
        why: 'Patterns solve recurring problems elegantly. Observer keeps the UI in sync without manual updates. Strategy lets us add new payment methods without changing existing code.',
        realWorld: 'YouTube subscriptions are the Observer pattern — when a channel posts, all subscribers get notified. Food delivery apps use Strategy — same checkout flow, different payment methods (card, wallet, cash).',
      },
    ],
  },
  {
    id: 'python-ml',
    icon: <Brain size={24} />,
    name: 'Python / ML',
    fullName: 'Python & Machine Learning',
    color: '#22c55e',
    topics: [
      {
        title: 'Logistic Regression — No-Show Prediction',
        where: 'ML service — the no-show prediction model uses scikit-learn\'s LogisticRegression.',
        how: 'The model takes features (booking lead time, fare class, day of week, route, passenger history) and predicts the probability a passenger will not show up. It outputs a value between 0 (will definitely show) and 1 (will definitely no-show). The sigmoid function S(x) = 1/(1+e^(-x)) maps any input to this 0-1 range.',
        why: 'Logistic regression is ideal for binary classification (show/no-show) with interpretable outputs. Unlike a neural network, we can explain exactly why a prediction was made — "booking lead time was the strongest factor."',
        realWorld: 'Airlines have used no-show prediction since the 1960s. United Airlines estimates that no-show rates vary from 2% (business class, booked early) to 15% (economy, booked last-minute). Our model captures these same patterns.',
        diagram: `graph LR
    A[Input Features] --> B[Lead Time: 14 days]
    A --> C[Fare Class: Economy]
    A --> D[Day: Friday]
    A --> E[Route: JFK-LHR]
    B --> F[Logistic Regression]
    C --> F
    D --> F
    E --> F
    F --> G[P no-show = 0.08]
    G --> H{P > threshold?}
    H -->|No| I[Normal booking]
    H -->|Yes| J[Flag for overbooking]
    style F fill:#8b5cf6,color:#fff
    style G fill:#22c55e,color:#fff`,
      },
      {
        title: 'Feature Engineering',
        where: 'ML service data preprocessing — raw booking data is transformed into meaningful model inputs.',
        how: 'Raw data like "booked on September 1st for October 5th flight" becomes "lead time = 34 days." Categorical data like fare class is one-hot encoded (economy → [1,0,0], business → [0,1,0]). Time features are extracted (day of week, hour of departure).',
        why: 'ML models can\'t understand raw text or dates. Feature engineering translates human-readable data into numbers the model can learn from. Better features = better predictions.',
        realWorld: 'Netflix doesn\'t feed raw movie titles into its recommendation engine. It engineers features: genre, director, average rating, your watch history. Same principle — transform raw data into predictive signals.',
      },
      {
        title: 'Train-Test Split & Model Evaluation',
        where: 'ML service model training — data is split 80/20 for training and testing.',
        how: 'We randomly divide 10,000 synthetic booking records: 8,000 for training (the model learns from these) and 2,000 for testing (we check accuracy on data the model has never seen). Metrics include accuracy, precision, recall, and F1 score.',
        why: 'Testing on training data gives false confidence. A student who memorizes the answer key gets 100% — but can they solve new problems? The test set checks for genuine understanding, not memorization.',
        realWorld: 'Medical drug trials work the same way. A drug tested only on the development group might seem perfect. Real efficacy is measured on a separate, unseen patient group.',
      },
      {
        title: 'Overbooking Strategy (Applied ML)',
        where: 'The no-show model\'s output feeds into the booking engine\'s overbooking limit.',
        how: 'If the model predicts 8% no-shows on a 180-seat flight, we might allow 180 × 1.05 = 189 bookings (capped at 5% over capacity). The cap prevents aggressive overbooking while still optimizing revenue. Each flight\'s limit is calculated individually based on its specific prediction.',
        why: 'Empty seats on a departed flight are lost revenue — forever. Controlled overbooking, guided by ML, recovers this revenue while keeping the risk of denied boarding extremely low.',
        realWorld: 'Almost every airline globally overbooks. Delta Airlines overbooks by 2-5% depending on the route. They use ML models very similar to ours, just trained on decades of real data instead of synthetic data.',
      },
    ],
  },
];

/* ================================================================
   SECTION 2: END-TO-END SYSTEM BLUEPRINT DATA
   ================================================================ */

interface WorkflowStep {
  stepNumber: number;
  title: string;
  icon: React.ReactNode;
  subjectBadges: { name: string; color: string; unit: string }[];
  description: string;
  formula?: string;
  sqlSnippet?: string;
  logicGate?: string;
  dataStructure?: string;
  javaTrace?: string;
}

const workflowSteps: WorkflowStep[] = [
  {
    stepNumber: 1,
    title: 'User Registration & Identity Verification',
    icon: <Users size={20} />,
    subjectBadges: [
      { name: 'DBMS', color: '#3b82f6', unit: 'Unit I & II' },
      { name: 'DMGT', color: '#8b5cf6', unit: 'Unit I — Propositional Logic' },
    ],
    description: 'Enforces relational keys, non-null fields, and unique email/phone constraints. Evaluates identity validation rules using propositional logic.',
    formula: 'ValidPassenger = (Nationality = \'Indian\' ∧ ValidGovtID) ∨ (Nationality = \'Foreign\' ∧ ValidPassport)',
    sqlSnippet: `CREATE TABLE passengers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nationality TEXT DEFAULT 'Indian',
  id_type TEXT DEFAULT 'Aadhaar Card',
  id_number TEXT,
  CONSTRAINT valid_passenger CHECK(
    (nationality = 'Indian' AND id_type IN ('Aadhaar Card','Driving License','Voter ID','PAN Card'))
    OR (nationality != 'Indian' AND id_type = 'Passport')
  )
);`,
    logicGate: `DMGT Propositional Logic Evaluation:
  P = "Nationality is Indian"    → TRUE
  Q = "Has valid Govt ID"        → TRUE  (Aadhaar: 4829 1049 8821)
  R = "Nationality is Foreign"   → FALSE
  S = "Has valid Passport"       → N/A

  ValidPassenger = (P ∧ Q) ∨ (R ∧ S)
                 = (TRUE ∧ TRUE) ∨ (FALSE ∧ N/A)
                 = TRUE ∨ FALSE
                 = TRUE  ✓ Identity Verified`,
  },
  {
    stepNumber: 2,
    title: 'Flight Search & Route Discovery',
    icon: <Layers size={20} />,
    subjectBadges: [
      { name: 'ADSA', color: '#f59e0b', unit: 'Unit II — Graph Traversal' },
      { name: 'DMGT', color: '#8b5cf6', unit: 'Unit II — Set Theory' },
    ],
    description: 'Uses Dijkstra\'s Algorithm / BFS across the flight connection graph to return direct and multi-hop route alternatives. Computes real-time physical seat availability via explicit set difference.',
    formula: 'AvailableSeats = AllConfiguredSeats ∖ BookedSeats',
    sqlSnippet: `-- Flight Search Query (uses B-tree index on origin, destination, departure_time)
SELECT f.id, f.flight_number, f.departure_time, f.arrival_time,
       f.base_price_economy, a.model AS aircraft
FROM flights f
JOIN aircraft a ON f.aircraft_id = a.id
WHERE f.origin = 'VTZ' AND f.destination = 'HYD'
  AND f.departure_time >= '2026-10-15T00:00:00'
  AND f.departure_time <  '2026-10-16T00:00:00'
  AND f.status = 'scheduled'
ORDER BY f.base_price_economy ASC;`,
    dataStructure: `ADSA — Dijkstra's Algorithm (Route Graph):
  Graph G = (V, E) where V = {airports}, E = {flights}
  
  Queue: [(VTZ, 0)]
  Visit VTZ → neighbors: {HYD: ₹4,200 direct}
  
  Shortest path: VTZ → HYD
  Distance: ₹4,200 | Duration: 65 min
  Complexity: O((V + E) log V) with min-heap`,
  },
  {
    stepNumber: 3,
    title: 'Interactive Seat Map & State Lookup',
    icon: <Zap size={20} />,
    subjectBadges: [
      { name: 'ADSA', color: '#f59e0b', unit: 'Unit I — Balanced Trees' },
    ],
    description: 'Queries the in-memory B-Tree index by (flight_id, seat_no) to fetch status in O(log n) time without full table scans.',
    formula: 'Lookup Time = O(log n) via B-Tree index on (flight_id, seat_number)',
    sqlSnippet: `-- Seat status lookup via B-Tree index (O(log n))
SELECT bs.seat_number, bs.seat_class, 'booked' AS status
FROM booking_seats bs
WHERE bs.flight_id = 42
UNION ALL
SELECT sl.seat_number, 'economy' AS seat_class, 'locked' AS status
FROM seat_locks sl
WHERE sl.flight_id = 42 AND sl.expires_at > datetime('now');`,
    dataStructure: `ADSA — B-Tree Index Internal State:
  B-Tree Order: 4 | Height: 3 | Keys: 180 seats
  
  Search: key = (42, '14A')
  
  Root [12A|18C|24F]
       ↓ left
  Node [3B|6D|9F|12A]
       ↓ right  
  Leaf [12A|12B|12C|14A|14B|14C]
            Found → seat_class: economy
                    status: available ✓
  
  Comparisons: 3 (vs 180 sequential scan)
  Time: O(log₄ 180) ≈ O(3.75) → 4 comparisons max`,
  },
  {
    stepNumber: 4,
    title: 'Concurrency Guard & Atomic Seat Hold',
    icon: <Shield size={20} />,
    subjectBadges: [
      { name: 'DBMS', color: '#3b82f6', unit: 'Unit V — ACID Transactions' },
      { name: 'DBMS', color: '#3b82f6', unit: 'Unit II — Keys & Constraints' },
    ],
    description: 'Triggers an atomic transaction with pessimistic locking. Enforces UNIQUE(flight_id, seat_id) so any simultaneous race-condition attempt on the same seat throws an immediate IntegrityError.',
    sqlSnippet: `-- ACID Transaction with Pessimistic Row Locking
BEGIN TRANSACTION;

-- Step 1: Verify seat is still available (atomic check)
SELECT status FROM booking_seats
WHERE flight_id = 42 AND seat_number = '14A';
-- Result: 0 rows → seat is free

-- Step 2: Lock the seat temporarily (5-min hold)
INSERT INTO seat_locks (flight_id, seat_number, session_id, expires_at)
VALUES (42, '14A', 'sess_abc123', datetime('now', '+5 minutes'));

-- Step 3: UNIQUE constraint prevents double-booking
-- If another session tries: UNIQUE constraint violation → ROLLBACK

COMMIT;  -- Atomicity: all or nothing`,
    logicGate: `DBMS ACID Properties Verification:
  [A] Atomicity   → BEGIN/COMMIT wraps all 3 steps
  [C] Consistency → UNIQUE(flight_id, seat_number) enforced
  [I] Isolation   → Row-level lock prevents race conditions  
  [D] Durability  → WAL journal persists committed data

  Concurrent Request Scenario:
    Session A: INSERT seat_lock('14A') → ✓ SUCCESS
    Session B: INSERT seat_lock('14A') → ✗ UNIQUE VIOLATION
    Result: Only one session holds the seat`,
  },
  {
    stepNumber: 5,
    title: 'Dynamic Overbooking & ML Evaluation',
    icon: <Brain size={20} />,
    subjectBadges: [
      { name: 'Python/ML', color: '#22c55e', unit: 'Supervised Learning — Logistic Regression' },
    ],
    description: 'Analyzes passenger features (lead time, fare type, route cancellation history) and calculates the individual no-show risk P(no-show) via the Sigmoid function.',
    formula: 'OverbookingCap = ⌊FlightCapacity × P(no-show)⌋',
    javaTrace: `// ML Service — No-Show Prediction Engine
// Python (scikit-learn LogisticRegression)

features = {
    "lead_time": 14,          // days before departure
    "fare_class": "economy",  // one-hot: [1, 0, 0]
    "is_weekend": 0,          // Saturday flight? No
    "group_size": 2,          // 2 passengers
    "flight_duration": 1.08,  // hours (65 min)
}

// Sigmoid: S(z) = 1 / (1 + e^(-z))
z = w₁·14 + w₂·1 + w₃·0 + w₄·2 + w₅·1.08 + bias
z = (-0.02)(14) + (0.35)(1) + (0)(0) + (-0.15)(2) + (0.08)(1.08) + (-1.2)
z = -0.28 + 0.35 + 0 - 0.30 + 0.086 - 1.2 = -1.344

P(no-show) = 1 / (1 + e^1.344) = 1 / (1 + 3.834) = 0.207

// Overbooking decision:
// FlightCapacity = 180, P(no-show) = 0.207
// OverbookingCap = ⌊180 × 0.207⌋ = ⌊37.26⌋ = 37
// Capped at 5% = max(9, 37) → Allow 189 bookings`,
  },
  {
    stepNumber: 6,
    title: 'Overflow Standby & Priority Waitlist',
    icon: <Activity size={20} />,
    subjectBadges: [
      { name: 'ADSA', color: '#f59e0b', unit: 'Unit II — Priority Queue / Max-Heap' },
    ],
    description: 'If confirmed and overbooking capacity are full, routes the passenger to the WaitlistHeap ordered by PriorityScore. When a cancellation occurs, extract_max() promotes the standby passenger.',
    formula: 'PriorityScore = (TierWeight × 100) − BookingTimestamp',
    dataStructure: `ADSA — Max-Heap (Priority Waitlist):
  PriorityScore = (TierWeight × 100) − BookingTimestamp

  Waitlist Heap State:
                [Platinum: 892]
               /              \\
        [Gold: 784]      [Silver: 671]
       /          \\
  [Std: 412]  [Std: 389]

  → Cancellation Event on Flight #42!
  → extract_max() → Platinum passenger (score: 892)
  → Auto-promote to CONFIRMED status
  → Send SMS + Email notification
  
  New Heap State:
                [Gold: 784]
               /            \\
        [Std: 412]     [Silver: 671]
       /
  [Std: 389]
  
  Time Complexity: O(log n) for extract + heapify`,
  },
  {
    stepNumber: 7,
    title: 'Payment Processing & PNR Generation',
    icon: <CreditCard size={20} />,
    subjectBadges: [
      { name: 'OOPJ', color: '#ef4444', unit: 'Units I-IV' },
    ],
    description: 'Coordinates domain entities (Flight, Passenger, Booking), handles polymorphic refund policies via strategy interfaces, and manages database transactions safely using try-catch-finally blocks.',
    sqlSnippet: `-- Final booking confirmation & PNR generation
BEGIN TRANSACTION;

-- Insert confirmed booking with generated PNR
INSERT INTO bookings (pnr, flight_id, contact_email, contact_phone,
                      total_amount, currency, status, fare_class)
VALUES ('SK-784210', 42, 'rajesh.sharma@gmail.com', '+91 98480 22334',
        8400, 'INR', 'confirmed', 'economy');

-- Insert passengers
INSERT INTO passengers (booking_id, first_name, last_name, nationality, id_type, id_number)
VALUES (11, 'Rajesh', 'Sharma', 'Indian', 'Aadhaar Card', '4829 1049 8821');

-- Assign seat (UNIQUE constraint = final guard)
INSERT INTO booking_seats (booking_id, flight_id, passenger_id, seat_number, seat_class)
VALUES (11, 42, 22, '14A', 'economy');

-- Record payment
INSERT INTO payments (booking_id, amount, currency, method, status, transaction_id, upi_id)
VALUES (11, 8400, 'INR', 'upi', 'completed', 'TXN-UPI-98421', 'rajesh@okhdfcbank');

-- Release seat lock
DELETE FROM seat_locks WHERE flight_id = 42 AND seat_number = '14A';

COMMIT;  -- ✓ ACID guarantee: booking is fully atomic`,
    javaTrace: `// OOPJ — Strategy Pattern for Payment Processing
// TypeScript (equivalent to Java interface polymorphism)

interface PaymentStrategy {
  processPayment(amount: number, details: PaymentDetails): PaymentResult;
  processRefund(transactionId: string): RefundResult;
}

class UPIPaymentStrategy implements PaymentStrategy {
  processPayment(amount: number, details: PaymentDetails): PaymentResult {
    // Validate UPI ID format: username@bankhandle
    if (!details.upiId?.match(/^[a-zA-Z0-9.]+@[a-z]+$/)) {
      throw new ValidationError('Invalid UPI ID format');
    }
    return {
      success: true,
      transactionId: 'TXN-UPI-' + generateId(),
      method: 'upi',
      amount: amount  // ₹8,400.00
    };
  }
}

// Strategy selection (polymorphism):
const strategy = PaymentStrategyFactory.create(method);
// method = 'upi' → new UPIPaymentStrategy()
// method = 'card' → new CardPaymentStrategy()
// method = 'netbanking' → new NetBankingPaymentStrategy()

const result = strategy.processPayment(8400, paymentDetails);
// try-catch-finally ensures cleanup on failure`,
  },
];

/* ================================================================
   SECTION 3: LIVE EXECUTION TRACE SIMULATOR
   ================================================================ */

interface SimulatorState {
  isRunning: boolean;
  currentStep: number;
  completedSteps: number[];
  terminalLines: TerminalLine[];
  passengerName: string;
  route: string;
  seat: string;
  nationality: string;
  idType: string;
}

interface TerminalLine {
  text: string;
  type: 'info' | 'sql' | 'logic' | 'data-structure' | 'success' | 'warning' | 'header' | 'result';
  timestamp: string;
}

const simulatorScenarios = [
  { name: 'Rajesh Sharma', route: 'VTZ → HYD', seat: '14A', nationality: 'Indian', idType: 'Aadhaar' },
  { name: 'Priya Reddy', route: 'BLR → DEL', seat: '22F', nationality: 'Indian', idType: 'Driving License' },
  { name: 'John Mitchell', route: 'BOM → DXB', seat: '8A', nationality: 'Foreign', idType: 'Passport' },
  { name: 'Ananya Verma', route: 'DEL → LHR', seat: '28A', nationality: 'Indian', idType: 'Passport' },
];

function generateTerminalOutput(step: number, scenario: typeof simulatorScenarios[0]): TerminalLine[] {
  const now = () => new Date().toISOString().split('T')[1].split('.')[0];
  const lines: TerminalLine[] = [];

  switch (step) {
    case 0:
      lines.push(
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `STEP 1: USER REGISTRATION & IDENTITY VERIFICATION`, type: 'header', timestamp: now() },
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `[DBMS] Enforcing relational constraints...`, type: 'info', timestamp: now() },
        { text: `INSERT INTO passengers (first_name, last_name, nationality, id_type, id_number)`, type: 'sql', timestamp: now() },
        { text: `VALUES ('${scenario.name.split(' ')[0]}', '${scenario.name.split(' ')[1]}', '${scenario.nationality}', '${scenario.idType}', '****');`, type: 'sql', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `[DMGT] Propositional Logic Gate Evaluation:`, type: 'logic', timestamp: now() },
        { text: `  P = "Nationality is ${scenario.nationality}" → TRUE`, type: 'logic', timestamp: now() },
        { text: `  Q = "Has valid ${scenario.idType}" → TRUE`, type: 'logic', timestamp: now() },
      );
      if (scenario.nationality === 'Indian') {
        lines.push(
          { text: `  ValidPassenger = (P ∧ Q) ∨ (R ∧ S)`, type: 'logic', timestamp: now() },
          { text: `                 = (TRUE ∧ TRUE) ∨ (FALSE ∧ N/A) = TRUE`, type: 'logic', timestamp: now() },
        );
      } else {
        lines.push(
          { text: `  ValidPassenger = (P ∧ Q) ∨ (R ∧ S)`, type: 'logic', timestamp: now() },
          { text: `                 = (FALSE ∧ N/A) ∨ (TRUE ∧ TRUE) = TRUE`, type: 'logic', timestamp: now() },
        );
      }
      lines.push({ text: `✓ Identity verified for ${scenario.name}`, type: 'success', timestamp: now() });
      break;

    case 1: {
      const [origin, dest] = scenario.route.split(' → ');
      lines.push(
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `STEP 2: FLIGHT SEARCH & ROUTE DISCOVERY`, type: 'header', timestamp: now() },
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `[ADSA] Building route graph G = (V, E)...`, type: 'data-structure', timestamp: now() },
        { text: `  Vertices: {${origin}, ${dest}, ...28 airports}`, type: 'data-structure', timestamp: now() },
        { text: `  Dijkstra: source=${origin}, target=${dest}`, type: 'data-structure', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `[DBMS] Executing indexed search query:`, type: 'info', timestamp: now() },
        { text: `SELECT f.id, f.flight_number, f.base_price_economy`, type: 'sql', timestamp: now() },
        { text: `FROM flights f WHERE f.origin='${origin}' AND f.destination='${dest}'`, type: 'sql', timestamp: now() },
        { text: `  AND f.status = 'scheduled' ORDER BY base_price_economy;`, type: 'sql', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `[DMGT] Set Theory — Availability Computation:`, type: 'logic', timestamp: now() },
        { text: `  U (AllSeats)     = {1A..30F}  |U| = 180`, type: 'logic', timestamp: now() },
        { text: `  B (BookedSeats)  = {12A, 12B, 15C, ...}  |B| = 23`, type: 'logic', timestamp: now() },
        { text: `  L (LockedSeats)  = {8F}  |L| = 1`, type: 'logic', timestamp: now() },
        { text: `  Available = U ∖ B ∖ L = 180 - 23 - 1 = 156 seats`, type: 'logic', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `✓ Found 4 flights on ${origin}→${dest} route`, type: 'success', timestamp: now() },
        { text: `  Cheapest: ₹4,200 (SV-701A) | Fastest: 65 min`, type: 'result', timestamp: now() },
      );
      break;
    }

    case 2:
      lines.push(
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `STEP 3: INTERACTIVE SEAT MAP & STATE LOOKUP`, type: 'header', timestamp: now() },
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `[ADSA] B-Tree Index Query:`, type: 'data-structure', timestamp: now() },
        { text: `  Index: idx_booking_seats_flight (flight_id, seat_number)`, type: 'data-structure', timestamp: now() },
        { text: `  Search key: (42, '${scenario.seat}')`, type: 'data-structure', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `  B-Tree traversal:`, type: 'data-structure', timestamp: now() },
        { text: `    Level 0 (Root): [12A | 18C | 24F] → go LEFT`, type: 'data-structure', timestamp: now() },
        { text: `    Level 1:        [3B | 6D | 9F | 12A] → go RIGHT`, type: 'data-structure', timestamp: now() },
        { text: `    Level 2 (Leaf): [12A | 12B | 14A | 14B] → FOUND`, type: 'data-structure', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `  Comparisons: 3 (vs 180 sequential scan)`, type: 'result', timestamp: now() },
        { text: `  Time: O(log₄ 180) ≈ 3.75 → 4 max`, type: 'result', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `SELECT seat_number, seat_class FROM booking_seats`, type: 'sql', timestamp: now() },
        { text: `WHERE flight_id = 42 AND seat_number = '${scenario.seat}';`, type: 'sql', timestamp: now() },
        { text: `  → Result: 0 rows (seat is AVAILABLE)`, type: 'result', timestamp: now() },
        { text: `✓ Seat ${scenario.seat} is available — rendering on seat map`, type: 'success', timestamp: now() },
      );
      break;

    case 3:
      lines.push(
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `STEP 4: CONCURRENCY GUARD & ATOMIC SEAT HOLD`, type: 'header', timestamp: now() },
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `[DBMS] Initiating ACID transaction...`, type: 'info', timestamp: now() },
        { text: `BEGIN TRANSACTION;`, type: 'sql', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `-- Verify: no existing lock or booking on seat`, type: 'sql', timestamp: now() },
        { text: `SELECT 1 FROM seat_locks WHERE flight_id=42 AND seat_number='${scenario.seat}';`, type: 'sql', timestamp: now() },
        { text: `  → 0 rows: no active lock`, type: 'result', timestamp: now() },
        { text: `SELECT 1 FROM booking_seats WHERE flight_id=42 AND seat_number='${scenario.seat}';`, type: 'sql', timestamp: now() },
        { text: `  → 0 rows: seat not booked`, type: 'result', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `-- Acquire pessimistic lock (5-minute hold)`, type: 'sql', timestamp: now() },
        { text: `INSERT INTO seat_locks (flight_id, seat_number, session_id, expires_at)`, type: 'sql', timestamp: now() },
        { text: `VALUES (42, '${scenario.seat}', 'sess_${Math.random().toString(36).slice(2,8)}', datetime('now','+5 minutes'));`, type: 'sql', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `COMMIT;`, type: 'sql', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `[DBMS] ACID Verification:`, type: 'logic', timestamp: now() },
        { text: `  [A] Atomicity   → Transaction wraps all checks + lock ✓`, type: 'logic', timestamp: now() },
        { text: `  [C] Consistency → UNIQUE(flight_id, seat_number) active ✓`, type: 'logic', timestamp: now() },
        { text: `  [I] Isolation   → Row locked, concurrent inserts blocked ✓`, type: 'logic', timestamp: now() },
        { text: `  [D] Durability  → WAL journal_mode ensures persistence ✓`, type: 'logic', timestamp: now() },
        { text: `✓ Seat ${scenario.seat} locked for ${scenario.name} (5-min hold window)`, type: 'success', timestamp: now() },
      );
      break;

    case 4: {
      const noShowProb = (0.05 + Math.random() * 0.15).toFixed(3);
      const cap = Math.floor(180 * parseFloat(noShowProb));
      lines.push(
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `STEP 5: DYNAMIC OVERBOOKING & ML EVALUATION`, type: 'header', timestamp: now() },
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `[ML Service] Logistic Regression — No-Show Prediction`, type: 'info', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `  Input features:`, type: 'data-structure', timestamp: now() },
        { text: `    lead_time        = 14 days`, type: 'data-structure', timestamp: now() },
        { text: `    fare_class       = economy  → one-hot: [1, 0, 0]`, type: 'data-structure', timestamp: now() },
        { text: `    is_weekend       = 0`, type: 'data-structure', timestamp: now() },
        { text: `    group_size       = 1`, type: 'data-structure', timestamp: now() },
        { text: `    flight_duration  = 1.08 hours`, type: 'data-structure', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `  Sigmoid function: S(z) = 1 / (1 + e^(-z))`, type: 'logic', timestamp: now() },
        { text: `  z = Σ(wᵢ·xᵢ) + bias`, type: 'logic', timestamp: now() },
        { text: `  z = (-0.02)(14) + (0.35)(1) + (0)(0) + (-0.15)(1) + (0.08)(1.08) + (-1.2)`, type: 'logic', timestamp: now() },
        { text: `  z = -1.344`, type: 'logic', timestamp: now() },
        { text: `  P(no-show) = 1 / (1 + e^1.344) = ${noShowProb}`, type: 'result', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `  OverbookingCap = ⌊180 × ${noShowProb}⌋ = ${cap}`, type: 'result', timestamp: now() },
        { text: `  Capped at 5% max = min(${cap}, 9) → Allow ${180 + Math.min(cap, 9)} bookings`, type: 'result', timestamp: now() },
        { text: `✓ ML evaluation complete — overbooking within safe limits`, type: 'success', timestamp: now() },
      );
      break;
    }

    case 5:
      lines.push(
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `STEP 6: OVERFLOW STANDBY & PRIORITY WAITLIST`, type: 'header', timestamp: now() },
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `[ADSA] Max-Heap Priority Queue Check:`, type: 'data-structure', timestamp: now() },
        { text: `  Current booking count: 156 / 180 capacity`, type: 'data-structure', timestamp: now() },
        { text: `  Overbooking buffer: 9 extra allowed`, type: 'data-structure', timestamp: now() },
        { text: `  Status: ✓ CONFIRMED seat available (no waitlist needed)`, type: 'result', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `  [Waitlist Heap — Current State]:`, type: 'data-structure', timestamp: now() },
        { text: `           ┌─────────────────┐`, type: 'data-structure', timestamp: now() },
        { text: `           │ Platinum: 892   │ ← max`, type: 'data-structure', timestamp: now() },
        { text: `           └────┬────────┬───┘`, type: 'data-structure', timestamp: now() },
        { text: `         ┌──────┴──┐  ┌──┴───────┐`, type: 'data-structure', timestamp: now() },
        { text: `         │Gold: 784│  │Silver:671│`, type: 'data-structure', timestamp: now() },
        { text: `         └─────────┘  └──────────┘`, type: 'data-structure', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `  PriorityScore formula:`, type: 'logic', timestamp: now() },
        { text: `    Score = (TierWeight × 100) − BookingTimestamp`, type: 'logic', timestamp: now() },
        { text: `    ${scenario.name}: Standard tier`, type: 'logic', timestamp: now() },
        { text: `    Score = (1 × 100) − 1695648000 = ... (lowest priority)`, type: 'logic', timestamp: now() },
        { text: `✓ Seat confirmed directly — waitlist not triggered`, type: 'success', timestamp: now() },
      );
      break;

    case 6: {
      const pnr = 'SK-' + Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      lines.push(
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `STEP 7: PAYMENT PROCESSING & PNR GENERATION`, type: 'header', timestamp: now() },
        { text: `════════════════════════════════════════`, type: 'header', timestamp: now() },
        { text: `[OOPJ] Strategy Pattern — Payment Processing:`, type: 'info', timestamp: now() },
        { text: `  PaymentStrategyFactory.create('upi')`, type: 'data-structure', timestamp: now() },
        { text: `    → Instantiating UPIPaymentStrategy`, type: 'data-structure', timestamp: now() },
        { text: `    → Validating UPI ID: rajesh@okhdfcbank ✓`, type: 'data-structure', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `[DBMS] Final atomic booking transaction:`, type: 'info', timestamp: now() },
        { text: `BEGIN TRANSACTION;`, type: 'sql', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `INSERT INTO bookings (pnr, flight_id, contact_email, total_amount, status)`, type: 'sql', timestamp: now() },
        { text: `VALUES ('${pnr}', 42, '${scenario.name.toLowerCase().replace(' ','.')}@gmail.com', 8400, 'confirmed');`, type: 'sql', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `INSERT INTO booking_seats (booking_id, flight_id, passenger_id, seat_number)`, type: 'sql', timestamp: now() },
        { text: `VALUES (LAST_ID, 42, LAST_PAX_ID, '${scenario.seat}');`, type: 'sql', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `INSERT INTO payments (booking_id, amount, currency, method, status, transaction_id)`, type: 'sql', timestamp: now() },
        { text: `VALUES (LAST_ID, 8400, 'INR', 'upi', 'completed', 'TXN-UPI-${Math.random().toString().slice(2,7)}');`, type: 'sql', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `DELETE FROM seat_locks WHERE flight_id=42 AND seat_number='${scenario.seat}';`, type: 'sql', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `COMMIT;`, type: 'sql', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `[OOPJ] try-catch-finally: Transaction committed successfully`, type: 'result', timestamp: now() },
        { text: `[PNR] Generated: ${pnr} (32⁶ = 1,073,741,824 possible codes)`, type: 'result', timestamp: now() },
        { text: ``, type: 'info', timestamp: now() },
        { text: `══════════════════════════════════════════`, type: 'success', timestamp: now() },
        { text: `✅ BOOKING CONFIRMED`, type: 'success', timestamp: now() },
        { text: `   Passenger: ${scenario.name}`, type: 'success', timestamp: now() },
        { text: `   Route:     ${scenario.route}`, type: 'success', timestamp: now() },
        { text: `   Seat:      ${scenario.seat} (Economy)`, type: 'success', timestamp: now() },
        { text: `   PNR:       ${pnr}`, type: 'success', timestamp: now() },
        { text: `   Amount:    ₹8,400`, type: 'success', timestamp: now() },
        { text: `   Payment:   UPI (rajesh@okhdfcbank)`, type: 'success', timestamp: now() },
        { text: `══════════════════════════════════════════`, type: 'success', timestamp: now() },
      );
      break;
    }
  }

  return lines;
}


/* ================================================================
   SECTION 4: MAIN PAGE COMPONENT
   ================================================================ */

export function SubjectsPage() {
  const [activeTab, setActiveTab] = useState<'curriculum' | 'blueprint' | 'simulator'>('curriculum');
  const [openSubject, setOpenSubject] = useState<string>('dbms');
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set(['Entity-Relationship (ER) Modeling']));

  const toggleTopic = (title: string) => {
    setOpenTopics(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <div style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
      <div className="container">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Page Header */}
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            Academic Curriculum & System Architecture
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', lineHeight: 1.7, maxWidth: 800 }}>
            Explore how five academic subjects converge into a production-grade airline reservation system.
            Navigate the curriculum reference, the end-to-end system blueprint, or run a live execution trace.
          </p>

          {/* Main Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-1)',
            marginBottom: 'var(--space-8)',
            background: 'var(--color-gray-100)',
            borderRadius: 'var(--radius-xl)',
            padding: 4,
            width: 'fit-content',
          }}>
            {[
              { key: 'curriculum' as const, label: 'Subject Curriculum', icon: <Database size={16} /> },
              { key: 'blueprint' as const, label: 'System Blueprint', icon: <Layers size={16} /> },
              { key: 'simulator' as const, label: 'Live Execution Trace', icon: <Terminal size={16} /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-lg)',
                  fontWeight: 600,
                  fontSize: 'var(--text-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  background: activeTab === tab.key ? 'var(--surface-primary)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'curriculum' && (
            <CurriculumTab
              openSubject={openSubject}
              setOpenSubject={setOpenSubject}
              openTopics={openTopics}
              toggleTopic={toggleTopic}
            />
          )}
          {activeTab === 'blueprint' && <BlueprintTab />}
          {activeTab === 'simulator' && <SimulatorTab />}
        </div>
      </div>
    </div>
  );
}


/* ================================================================
   TAB 1: CURRICULUM (Preserved from original)
   ================================================================ */

function CurriculumTab({
  openSubject,
  setOpenSubject,
  openTopics,
  toggleTopic,
}: {
  openSubject: string;
  setOpenSubject: (id: string) => void;
  openTopics: Set<string>;
  toggleTopic: (title: string) => void;
}) {
  return (
    <div style={{ maxWidth: 900 }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-8)', lineHeight: 1.7 }}>
        This project applies concepts from five academic subjects. Each section below explains <strong>where</strong> the concept is used in this system,
        <strong> how</strong> it works in plain language, <strong>why</strong> it was the right choice, and provides a <strong>real-world example</strong> showing the same idea in action at real companies.
      </p>

      {/* Subject Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-8)', flexWrap: 'wrap' }}>
        {subjects.map(sub => (
          <button
            key={sub.id}
            className={`btn ${openSubject === sub.id ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setOpenSubject(sub.id)}
            style={openSubject === sub.id ? { background: sub.color, borderColor: sub.color } : {}}
          >
            {sub.icon}
            {sub.name}
          </button>
        ))}
      </div>

      {/* Active Subject Content */}
      {subjects.filter(s => s.id === openSubject).map(subject => (
        <div key={subject.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 'var(--radius-xl)',
              background: `${subject.color}15`,
              color: subject.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {subject.icon}
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{subject.fullName}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{subject.topics.length} concepts applied in this project</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {subject.topics.map(topic => {
              const isOpen = openTopics.has(topic.title);
              return (
                <div key={topic.title} className="card" style={{ border: isOpen ? `2px solid ${subject.color}30` : undefined }}>
                  <button
                    onClick={() => toggleTopic(topic.title)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      width: '100%',
                      padding: 'var(--space-5)',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: 'var(--text-base)',
                    }}
                  >
                    {isOpen ? <ChevronDown size={18} style={{ color: subject.color }} /> : <ChevronRight size={18} style={{ color: 'var(--text-tertiary)' }} />}
                    {topic.title}
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 var(--space-5) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                      <Section label="📍 Where it's used" color="#3b82f6" content={topic.where} />
                      <Section label="⚙️ How it works" color="#8b5cf6" content={topic.how} />
                      <Section label="💡 Why this approach" color="#f59e0b" content={topic.why} />
                      <Section label="🌍 Real-world example" color="#22c55e" content={topic.realWorld} />

                      {topic.diagram && (
                        <div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>📊 Interactive Architecture Diagram</span>
                          </div>
                          <MermaidViewer chart={topic.diagram} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}


/* ================================================================
   TAB 2: END-TO-END SYSTEM BLUEPRINT
   ================================================================ */

function BlueprintTab() {
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  const e2eDiagram = `graph TD
    subgraph PRES["🖥️ Presentation Layer"]
        A1["React 18 + TypeScript"]
        A2["Component Composition"]
        A3["Seat Map 2D/3D"]
    end

    subgraph ENGINE["⚙️ Application Engine"]
        B1["Express.js REST API"]
        B2["ACID Transaction Manager"]
        B3["PNR Generator"]
        B4["Seat Lock Manager"]
    end

    subgraph DB["🗄️ Persistence Layer"]
        C1["SQLite + sql.js"]
        C2["B-Tree Indexes"]
        C3["WAL Journal"]
        C4["Foreign Key Constraints"]
    end

    subgraph ML["🧠 ML Service"]
        D1["Logistic Regression"]
        D2["Feature Engineering"]
        D3["No-Show Predictor"]
    end

    A1 -->|"HTTP REST"| B1
    A2 -->|"State Mgmt"| A3
    B1 -->|"SQL Queries"| C1
    B2 -->|"BEGIN/COMMIT"| C1
    B4 -->|"UNIQUE Constraints"| C3
    B1 -->|"Predict API"| D1
    D3 -->|"P(no-show)"| B2
    C2 -->|"O(log n) lookup"| B1

    style PRES fill:#1e293b,color:#e2e8f0,stroke:#38bdf8
    style ENGINE fill:#1e293b,color:#e2e8f0,stroke:#f59e0b
    style DB fill:#1e293b,color:#e2e8f0,stroke:#3b82f6
    style ML fill:#1e293b,color:#e2e8f0,stroke:#22c55e`;

  return (
    <div>
      {/* Architecture Overview */}
      <div className="card" style={{ marginBottom: 'var(--space-8)', padding: 'var(--space-6)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={22} style={{ color: 'var(--color-sky-500)' }} />
          System Architecture Overview
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', lineHeight: 1.7 }}>
          Four-layer architecture showing how the Presentation, Engine, Database, and ML layers interact.
          Each connection represents a specific academic subject concept in action.
        </p>
        <MermaidViewer chart={e2eDiagram} />
      </div>

      {/* End-to-End Workflow Steps */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ArrowRight size={22} style={{ color: 'var(--color-gold-500)' }} />
        End-to-End Passenger Journey: Registration → Booking Confirmation
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)', lineHeight: 1.7 }}>
        Click each step to see exactly which academic subject executes at every stage of the booking lifecycle.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {workflowSteps.map((step, idx) => {
          const isExpanded = expandedStep === idx;
          return (
            <div key={step.stepNumber} className="card" style={{
              border: isExpanded ? '2px solid var(--color-sky-400)' : undefined,
              transition: 'all var(--transition-base)',
            }}>
              {/* Step Header */}
              <button
                onClick={() => setExpandedStep(isExpanded ? null : idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  width: '100%',
                  padding: 'var(--space-4) var(--space-5)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {/* Step number badge */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-full)',
                  background: isExpanded
                    ? 'linear-gradient(135deg, var(--color-sky-500), var(--color-sky-600))'
                    : 'var(--color-gray-100)',
                  color: isExpanded ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 'var(--text-sm)',
                  flexShrink: 0,
                }}>
                  {step.stepNumber}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {step.icon}
                    {step.title}
                  </div>
                  {/* Subject badges */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {step.subjectBadges.map((badge, i) => (
                      <span key={i} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: `${badge.color}15`,
                        color: badge.color,
                        whiteSpace: 'nowrap',
                      }}>
                        {badge.name}: {badge.unit}
                      </span>
                    ))}
                  </div>
                </div>

                {isExpanded
                  ? <ChevronDown size={18} style={{ color: 'var(--color-sky-500)', flexShrink: 0 }} />
                  : <ChevronRight size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                }
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{
                  padding: '0 var(--space-5) var(--space-6)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-4)',
                  borderTop: '1px solid var(--color-gray-200)',
                  marginTop: 'var(--space-2)',
                  paddingTop: 'var(--space-4)',
                }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                    {step.description}
                  </p>

                  {step.formula && (
                    <div style={{
                      background: '#0b1120',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-4)',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-gold-400)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Mathematical Formula
                      </div>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: '#e2e8f0', lineHeight: 1.6 }}>
                        {step.formula}
                      </code>
                    </div>
                  )}

                  {step.sqlSnippet && (
                    <div style={{
                      background: '#0b1120',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-4)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ● DBMS — SQL Execution
                      </div>
                      <pre style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: '#a5f3fc',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        overflowX: 'auto',
                      }}>
                        {step.sqlSnippet}
                      </pre>
                    </div>
                  )}

                  {step.logicGate && (
                    <div style={{
                      background: '#0b1120',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-4)',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#8b5cf6', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ● DMGT — Logic / ACID Verification
                      </div>
                      <pre style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: '#c4b5fd',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        overflowX: 'auto',
                      }}>
                        {step.logicGate}
                      </pre>
                    </div>
                  )}

                  {step.dataStructure && (
                    <div style={{
                      background: '#0b1120',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-4)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ● ADSA — Data Structure State
                      </div>
                      <pre style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: '#fde68a',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        overflowX: 'auto',
                      }}>
                        {step.dataStructure}
                      </pre>
                    </div>
                  )}

                  {step.javaTrace && (
                    <div style={{
                      background: '#0b1120',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-4)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ● OOPJ / Python — Execution Trace
                      </div>
                      <pre style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: '#fca5a5',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        overflowX: 'auto',
                      }}>
                        {step.javaTrace}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ================================================================
   TAB 3: LIVE EXECUTION TRACE SIMULATOR
   ================================================================ */

function SimulatorTab() {
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [state, setState] = useState<SimulatorState>({
    isRunning: false,
    currentStep: -1,
    completedSteps: [],
    terminalLines: [],
    passengerName: simulatorScenarios[0].name,
    route: simulatorScenarios[0].route,
    seat: simulatorScenarios[0].seat,
    nationality: simulatorScenarios[0].nationality,
    idType: simulatorScenarios[0].idType,
  });

  const terminalRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollTerminal = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollTerminal();
  }, [state.terminalLines, scrollTerminal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const scenario = simulatorScenarios[selectedScenario];

  const runSimulation = useCallback(() => {
    const scenario = simulatorScenarios[selectedScenario];
    setState(prev => ({
      ...prev,
      isRunning: true,
      currentStep: 0,
      completedSteps: [],
      terminalLines: [
        { text: `╔══════════════════════════════════════════════════╗`, type: 'header', timestamp: new Date().toISOString().split('T')[1].split('.')[0] },
        { text: `║  SkyVoyage — Live Execution Trace Simulator      ║`, type: 'header', timestamp: new Date().toISOString().split('T')[1].split('.')[0] },
        { text: `║  Passenger: ${scenario.name.padEnd(36)}║`, type: 'header', timestamp: new Date().toISOString().split('T')[1].split('.')[0] },
        { text: `║  Route: ${scenario.route.padEnd(40)}║`, type: 'header', timestamp: new Date().toISOString().split('T')[1].split('.')[0] },
        { text: `║  Seat: ${scenario.seat.padEnd(41)}║`, type: 'header', timestamp: new Date().toISOString().split('T')[1].split('.')[0] },
        { text: `║  ID: ${(scenario.nationality + ' ' + scenario.idType).padEnd(43)}║`, type: 'header', timestamp: new Date().toISOString().split('T')[1].split('.')[0] },
        { text: `╚══════════════════════════════════════════════════╝`, type: 'header', timestamp: new Date().toISOString().split('T')[1].split('.')[0] },
        { text: ``, type: 'info', timestamp: new Date().toISOString().split('T')[1].split('.')[0] },
      ],
    }));

    // Animate through steps
    let stepIndex = 0;
    const runStep = () => {
      if (stepIndex >= 7) {
        setState(prev => ({ ...prev, isRunning: false, currentStep: -1 }));
        return;
      }

      const newLines = generateTerminalOutput(stepIndex, scenario);
      const currentIdx = stepIndex;
      setState(prev => ({
        ...prev,
        currentStep: currentIdx,
        completedSteps: [...prev.completedSteps, currentIdx],
        terminalLines: [...prev.terminalLines, ...newLines],
      }));

      stepIndex++;
      timeoutRef.current = setTimeout(runStep, 2200);
    };

    timeoutRef.current = setTimeout(runStep, 800);
  }, [selectedScenario]);

  const resetSimulation = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState({
      isRunning: false,
      currentStep: -1,
      completedSteps: [],
      terminalLines: [],
      passengerName: simulatorScenarios[selectedScenario].name,
      route: simulatorScenarios[selectedScenario].route,
      seat: simulatorScenarios[selectedScenario].seat,
      nationality: simulatorScenarios[selectedScenario].nationality,
      idType: simulatorScenarios[selectedScenario].idType,
    });
  }, [selectedScenario]);

  const getLineColor = (type: TerminalLine['type']): string => {
    switch (type) {
      case 'header': return '#fbbf24';
      case 'sql': return '#a5f3fc';
      case 'logic': return '#c4b5fd';
      case 'data-structure': return '#fde68a';
      case 'success': return '#86efac';
      case 'warning': return '#fde68a';
      case 'result': return '#93c5fd';
      case 'info':
      default: return '#94a3b8';
    }
  };

  const getLinePrefix = (type: TerminalLine['type']): string => {
    switch (type) {
      case 'sql': return '  ';
      case 'logic': return '  ';
      case 'data-structure': return '  ';
      default: return '';
    }
  };

  return (
    <div>
      {/* Scenario Selector */}
      <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} style={{ color: 'var(--color-gold-500)' }} />
          Select Booking Scenario
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
          Choose a sample passenger scenario, then click <strong>"Simulate Live Execution"</strong> to watch every system layer execute in real time —
          SQL queries, boolean logic gates, B-Tree traversals, ML probability scores, and OOP strategy patterns.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          {simulatorScenarios.map((sc, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedScenario(idx);
                if (!state.isRunning) resetSimulation();
              }}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: selectedScenario === idx ? '2px solid var(--color-sky-500)' : '1px solid var(--color-gray-200)',
                background: selectedScenario === idx ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{sc.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: 2 }}>
                {sc.route} • Seat {sc.seat} • {sc.nationality} ({sc.idType})
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button
            className="btn btn--primary"
            onClick={runSimulation}
            disabled={state.isRunning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: state.isRunning ? 0.6 : 1,
            }}
          >
            <Play size={16} />
            {state.isRunning ? 'Simulating...' : 'Simulate Live Execution'}
          </button>
          <button
            className="btn btn--secondary"
            onClick={resetSimulation}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </div>

      {/* Visual Pipeline Progress */}
      <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} style={{ color: 'var(--color-sky-500)' }} />
          Execution Pipeline
        </h3>
        <div style={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          paddingBottom: 'var(--space-2)',
        }}>
          {workflowSteps.map((step, idx) => {
            const isActive = state.currentStep === idx;
            const isCompleted = state.completedSteps.includes(idx);
            const isUpcoming = !isActive && !isCompleted;

            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all 0.4s ease',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(56, 189, 248, 0.1))'
                    : isCompleted
                      ? 'rgba(34, 197, 94, 0.08)'
                      : 'transparent',
                  border: isActive
                    ? '2px solid var(--color-sky-400)'
                    : isCompleted
                      ? '1px solid rgba(34, 197, 94, 0.3)'
                      : '1px solid var(--color-gray-200)',
                  minWidth: 80,
                  position: 'relative',
                  ...(isActive ? {
                    boxShadow: '0 0 20px rgba(14, 165, 233, 0.2)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  } : {}),
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive
                      ? 'var(--color-sky-500)'
                      : isCompleted
                        ? 'var(--color-success)'
                        : 'var(--color-gray-200)',
                    color: (isActive || isCompleted) ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.4s ease',
                  }}>
                    {isCompleted ? <CheckCircle size={14} /> : isActive ? <Clock size={14} /> : <span style={{ fontSize: '11px', fontWeight: 700 }}>{step.stepNumber}</span>}
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: isActive ? 'var(--color-sky-500)' : isCompleted ? 'var(--color-success)' : 'var(--text-tertiary)',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    maxWidth: 72,
                    overflow: 'hidden',
                  }}>
                    {step.title.split(' ').slice(0, 2).join(' ')}
                  </span>
                  {/* Subject color dots */}
                  <div style={{ display: 'flex', gap: 3 }}>
                    {step.subjectBadges.map((b, i) => (
                      <div key={i} style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isUpcoming ? 'var(--color-gray-300)' : b.color,
                        transition: 'all 0.4s ease',
                      }} />
                    ))}
                  </div>
                </div>
                {idx < workflowSteps.length - 1 && (
                  <ArrowRight size={14} style={{
                    color: isCompleted ? 'var(--color-success)' : 'var(--color-gray-300)',
                    margin: '0 2px',
                    transition: 'color 0.4s ease',
                    flexShrink: 0,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminal Output */}
      <div style={{
        background: '#0a0e1a',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Terminal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: '12px 16px',
          background: '#111827',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#94a3b8', flex: 1, textAlign: 'center' }}>
            SkyVoyage Execution Trace — {scenario.name} ({scenario.route})
          </span>
          <Terminal size={14} style={{ color: '#94a3b8' }} />
        </div>

        {/* Terminal Body */}
        <div
          ref={terminalRef}
          style={{
            padding: 'var(--space-4)',
            minHeight: 400,
            maxHeight: 600,
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '12.5px',
            lineHeight: 1.6,
          }}
        >
          {state.terminalLines.length === 0 && (
            <div style={{ color: '#4b5563', textAlign: 'center', paddingTop: 'var(--space-12)' }}>
              <Terminal size={40} style={{ margin: '0 auto var(--space-4)', opacity: 0.3 }} />
              <div style={{ fontSize: 'var(--text-sm)' }}>Select a scenario and click "Simulate Live Execution" to begin</div>
              <div style={{ fontSize: '11px', marginTop: 8 }}>
                The terminal will display live SQL, logic gates, data structure states, and ML traces
              </div>
            </div>
          )}
          {state.terminalLines.map((line, idx) => (
            <div
              key={idx}
              style={{
                color: getLineColor(line.type),
                opacity: 0,
                animation: 'terminalFadeIn 0.3s ease forwards',
                animationDelay: `${Math.min(idx * 20, 200)}ms`,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {line.text && (
                <>
                  <span style={{ color: '#4b5563', marginRight: 8, fontSize: '10px' }}>
                    {line.timestamp}
                  </span>
                  {getLinePrefix(line.type)}{line.text}
                </>
              )}
              {!line.text && <br />}
            </div>
          ))}
          {state.isRunning && (
            <div style={{ color: 'var(--color-sky-400)', marginTop: 'var(--space-2)' }}>
              <span style={{ animation: 'blink 1s step-end infinite' }}>▋</span>
            </div>
          )}
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes terminalFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 10px rgba(14, 165, 233, 0.15); }
          50% { box-shadow: 0 0 25px rgba(14, 165, 233, 0.3); }
        }
      `}</style>
    </div>
  );
}


/* ================================================================
   SHARED HELPER COMPONENTS
   ================================================================ */

function Section({ label, color, content }: { label: string; color: string; content: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color, marginBottom: 'var(--space-1)' }}>
        {label}
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.7 }}>
        {content}
      </p>
    </div>
  );
}
