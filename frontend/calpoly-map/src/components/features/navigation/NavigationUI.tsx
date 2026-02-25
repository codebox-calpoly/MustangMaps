import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMapContext } from "../../../context/MapContext";

export function NavigationUI() {
  const { exitNavigation, navSteps, activeStepIndex } = useMapContext();

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Navigation Mode</Text>
        {navSteps.length > 0 && (
          <Text style={styles.step}>
            Step {activeStepIndex + 1}/{navSteps.length}:{" "}
            {navSteps[activeStepIndex]?.instruction}
          </Text>
        )}
      </View>

      <View style={styles.bottomPanel}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit navigation"
          onPress={exitNavigation}
          style={({ pressed }) => [
            styles.exitButton,
            pressed && styles.exitButtonPressed,
          ]}
        >
          <Text style={styles.exitButtonText}>Exit Navigation</Text>
        </Pressable>
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
    justifyContent: "space-between",
    pointerEvents: "box-none",
  },
  topBar: {
    marginTop: 60,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  step: {
    fontSize: 14,
    color: "#374151",
    marginTop: 6,
  },
  bottomPanel: {
    marginBottom: 48,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    alignItems: "center",
  },
  exitButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#DC2626",
  },
  exitButtonPressed: {
    backgroundColor: "#B91C1C",
  },
  exitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
