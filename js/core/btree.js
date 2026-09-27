/**
 * ============================================================
 * SKYVOYAGE ENTERPRISE — B-Tree Index (ADSA Unit 1)
 * ============================================================
 * A complete, generic in-memory B-Tree with configurable order t.
 * Used to index active bookings by PNR for O(log n) search.
 *
 * Academic Concepts Demonstrated:
 * - Multi-way search tree invariants (every node has at most 2t-1 keys)
 * - Node splitting during insertion (split when node is full)
 * - Proactive splitting (split-on-descent) guaranteeing single-pass insert
 * - In-order, pre-order, and level-order traversal
 * - Deletion with merge and redistribution
 * - Live telemetry: height, node count, comparison count
 * ============================================================
 */

export class BTreeNode {
  /**
   * @param {boolean} leaf — whether this node is a leaf
   */
  constructor(leaf = true) {
    /** @type {Array<{key: string, value: any}>} Sorted key-value pairs */
    this.keys = [];
    /** @type {BTreeNode[]} Child pointers (keys.length + 1 children for internal nodes) */
    this.children = [];
    /** @type {boolean} */
    this.leaf = leaf;
  }

  get n() { return this.keys.length; }
}

export class BTree {
  /**
   * @param {number} t — minimum degree (each node has at most 2t-1 keys)
   */
  constructor(t = 3) {
    if (t < 2) throw new Error('Minimum degree t must be >= 2');
    /** @type {number} Minimum degree */
    this.t = t;
    /** @type {BTreeNode} Root node */
    this.root = new BTreeNode(true);
    /** @type {number} Total number of keys stored */
    this.size = 0;

    // ── Telemetry ──
    this._comparisons = 0;
    this._nodeCount = 1;
    this._insertions = 0;
    this._deletions = 0;
    this._searches = 0;
  }

  // ══════════════════════════════════════════════════════════
  //  TELEMETRY — Live dashboard stats
  // ══════════════════════════════════════════════════════════

  /** Compute tree height via root-to-leaf traversal */
  get height() {
    let h = 0;
    let node = this.root;
    while (!node.leaf) {
      h++;
      node = node.children[0];
    }
    return h;
  }

  get nodeCount() { return this._nodeCount; }
  get comparisons() { return this._comparisons; }
  get totalInsertions() { return this._insertions; }
  get totalDeletions() { return this._deletions; }
  get totalSearches() { return this._searches; }

  /** Reset comparison counter (useful for per-operation measurement) */
  resetComparisons() {
    const prev = this._comparisons;
    this._comparisons = 0;
    return prev;
  }

  getTelemetry() {
    return {
      height: this.height,
      nodeCount: this._nodeCount,
      size: this.size,
      comparisons: this._comparisons,
      insertions: this._insertions,
      deletions: this._deletions,
      searches: this._searches,
      order: this.t,
      maxKeysPerNode: 2 * this.t - 1,
    };
  }

  // ══════════════════════════════════════════════════════════
  //  SEARCH — O(log n) key lookup
  // ══════════════════════════════════════════════════════════

  /**
   * Search for a key in the B-Tree.
   * @param {string} key
   * @returns {{node: BTreeNode, index: number, value: any}|null}
   */
  search(key) {
    this._searches++;
    return this._search(this.root, key);
  }

  /** @private */
  _search(node, key) {
    let i = 0;
    while (i < node.n) {
      this._comparisons++;
      const cmp = this._compare(key, node.keys[i].key);
      if (cmp === 0) return { node, index: i, value: node.keys[i].value };
      if (cmp < 0) break;
      i++;
    }
    if (node.leaf) return null;
    return this._search(node.children[i], key);
  }

  /**
   * Check if a key exists.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.search(key) !== null;
  }

  /**
   * Get the value associated with a key, or undefined.
   * @param {string} key
   * @returns {any|undefined}
   */
  get(key) {
    const result = this.search(key);
    return result ? result.value : undefined;
  }

