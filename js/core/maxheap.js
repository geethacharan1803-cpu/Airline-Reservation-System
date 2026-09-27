/**
 * ============================================================
 * SKYVOYAGE ENTERPRISE — Max-Heap Priority Queue (ADSA Unit 2)
 * ============================================================
 * Manages standby/waitlisted passengers when flights are full.
 *
 * Priority Score = (TierWeight × 100) − Timestamp
 *   - Gold:   TierWeight = 4  → Score base = 400
 *   - Silver: TierWeight = 3  → Score base = 300
 *   - Bronze: TierWeight = 2  → Score base = 200
 *   - Basic:  TierWeight = 1  → Score base = 100
 *
 * When a booking is cancelled, extractMax() auto-promotes the
 * highest-priority waitlisted passenger to a confirmed seat.
 *
 * Academic Concepts Demonstrated:
 * - Binary max-heap stored in a flat array
 * - O(log n) insert via heapifyUp (swim)
 * - O(log n) extractMax via heapifyDown (sink)
 * - O(1) peek at maximum
 * - Heap property validation
 * - Visual tree representation for dashboard
 * ============================================================
 */

/** Tier weight constants */
export const TIER_WEIGHTS = Object.freeze({
  gold: 4,
  silver: 3,
  bronze: 2,
  basic: 1,
});

/**
 * Calculate priority score for a waitlisted passenger.
 * Higher score = higher priority.
 * @param {string} tier — 'gold' | 'silver' | 'bronze' | 'basic'
 * @param {number} timestamp — booking request timestamp (ms since epoch)
 * @returns {number}
 */
export function calculatePriority(tier, timestamp) {
  const weight = TIER_WEIGHTS[tier] || TIER_WEIGHTS.basic;
  // Normalize timestamp to seconds for manageable numbers, and negate
  // so earlier requests get higher scores within same tier
  const timeComponent = Math.floor(timestamp / 1000);
  return (weight * 100000) - timeComponent;
}

/**
 * @typedef {Object} WaitlistEntry
 * @property {string} id — unique entry ID
 * @property {string} passengerId — reference to passenger
 * @property {string} passengerName — display name
 * @property {string} flightId — reference to flight
 * @property {string} tier — 'gold' | 'silver' | 'bronze' | 'basic'
 * @property {number} priority — computed priority score
 * @property {number} timestamp — original request time
 * @property {string} seatPreference — preferred seat class
 */

export class MaxHeap {
  constructor() {
    /** @type {WaitlistEntry[]} Flat array storing heap elements */
    this.heap = [];

    // ── Telemetry ──
    this._swaps = 0;
    this._comparisons = 0;
    this._insertions = 0;
    this._extractions = 0;
  }

  // ══════════════════════════════════════════════════════════
  //  CORE OPERATIONS
  // ══════════════════════════════════════════════════════════

  /**
   * Insert a new entry into the heap.
   * @param {WaitlistEntry} entry
   */
  insert(entry) {
    this.heap.push(entry);
    this._insertions++;
    this._heapifyUp(this.heap.length - 1);
  }

  /**
   * Remove and return the highest-priority entry.
   * @returns {WaitlistEntry|null}
   */
  extractMax() {
    if (this.heap.length === 0) return null;
    this._extractions++;

    const max = this.heap[0];
    const last = this.heap.pop();

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._heapifyDown(0);
    }

