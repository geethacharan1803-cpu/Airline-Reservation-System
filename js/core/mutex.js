/**
 * ============================================================
 * SKYVOYAGE ENTERPRISE — Async Mutex & Transaction Layer
 * ============================================================
 * Simulates pessimistic locking (DBMS Unit 5: SELECT ... FOR UPDATE)
 * using an async mutex queue.
 *
 * Features:
 * - Mutual exclusion with FIFO queue (fair scheduling)
 * - Named locks (per-resource locking, e.g., per-seat)
 * - RAII-style withLock() for automatic release
 * - Transaction wrapper with commit/rollback semantics
 * - Deadlock detection (timeout-based)
 * - Lock telemetry for concurrency stress test
 * ============================================================
 */

export class AsyncMutex {
  constructor(name = 'default') {
    this.name = name;
    this._locked = false;
    this._queue = [];
    this._holder = null;
    this._acquireTime = null;

    // Telemetry
    this._totalAcquires = 0;
    this._totalWaits = 0;
    this._totalTimeouts = 0;
    this._contentionHistory = [];
  }

  get isLocked() { return this._locked; }
  get queueLength() { return this._queue.length; }

  /**
   * Acquire the lock. Returns a promise that resolves when the lock is acquired.
   * @param {string} holderId — identifier for the lock holder (for debugging)
   * @param {number} timeoutMs — maximum time to wait (0 = infinite)
   * @returns {Promise<boolean>} — true if acquired, false if timed out
   */
  acquire(holderId = 'anonymous', timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const tryAcquire = () => {
        if (!this._locked) {
          this._locked = true;
          this._holder = holderId;
          this._acquireTime = Date.now();
          this._totalAcquires++;
          resolve(true);
          return true;
        }
        return false;
      };

      if (tryAcquire()) return;

      // Enqueue waiter
      this._totalWaits++;
      let timer = null;
      const waiter = { resolve, holderId, enqueueTime: Date.now() };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          const idx = this._queue.indexOf(waiter);
          if (idx !== -1) {
            this._queue.splice(idx, 1);
            this._totalTimeouts++;
            this._contentionHistory.push({
              holderId,
              event: 'timeout',
              timestamp: Date.now(),
              waitedMs: Date.now() - waiter.enqueueTime,
            });
            resolve(false);
          }
        }, timeoutMs);
      }

      waiter.timer = timer;
      this._queue.push(waiter);
    });
  }

  /**
   * Release the lock. Wakes the next waiter in the FIFO queue.
   */
  release() {
    if (!this._locked) return;

    const holdTime = Date.now() - (this._acquireTime || Date.now());
    this._contentionHistory.push({
      holderId: this._holder,
      event: 'release',
      timestamp: Date.now(),
      holdTimeMs: holdTime,
    });

    this._locked = false;
    this._holder = null;
    this._acquireTime = null;

    // Wake next waiter
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      if (next.timer) clearTimeout(next.timer);
      // Use microtask to avoid synchronous reentrancy
      queueMicrotask(() => {
        this._locked = true;
        this._holder = next.holderId;
        this._acquireTime = Date.now();
        this._totalAcquires++;
        next.resolve(true);
      });
    }
  }

  /**
   * RAII-style lock usage. Automatically releases when done.
   * @param {string} holderId
   * @param {Function} fn — async function to execute while holding lock
   * @param {number} timeoutMs
   * @returns {Promise<{acquired: boolean, result?: any, error?: Error}>}
   */
  async withLock(holderId, fn, timeoutMs = 30000) {
    const acquired = await this.acquire(holderId, timeoutMs);
    if (!acquired) {
      return { acquired: false, error: new Error(`Lock timeout for ${holderId} on mutex ${this.name}`) };
    }
    try {
      const result = await fn();
      return { acquired: true, result };
    } catch (error) {
      return { acquired: true, error };
    } finally {
      this.release();
    }
  }

  getTelemetry() {
    return {
      name: this.name,
      isLocked: this._locked,
      holder: this._holder,
      queueLength: this._queue.length,
      totalAcquires: this._totalAcquires,
      totalWaits: this._totalWaits,
      totalTimeouts: this._totalTimeouts,
      recentHistory: this._contentionHistory.slice(-20),
    };
  }
}

