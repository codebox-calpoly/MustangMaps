import React, { useCallback, useMemo, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useMapContext } from "../../../context/MapContext";

export type MapMode = "buildings" | "amenities";

export type BuildingFilterOption = {
  id: string;
  label: string;
};

export type AmenityFilterOption = {
  id: string;
  label: string;
};

type Props = {
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  buildingTypeIds: string[];
  onBuildingTypesChange: (ids: string[]) => void;
  amenityTypeIds: string[];
  onAmenityTypesChange: (ids: string[]) => void;
  buildingOptions: BuildingFilterOption[];
  amenityOptions: AmenityFilterOption[];
  onLayoutHeight?: (height: number) => void;
};

export function MapFilters({
  mapMode,
  onMapModeChange,
  buildingTypeIds,
  onBuildingTypesChange,
  amenityTypeIds,
  onAmenityTypesChange,
  buildingOptions,
  amenityOptions,
  onLayoutHeight,
}: Props) {
  const buildingSet = useMemo(() => new Set(buildingTypeIds), [buildingTypeIds]);
  const amenitySet = useMemo(() => new Set(amenityTypeIds), [amenityTypeIds]);
  const { clearSelection, mapStyle, setMapStyle } = useMapContext();
  const dark = mapStyle === "dark";

  // Guard against rapid-fire tab switches that can crash the native map layers.
  const lastSwitchRef = useRef(0);
  const handleModeChange = useCallback(
    (mode: MapMode) => {
      if (mode === mapMode) return;
      const now = Date.now();
      if (now - lastSwitchRef.current < 300) return;
      lastSwitchRef.current = now;
      onMapModeChange(mode);
      clearSelection();
    },
    [clearSelection, mapMode, onMapModeChange],
  );

  const activeOptions = mapMode === "buildings" ? buildingOptions : amenityOptions;
  const activeSet = mapMode === "buildings" ? buildingSet : amenitySet;
  const activeTypeIds = mapMode === "buildings" ? buildingTypeIds : amenityTypeIds;
  const onActiveChange = mapMode === "buildings" ? onBuildingTypesChange : onAmenityTypesChange;

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayoutHeight?.(event.nativeEvent.layout.height);
    },
    [onLayoutHeight],
  );

  return (
    <View style={styles.container} pointerEvents="box-none" onLayout={handleLayout}>
      <View style={[styles.panel, dark && styles.panelDark]}>
        {/* Mode selector + theme toggle */}
        <View style={styles.topRow}>
          <View style={[styles.segmented, dark && styles.segmentedDark]}>
            {(["buildings", "amenities"] as MapMode[]).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => handleModeChange(mode)}
                style={[
                  styles.segment,
                  mapMode === mode && (dark ? styles.segmentActiveDark : styles.segmentActive),
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    dark && styles.segmentTextDark,
                    mapMode === mode && styles.segmentTextActive,
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${dark ? "light" : "dark"} mode`}
            onPress={() => setMapStyle(dark ? "light" : "dark")}
            style={({ pressed }) => [
              styles.themeButton,
              dark && styles.themeButtonDark,
              pressed && styles.themeButtonPressed,
            ]}
          >
            <Text style={[styles.themeIcon, dark && styles.themeIconDark]}>
              {dark ? "☀" : "☾"}
            </Text>
          </Pressable>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {activeOptions.map((option) => {
            const isAllOption = option.id === "all";
            const isActive = isAllOption ? activeTypeIds.length === 0 : activeSet.has(option.id);

            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  if (isAllOption) {
                    onActiveChange([]);
                    return;
                  }
                  const next = new Set(activeTypeIds);
                  if (next.has(option.id)) {
                    next.delete(option.id);
                  } else {
                    next.add(option.id);
                  }
                  onActiveChange(Array.from(next));
                }}
                style={[
                  styles.chip,
                  dark && styles.chipDark,
                  isActive && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    dark && styles.chipTextDark,
                    isActive && styles.chipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 2,
  },
  panel: {
    marginHorizontal: 12,
    marginTop: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  panelDark: {
    backgroundColor: "#1C1F26",
    borderColor: "#3A4048",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  segmented: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segmentedDark: {
    backgroundColor: "#2A2F38",
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentActiveDark: {
    backgroundColor: "#3A4048",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  segmentTextDark: {
    color: "#9CA3AF",
  },
  segmentTextActive: {
    color: "#111827",
    fontWeight: "700",
  },
  themeButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  themeButtonDark: {
    backgroundColor: "#2A2F38",
    borderColor: "#3A4048",
  },
  themeButtonPressed: {
    opacity: 0.75,
  },
  themeIcon: {
    fontSize: 16,
    color: "#374151",
  },
  themeIconDark: {
    color: "#D1D5DB",
  },
  chipsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
  },
  chipDark: {
    backgroundColor: "#2A2F38",
    borderColor: "#3A4048",
  },
  chipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  chipText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextDark: {
    color: "#D1D5DB",
  },
  chipTextActive: {
    color: "#F9FAFB",
  },
});