  // ══════════════════════════════════════════════════════════
  //  INSERT — O(log n) with proactive split-on-descent
  // ══════════════════════════════════════════════════════════

  /**
   * Insert a key-value pair. If the key already exists, update its value.
   * @param {string} key
   * @param {any} value
   * @returns {boolean} true if new key inserted, false if updated
   */
  insert(key, value) {
    // Check for update
    const existing = this.search(key);
    if (existing) {
      existing.node.keys[existing.index].value = value;
      return false;
    }

    this._insertions++;
    const root = this.root;

    // If root is full, split it first
    if (root.n === 2 * this.t - 1) {
      const newRoot = new BTreeNode(false);
      this._nodeCount++;
      newRoot.children.push(this.root);
      this._splitChild(newRoot, 0);
      this.root = newRoot;
    }

    this._insertNonFull(this.root, key, value);
    this.size++;
    return true;
  }

  /** @private Split child j of node x */
  _splitChild(x, j) {
    const t = this.t;
    const y = x.children[j]; // Full child to split
    const z = new BTreeNode(y.leaf); // New node gets upper half
    this._nodeCount++;

    // Move upper t-1 keys to z
    z.keys = y.keys.splice(t); // keys[t..2t-2]
    const median = y.keys.pop(); // key[t-1] is the median promoted up

    // Move upper t children to z (if internal node)
    if (!y.leaf) {
      z.children = y.children.splice(t); // children[t..2t-1]
    }

    // Insert median into parent x
    x.keys.splice(j, 0, median);
    x.children.splice(j + 1, 0, z);
  }

