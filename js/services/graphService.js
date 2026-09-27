/**
 * ============================================================
 * SKYVOYAGE ENTERPRISE — Graph Service (DMGT Unit 4 & 5)
 * ============================================================
 * Airport route network modeled as a directed weighted graph.
 * Dijkstra's algorithm for shortest layover path during disruption.
 *
 * Academic Concepts Demonstrated:
 * - Directed graph (adjacency list representation)
 * - Edge weights (flight duration + layover time)
 * - Dijkstra's shortest path algorithm with priority queue
 * - BFS/DFS traversal
 * - Graph properties (degree, connectivity, path existence)
 * ============================================================
 */

// ══════════════════════════════════════════════════════════
//  GRAPH DATA STRUCTURE
// ══════════════════════════════════════════════════════════

export class Graph {
  constructor() {
    /** @type {Map<string, {code: string, city: string, lat: number, lng: number}>} */
    this.nodes = new Map();
    /** @type {Map<string, Array<{to: string, weight: number, flight: string, duration: number}>>} */
    this.adjList = new Map();
  }

  /**
   * Add an airport node.
   * @param {string} code — airport code (e.g., 'DEL')
   * @param {Object} data — { city, name, lat, lng }
   */
  addNode(code, data) {
    this.nodes.set(code, { code, ...data });
    if (!this.adjList.has(code)) {
      this.adjList.set(code, []);
    }
  }

  /**
   * Add a directed edge (route).
   * @param {string} from — origin airport code
   * @param {string} to — destination airport code
   * @param {number} weight — total travel time in minutes
   * @param {string} flight — flight number
   * @param {number} duration — flight duration in minutes
   */
  addEdge(from, to, weight, flight = '', duration = 0) {
    if (!this.adjList.has(from)) this.adjList.set(from, []);
    this.adjList.get(from).push({ to, weight, flight, duration });
  }

  /**
   * Get all neighbors of a node.
   * @param {string} node
   * @returns {Array}
   */
  getNeighbors(node) {
    return this.adjList.get(node) || [];
  }

  /**
   * Get in-degree (number of incoming edges).
   */
  getInDegree(node) {
    let count = 0;
    for (const edges of this.adjList.values()) {
      count += edges.filter(e => e.to === node).length;
    }
    return count;
  }

  /**
   * Get out-degree (number of outgoing edges).
   */
  getOutDegree(node) {
    return (this.adjList.get(node) || []).length;
  }

  /**
   * Get all edges in the graph.
   * @returns {Array<{from: string, to: string, weight: number, flight: string}>}
   */
  getAllEdges() {
    const edges = [];
    for (const [from, neighbors] of this.adjList) {
      for (const edge of neighbors) {
        edges.push({ from, to: edge.to, weight: edge.weight, flight: edge.flight, duration: edge.duration });
      }
    }
    return edges;
  }

  /** Get total node count */
  get nodeCount() { return this.nodes.size; }

  /** Get total edge count */
  get edgeCount() {
    let count = 0;
    for (const edges of this.adjList.values()) count += edges.length;
    return count;
  }
}

// ══════════════════════════════════════════════════════════
//  DIJKSTRA'S SHORTEST PATH ALGORITHM
// ══════════════════════════════════════════════════════════

/**
 * Simple min-priority queue for Dijkstra's algorithm.
 */
class MinPQ {
  constructor() { this.items = []; }
  insert(item, priority) { this.items.push({ item, priority }); this.items.sort((a, b) => a.priority - b.priority); }
  extractMin() { return this.items.shift(); }
  get isEmpty() { return this.items.length === 0; }
}

/**
 * Dijkstra's algorithm to find the shortest path (minimum total travel time).
 *
 * @param {Graph} graph
 * @param {string} source — origin airport code
 * @param {string} target — destination airport code
 * @returns {{
 *   found: boolean,
 *   distance: number,
 *   path: string[],
 *   edges: Array<{from: string, to: string, flight: string, weight: number}>,
 *   steps: Array — algorithm trace for visualization
 * }}
 */