/**
 * ── Named Lock Manager ──
 * Provides per-resource locking (e.g., one lock per seat).
 * Simulates row-level locking from DBMS.
 */
export class LockManager {
  constructor() {
    /** @type {Map<string, AsyncMutex>} */
    this._locks = new Map();
  }

  /**
   * Get or create a named mutex.
   * @param {string} resourceId — e.g., "flight:SV101:seat:12A"
   * @returns {AsyncMutex}
   */
  getLock(resourceId) {
    if (!this._locks.has(resourceId)) {
      this._locks.set(resourceId, new AsyncMutex(resourceId));
    }
    return this._locks.get(resourceId);
  }

  /**
   * Execute a function while holding a named lock.
   * @param {string} resourceId
   * @param {string} holderId
   * @param {Function} fn
   * @param {number} timeoutMs
   */
  async withLock(resourceId, holderId, fn, timeoutMs = 30000) {
    const mutex = this.getLock(resourceId);
    return mutex.withLock(holderId, fn, timeoutMs);
  }

  /**
   * Get telemetry for all active locks.
   */
  getTelemetry() {
    const locks = {};
    for (const [id, mutex] of this._locks) {
      if (mutex.isLocked || mutex._totalAcquires > 0) {
        locks[id] = mutex.getTelemetry();
      }
    }
    return {
      totalLocks: this._locks.size,
      activeLocks: [...this._locks.values()].filter(m => m.isLocked).length,
      locks,
    };
  }

  /** Clear all locks */
  clear() {
    this._locks.clear();
  }
}

/**
 * ── Transaction Wrapper ──
 * Provides commit/rollback semantics over a sequence of operations.
 * Simulates database transactions with exception-safe recovery.
 */
export class Transaction {
  /**
   * @param {string} txId — transaction identifier
   * @param {LockManager} lockManager
   */
  constructor(txId, lockManager) {
    this.txId = txId;
    this.lockManager = lockManager;
    this.operations = [];
    this._committed = false;
    this._rolledBack = false;
    this._heldLocks = [];
    this.startTime = Date.now();
  }

  get status() {
    if (this._committed) return 'committed';
    if (this._rolledBack) return 'rolled_back';
    return 'active';
  }

  /**
   * Add an operation with its undo function.
   * @param {string} description
   * @param {Function} execute — forward operation
   * @param {Function} undo — rollback operation
   */
  addOperation(description, execute, undo) {
    this.operations.push({ description, execute, undo, executed: false });
  }

  /**
   * Execute all operations in order. On failure, rollback all completed ones.
   * @returns {Promise<{success: boolean, error?: Error}>}
   */
  async commit() {
    if (this._committed || this._rolledBack) {
      throw new Error(`Transaction ${this.txId} already ${this.status}`);
    }

    for (const op of this.operations) {
      try {
        await op.execute();
        op.executed = true;
      } catch (error) {
        console.error(`[TX ${this.txId}] Operation failed: ${op.description}`, error);
        await this.rollback();
        return { success: false, error };
      }
    }

    this._committed = true;
    this._releaseAllLocks();
    return { success: true };
  }

  /**
   * Rollback all executed operations in reverse order.
   */
  async rollback() {
    if (this._committed || this._rolledBack) return;

    const executed = this.operations.filter(op => op.executed).reverse();
    for (const op of executed) {
      try {
        await op.undo();
      } catch (error) {
        console.error(`[TX ${this.txId}] Undo failed: ${op.description}`, error);
      }
    }

    this._rolledBack = true;
    this._releaseAllLocks();
  }

  /** Acquire a named lock for this transaction */
  async acquireLock(resourceId, timeoutMs = 30000) {
    const mutex = this.lockManager.getLock(resourceId);
    const acquired = await mutex.acquire(this.txId, timeoutMs);
    if (acquired) {
      this._heldLocks.push(mutex);
    }
    return acquired;
  }

  /** @private Release all held locks */
  _releaseAllLocks() {
    for (const mutex of this._heldLocks) {
      mutex.release();
    }
    this._heldLocks = [];
  }
}

/** Singleton lock manager instance */
export const lockManager = new LockManager();
