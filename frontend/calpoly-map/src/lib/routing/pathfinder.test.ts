import test from "node:test";
import assert from "node:assert/strict";
import {
  findPath,
  type PathGraph,
  haversineDistanceMeters,
} from "./pathfinder";
import { buildDirectionsFromSegments } from "./directions";

test("findPath returns shortest path with segments", () => {
  // B is clearly off the A→C line so it survives RDP simplification
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.6595, 35.305] },
      B: { id: "B", coordinates: [-120.6592, 35.3046] },
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
          [-120.6592, 35.3046],
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

// ── Path simplification tests ──────────────────────────────────────

test("collinear nodes are all preserved in path (no simplification)", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.660, 35.3040] },
      B: { id: "B", coordinates: [-120.660, 35.3042] },
      C: { id: "C", coordinates: [-120.660, 35.3044] },
      D: { id: "D", coordinates: [-120.660, 35.3046] },
      E: { id: "E", coordinates: [-120.660, 35.3048] },
    },
    edges: {
      AB: { id: "AB", from: "A", to: "B", distance: 22 },
      BC: { id: "BC", from: "B", to: "C", distance: 22 },
      CD: { id: "CD", from: "C", to: "D", distance: 22 },
      DE: { id: "DE", from: "D", to: "E", distance: 22 },
    },
  };

  const result = findPath(graph, [-120.660, 35.3040], [-120.660, 35.3048]);
  assert.ok(result);
  assert.equal(result.nodes.join(","), "A,B,C,D,E");
  assert.equal(result.path.length, 5);
  assert.equal(result.segments.length, 4);
  assert.deepEqual(result.path[0], [-120.660, 35.3040]);
  assert.deepEqual(result.path[4], [-120.660, 35.3048]);
});

test("L-shaped path preserves all nodes including turn point", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.662, 35.304] },
      B: { id: "B", coordinates: [-120.661, 35.304] },
      C: { id: "C", coordinates: [-120.660, 35.304] },
      D: { id: "D", coordinates: [-120.660, 35.305] },
      E: { id: "E", coordinates: [-120.660, 35.306] },
    },
    edges: {
      AB: { id: "AB", from: "A", to: "B", distance: 81 },
      BC: { id: "BC", from: "B", to: "C", distance: 81 },
      CD: { id: "CD", from: "C", to: "D", distance: 111 },
      DE: { id: "DE", from: "D", to: "E", distance: 111 },
    },
  };

  const result = findPath(graph, [-120.662, 35.304], [-120.660, 35.306]);
  assert.ok(result);
  assert.equal(result.path.length, 5);
  const hasC = result.path.some(
    (p) => Math.abs(p[0] - -120.660) < 0.0001 && Math.abs(p[1] - 35.304) < 0.0001,
  );
  assert.ok(hasC, "turn point C must be preserved");
  assert.deepEqual(result.path[0], [-120.662, 35.304]);
  assert.deepEqual(result.path[result.path.length - 1], [-120.660, 35.306]);
});

test("small wobbles are preserved in path (no simplification)", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.66000, 35.3040] },
      B: { id: "B", coordinates: [-120.65998, 35.3042] },
      C: { id: "C", coordinates: [-120.66002, 35.3044] },
      D: { id: "D", coordinates: [-120.65999, 35.3046] },
      E: { id: "E", coordinates: [-120.66000, 35.3048] },
    },
    edges: {
      AB: { id: "AB", from: "A", to: "B", distance: 22 },
      BC: { id: "BC", from: "B", to: "C", distance: 22 },
      CD: { id: "CD", from: "C", to: "D", distance: 22 },
      DE: { id: "DE", from: "D", to: "E", distance: 22 },
    },
  };

  const result = findPath(graph, [-120.66000, 35.3040], [-120.66000, 35.3048]);
  assert.ok(result);
  assert.equal(result.path.length, 5, "all graph nodes should be preserved");
  assert.equal(result.segments.length, 4);
});