  /** @private Insert into a non-full node */
  _insertNonFull(node, key, value) {
    let i = node.n - 1;

    if (node.leaf) {
      // Find insertion position
      while (i >= 0) {
        this._comparisons++;
        if (this._compare(key, node.keys[i].key) >= 0) break;
        i--;
      }
      node.keys.splice(i + 1, 0, { key, value });
    } else {
      // Find child to descend into
      while (i >= 0) {
        this._comparisons++;
        if (this._compare(key, node.keys[i].key) >= 0) break;
        i--;
      }
      i++;
      // Proactive split: if child is full, split before descending
      if (node.children[i].n === 2 * this.t - 1) {
        this._splitChild(node, i);
        this._comparisons++;
        if (this._compare(key, node.keys[i].key) > 0) i++;
      }
      this._insertNonFull(node.children[i], key, value);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  DELETE — O(log n) with merge/redistribution
  // ══════════════════════════════════════════════════════════

  /**
   * Delete a key from the B-Tree.
   * @param {string} key
   * @returns {boolean} true if key was found and deleted
   */
  delete(key) {
    if (!this.root.n) return false;

    const deleted = this._delete(this.root, key);
    if (deleted) {
      this.size--;
      this._deletions++;
    }

    // Shrink tree if root is empty and has a child
    if (this.root.n === 0 && !this.root.leaf) {
      this._nodeCount--;
      this.root = this.root.children[0];
    }

    return deleted;
  }

  /** @private */
  _delete(node, key) {
    const t = this.t;
    let i = this._findKeyIndex(node, key);

    // Case 1: Key found in this node
    if (i < node.n && this._compare(node.keys[i].key, key) === 0) {
      if (node.leaf) {
        // Case 1a: Leaf — simply remove
        node.keys.splice(i, 1);
        return true;
      }
      // Case 1b: Internal node
      return this._deleteInternalKey(node, i);
    }

    // Case 2: Key not in this node — must be in subtree
    if (node.leaf) return false; // Key not found

    // Ensure child has at least t keys before descending
    const isLastChild = (i === node.n);
    if (node.children[i].n < t) {
      this._fill(node, i);
    }
    // After fill, i might have changed if merge happened
    if (isLastChild && i > node.n) {
      return this._delete(node.children[i - 1], key);
    }
    return this._delete(node.children[i], key);
  }

  /** @private Delete a key from an internal node */
  _deleteInternalKey(node, i) {
    const t = this.t;
    const keyEntry = node.keys[i];

    if (node.children[i].n >= t) {
      // Replace with predecessor
      const pred = this._getPredecessor(node.children[i]);
      node.keys[i] = pred;
      return this._delete(node.children[i], pred.key);
    } else if (node.children[i + 1].n >= t) {
      // Replace with successor
      const succ = this._getSuccessor(node.children[i + 1]);
      node.keys[i] = succ;
      return this._delete(node.children[i + 1], succ.key);
    } else {
      // Merge children[i] and children[i+1]
      this._merge(node, i);
      return this._delete(node.children[i], keyEntry.key);
    }
  }

  /** @private Get the predecessor (rightmost key in left subtree) */
  _getPredecessor(node) {
    while (!node.leaf) node = node.children[node.n];
    return { ...node.keys[node.n - 1] };
  }

  /** @private Get the successor (leftmost key in right subtree) */
  _getSuccessor(node) {
    while (!node.leaf) node = node.children[0];
    return { ...node.keys[0] };
  }

  /** @private Ensure children[i] has at least t keys */
  _fill(node, i) {
    const t = this.t;
    if (i > 0 && node.children[i - 1].n >= t) {
      this._borrowFromPrev(node, i);
    } else if (i < node.n && node.children[i + 1].n >= t) {
      this._borrowFromNext(node, i);
    } else {
      if (i < node.n) {
        this._merge(node, i);
      } else {
        this._merge(node, i - 1);
      }
    }
  }

  /** @private Borrow a key from children[i-1] */
  _borrowFromPrev(node, i) {
    const child = node.children[i];
    const sibling = node.children[i - 1];
    // Move parent key down to child's front
    child.keys.unshift(node.keys[i - 1]);
    // Move sibling's last key up to parent
    node.keys[i - 1] = sibling.keys.pop();
    // Move sibling's last child to child's front
    if (!child.leaf) {
      child.children.unshift(sibling.children.pop());
    }
  }

  /** @private Borrow a key from children[i+1] */
  _borrowFromNext(node, i) {
    const child = node.children[i];
    const sibling = node.children[i + 1];
    child.keys.push(node.keys[i]);
    node.keys[i] = sibling.keys.shift();
    if (!child.leaf) {
      child.children.push(sibling.children.shift());
    }
  }

  /** @private Merge children[i] and children[i+1] via parent key i */
  _merge(node, i) {
    const left = node.children[i];
    const right = node.children[i + 1];

    // Pull parent key down
    left.keys.push(node.keys[i]);
    // Append right's keys and children
    left.keys.push(...right.keys);
    if (!left.leaf) {
      left.children.push(...right.children);
    }
    // Remove from parent
    node.keys.splice(i, 1);
    node.children.splice(i + 1, 1);
    this._nodeCount--;
  }

  /** @private Find index of first key >= given key */
  _findKeyIndex(node, key) {
    let i = 0;
    while (i < node.n) {
      this._comparisons++;
      if (this._compare(key, node.keys[i].key) <= 0) break;
      i++;
    }
    return i;
  }

  // ══════════════════════════════════════════════════════════
  //  TRAVERSAL — In-order, Pre-order, Level-order
  // ══════════════════════════════════════════════════════════

  /**
   * In-order traversal (sorted output).
   * @returns {Array<{key: string, value: any}>}
   */
  inOrder() {
    const result = [];
    this._inOrder(this.root, result);
    return result;
  }

  /** @private */
  _inOrder(node, result) {
    for (let i = 0; i < node.n; i++) {
      if (!node.leaf) this._inOrder(node.children[i], result);
      result.push(node.keys[i]);
    }
    if (!node.leaf) this._inOrder(node.children[node.n], result);
  }

  /**
   * Pre-order traversal (useful for serialization).
   * @returns {Array<{key: string, value: any}>}
   */
  preOrder() {
    const result = [];
    this._preOrder(this.root, result);
    return result;
  }

  /** @private */
  _preOrder(node, result) {
    for (let i = 0; i < node.n; i++) {
      result.push(node.keys[i]);
    }
    if (!node.leaf) {
      for (const child of node.children) {
        this._preOrder(child, result);
      }
    }
  }

  /**
   * Level-order (BFS) traversal — used for tree visualization.
   * Returns array of levels, each level is an array of nodes.
   * @returns {Array<Array<{keys: Array, isLeaf: boolean}>>}
   */
  levelOrder() {
    const levels = [];
    if (!this.root.n) return levels;

    let queue = [this.root];
    while (queue.length > 0) {
      const level = [];
      const nextQueue = [];
      for (const node of queue) {
        level.push({
          keys: node.keys.map(k => ({ key: k.key, value: k.value })),
          isLeaf: node.leaf,
        });
        if (!node.leaf) {
          nextQueue.push(...node.children);
        }
      }
      levels.push(level);
      queue = nextQueue;
    }
    return levels;
  }

  /**
   * Get all keys within a range [low, high] inclusive.
   * @param {string} low
   * @param {string} high
   * @returns {Array<{key: string, value: any}>}
   */
  rangeQuery(low, high) {
    const result = [];
    this._rangeQuery(this.root, low, high, result);
    return result;
  }

  /** @private */
  _rangeQuery(node, low, high, result) {
    let i = 0;
    while (i < node.n && this._compare(node.keys[i].key, low) < 0) {
      this._comparisons++;
      i++;
    }
    for (; i < node.n; i++) {
      this._comparisons++;
      if (this._compare(node.keys[i].key, high) > 0) return;
      if (!node.leaf) this._rangeQuery(node.children[i], low, high, result);
      result.push(node.keys[i]);
    }
    if (!node.leaf) this._rangeQuery(node.children[i], low, high, result);
  }

  // ══════════════════════════════════════════════════════════
  //  UTILITIES
  // ══════════════════════════════════════════════════════════

  /** String comparison */
  _compare(a, b) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  /** Clear the entire tree */
  clear() {
    this.root = new BTreeNode(true);
    this.size = 0;
    this._nodeCount = 1;
  }

  /** Check if the tree is empty */
  isEmpty() {
    return this.size === 0;
  }

  /**
   * Validate B-Tree invariants (for testing/academic demonstration).
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];
    const t = this.t;

    const check = (node, depth, isRoot) => {
      // Check key count bounds
      if (!isRoot && node.n < t - 1) {
        errors.push(`Non-root node has ${node.n} keys, min is ${t - 1}`);
      }
      if (node.n > 2 * t - 1) {
        errors.push(`Node has ${node.n} keys, max is ${2 * t - 1}`);
      }

      // Check keys are sorted
      for (let i = 1; i < node.n; i++) {
        if (this._compare(node.keys[i - 1].key, node.keys[i].key) >= 0) {
          errors.push(`Keys not sorted: ${node.keys[i - 1].key} >= ${node.keys[i].key}`);
        }
      }

      // Check children count
      if (!node.leaf) {
        if (node.children.length !== node.n + 1) {
          errors.push(`Internal node has ${node.n} keys but ${node.children.length} children (expected ${node.n + 1})`);
        }
        for (const child of node.children) {
          check(child, depth + 1, false);
        }
      }
    };

    check(this.root, 0, true);

    // Check all leaves are at the same depth
    const leafDepths = new Set();
    const getLeafDepths = (node, d) => {
      if (node.leaf) { leafDepths.add(d); return; }
      for (const child of node.children) getLeafDepths(child, d + 1);
    };
    getLeafDepths(this.root, 0);
    if (leafDepths.size > 1) {
      errors.push(`Leaves at different depths: ${[...leafDepths].join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Export the tree structure as a JSON-serializable object.
   */
  toJSON() {
    const serialize = (node) => ({
      keys: node.keys.map(k => ({ key: k.key, value: k.value })),
      leaf: node.leaf,
      children: node.leaf ? [] : node.children.map(serialize),
    });
    return {
      t: this.t,
      size: this.size,
      root: serialize(this.root),
      telemetry: this.getTelemetry(),
    };
  }
}
