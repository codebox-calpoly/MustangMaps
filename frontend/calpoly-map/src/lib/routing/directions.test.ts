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
  assert.equal(classifyTurn(10, 28), "continue");
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

test("tiny zigzag before junction does not invert turn direction", () => {
  // Heading south (180°), tiny 3m zigzag nearly north (350°), then east (90°).
  // Without the fix, previousBearing becomes 350° from the zigzag, making the
  // east turn classify as "turn-right" (+100° delta).  The correct result is
  // "turn-left" because the user is heading south overall and east is to their left.
  const segments: RouteSegment[] = [
    segment([0, 0], [0, -1], 50, 180),
    segment([0, -1], [0, -0.99], 3, 350),
    segment([0, -0.99], [1, -0.99], 30, 90),
  ];

  const steps = buildDirectionsFromSegments(segments);
  // The tiny zigzag should be absorbed and the east turn should be left
  const turnStep = steps.find((s) => s.maneuver === "turn-left" || s.maneuver === "turn-right");
  assert.ok(turnStep, "expected a turn step");
  assert.equal(turnStep.maneuver, "turn-left");
});