test("simplification keeps deviations above epsilon", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.660, 35.3040] },
      B: { id: "B", coordinates: [-120.660, 35.3044] },
      C: { id: "C", coordinates: [-120.6599, 35.3048] },
      D: { id: "D", coordinates: [-120.660, 35.3052] },
    },
    edges: {
      AB: { id: "AB", from: "A", to: "B", distance: 44 },
      BC: { id: "BC", from: "B", to: "C", distance: 46 },
      CD: { id: "CD", from: "C", to: "D", distance: 46 },
    },
  };

  const result = findPath(graph, [-120.660, 35.3040], [-120.660, 35.3052]);
  assert.ok(result);
  const hasC = result.path.some(
    (p) => Math.abs(p[0] - -120.6599) < 0.00001 && Math.abs(p[1] - 35.3048) < 0.0001,
  );
  assert.ok(hasC, "deviation >3m at C must survive simplification");
  assert.ok(result.path.length >= 3, `expected ≥3 path points, got ${result.path.length}`);
});

test("segments after simplification are consistent with path", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.662, 35.304] },
      B: { id: "B", coordinates: [-120.661, 35.304] },
      C: { id: "C", coordinates: [-120.660, 35.304] },
      D: { id: "D", coordinates: [-120.660, 35.306] },
    },
    edges: {
      AB: { id: "AB", from: "A", to: "B", distance: 81 },
      BC: { id: "BC", from: "B", to: "C", distance: 81 },
      CD: { id: "CD", from: "C", to: "D", distance: 222 },
    },
  };

  const result = findPath(graph, [-120.662, 35.304], [-120.660, 35.306]);
  assert.ok(result);
  assert.equal(
    result.segments.length,
    result.path.length - 1,
    "segment count must equal path points minus one",
  );
  for (let i = 0; i < result.segments.length; i++) {
    const seg: { from: [number, number]; to: [number, number]; distance: number; bearing: number } = result.segments[i];
    assert.deepEqual(seg.from, result.path[i], `segment[${i}].from must match path[${i}]`);
    assert.deepEqual(seg.to, result.path[i + 1], `segment[${i}].to must match path[${i + 1}]`);
    assert.ok(seg.distance > 0, `segment[${i}].distance must be positive`);
    assert.ok(seg.bearing >= 0 && seg.bearing < 360, `segment[${i}].bearing must be [0, 360)`);
  }
});

test("directions from simplified L-shaped path produce correct turn", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.662, 35.304] },
      B: { id: "B", coordinates: [-120.661, 35.304] },
      C: { id: "C", coordinates: [-120.660, 35.304] },
      D: { id: "D", coordinates: [-120.660, 35.305] },
      E: { id: "E", coordinates: [-120.660, 35.306] },
    },
    edges: {
      AB: { id: "AB", from: "A", to: "B", distance: 81 },
      BC: { id: "BC", from: "B", to: "C", distance: 81 },
      CD: { id: "CD", from: "C", to: "D", distance: 111 },
      DE: { id: "DE", from: "D", to: "E", distance: 111 },
    },
  };

  const result = findPath(graph, [-120.662, 35.304], [-120.660, 35.306]);
  assert.ok(result);

  const steps = buildDirectionsFromSegments(result.segments);
  assert.ok(steps.length >= 2, `expected ≥2 direction steps, got ${steps.length}`);
  assert.equal(steps[0].maneuver, "head");

  const turnStep = steps.find(
    (s) => s.maneuver === "turn-left" || s.maneuver === "turn-right",
  );
  assert.ok(turnStep, "expected a turn instruction");
  assert.equal(turnStep.maneuver, "turn-left", "east→north should be a left turn");
  assert.match(turnStep.instruction, /^Turn left/);
});

test("total distance is preserved with all nodes", () => {
  const graph: PathGraph = {
    nodes: {
      A: { id: "A", coordinates: [-120.660, 35.3040] },
      B: { id: "B", coordinates: [-120.660, 35.3044] },
      C: { id: "C", coordinates: [-120.660, 35.3048] },
      D: { id: "D", coordinates: [-120.660, 35.3052] },
    },
    edges: {
      AB: { id: "AB", from: "A", to: "B", distance: 44 },
      BC: { id: "BC", from: "B", to: "C", distance: 44 },
      CD: { id: "CD", from: "C", to: "D", distance: 44 },
    },
  };

  const result = findPath(graph, [-120.660, 35.3040], [-120.660, 35.3052]);
  assert.ok(result);
  assert.equal(result.path.length, 4);
  assert.equal(result.distance, 132);
  const segmentTotal = result.segments.reduce((sum, s) => sum + s.distance, 0);
  assert.ok(
    Math.abs(segmentTotal - result.distance) < 5,
    `segment total ${segmentTotal.toFixed(1)}m should be close to A* total ${result.distance}m`,
  );
});
