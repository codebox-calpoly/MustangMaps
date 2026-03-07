import test from "node:test";
import assert from "node:assert/strict";
import type { RouteSegment } from "./pathfinder";
import {
  buildDirectionsFromSegments,
  classifyTurn,
  signedBearingDelta,
  bearingToCompassDirection,
} from "./directions";

function segment(
  from: [number, number],
  to: [number, number],
  distance: number,
  bearing: number,
): RouteSegment {
  return { from, to, distance, bearing };
}

test("classifyTurn keeps small angle changes as continue", () => {
  assert.equal(classifyTurn(10, 22), "continue");
  assert.equal(classifyTurn(10, 90), "turn-right");
  assert.equal(classifyTurn(90, 10), "turn-left");
});

test("signedBearingDelta wraps across north correctly", () => {
  assert.equal(signedBearingDelta(350, 10), 20);
  assert.equal(signedBearingDelta(10, 350), -20);
});

test("bearingToCompassDirection maps to 8-way compass", () => {
  assert.equal(bearingToCompassDirection(0), "north");
  assert.equal(bearingToCompassDirection(45), "north-east");
  assert.equal(bearingToCompassDirection(200), "south");
});

test("buildDirectionsFromSegments creates turn instructions for significant bearing changes", () => {
  const segments: RouteSegment[] = [
    segment([0, 0], [0, 1], 50, 0),
    segment([0, 1], [0, 2], 20, 6),
    segment([0, 2], [1, 2], 30, 90),
    segment([1, 2], [2, 2], 25, 95),
  ];

  const steps = buildDirectionsFromSegments(segments);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].maneuver, "head");
  assert.equal(steps[0].distance, 70);
  assert.equal(steps[1].maneuver, "turn-right");
  assert.equal(steps[1].distance, 55);
  assert.match(steps[1].instruction, /^Turn right/);
});

test("buildDirectionsFromSegments merges tiny steps", () => {
  const segments: RouteSegment[] = [
    segment([0, 0], [0, 1], 30, 0),
    segment([0, 1], [1, 1], 4, 90),
    segment([1, 1], [1, 2], 28, 0),
  ];

  const steps = buildDirectionsFromSegments(segments, { tinyStepMaxMeters: 8 });
  assert.equal(steps.length, 2);
  assert.equal(steps[0].distance, 34);
  assert.equal(steps[1].distance, 28);
  assert.equal(steps[0].maneuver, "head");
  assert.equal(steps[1].maneuver, "turn-left");
});

test("tiny starting segment does not corrupt first turn classification", () => {
  // Tiny 3m start pointing northwest (315°), then 66m south (180°), then 30m east (90°).
  const segments: RouteSegment[] = [
    segment([0, 0], [0.00001, 0.00001], 3, 315),
    segment([0.00001, 0.00001], [0.00001, -0.0005], 66, 180),
    segment([0.00001, -0.0005], [0.0003, -0.0005], 30, 90),
  ];

  const steps = buildDirectionsFromSegments(segments);
  assert.equal(steps[0].maneuver, "head");
  assert.ok(steps[0].distance >= 60, `expected head step ≥60m, got ${steps[0].distance}`);
  const turnStep = steps.find((s) => s.maneuver === "turn-left" || s.maneuver === "turn-right");
  assert.ok(turnStep, "expected a turn step");
  assert.equal(turnStep.maneuver, "turn-left");
});

test("40° cumulative drift stays as single step (below threshold)", () => {
  // Five segments gradually curving right, each only 10° apart.
  // Total drift is 40° which is below the 55° threshold, so it
  // should remain a single "head" step (gentle curve, not a turn).
  const segments: RouteSegment[] = [
    segment([0, 0], [1, 0], 30, 0),
    segment([1, 0], [2, 0], 30, 10),
    segment([2, 0], [3, 0], 30, 20),
    segment([3, 0], [4, 0], 30, 30),
    segment([4, 0], [5, 0], 30, 40),
  ];

  const steps = buildDirectionsFromSegments(segments);
  assert.equal(steps.length, 1, "40° gentle curve should be a single head step");
  assert.equal(steps[0].maneuver, "head");
  assert.equal(steps[0].distance, 150);
});