    return max;
  }

  /**
   * Peek at the highest-priority entry without removing it.
   * @returns {WaitlistEntry|null}
   */
  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  /**
   * Remove a specific entry by its ID.
   * @param {string} entryId
   * @returns {WaitlistEntry|null}
   */
  removeById(entryId) {
    const index = this.heap.findIndex(e => e.id === entryId);
    if (index === -1) return null;

    const entry = this.heap[index];

    if (index === this.heap.length - 1) {
      this.heap.pop();
    } else {
      this.heap[index] = this.heap.pop();
      // Fix heap: might need to go up or down
      const parentIdx = this._parent(index);
      if (index > 0 && this._comparePriority(index, parentIdx) > 0) {
        this._heapifyUp(index);
      } else {
        this._heapifyDown(index);
      }
    }

    return entry;
  }

  /**
   * Get all entries for a specific flight.
   * @param {string} flightId
   * @returns {WaitlistEntry[]} Sorted by priority descending
   */
  getByFlight(flightId) {
    return this.heap
      .filter(e => e.flightId === flightId)
      .sort((a, b) => b.priority - a.priority);
  }

  // ══════════════════════════════════════════════════════════
  //  HEAP INTERNALS
  // ══════════════════════════════════════════════════════════

  /** @private Swim up to restore heap property after insertion */
  _heapifyUp(index) {
    while (index > 0) {
      const parentIdx = this._parent(index);
      this._comparisons++;
      if (this._comparePriority(index, parentIdx) <= 0) break;
      this._swap(index, parentIdx);
      index = parentIdx;
    }
  }

  /** @private Sink down to restore heap property after extraction */
  _heapifyDown(index) {
    const size = this.heap.length;
    while (true) {
      let largest = index;
      const left = this._leftChild(index);
      const right = this._rightChild(index);

      if (left < size) {
        this._comparisons++;
        if (this._comparePriority(left, largest) > 0) {
          largest = left;
        }
      }
      if (right < size) {
        this._comparisons++;
        if (this._comparePriority(right, largest) > 0) {
          largest = right;
        }
      }

      if (largest === index) break;
      this._swap(index, largest);
      index = largest;
    }
  }

  /** @private Compare priority of two heap elements by index */
  _comparePriority(i, j) {
    return this.heap[i].priority - this.heap[j].priority;
  }

  /** @private Swap two elements */
  _swap(i, j) {
    this._swaps++;
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  // ── Index arithmetic ──
  _parent(i) { return Math.floor((i - 1) / 2); }
  _leftChild(i) { return 2 * i + 1; }
  _rightChild(i) { return 2 * i + 2; }

  // ══════════════════════════════════════════════════════════
  //  TELEMETRY & VISUALIZATION
  // ══════════════════════════════════════════════════════════

  get size() { return this.heap.length; }
  get isEmpty() { return this.heap.length === 0; }

  getTelemetry() {
    return {
      size: this.size,
      swaps: this._swaps,
      comparisons: this._comparisons,
      insertions: this._insertions,
      extractions: this._extractions,
      maxPriority: this.peek()?.priority ?? null,
      treeDepth: this.size > 0 ? Math.floor(Math.log2(this.size)) + 1 : 0,
    };
  }

  /**
   * Get a level-order representation for visual tree rendering.
   * @returns {Array<Array<WaitlistEntry|null>>}
   */
  toLevels() {
    if (this.heap.length === 0) return [];
    const levels = [];
    let levelStart = 0;
    let levelSize = 1;

    while (levelStart < this.heap.length) {
      const level = [];
      for (let i = levelStart; i < Math.min(levelStart + levelSize, this.heap.length); i++) {
        level.push(this.heap[i]);
      }
      levels.push(level);
      levelStart += levelSize;
      levelSize *= 2;
    }
    return levels;
  }

  /**
   * Get all entries as a sorted array (highest priority first).
   * Does NOT modify the heap.
   * @returns {WaitlistEntry[]}
   */
  toSortedArray() {
    return [...this.heap].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Validate max-heap property.
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];
    for (let i = 1; i < this.heap.length; i++) {
      const parentIdx = this._parent(i);
      if (this.heap[i].priority > this.heap[parentIdx].priority) {
        errors.push(
          `Heap violation: child[${i}] (${this.heap[i].priority}) > parent[${parentIdx}] (${this.heap[parentIdx].priority})`
        );
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /** Clear the heap */
  clear() {
    this.heap = [];
  }

  /** Export as JSON */
  toJSON() {
    return {
      heap: this.heap.map(e => ({ ...e })),
      telemetry: this.getTelemetry(),
    };
  }
}
