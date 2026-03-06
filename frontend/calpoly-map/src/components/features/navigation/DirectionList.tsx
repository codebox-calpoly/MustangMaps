import React, { useMemo } from "react";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { StyleSheet, Text, View } from "react-native";
import type { DirectionStep } from "../../../lib/routing/directions";

interface DirectionListProps {
  steps: DirectionStep[];
  activeStepIndex: number;
  activeStepRemainingDistance?: number;
  bottomInset?: number;
}

interface StepListItem {
  id: string;
  index: number;
  step: DirectionStep;
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

function getManeuverSymbol(step: DirectionStep) {
  switch (step.maneuver) {
    case "turn-left":
      return "L";
    case "turn-right":
      return "R";
    case "arrive":
      return "A";
    case "head":
      return "C";
    default:
      return "C";
  }
}

export function DirectionList({
  steps,
  activeStepIndex,
  activeStepRemainingDistance,
  bottomInset = 0,
}: DirectionListProps) {
  const data = useMemo<StepListItem[]>(
    () => {
      const remainingSteps = steps.slice(Math.max(0, activeStepIndex));
      return remainingSteps.map((step, index) => ({
        id: `${activeStepIndex + index}-${step.from[0]}:${step.from[1]}-${step.to[0]}:${step.to[1]}`,
        index,
        step,
      }));
    },
    [activeStepIndex, steps],
  );

  if (data.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateTitle}>Route complete</Text>
        <Text style={styles.emptyStateText}>
          There are no remaining directions.
        </Text>
      </View>
    );
  }

  return (
    <BottomSheetFlatList
      data={data}
      keyExtractor={(item: StepListItem) => item.id}
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: Math.max(16, bottomInset) },
      ]}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }: { item: StepListItem }) => {
        const isCurrent = item.index === 0;

        return (
          <View
            style={[
              styles.stepRow,
              isCurrent && styles.stepRowActive,
            ]}
          >
            <View
              style={[
                styles.stepIndexBadge,
                isCurrent && styles.stepIndexBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.stepIndexText,
                  isCurrent && styles.stepIndexTextActive,
                ]}
              >
                {getManeuverSymbol(item.step)}
              </Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepInstruction}>
                {item.step.instruction}
              </Text>
              <Text style={styles.stepMeta}>
                {formatStepDistance(
                  isCurrent && activeStepRemainingDistance != null
                    ? activeStepRemainingDistance
                    : item.step.distance,
                )}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    padding: 14,
    gap: 4,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  emptyStateText: {
    fontSize: 12,
    color: "#6B7280",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: 10,
    gap: 10,
  },
  stepRowActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  stepIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  stepIndexBadgeActive: {
    backgroundColor: "#2563EB",
  },
  stepIndexText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },
  stepIndexTextActive: {
    color: "#FFFFFF",
  },
  stepBody: {
    flex: 1,
    gap: 2,
  },
  stepInstruction: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  stepMeta: {
    fontSize: 12,
    color: "#6B7280",
  },
});
