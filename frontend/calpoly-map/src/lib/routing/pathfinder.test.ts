import test from "node:test";
import assert from "node:assert/strict";
import {
  findPath,
  type PathGraph,
  haversineDistanceMeters,
} from "./pathfinder";

test("findPath returns shortest path with segments", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.6595, 35.305] },
      B: { id: "B", coordinates: [-120.659, 35.3052] },
      C: { id: "C", coordinates: [-120.6585, 35.3054] },
    },
    edges: {
      AB: {
        id: "AB",
        from: "A",
        to: "B",
        distance: 80,
        coordinates: [
          [-120.6595, 35.305],
          [-120.6592, 35.3051],
          [-120.659, 35.3052],
        ],
      },
      BC: {
        id: "BC",
        from: "B",
        to: "C",
        distance: 80,
      },
      AC: {
        id: "AC",
        from: "A",
        to: "C",
        distance: 250,
      },
    },
  };

  const result = findPath(
    graph,
    [-120.65952, 35.30501],
    [-120.65849, 35.30541],
  );

  assert.ok(result);
  assert.equal(result.nodes.join(","), "A,B,C");
  assert.equal(result.distance, 160);
  assert.equal(result.segments.length, 2);
  assert.ok(result.path.length >= 3);
});

test("findPath returns null when no path exists", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.6595, 35.305] },
      B: { id: "B", coordinates: [-120.659, 35.3052] },
      C: { id: "C", coordinates: [-120.6585, 35.3054] },
    },
    edges: {
      AB: { id: "AB", from: "A", to: "B", distance: 80 },
    },
  };

  const result = findPath(
    graph,
    [-120.6595, 35.305],
    [-120.6585, 35.3054],
  );

  assert.equal(result, null);
});

test("findPath returns null when start or end is out of range", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.6595, 35.305] },
      B: { id: "B", coordinates: [-120.659, 35.3052] },
    },
    edges: {
      AB: { id: "AB", from: "A", to: "B", distance: 80 },
    },
  };

  const farStart: [number, number] = [-120.7, 35.4];
  const distance = haversineDistanceMeters(
    farStart,
    graph.nodes.A.coordinates,
  );
  assert.ok(distance > 50);

  const result = findPath(graph, farStart, graph.nodes.B.coordinates);
  assert.equal(result, null);
});

test("findPath handles same start and end node", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.6595, 35.305] },
    },
    edges: {},
  };

  const result = findPath(graph, [-120.6595, 35.305], [-120.6595, 35.305]);

  assert.ok(result);
  assert.equal(result.nodes.length, 1);
  assert.equal(result.distance, 0);
  assert.equal(result.segments.length, 0);
});

test("findPath can restrict to accessible edges only", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.6595, 35.305] },
      B: { id: "B", coordinates: [-120.659, 35.3052] },
      C: { id: "C", coordinates: [-120.6585, 35.3054] },
    },
    edges: {
      AB: {
        id: "AB",
        from: "A",
        to: "B",
        distance: 80,
        accessible: false,
      },
      BC: {
        id: "BC",
        from: "B",
        to: "C",
        distance: 80,
        accessible: true,
      },
      AC: {
        id: "AC",
        from: "A",
        to: "C",
        distance: 250,
        accessible: true,
      },
    },
  };

  const allEdgesResult = findPath(graph, graph.nodes.A.coordinates, graph.nodes.C.coordinates);
  assert.ok(allEdgesResult);
  assert.equal(allEdgesResult.nodes.join(","), "A,B,C");

  const accessibleOnlyResult = findPath(
    graph,
    graph.nodes.A.coordinates,
    graph.nodes.C.coordinates,
    { onlyAccessible: true },
  );
  assert.ok(accessibleOnlyResult);
  assert.equal(accessibleOnlyResult.nodes.join(","), "A,C");
});
