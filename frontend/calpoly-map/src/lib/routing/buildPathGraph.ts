import type { FeatureCollection, LineString, MultiLineString } from "geojson";
import { haversineDistanceMeters } from "./pathfinder";
import type {
  PathGraph,
  PathGraphEdge,
  PathGraphNode,
} from "./pathfinder";

type Coord = [number, number];

type LineGeometry = LineString | MultiLineString;

function parseAccessible(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["yes", "true", "1"].includes(normalized)) {
      return true;
    }
    if (["no", "false", "0"].includes(normalized)) {
      return false;
    }
  }
  return true;
}

function coordKey(coord: Coord) {
  const [lon, lat] = coord;
  return `${lon.toFixed(6)},${lat.toFixed(6)}`;
}

function addNode(
  nodes: Record<string, PathGraphNode>,
  nodeIds: Map<string, string>,
  coord: Coord,
) {
  const key = coordKey(coord);
  const existing = nodeIds.get(key);
  if (existing) {
    return existing;
  }
  const id = `node-${key}`;
  nodes[id] = { id, coordinates: coord };
  nodeIds.set(key, id);
  return id;
}

function addEdge(
  edges: Record<string, PathGraphEdge>,
  fromId: string,
  toId: string,
  fromCoord: Coord,
  toCoord: Coord,
  accessible: boolean,
  counter: number,
) {
  const id = `edge-${counter}`;
  edges[id] = {
    id,
    from: fromId,
    to: toId,
    distance: haversineDistanceMeters(fromCoord, toCoord),
    coordinates: [fromCoord, toCoord],
    accessible,
  };
  return id;
}

export function buildPathGraphFromGeoJSON(
  collection: FeatureCollection,
): PathGraph {
  const nodes: Record<string, PathGraphNode> = {};
  const edges: Record<string, PathGraphEdge> = {};
  const nodeIds = new Map<string, string>();
  let edgeCounter = 0;

  for (const feature of collection.features) {
    const geometry = feature.geometry as LineGeometry | null;
    const accessible = parseAccessible(feature.properties?.accessible);
    if (!geometry) {
      continue;
    }

    if (geometry.type === "LineString") {
      const coords = geometry.coordinates as Coord[];
      for (let i = 0; i < coords.length - 1; i += 1) {
        const fromCoord = coords[i];
        const toCoord = coords[i + 1];
        if (!fromCoord || !toCoord) {
          continue;
        }
        const fromId = addNode(nodes, nodeIds, fromCoord);
        const toId = addNode(nodes, nodeIds, toCoord);
        addEdge(
          edges,
          fromId,
          toId,
          fromCoord,
          toCoord,
          accessible,
          edgeCounter,
        );
        edgeCounter += 1;
      }
    }

    if (geometry.type === "MultiLineString") {
      const lines = geometry.coordinates as Coord[][];
      for (const line of lines) {
        for (let i = 0; i < line.length - 1; i += 1) {
          const fromCoord = line[i];
          const toCoord = line[i + 1];
          if (!fromCoord || !toCoord) {
            continue;
          }
          const fromId = addNode(nodes, nodeIds, fromCoord);
          const toId = addNode(nodes, nodeIds, toCoord);
          addEdge(
            edges,
            fromId,
            toId,
            fromCoord,
            toCoord,
            accessible,
            edgeCounter,
          );
          edgeCounter += 1;
        }
      }
    }
  }

  return { nodes, edges };
}
