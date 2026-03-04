import type { PathfinderResult, RouteSegment } from "./pathfinder";

export type CompassDirection =
  | "north"
  | "north-east"
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west"
  | "north-west";

export type DirectionManeuver =
  | "head"
  | "continue"
  | "turn-left"
  | "turn-right"
  | "arrive";

export interface DirectionStep {
  instruction: string;
  distance: number;
  bearing: number;
  direction: CompassDirection;
  maneuver: DirectionManeuver;
  from: [number, number];
  to: [number, number];
}

export interface DirectionOptions {
  continueAngleMaxDeg?: number;
  tinyStepMaxMeters?: number;
  includeArrivalStep?: boolean;
}

const DEFAULT_CONTINUE_ANGLE_MAX_DEG = 25;
const DEFAULT_TINY_STEP_MAX_METERS = 8;

const COMPASS_DIRECTIONS: CompassDirection[] = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

type MovementManeuver = Exclude<DirectionManeuver, "arrive">;

interface StepAccumulator {
  maneuver: MovementManeuver;
  distance: number;
  from: [number, number];
  to: [number, number];
  firstBearing: number;
  lastBearing: number;
}

function normalizeBearing(bearing: number) {
  return ((bearing % 360) + 360) % 360;
}

function roundDistanceMeters(distance: number) {
  return Math.max(1, Math.round(distance));
}

function movementBearing(step: StepAccumulator) {
  if (step.maneuver === "continue") {
    return normalizeBearing(step.lastBearing);
  }
  return normalizeBearing(step.firstBearing);
}

function createAccumulator(
  segment: RouteSegment,
  maneuver: MovementManeuver,
): StepAccumulator {
  return {
    maneuver,
    distance: segment.distance,
    from: segment.from,
    to: segment.to,
    firstBearing: segment.bearing,
    lastBearing: segment.bearing,
  };
}

function extendAccumulator(target: StepAccumulator, segment: RouteSegment) {
  target.distance += segment.distance;
  target.to = segment.to;
  target.lastBearing = segment.bearing;
}

function mergeAccumulatorIntoPrevious(
  previous: StepAccumulator,
  current: StepAccumulator,
) {
  previous.distance += current.distance;
  previous.to = current.to;
  previous.lastBearing = current.lastBearing;
}

function mergeAccumulatorIntoNext(
  next: StepAccumulator,
  current: StepAccumulator,
) {
  next.distance += current.distance;
  next.from = current.from;
  next.firstBearing = current.firstBearing;
}

function instructionFromStep(
  maneuver: MovementManeuver,
  direction: CompassDirection,
  distance: number,
) {
  const roundedDistance = roundDistanceMeters(distance);
  if (maneuver === "head") {
    return `Head ${direction} for ${roundedDistance} m`;
  }
  if (maneuver === "continue") {
    return `Continue ${direction} for ${roundedDistance} m`;
  }
  if (maneuver === "turn-left") {
    return `Turn left toward ${direction} and continue for ${roundedDistance} m`;
  }
  return `Turn right toward ${direction} and continue for ${roundedDistance} m`;
}

export function bearingToCompassDirection(bearing: number): CompassDirection {
  const normalized = normalizeBearing(bearing);
  const index = Math.round(normalized / 45) % COMPASS_DIRECTIONS.length;
  return COMPASS_DIRECTIONS[index];
}

export function signedBearingDelta(
  previousBearing: number,
  currentBearing: number,
) {
  const rawDelta = normalizeBearing(currentBearing) - normalizeBearing(previousBearing);
  return ((rawDelta + 540) % 360) - 180;
}

export function classifyTurn(
  previousBearing: number,
  currentBearing: number,
  continueAngleMaxDeg = DEFAULT_CONTINUE_ANGLE_MAX_DEG,
): "continue" | "turn-left" | "turn-right" {
  const delta = signedBearingDelta(previousBearing, currentBearing);
  if (Math.abs(delta) <= continueAngleMaxDeg) {
    return "continue";
  }
  return delta < 0 ? "turn-left" : "turn-right";
}

function mergeAdjacentSameManeuver(steps: StepAccumulator[]) {
  if (steps.length < 2) {
    return steps;
  }

  const merged: StepAccumulator[] = [{ ...steps[0] }];
  for (let i = 1; i < steps.length; i += 1) {
    const current = steps[i];
    const previous = merged[merged.length - 1];
    if (previous.maneuver === current.maneuver) {
      mergeAccumulatorIntoPrevious(previous, current);
      continue;
    }
    merged.push({ ...current });
  }
  return merged;
}

