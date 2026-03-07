import React, { useEffect, useMemo, useRef, useState } from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMapContext } from "../../../context/MapContext";
import { DirectionList } from "./DirectionList";
import type { DirectionStep } from "../../../lib/routing/directions";

const DEFAULT_WALKING_SPEED_MPS = 1.3;
const MIN_WALKING_SPEED_MPS = 0.3; // Below this treat user as stopped
const SPEED_WINDOW_MS = 15_000; // Rolling window for speed calculation
const MIN_DISTANCE_FOR_SPEED_M = 5; // Ignore GPS jitter below this
const SPEED_SMOOTHING = 0.25; // EMA factor: 0 = ignore new, 1 = no smoothing
// When the remaining distance on a straight step ("head"/"continue") drops
// below this threshold, promote the upcoming turn to the primary display —
// similar to Google Maps switching from "Head north" to "Turn left" as you
// approach the intersection.
const TURN_PROMOTE_METERS = 40;

type Coordinates = [number, number];

interface LocationSample {
  coords: Coordinates;
  timestamp: number;
}

function distanceBetweenCoordinatesMeters(from: Coordinates, to: Coordinates) {
  const toRadians = Math.PI / 180;
  const lat1 = from[1] * toRadians;
  const lat2 = to[1] * toRadians;
  const latDelta = (to[1] - from[1]) * toRadians;
  const lonDelta = (to[0] - from[0]) * toRadians;

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(lonDelta / 2) *
      Math.sin(lonDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6_371_000 * c;
}

function formatStepDistance(distanceMeters: number) {
  if (distanceMeters <= 0) {
    return "0 m";
  }
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }
  return `${Math.max(1, Math.round(distanceMeters))} m`;
}

/**
 * Project a point onto a segment and return the fractional position (0–1)
 * and the flat-Earth distance² from the point to its projection.
 */
function projectOntoSegment(
  point: Coordinates,
  segA: Coordinates,
  segB: Coordinates,
): { t: number; distSq: number } {
  const toRad = Math.PI / 180;
  const cosLat = Math.cos(((segA[1] + segB[1]) / 2) * toRad);
  const px = (point[0] - segA[0]) * cosLat * 111_320;
  const py = (point[1] - segA[1]) * 111_320;
  const bx = (segB[0] - segA[0]) * cosLat * 111_320;
  const by = (segB[1] - segA[1]) * 111_320;
  const lenSq = bx * bx + by * by;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / lenSq)) : 0;
  const dx = px - t * bx;
  const dy = py - t * by;
  return { t, distSq: dx * dx + dy * dy };
}

/**
 * Compute remaining distance along a path from the user's current position
 * to a target coordinate.  Projects onto path segments for accuracy even
 * when path points are far apart (after simplification).
 * Returns null if the target isn't found so the caller can fall back.
 */
function remainingDistanceAlongPath(
  userLoc: Coordinates,
  target: Coordinates,
  path: [number, number][],
): number | null {
  // Locate target in the path (search from end since targets are usually ahead)
  let targetIdx = -1;
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i][0] === target[0] && path[i][1] === target[1]) {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx < 0) return null;

  // Find the path segment closest to the user (only up to targetIdx)
  let bestSegIdx = 0;
  let bestDistSq = Number.POSITIVE_INFINITY;
  let bestT = 0;
  const segLimit = Math.min(targetIdx, path.length - 1);
  for (let i = 0; i < segLimit; i++) {
    const { t, distSq } = projectOntoSegment(
      userLoc,
      path[i] as Coordinates,
      path[i + 1] as Coordinates,
    );
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestSegIdx = i;
      bestT = t;
    }
  }

  // Distance from projection point to the end of the best segment
  const segLength = distanceBetweenCoordinatesMeters(
    path[bestSegIdx] as Coordinates,
    path[bestSegIdx + 1] as Coordinates,
  );
  let remaining = segLength * (1 - bestT);

  // Add full segment distances from (bestSegIdx+1) to targetIdx
  for (let i = bestSegIdx + 1; i < targetIdx; i++) {
    remaining += distanceBetweenCoordinatesMeters(
      path[i] as Coordinates,
      path[i + 1] as Coordinates,
    );
  }
  return remaining;
}

