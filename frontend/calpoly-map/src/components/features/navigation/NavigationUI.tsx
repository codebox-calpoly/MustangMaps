import React, { useMemo, useState } from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMapContext } from "../../../context/MapContext";
import { DirectionList } from "./DirectionList";
import type { DirectionStep } from "../../../lib/routing/directions";

const WALKING_SPEED_METERS_PER_SECOND = 1.3;

type Coordinates = [number, number];

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

function formatDistanceMiles(distanceMeters: number) {
  const miles = distanceMeters * 0.000621371;
  return `${miles.toFixed(1)} mi`;
}

function formatRemainingMinutes(distanceMeters: number) {
  if (distanceMeters <= 0) {
    return "0 min";
  }
  const minutes = distanceMeters / WALKING_SPEED_METERS_PER_SECOND / 60;
  return `${Math.max(1, Math.round(minutes))} min`;
}

function formatArrivalTime(distanceMeters: number) {
  const seconds = Math.max(0, distanceMeters / WALKING_SPEED_METERS_PER_SECOND);
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
    case "turn-left":
      return "Turn Left";
    case "turn-right":
      return "Turn Right";
    case "arrive":
      return "Arrive at Destination";
    default:
      return "Continue Straight";
  }
}

export function NavigationUI() {
  const { exitNavigation, navSteps, activeStepIndex } = useMapContext();
  const insets = useSafeAreaInsets();
  const [topBarHeight, setTopBarHeight] = useState(0);

  const snapPoints = useMemo(() => ["16%", "52%"], []);

  const clampedStepIndex = useMemo(() => {
    if (navSteps.length === 0) {
      return 0;
    }
    return Math.min(activeStepIndex, navSteps.length - 1);
  }, [activeStepIndex, navSteps.length]);

  const currentStep = navSteps[clampedStepIndex];

  const remainingDistanceMeters = useMemo(() => {
    if (navSteps.length === 0) {
      return 0;
    }
    return navSteps
      .slice(clampedStepIndex)
      .reduce((total, step) => total + Math.max(0, step.distance), 0);
  }, [clampedStepIndex, navSteps]);

  const totalDistanceMeters = useMemo(() => {
    if (navSteps.length === 0) {
      return 0;
    }
    return navSteps.reduce(
      (total, step) => total + Math.max(0, step.distance),
      0,
    );
  }, [navSteps]);

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
              {currentStep?.maneuver === "turn-left"
                ? "L"
                : currentStep?.maneuver === "turn-right"
                  ? "R"
                  : currentStep?.maneuver === "arrive"
                    ? "A"
                    : "C"}
            </Text>
          </View>
          <View style={styles.topTextColumn}>
            <Text style={styles.topDistance}>
              {formatStepDistance(currentStep?.distance ?? 0)}
            </Text>
            <Text style={styles.topInstruction}>
              {getPrimaryInstruction(currentStep)}
            </Text>
            {navSteps.length > 0 && (
              <Text style={styles.topSubtext}>
                Step {clampedStepIndex + 1} of {navSteps.length}
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
              {formatRemainingMinutes(remainingDistanceMeters)}
            </Text>
            <Text style={styles.summaryMeta}>
              {formatDistanceMiles(totalDistanceMeters)} |{" "}
              {formatArrivalTime(remainingDistanceMeters)}
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
        {currentStep && (
          <Text numberOfLines={1} style={styles.currentInstructionText}>
            {currentStep.instruction}
          </Text>
        )}
      </View>
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
});