function mergeTinySteps(
  steps: StepAccumulator[],
  tinyStepMaxMeters: number,
) {
  if (steps.length < 2 || tinyStepMaxMeters <= 0) {
    return steps;
  }

  const merged = steps.map((step) => ({ ...step }));
  let index = 0;
  while (index < merged.length) {
    const current = merged[index];
    const isTiny = current.distance <= tinyStepMaxMeters;
    if (!isTiny || merged.length === 1) {
      index += 1;
      continue;
    }

    if (index === 0) {
      mergeAccumulatorIntoNext(merged[index + 1], current);
      merged.splice(index, 1);
      continue;
    }

    mergeAccumulatorIntoPrevious(merged[index - 1], current);
    merged.splice(index, 1);
  }

  return mergeAdjacentSameManeuver(merged);
}

export function buildDirectionsFromSegments(
  segments: RouteSegment[],
  options?: DirectionOptions,
): DirectionStep[] {
  if (segments.length === 0) {
    return [];
  }

  const continueAngleMaxDeg =
    options?.continueAngleMaxDeg ?? DEFAULT_CONTINUE_ANGLE_MAX_DEG;
  const tinyStepMaxMeters =
    options?.tinyStepMaxMeters ?? DEFAULT_TINY_STEP_MAX_METERS;

  const rawSteps: StepAccumulator[] = [createAccumulator(segments[0], "head")];

  // Initialise previousBearing from the first non-tiny segment so that a
  // noisy 2-3 m starting segment (graph jitter near the snap point) doesn't
  // corrupt the classification of the first real turn.
  let previousBearing = segments[0].bearing;
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i].distance > tinyStepMaxMeters) {
      previousBearing = segments[i].bearing;
      break;
    }
  }

  for (let i = 1; i < segments.length; i += 1) {
    const segment = segments[i];
    const maneuver = classifyTurn(
      previousBearing,
      segment.bearing,
      continueAngleMaxDeg,
    );

    if (maneuver === "continue") {
      extendAccumulator(rawSteps[rawSteps.length - 1], segment);
    } else {
      rawSteps.push(createAccumulator(segment, maneuver));
    }
    // Skip previousBearing update for tiny segments that represent graph
    // zigzags (near-reversals) rather than legitimate short turns.  A tiny
    // segment whose bearing deviates more than 100° from the current travel
    // direction is almost certainly noise in the path graph and would
    // corrupt the turn classification of the next real segment.
    const isTiny = segment.distance <= tinyStepMaxMeters;
    const bearingJump = Math.abs(signedBearingDelta(previousBearing, segment.bearing));
    if (!(isTiny && bearingJump > 100)) {
      previousBearing = segment.bearing;
    }
  }

  const compacted = mergeTinySteps(rawSteps, tinyStepMaxMeters);

  // The first step must always be "head" — the user has no prior travel
  // direction to "turn" from.  Tiny-step merging can absorb the original
  // head into a subsequent turn step; force it back.
  if (compacted.length > 0 && compacted[0].maneuver !== "head") {
    compacted[0].maneuver = "head";
  }

  return compacted.map((step) => {
    const bearing = movementBearing(step);
    const direction = bearingToCompassDirection(bearing);
    return {
      instruction: instructionFromStep(step.maneuver, direction, step.distance),
      distance: step.distance,
      bearing,
      direction,
      maneuver: step.maneuver,
      from: step.from,
      to: step.to,
    };
  });
}

export function buildDirectionsFromPath(
  pathResult: PathfinderResult,
  options?: DirectionOptions,
): DirectionStep[] {
  const steps = buildDirectionsFromSegments(pathResult.segments, options);
  const includeArrivalStep = options?.includeArrivalStep ?? true;

  if (!includeArrivalStep || pathResult.path.length === 0) {
    return steps;
  }

  if (steps.length === 0) {
    const position = pathResult.path[0];
    return [
      {
        instruction: "You are at your destination",
        distance: 0,
        bearing: 0,
        direction: "north",
        maneuver: "arrive",
        from: position,
        to: position,
      },
    ];
  }

  const destination = pathResult.path[pathResult.path.length - 1];
  const lastStep = steps[steps.length - 1];
  return [
    ...steps,
    {
      instruction: "You have arrived at your destination",
      distance: 0,
      bearing: lastStep.bearing,
      direction: lastStep.direction,
      maneuver: "arrive",
      from: destination,
      to: destination,
    },
  ];
}