export function dijkstra(graph, source, target) {
  const dist = new Map();
  const prev = new Map();
  const prevEdge = new Map();
  const visited = new Set();
  const steps = []; // Algorithm trace for visualization

  // Initialize distances
  for (const node of graph.nodes.keys()) {
    dist.set(node, Infinity);
  }
  dist.set(source, 0);

  const pq = new MinPQ();
  pq.insert(source, 0);

  steps.push({ type: 'init', source, target, message: `Starting Dijkstra from ${source} to ${target}` });

  while (!pq.isEmpty) {
    const { item: u, priority: d } = pq.extractMin();

    if (visited.has(u)) continue;
    visited.add(u);

    steps.push({
      type: 'visit',
      node: u,
      distance: d,
      message: `Visiting ${u} (distance: ${d} min)`,
    });

    if (u === target) {
      steps.push({ type: 'found', node: u, distance: d, message: `Target ${target} reached! Total: ${d} min` });
      break;
    }

    for (const edge of graph.getNeighbors(u)) {
      if (visited.has(edge.to)) continue;

      const newDist = d + edge.weight;
      steps.push({
        type: 'relax',
        from: u,
        to: edge.to,
        weight: edge.weight,
        newDist,
        currentDist: dist.get(edge.to),
        improved: newDist < dist.get(edge.to),
        message: `Edge ${u}→${edge.to} (${edge.flight}): ${d}+${edge.weight}=${newDist} ${newDist < dist.get(edge.to) ? '< ' + dist.get(edge.to) + ' ✓ UPDATE' : '>= ' + dist.get(edge.to) + ' ✗'}`,
      });

      if (newDist < dist.get(edge.to)) {
        dist.set(edge.to, newDist);
        prev.set(edge.to, u);
        prevEdge.set(edge.to, edge);
        pq.insert(edge.to, newDist);
      }
    }
  }

  // Reconstruct path
  if (!visited.has(target) || dist.get(target) === Infinity) {
    return { found: false, distance: Infinity, path: [], edges: [], steps };
  }

  const path = [];
  const edges = [];
  let current = target;
  while (current !== source) {
    path.unshift(current);
    const edge = prevEdge.get(current);
    if (edge) edges.unshift({ from: prev.get(current), to: current, flight: edge.flight, weight: edge.weight, duration: edge.duration });
    current = prev.get(current);
  }
  path.unshift(source);

  return {
    found: true,
    distance: dist.get(target),
    path,
    edges,
    steps,
    summary: `Shortest path: ${path.join(' → ')} (${dist.get(target)} minutes total via ${edges.length} flight(s))`,
  };
}

// ══════════════════════════════════════════════════════════
//  BFS / DFS TRAVERSALS
// ══════════════════════════════════════════════════════════

/**
 * Breadth-First Search traversal.
 * @param {Graph} graph
 * @param {string} start
 * @returns {string[]} visited nodes in BFS order
 */
export function bfs(graph, start) {
  const visited = new Set();
  const queue = [start];
  const order = [];
  visited.add(start);

  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    for (const edge of graph.getNeighbors(node)) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
  }

  return order;
}

/**
 * Depth-First Search traversal.
 * @param {Graph} graph
 * @param {string} start
 * @returns {string[]} visited nodes in DFS order
 */
export function dfs(graph, start) {
  const visited = new Set();
  const order = [];

  function visit(node) {
    if (visited.has(node)) return;
    visited.add(node);
    order.push(node);
    for (const edge of graph.getNeighbors(node)) {
      visit(edge.to);
    }
  }

  visit(start);
  return order;
}

// ══════════════════════════════════════════════════════════
//  INITIALIZE ROUTE NETWORK
// ══════════════════════════════════════════════════════════

/**
 * Create and populate the SkyVoyage route network graph.
 * @returns {Graph}
 */
