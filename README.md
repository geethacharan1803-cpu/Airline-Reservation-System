# SkyVoyage Enterprise — Airline Reservation System
### Autonomous Concurrency Defense, Curricular Algorithmic Engine & Predictive Yield Optimization

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![ES6 JavaScript](https://img.shields.io/badge/ES6_JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Python 3.10+](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-222222?style=for-the-badge&logo=github&logoColor=white)](https://pages.github.com/)
[![Zero Build](https://img.shields.io/badge/Architecture-Zero--Build_Native-10B981?style=for-the-badge)](#-zero-build-deployment--local-execution-guide)
[![Academic Evaluation](https://img.shields.io/badge/Academic_Suite-R23_Curriculum-8B5CF6?style=for-the-badge)](#-comprehensive-subject-to-implementation-mapping)

---

## 📌 Problem Statement Solved

In high-volume airline operations, reservation systems encounter two catastrophic failure modes:

1. **Double-Booking Race Conditions:**
   When multiple passengers attempt to reserve the same high-demand seat simultaneously (e.g. holiday rushes or festival tatkal spikes), distributed networks suffer from race conditions. Traditional web applications lack database-level serialization, causing duplicate boarding passes to be issued for the identical seat coordinate—leading to gate-side confrontation, flight departure delays, and heavy regulatory non-compliance fines.
   * **Our Solution:** An atomic, transactional persistence layer enforcing composite uniqueness `UNIQUE(flight_id, seat_no)`, persistent session hold locks (`session_hold_id`), and pessimistic mutexes (`SELECT ... FOR UPDATE`), guaranteeing exactly one confirmed booking per seat with mathematical proof across parallel threads.

2. **Ad-Hoc, Arbitrary Overbooking Decisions:**
   Airlines rely on overbooking to mitigate passenger no-shows. When capacity buffers are determined via human intuition or static arbitrary percentages, planes either depart with empty, unmonetized seats (revenue spoilage) or suffer excessive passenger bumping (denied boarding compensation, passenger dissatisfaction, and civil penalties).
   * **Our Solution:** A deterministic Machine Learning engine utilizing **Logistic Regression with Sigmoid Activation** to forecast route-specific no-show probabilities $p$, coupled with a **Binomial Expected Cost Minimization Function** that balances bumping penalties against seat spoilage to calculate the exact mathematical overbooking buffer ($+b^*$ seats).

---

## 🏛️ End-to-End System Architecture

SkyVoyage Enterprise is built on a **Zero-Build Universal Architecture**. It executes entirely via native browser ES6 modules (`<script type="module">`) and client-side IndexedDB persistence, mirrored by a zero-dependency serverless Python ML analytics layer.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT TIER (Pure HTML5 & CSS3)                              │
│  Interactive 90-Day Calendar ──► Dynamic Route Selector ──► Live Vacancy Telemetry Counter  │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                     STEP 1: DMGT PROPOSITIONAL LOGIC CHECKOUT GATES                         │
│                    CanBook = (ValidIdentity ∧ PaymentCleared) ∧ (SeatAvailable ∨ Overbook)  │
│             [P ∧ Q] Gate ──► [R ∨ S] Gate ──► Master Conjunction ──► Verified / Aborted     │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 2: ADSA IN-MEMORY MULTI-WAY BALANCED B-TREE (m=3)                   │
│             Disk-Optimized PNR Indexing ──► Logarithmic Split ──► O(log n) Traversal        │
│                    Key Lookup Spikes Handled in ≤ 3 Traversals Without Lag                  │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                        STEP 3: DBMS ACID STORE & PESSIMISTIC MUTEX                          │
│               Composite Unique Key: CONSTRAINT uk_seat UNIQUE(flight_id, seat_no)           │
│        SELECT ... FOR UPDATE ──► Lock Acquired (10m TTL) ──► COMMIT / ROLLBACK 409          │
│                      20-Thread Concurrency Defense: 1 Confirmed, 19 Rejected                │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│               STEP 4: PYTHON ML LOGISTIC REGRESSION & BINOMIAL OVERBOOKING                  │
│                     Sigmoid: P(no-show) = 1 / (1 + exp(-z))                                 │
│              Binomial Cost Optimizer: min E[Cost(b)] ──► Optimal Buffer +b* Seats           │
│              Standby Passengers Routed to ADSA Binary Max-Heap Priority Queue               │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎓 Comprehensive Subject-to-Implementation Mapping

Every module, algorithm, and data structure directly embodies core curricular concepts from the B.Tech Computer Science R23 Regulation:

| Subject & R23 Unit | Curricular Concept Used | Target Project File & Function | Concrete Real-World Aviation Role |
| :--- | :--- | :--- | :--- |
| **DBMS**<br>`Unit 2: Relational Model` | **Composite Keys & Integrity Constraints** | [`js/core/db.js`](js/core/db.js)<br>`initDB()`, `flightSeat` index | Enforces `UNIQUE(flight_id, seat_no)`. Prevents duplicate seat assignment at the database level when concurrent requests arrive simultaneously. |
| **DBMS**<br>`Unit 3: Normalization` | **3NF Relational Decomposition** | [`js/core/db.js`](js/core/db.js)<br>`SEED_DATA`, store schemas | Decomposes Flights, Passengers, Bookings, and Seats into separate relations to prevent update/deletion anomalies. |
| **DBMS**<br>`Unit 5: Concurrency Control` | **Pessimistic Row Mutex & Two-Phase Locking (2PL)** | [`js/core/mutex.js`](js/core/mutex.js)<br>`withLock()`, [`js/services/bookingService.js`](js/services/bookingService.js)`holdSeat()` | Locks seat coordinate with a 10-minute TTL. Eliminates false-positive availability rejections via persistent `session_hold_id`. |
| **ADSA**<br>`Unit 1: Multi-Way Trees` | **In-Memory Balanced B-Tree (Order $t=3$)** | [`js/core/btree.js`](js/core/btree.js)<br>`BTree.search()`, `BTree.insert()` | High-throughput, logarithmic indexing ($O(\log n)$) of cryptographic 6-character PNRs, eliminating sequential scan latency during airport rushes. |
| **ADSA**<br>`Unit 2: Priority Queues` | **Binary Max-Heap Standby Priority Queue** | [`js/core/maxheap.js`](js/core/maxheap.js)<br>`MaxHeap.insert()`, `extractMax()` | Prioritizes standby waitlists: $\text{Priority} = (\text{TierWeight} \times 10^5) - t$. Instant $O(1)$ extraction and promotion of VIP members upon cancellation. |
| **DMGT**<br>`Unit 1: Propositional Logic` | **Boolean Logic Gates & Truth Functions** | [`js/services/logicGate.js`](js/services/logicGate.js)<br>`evaluateBookingFormula()` | Evaluates $\text{CanBook} = (P \land Q) \land (R \lor S)$ verifying identity, payment clearance, and capacity allowance before checkout commits. |
| **DMGT**<br>`Unit 2: Set Theory & Relations` | **Set Difference & Injective Mappings** | [`js/services/seatService.js`](js/services/seatService.js)<br>`computeSeatAvailability()` | Calculates available seats: $A = U \setminus (B \cup H)$. Enforces injective (one-to-one) mapping $f: \text{Passenger} \to \text{Seat}$, bound by Pigeonhole Principle. |
| **DMGT**<br>`Unit 4 & 5: Graph Theory` | **Weighted Directed Route Graphs & Dijkstra** | [`js/services/graphService.js`](js/services/graphService.js)<br>`findAlternativeRoute()` | Models airports as vertices and routes as weighted directed edges. Computes shortest layover routes and transit times when direct flights sell out. |
| **OOPJ**<br>`Unit 1 & 2: Inheritance & Encapsulation` | **Abstract Classes & Private (#) Access Control** | [`js/models/index.js`](js/models/index.js)<br>`Person`, `Passenger`, `User` | Encapsulates passenger identity, contact data, and loyalty credentials using strictly private (`#`) fields, preventing unauthorized external state mutation. |
| **OOPJ**<br>`Unit 3: Design Patterns` | **Polymorphic Strategy Design Pattern** | [`js/models/index.js`](js/models/index.js)<br>`RefundPolicyStrategy`, `TieredRefundPolicy` | Decouples fare refund calculations (`Full`, `Tiered`, `NonRefundable`) dynamically based on departure lead time without sprawling switch/if-else chains. |
| **OOPJ**<br>`Unit 4: Exception Handling` | **Structured Checked Exception Hierarchy** | [`js/services/bookingService.js`](js/services/bookingService.js)<br>`BookingException` classes | Handles `SeatUnavailableError`, `DoubleBookingError`, and `LockTimeoutError` gracefully across client and background transactions. |
| **Python / ML**<br>`Classification & Cost Optimization` | **Logistic Regression & Binomial Cost Minimization** | [`ml-service/models/noshow_model.py`](ml-service/models/noshow_model.py)<br>`compute_expected_cost()`, `find_optimal_overbooking()` | Predicts route no-show probability $p = \sigma(z)$ and numerically optimizes the overbooking buffer $+b^*$ to maximize revenue and cap bumping risk $< 0.5\%$. |

---

## 🤖 Applied Machine Learning & Statistical Overbooking Model

Airlines face an economic dilemma: leaving seats empty causes permanent revenue spoilage, while overbooking excessively triggers expensive bumping compensation, hotel vouchers, and civil fines.

### 1. Logistic Regression No-Show Probability
The passenger no-show probability $p$ is modeled via Logistic Regression with a Sigmoid activation function:

$$z = w_0 + \sum_{i=1}^{n} w_i x_i$$

$$p = \sigma(z) = \frac{1}{1 + e^{-z}}$$

Where the feature vector $\mathbf{x}$ incorporates:
- $x_1$: Normalized booking lead time ($d / 90$)
- $x_2$: Cabin class indicator (Economy: $+0.12$, Premium: $+0.08$, Business: $+0.04$)
- $x_3$: Route historical base no-show rate
- $x_4$: Day-of-week seasonality (Weekend vs. Weekday)
- $x_5$: Monsoon / Weather disruption coefficient

### 2. Binomial Expected Cost Minimization
Given physical aircraft capacity $N$ and an overbooking buffer $b \ge 0$, the total number of tickets issued is $N + b$.
Assuming passenger arrivals follow a Binomial distribution $X \sim \text{Binomial}(N + b, 1 - p)$, the expected operational cost function is defined as:

$$E[\text{Cost}(b)] = \sum_{k=0}^{N+b} \binom{N+b}{k} (1-p)^k p^{N+b-k} \cdot \left[ C_{\text{bump}} \max(0, k - N) + C_{\text{spoil}} \max(0, N - k) \right]$$

Where:
- $k$: Number of passengers showing up at departure gate
- $C_{\text{bump}}$: Penalty per denied-boarding passenger (statutory compensation: ₹15,000)
- $C_{\text{spoil}}$: Spoilage cost per empty departure seat (unmonetized fare loss: ₹4,500)

The optimal overbooking buffer $b^*$ is the convex integer minimizer:

$$b^* = \arg\min_{b \in [0, b_{\max}]} E[\text{Cost}(b)]$$

The platform computes this convex minimum in real-time, displaying both the Sigmoid trajectory and the cost curve on the interactive canvas.

---

## 🚀 Zero-Build Deployment & Local Execution Guide

SkyVoyage Enterprise requires **no compilation, no bundler (no Vite, Webpack, or Rollup), and no Node.js runtime**. It runs directly in all modern web browsers.

### Local Execution (Immediate Launch)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/geethacharan1803-cpu/Airline-Reservation-System.git
   cd Airline-Reservation-System
   ```

2. **Start the local HTTP server:**
   Using Python's built-in module (any Python 3 version):
   ```bash
   python -m http.server 8000
   ```

3. **Open in browser:**
   Navigate to [http://localhost:8000](http://localhost:8000).

*(Optional: You can also use VS Code's "Live Server" extension or any standard static file server.)*

---

### Cloud Static Deployment

#### 1. Deploying to Vercel (Instant Zero-Config)
Since the project is zero-build static HTML5/CSS3/ES6:
- Link the repository on [vercel.com](https://vercel.com).
- Set **Framework Preset** to `Other`.
- Leave **Build Command** empty.
- Set **Output Directory** to `.` (root).
- Click **Deploy**. Vercel will immediately serve the site with global CDN caching.

#### 2. Deploying to GitHub Pages
1. Go to repository **Settings** ➔ **Pages**.
2. Under **Build and deployment** ➔ **Source**, select `Deploy from a branch`.
3. Choose branch `main` and folder `/ (root)`.
4. Click **Save**. Your application will be live at:
   `https://geethacharan1803-cpu.github.io/Airline-Reservation-System/`

---

## 🧪 Interactive Concept Pop-up Engine (Academic Evaluator Suite)

Navigate to the **Academics** tab in the navigation bar (`#/academic`):
1. **Interactive Architecture Blueprint:** Follows the 6-layer pipeline from browser click down to storage mutexes.
2. **Passenger Journey Simulation:** Step through the 6 journey milestones with real-time terminal stream output.
3. **The 5 Core Subjects Grid:** Click on **DBMS**, **ADSA**, **DMGT**, **OOPJ**, or **Python ML** to open the full-screen interactive modal dialog:
   - **Dual Concurrent Write Race:** Watch User 1 (commit) and User 2 (integrity rollback) race toward `UNIQUE(flight_id, seat_no)`.
   - **B-Tree & Max-Heap Simulator:** Search keys with logarithmic comparison step counters and auto-promote standby VIPs.
   - **Boolean Logic Gates Circuit:** Toggle switches $P, Q, R, S$ to see live wires light up and evaluate truth tables.
   - **Polymorphic Strategy Calculator:** Adjust fare amounts and hours to observe dynamic method dispatch.
   - **Dynamic Sigmoid Canvas:** Drag booking lead-time sliders to watch the real-time probability point move along the curve.

---

## 📄 License & Academic Integrity

Developed for academic demonstration and curricular evaluation under the **B.Tech II Year I Semester (R23 Curriculum) Computer Science & Engineering Specification**.
Distributed under the MIT License.
