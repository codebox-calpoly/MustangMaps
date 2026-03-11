export interface RouteSegment {
  from: [number, number];
  to: [number, number];
  distance: number;
  bearing: number;
}

export interface PathfinderResult {
  path: [number, number][];
  distance: number;
  nodes: string[];
  segments: RouteSegment[];
}

export interface PathGraphNode {
  id: string;
  coordinates: [number, number];
}

export interface PathGraphEdge {
  id: string;
  from: string;
  to: string;
  distance: number;
  coordinates?: [number, number][];
  bidirectional?: boolean;
}

export interface PathGraphEdgeRef {
  to: string;
  edgeId: string;
  distance: number;
}

export interface PathGraph {
  nodes: Record<string, PathGraphNode>;
  edges: Record<string, PathGraphEdge>;
  adjacency?: Record<string, PathGraphEdgeRef[]>;
}

const DEFAULT_SNAP_RADIUS_METERS = 50;
const MAX_SNAP_RADIUS_METERS = 200;

export interface FindPathOptions {
  snapRadiusMeters?: number;
}

class MinHeap<T> {
  private data: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  push(item: T) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) {
      return undefined;
    }
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  get size() {
    return this.data.length;
  }

  private bubbleUp(index: number) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.compare(this.data[current], this.data[parent]) >= 0) {
        break;
      }
      [this.data[current], this.data[parent]] = [
        this.data[parent],
        this.data[current],
      ];
      current = parent;
    }
  }

  private bubbleDown(index: number) {
    let current = index;
    const length = this.data.length;
    while (true) {
      const left = current * 2 + 1;
      const right = current * 2 + 2;
      let smallest = current;

      if (left < length && this.compare(this.data[left], this.data[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.data[right], this.data[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === current) {
        break;
      }
      [this.data[current], this.data[smallest]] = [
        this.data[smallest],
        this.data[current],
      ];
      current = smallest;
    }
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceMeters(
  from: [number, number],
  to: [number, number],
) {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const earthRadius = 6371000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2) *
      Math.cos(lat1Rad) *
      Math.cos(lat2Rad);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

export function bearingDegrees(
  from: [number, number],
  to: [number, number],
) {
  const [lon1, lat1] = from.map(toRadians);
  const [lon2, lat2] = to.map(toRadians);
  const deltaLon = lon2 - lon1;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function buildAdjacency(graph: PathGraph) {
  if (graph.adjacency) {
    return graph.adjacency;
  }
  const adjacency: Record<string, PathGraphEdgeRef[]> = {};
  for (const edge of Object.values(graph.edges)) {
    if (!adjacency[edge.from]) {
      adjacency[edge.from] = [];
    }
    adjacency[edge.from].push({
      to: edge.to,
      edgeId: edge.id,
      distance: edge.distance,
    });

    if (edge.bidirectional !== false) {
      if (!adjacency[edge.to]) {
        adjacency[edge.to] = [];
      }
      adjacency[edge.to].push({
        to: edge.from,
        edgeId: edge.id,
        distance: edge.distance,
      });
    }
  }
  return adjacency;
}

function findNearestNodeId(
  graph: PathGraph,
  coord: [number, number],
  radiusMeters: number,
) {
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of Object.values(graph.nodes)) {
    const distance = haversineDistanceMeters(coord, node.coordinates);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = node.id;
    }
  }
  if (bestId && bestDistance <= radiusMeters) {
    return bestId;
  }
  return null;
}

function normalizeEdgeCoordinates(
  edge: PathGraphEdge,
  from: [number, number],
  to: [number, number],
) {
  if (!edge.coordinates || edge.coordinates.length === 0) {
    return null;
  }
  const coords = edge.coordinates;
  const startDistance = haversineDistanceMeters(coords[0], from);
  const endDistance = haversineDistanceMeters(coords[coords.length - 1], from);
  if (endDistance < startDistance) {
    return [...coords].reverse();
  }
  return coords;
}

function appendCoordinates(
  target: [number, number][],
  coords: [number, number][],
) {
  for (const coord of coords) {
    const last = target[target.length - 1];
    if (!last || last[0] !== coord[0] || last[1] !== coord[1]) {
      target.push(coord);
    }
  }
}

export function findPath(
  graph: PathGraph,
  startCoord: [number, number],
  endCoord: [number, number],
  options?: FindPathOptions,
): PathfinderResult | null {
  const snapRadius = Math.min(
    options?.snapRadiusMeters ?? DEFAULT_SNAP_RADIUS_METERS,
    MAX_SNAP_RADIUS_METERS,
  );
  const adjacency = buildAdjacency(graph);
  const startNodeId = findNearestNodeId(
    graph,
    startCoord,
    snapRadius,
  );
  const endNodeId = findNearestNodeId(
    graph,
    endCoord,
    snapRadius,
  );

  if (!startNodeId || !endNodeId) {
    return null;
  }

  if (startNodeId === endNodeId) {
    const node = graph.nodes[startNodeId];
    return {
      path: [node.coordinates],
      distance: 0,
      nodes: [startNodeId],
      segments: [],
    };
  }

  const openSet = new MinHeap<{ nodeId: string; f: number; g: number }>(
    (a, b) => a.f - b.f,
  );
  const cameFrom = new Map<string, string>();
  const cameViaEdge = new Map<string, string>();
  const gScore = new Map<string, number>();

  gScore.set(startNodeId, 0);
  openSet.push({
    nodeId: startNodeId,
    g: 0,
    f: haversineDistanceMeters(
      graph.nodes[startNodeId].coordinates,
      graph.nodes[endNodeId].coordinates,
    ),
  });

  while (openSet.size > 0) {
    const current = openSet.pop();
    if (!current) {
      break;
    }
    const bestKnown = gScore.get(current.nodeId);
    if (bestKnown === undefined || current.g > bestKnown) {
      continue;
    }

    if (current.nodeId === endNodeId) {
      const nodePath: string[] = [];
      const edgePath: string[] = [];
      let cursor: string | undefined = endNodeId;
      while (cursor) {
        nodePath.push(cursor);
        const prev = cameFrom.get(cursor);
        if (prev) {
          const edgeId = cameViaEdge.get(cursor);
          if (edgeId) {
            edgePath.push(edgeId);
          }
        }
        cursor = prev;
      }
      nodePath.reverse();
      edgePath.reverse();

      const pathCoords: [number, number][] = [];
      const segments: RouteSegment[] = [];
      if (nodePath.length === 0) return null;
      appendCoordinates(pathCoords, [graph.nodes[nodePath[0]].coordinates]);

      for (let i = 0; i < edgePath.length; i += 1) {
        const edgeId = edgePath[i];
        const edge = graph.edges[edgeId];
        const fromNodeId = nodePath[i];
        const toNodeId = nodePath[i + 1];
        if (!edge || !graph.nodes[fromNodeId] || !graph.nodes[toNodeId]) continue;
        const fromCoord = graph.nodes[fromNodeId].coordinates;
        const toCoord = graph.nodes[toNodeId].coordinates;

        const edgeCoords = normalizeEdgeCoordinates(edge, fromCoord, toCoord);
        if (edgeCoords) {
          appendCoordinates(pathCoords, edgeCoords);
          const last = pathCoords[pathCoords.length - 1];
          if (!last || last[0] !== toCoord[0] || last[1] !== toCoord[1]) {
            appendCoordinates(pathCoords, [toCoord]);
          }
        } else {
          appendCoordinates(pathCoords, [toCoord]);
        }

        segments.push({
          from: fromCoord,
          to: toCoord,
          distance: edge.distance,
          bearing: bearingDegrees(fromCoord, toCoord),
        });
      }

      const distance = gScore.get(endNodeId) ?? 0;
      return {
        path: pathCoords,
        distance,
        nodes: nodePath,
        segments,
      };
    }

    const neighbors = adjacency[current.nodeId] ?? [];
    for (const neighbor of neighbors) {
      const tentative =
        (gScore.get(current.nodeId) ?? Number.POSITIVE_INFINITY) +
        neighbor.distance;
      const existing = gScore.get(neighbor.to);
      if (existing === undefined || tentative < existing) {
        cameFrom.set(neighbor.to, current.nodeId);
        cameViaEdge.set(neighbor.to, neighbor.edgeId);
        gScore.set(neighbor.to, tentative);
        const neighborCoord = graph.nodes[neighbor.to]?.coordinates;
        if (!neighborCoord) {
          continue;
        }
        const heuristic = haversineDistanceMeters(
          neighborCoord,
          graph.nodes[endNodeId].coordinates,
        );
        openSet.push({
          nodeId: neighbor.to,
          g: tentative,
          f: tentative + heuristic,
        });
      }
    }
  }

  return null;
}