export function createRouteNetwork() {
  const graph = new Graph();

  // Add airport nodes with approximate coordinates for visualization
  const airports = {
    DEL: { city: 'New Delhi', lat: 28.56, lng: 77.10 },
    BOM: { city: 'Mumbai', lat: 19.09, lng: 72.87 },
    BLR: { city: 'Bengaluru', lat: 13.20, lng: 77.71 },
    MAA: { city: 'Chennai', lat: 12.99, lng: 80.17 },
    HYD: { city: 'Hyderabad', lat: 17.24, lng: 78.43 },
    VTZ: { city: 'Visakhapatnam', lat: 17.72, lng: 83.22 },
    CCU: { city: 'Kolkata', lat: 22.65, lng: 88.45 },
    GOI: { city: 'Goa', lat: 15.38, lng: 73.83 },
    JAI: { city: 'Jaipur', lat: 26.82, lng: 75.81 },
    COK: { city: 'Kochi', lat: 10.15, lng: 76.40 },
    AMD: { city: 'Ahmedabad', lat: 23.07, lng: 72.63 },
    DXB: { city: 'Dubai', lat: 25.25, lng: 55.36 },
    LHR: { city: 'London', lat: 51.47, lng: -0.45 },
    SIN: { city: 'Singapore', lat: 1.36, lng: 103.99 },
  };

  for (const [code, data] of Object.entries(airports)) {
    graph.addNode(code, data);
  }

  // Add routes (directed edges) with travel times in minutes
  const routes = [
    // Direct flights from seed data
    { from: 'VTZ', to: 'HYD', weight: 75, flight: 'AI442', duration: 75 },
    { from: 'HYD', to: 'VTZ', weight: 75, flight: 'AI443', duration: 75 },
    { from: 'BOM', to: 'DXB', weight: 210, flight: 'EK501', duration: 210 },
    { from: 'DXB', to: 'BOM', weight: 210, flight: 'EK502', duration: 210 },
    { from: 'BLR', to: 'DEL', weight: 165, flight: '6E204', duration: 165 },
    { from: 'BOM', to: 'LHR', weight: 540, flight: 'BA138', duration: 540 },
    { from: 'LHR', to: 'BOM', weight: 540, flight: 'BA139', duration: 540 },
    { from: 'DEL', to: 'SIN', weight: 330, flight: 'SQ402', duration: 330 },
    { from: 'DEL', to: 'BOM', weight: 135, flight: 'SV101', duration: 135 },
    { from: 'BOM', to: 'HYD', weight: 90, flight: 'SV303', duration: 90 },
    { from: 'MAA', to: 'CCU', weight: 150, flight: 'SV404', duration: 150 },
    { from: 'DEL', to: 'BLR', weight: 165, flight: 'SV505', duration: 165 },
    { from: 'HYD', to: 'GOI', weight: 90, flight: 'SV606', duration: 90 },
    { from: 'BOM', to: 'DEL', weight: 135, flight: 'SV707', duration: 135 },
    { from: 'CCU', to: 'BLR', weight: 165, flight: 'SV808', duration: 165 },

    // Additional connecting routes
    { from: 'DEL', to: 'JAI', weight: 55, flight: 'SV901', duration: 55 },
    { from: 'JAI', to: 'BOM', weight: 110, flight: 'SV902', duration: 110 },
    { from: 'BOM', to: 'GOI', weight: 60, flight: 'SV903', duration: 60 },
    { from: 'BLR', to: 'MAA', weight: 50, flight: 'SV904', duration: 50 },
    { from: 'MAA', to: 'HYD', weight: 75, flight: 'SV905', duration: 75 },
    { from: 'BLR', to: 'COK', weight: 60, flight: 'SV906', duration: 60 },
    { from: 'DEL', to: 'AMD', weight: 95, flight: 'SV907', duration: 95 },
    { from: 'AMD', to: 'BOM', weight: 65, flight: 'SV908', duration: 65 },
    { from: 'CCU', to: 'DEL', weight: 140, flight: 'SV909', duration: 140 },
    { from: 'HYD', to: 'BLR', weight: 75, flight: 'SV910', duration: 75 },
    { from: 'GOI', to: 'BOM', weight: 60, flight: 'SV911', duration: 60 },
    { from: 'COK', to: 'BOM', weight: 100, flight: 'SV912', duration: 100 },
  ];

  for (const route of routes) {
    // Add layover time for connecting flights (45 min average)
    graph.addEdge(route.from, route.to, route.weight, route.flight, route.duration);
  }

  return graph;
}

/**
 * Find an alternative route when a flight is disrupted.
 * Adds layover time (45 min) for connecting flights.
 *
 * @param {string} origin
 * @param {string} destination
 * @returns {Object} Dijkstra result with layover-adjusted path
 */
export function findAlternativeRoute(origin, destination) {
  const graph = createRouteNetwork();

  // Create a modified graph with layover costs
  const layoverGraph = new Graph();
  for (const [code, data] of graph.nodes) {
    layoverGraph.addNode(code, data);
  }
  for (const [from, edges] of graph.adjList) {
    for (const edge of edges) {
      // Add 45 min layover for connections (not direct)
      layoverGraph.addEdge(from, edge.to, edge.weight, edge.flight, edge.duration);
    }
  }

  const result = dijkstra(layoverGraph, origin, destination);

  // Add layover time between connecting flights
  if (result.found && result.edges.length > 1) {
    const layoverTime = 45; // minutes
    const totalLayover = (result.edges.length - 1) * layoverTime;
    result.distance += totalLayover;
    result.layoverCount = result.edges.length - 1;
    result.totalLayoverTime = totalLayover;
    result.summary = `${result.path.join(' → ')} (${result.distance} min total, ${result.edges.length} flight(s), ${result.layoverCount} layover(s))`;
  }

  return result;
}

/**
 * Get all graph properties for display.
 */
export function getGraphProperties() {
  const graph = createRouteNetwork();

  const properties = {
    nodeCount: graph.nodeCount,
    edgeCount: graph.edgeCount,
    nodes: [...graph.nodes.values()],
    edges: graph.getAllEdges(),
    degrees: {},
  };

  for (const code of graph.nodes.keys()) {
    properties.degrees[code] = {
      in: graph.getInDegree(code),
      out: graph.getOutDegree(code),
      total: graph.getInDegree(code) + graph.getOutDegree(code),
    };
  }

  return properties;
}