test("60° cumulative drift creates turn instruction", () => {
  // Six segments gradually curving right, each 12° apart.
  // Total drift is 60° which exceeds the 55° threshold.
  const segments: RouteSegment[] = [
    segment([0, 0], [1, 0], 30, 0),
    segment([1, 0], [2, 0], 30, 12),
    segment([2, 0], [3, 0], 30, 24),
    segment([3, 0], [4, 0], 30, 36),
    segment([4, 0], [5, 0], 30, 48),
    segment([5, 0], [6, 0], 30, 60),
  ];

  const steps = buildDirectionsFromSegments(segments);
  assert.ok(
    steps.length >= 2,
    `expected at least 2 steps for 60° total curve, got ${steps.length}`,
  );
  assert.equal(steps[0].maneuver, "head");
  const turnStep = steps.find(
    (s) => s.maneuver === "turn-left" || s.maneuver === "turn-right",
  );
  assert.ok(turnStep, "expected a turn step from cumulative drift");
  assert.equal(turnStep.maneuver, "turn-right");
});

test("gradual curve east-to-south produces turn even with small increments", () => {
  // Simulates the real campus scenario: path goes east (90°), curves
  // gradually southeast, then south.  Each step is only ~18° but the
  // total change is 72° — clearly a direction change the user should see.
  const segments: RouteSegment[] = [
    segment([0, 0], [1, 0], 40, 90),
    segment([1, 0], [2, -0.2], 40, 108),
    segment([2, -0.2], [3, -0.6], 40, 126),
    segment([3, -0.6], [4, -1.2], 40, 144),
    segment([4, -1.2], [5, -2], 40, 162),
  ];

  const steps = buildDirectionsFromSegments(segments);
  assert.ok(
    steps.length >= 2,
    `expected at least 2 steps for 72° curve, got ${steps.length}`,
  );
  assert.equal(steps[0].maneuver, "head");
  const turnStep = steps.find(
    (s) => s.maneuver === "turn-left" || s.maneuver === "turn-right",
  );
  assert.ok(turnStep, "expected a turn step for east-to-south curve");
  assert.equal(turnStep.maneuver, "turn-right");
});

test("gentle straight road with minor wobble stays as one step", () => {
  // Bearing wobbles ±8° around 90° — should NOT trigger a turn.
  const segments: RouteSegment[] = [
    segment([0, 0], [1, 0], 50, 90),
    segment([1, 0], [2, 0], 50, 98),
    segment([2, 0], [3, 0], 50, 85),
    segment([3, 0], [4, 0], 50, 93),
    segment([4, 0], [5, 0], 50, 88),
  ];

  const steps = buildDirectionsFromSegments(segments);
  assert.equal(steps.length, 1, "wobbling road should be a single head step");
  assert.equal(steps[0].maneuver, "head");
  assert.equal(steps[0].distance, 250);
});

test("two consecutive 90-degree left turns are preserved as separate steps", () => {
  // Route goes north, turns left (west), short segment, turns left again (south).
  // Both turns must appear as separate instructions.
  const segments: RouteSegment[] = [
    segment([0, 0], [0, 1], 50, 0),
    segment([0, 1], [-1, 1], 30, 270),
    segment([-1, 1], [-1, 0], 200, 180),
  ];

  const steps = buildDirectionsFromSegments(segments);
  assert.equal(steps.length, 3, "expected 3 steps: head, turn-left, turn-left");
  assert.equal(steps[0].maneuver, "head");
  assert.equal(steps[1].maneuver, "turn-left");
  assert.equal(steps[2].maneuver, "turn-left");
  assert.equal(steps[1].distance, 30);
  assert.equal(steps[2].distance, 200);
});

test("two consecutive right turns are preserved as separate steps", () => {
  const segments: RouteSegment[] = [
    segment([0, 0], [0, 1], 60, 0),
    segment([0, 1], [1, 1], 25, 90),
    segment([1, 1], [1, 0], 150, 180),
  ];

  const steps = buildDirectionsFromSegments(segments);
  assert.equal(steps.length, 3, "expected 3 steps: head, turn-right, turn-right");
  assert.equal(steps[0].maneuver, "head");
  assert.equal(steps[1].maneuver, "turn-right");
  assert.equal(steps[2].maneuver, "turn-right");
});

test("tiny zigzag before junction does not invert turn direction", () => {
  // Heading south (180°), tiny 3m zigzag nearly north (350°), then east (90°).
  const segments: RouteSegment[] = [
    segment([0, 0], [0, -1], 50, 180),
    segment([0, -1], [0, -0.99], 3, 350),
    segment([0, -0.99], [1, -0.99], 30, 90),
  ];

  const steps = buildDirectionsFromSegments(segments);
  const turnStep = steps.find((s) => s.maneuver === "turn-left" || s.maneuver === "turn-right");
  assert.ok(turnStep, "expected a turn step");
  assert.equal(turnStep.maneuver, "turn-left");
});