function formatDistanceMiles(distanceMeters: number) {
  const miles = distanceMeters * 0.000621371;
  return `${miles.toFixed(1)} mi`;
}

function formatRemainingMinutes(distanceMeters: number, speed: number) {
  if (distanceMeters <= 0) {
    return "0 min";
  }
  const minutes = distanceMeters / speed / 60;
  return `${Math.max(1, Math.round(minutes))} min`;
}

function formatArrivalTime(distanceMeters: number, speed: number) {
  const seconds = Math.max(0, distanceMeters / speed);
  const arrivalDate = new Date(Date.now() + seconds * 1000);
  return `${arrivalDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })} Arrival`;
}

function getPrimaryInstruction(step?: DirectionStep) {
  if (!step) {
    return "Continue";
  }
  switch (step.maneuver) {
    case "head":
      return "Head Straight";
    case "continue":
      return "Continue Straight";
    case "turn-left":
      return "Turn Left";
    case "turn-right":
      return "Turn Right";
    case "arrive":
      return "Arrive at Destination";
  }
}

export function NavigationUI() {
  const { exitNavigation, navSteps, activeStepIndex, userLocation, isRerouting, activePath } = useMapContext();
  const insets = useSafeAreaInsets();
  const [topBarHeight, setTopBarHeight] = useState(0);

  // Force a re-render every 30s so the arrival time stays current even when
  // the user is standing still (Date.now() advances but nothing else changes).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Track GPS samples to compute the user's actual walking speed
  const locationSamplesRef = useRef<LocationSample[]>([]);
  const smoothedSpeedRef = useRef(DEFAULT_WALKING_SPEED_MPS);

  // Reset speed data after a reroute so stale samples from the old route
  // don't corrupt the ETA on the new one.
  const navStepsIdRef = useRef(navSteps);
  useEffect(() => {
    if (navSteps !== navStepsIdRef.current) {
      navStepsIdRef.current = navSteps;
      locationSamplesRef.current = [];
      smoothedSpeedRef.current = DEFAULT_WALKING_SPEED_MPS;
    }
  }, [navSteps]);

  useEffect(() => {
    if (!userLocation) return;
    locationSamplesRef.current.push({ coords: userLocation, timestamp: Date.now() });
  }, [userLocation]);

  const effectiveSpeed = useMemo(() => {
    const now = Date.now();
    const cutoff = now - SPEED_WINDOW_MS;
    const samples = locationSamplesRef.current;

    // Prune stale samples
    while (samples.length > 0 && samples[0].timestamp < cutoff) {
      samples.shift();
    }

    let rawSpeed = DEFAULT_WALKING_SPEED_MPS;

    if (samples.length >= 2) {
      const oldest = samples[0];
      const newest = samples[samples.length - 1];
      const elapsedSeconds = (newest.timestamp - oldest.timestamp) / 1000;

      if (elapsedSeconds >= 3) {
        let totalDistance = 0;
        for (let i = 1; i < samples.length; i++) {
          totalDistance += distanceBetweenCoordinatesMeters(
            samples[i - 1].coords,
            samples[i].coords,
          );
        }

        if (totalDistance >= MIN_DISTANCE_FOR_SPEED_M) {
          const measured = totalDistance / elapsedSeconds;
          if (measured >= MIN_WALKING_SPEED_MPS) {
            rawSpeed = measured;
          }
        }
      }
    }

    // Exponential moving average so the ETA doesn't jump wildly between
    // GPS updates.  SPEED_SMOOTHING controls how fast we adapt (lower =
    // smoother).
    smoothedSpeedRef.current =
      SPEED_SMOOTHING * rawSpeed + (1 - SPEED_SMOOTHING) * smoothedSpeedRef.current;

    return smoothedSpeedRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, tick]);

  const snapPoints = useMemo(() => ["16%", "52%"], []);

  const clampedStepIndex = useMemo(() => {
    if (navSteps.length === 0) {
      return 0;
    }
    return Math.min(activeStepIndex, navSteps.length - 1);
  }, [activeStepIndex, navSteps.length]);

  const currentStep = navSteps[clampedStepIndex];

  // Preview the NEXT maneuver — what the user needs to do next.
  // While walking straight, the top bar shows "Turn Right" with distance
  // TO the turn, not "Head straight" with distance of the current leg.
  const previewStep = useMemo(() => {
    if (navSteps.length === 0 || !currentStep) return undefined;
    if (currentStep.maneuver === "arrive") return currentStep;
    const nextIdx = clampedStepIndex + 1;
    if (nextIdx < navSteps.length) {
      return navSteps[nextIdx];
    }
    return currentStep;
  }, [clampedStepIndex, currentStep, navSteps]);

  const currentStepRemainingDistance = useMemo(() => {
    if (!currentStep) return 0;
    if (!userLocation) return Math.max(0, currentStep.distance);

    const pathCoords = activePath?.path;
    if (pathCoords && pathCoords.length >= 2) {
      const along = remainingDistanceAlongPath(userLocation, currentStep.to, pathCoords);
      if (along != null) {
        return Math.min(Math.max(0, currentStep.distance), along);
      }
    }

    // Fallback: straight-line distance
    return Math.min(
      Math.max(0, currentStep.distance),
      distanceBetweenCoordinatesMeters(userLocation, currentStep.to),
    );
  }, [activePath, currentStep, userLocation]);

  // Google Maps-style promotion: when the user is close to a turn on a
  // straight step, show the turn as the primary instruction instead of
  // "Head Straight".  This avoids a useless "Head Straight — 8 m" when the
  // turn is right in front of them.
  const isStraightStep =
    currentStep?.maneuver === "head" || currentStep?.maneuver === "continue";
  const shouldPromotePreview =
    isStraightStep &&
    previewStep != null &&
    currentStep !== previewStep &&
    currentStepRemainingDistance <= TURN_PROMOTE_METERS;

  // Once the user has walked ≥10 m past a turn, they've already turned —
  // show "Continue Straight" instead of repeating "Turn Right" for the
  // rest of the leg.
  const isTurnStep =
    currentStep?.maneuver === "turn-left" || currentStep?.maneuver === "turn-right";
  const TURN_COMPLETED_METERS = 10;
  const turnAlreadyCompleted =
    isTurnStep &&
    currentStep != null &&
    currentStep.distance - currentStepRemainingDistance >= TURN_COMPLETED_METERS;

  // The step shown as the big instruction in the top bar.
  const displayStep = shouldPromotePreview
    ? previewStep
    : turnAlreadyCompleted
      ? { ...currentStep!, maneuver: "continue" as const }
      : currentStep;
  // The secondary hint shown as subtext.
  const displaySubStep = shouldPromotePreview ? undefined : previewStep;
  // Distance shown: always the remaining distance to the current step's end
  // (i.e. how far until the turn), regardless of promotion.
  const displayDistance = currentStepRemainingDistance;

  const remainingDistanceMeters = useMemo(() => {
    if (navSteps.length === 0) {
      return 0;
    }
    // Sum distances of all future steps (after current)
    const futureStepsDistance = navSteps
      .slice(clampedStepIndex + 1)
      .reduce((total, step) => total + Math.max(0, step.distance), 0);

    // For the current step, use path-based remaining distance
    return futureStepsDistance + currentStepRemainingDistance;
  }, [clampedStepIndex, currentStepRemainingDistance, navSteps]);

  return (
    <View style={styles.container}>
      <View
        style={[styles.topBar, { paddingTop: insets.top + 2 }]}
        onLayout={(event) => {
          const nextHeight = event.nativeEvent.layout.height;
          setTopBarHeight((currentHeight) =>
            Math.abs(currentHeight - nextHeight) < 1 ? currentHeight : nextHeight,
          );
        }}
      >
        <View style={styles.topBarContent}>
          <View style={styles.turnBadge}>
            <Text style={styles.turnBadgeText}>
              {displayStep?.maneuver === "turn-left"
                ? "L"
                : displayStep?.maneuver === "turn-right"
                  ? "R"
                  : displayStep?.maneuver === "arrive"
                    ? "A"
                    : "C"}
            </Text>
          </View>
          <View style={styles.topTextColumn}>
            <Text style={styles.topDistance}>
              {formatStepDistance(displayDistance)}
            </Text>
            <Text style={styles.topInstruction}>
              {getPrimaryInstruction(displayStep)}
            </Text>
            {displaySubStep && displaySubStep !== currentStep && (
              <Text style={styles.topSubtext}>
                Then: {getPrimaryInstruction(displaySubStep)}
              </Text>
            )}
          </View>
        </View>
      </View>

      <BottomSheet
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <View style={styles.summaryPanel}>
          <View style={styles.summaryMain}>
            <Text style={styles.summaryMinutes}>
              {formatRemainingMinutes(remainingDistanceMeters, effectiveSpeed)}
            </Text>
            <Text style={styles.summaryMeta}>
              {formatDistanceMiles(remainingDistanceMeters)} |{" "}
              {formatArrivalTime(remainingDistanceMeters, effectiveSpeed)}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit navigation"
            onPress={exitNavigation}
            style={({ pressed }) => [
              styles.exitButton,
              pressed && styles.exitButtonPressed,
            ]}
          >
            <Text style={styles.exitButtonText}>Exit</Text>
          </Pressable>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>All Directions</Text>
        </View>

        <View style={styles.listContainer}>
          <DirectionList
            steps={navSteps}
            activeStepIndex={clampedStepIndex}
            activeStepRemainingDistance={currentStepRemainingDistance}
            bottomInset={insets.bottom}
          />
        </View>
      </BottomSheet>

      <View
        style={[
          styles.currentInstructionPill,
          { top: topBarHeight, opacity: topBarHeight > 0 ? 1 : 0 },
        ]}
        pointerEvents="none"
      >
        {displayStep && (
          <Text numberOfLines={1} style={styles.currentInstructionText}>
            {getPrimaryInstruction(displayStep)} — {formatStepDistance(displayDistance)}
          </Text>
        )}
      </View>

      {isRerouting && (
        <View style={styles.reroutingBanner} pointerEvents="none">
          <Text style={styles.reroutingText}>Rerouting...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "box-none",
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    minHeight: 124,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  turnBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  turnBadgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  topTextColumn: {
    flex: 1,
    alignItems: "center",
    marginRight: 36,
    gap: 1,
  },
  topDistance: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  topInstruction: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  topSubtext: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  currentInstructionPill: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 12,
    backgroundColor: "rgba(17, 24, 39, 0.92)",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  currentInstructionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  handleIndicator: {
    backgroundColor: "#D1D5DB",
    width: 44,
  },
  summaryPanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 14,
  },
  summaryMain: {
    flex: 1,
    gap: 2,
  },
  summaryMinutes: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    color: "#111827",
  },
  summaryMeta: {
    fontSize: 14,
    color: "#6B7280",
  },
  listHeader: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
  },
  listHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    letterSpacing: 0.4,
  },
  listContainer: {
    flex: 1,
    paddingTop: 10,
  },
  exitButton: {
    minWidth: 74,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#E05252",
  },
  exitButtonPressed: {
    backgroundColor: "#C24141",
  },
  exitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  reroutingBanner: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    backgroundColor: "rgba(17, 24, 39, 0.88)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  reroutingText: {
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: "700",
  },
});
