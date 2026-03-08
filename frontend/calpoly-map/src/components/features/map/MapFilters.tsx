import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
}: Props) {
  const buildingSet = useMemo(() => new Set(buildingTypeIds), [buildingTypeIds]);
  const amenitySet = useMemo(() => new Set(amenityTypeIds), [amenityTypeIds]);
  const { mapStyle, setMapStyle } = useMapContext();
  const nextMapStyle = mapStyle === "light" ? "dark" : "light";

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.panel}>
        <View style={styles.rowSpaceBetween}>
          <Text style={styles.panelTitle}>Map Style</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${nextMapStyle} mode`}
            onPress={() => setMapStyle(nextMapStyle)}
            style={({ pressed }) => [
              styles.styleToggle,
              mapStyle === "dark" && styles.styleToggleActive,
              pressed && styles.styleTogglePressed,
            ]}
          >
            <Text
              style={[
                styles.styleToggleText,
                mapStyle === "dark" && styles.styleToggleTextActive,
              ]}
            >
              {mapStyle === "dark" ? "Dark" : "Light"}
            </Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          {(["buildings", "amenities"] as MapMode[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => onMapModeChange(mode)}
              style={[styles.chip, mapMode === mode && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  mapMode === mode && styles.chipTextActive,
                ]}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {mapMode === "buildings" && (
          <View style={styles.rowWrap}>
            {buildingOptions.map((option) => {
              const isAllOption = option.id === "all";
              const isActive = isAllOption
                ? buildingTypeIds.length === 0
                : buildingSet.has(option.id);

              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    if (isAllOption) {
                      onBuildingTypesChange([]);
                      return;
                    }

                    const next = new Set(buildingTypeIds);
                    if (next.has(option.id)) {
                      next.delete(option.id);
                    } else {
                      next.add(option.id);
                    }
                    onBuildingTypesChange(Array.from(next));
                  }}
                  style={[styles.chip, isActive && styles.chipActive]}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {mapMode === "amenities" && (
          <View style={styles.rowWrap}>
            {amenityOptions.map((option) => {
              const isActive = amenitySet.has(option.id);
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    const next = new Set(amenityTypeIds);
                    if (next.has(option.id)) {
                      next.delete(option.id);
                    } else {
                      next.add(option.id);
                    }
                    onAmenityTypesChange(Array.from(next));
                  }}
                  style={[styles.chip, isActive && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, isActive && styles.chipTextActive]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
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
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  rowSpaceBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
  },
  chipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  chipText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#F9FAFB",
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  styleToggle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: "#F9FAFB",
  },
  styleToggleActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  styleTogglePressed: {
    opacity: 0.85,
  },
  styleToggleText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  styleToggleTextActive: {
    color: "#F9FAFB",
  },
});
