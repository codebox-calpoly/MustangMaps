import React from "react";
import { Modal, Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import type { Feature, Geometry, GeoJsonProperties } from "geojson";
import { useMapContext } from "../../context/MapContext";

interface BuildingPopupProps {
  visible: boolean;
  building: Feature<Geometry, GeoJsonProperties> | null;
  onClose: () => void;
  onNavigate: (building: Feature<Geometry, GeoJsonProperties>) => void;
}

export function BuildingPopup({ visible, building, onClose, onNavigate }: BuildingPopupProps) {
  const { mapStyle } = useMapContext();
  const isDark = mapStyle === "dark";

  if (!building || !visible) return null;

  const props = building.properties || {};
  const name = props.name || "Unknown Building";
  const amenity = props.amenity;
  const buildingType = props.building;
  const address = props["addr:street"];
  const universityFunction = props["university-function"];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.popup, isDark && styles.popupDark]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.header, isDark && styles.headerDark]}>
            <Text style={[styles.title, isDark && styles.titleDark]}>{name}</Text>
            <Pressable onPress={onClose} style={[styles.closeButton, isDark && styles.closeButtonDark]}>
              <Text style={[styles.closeButtonText, isDark && styles.closeButtonTextDark]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            {amenity && (
              <View style={styles.row}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Type:</Text>
                <Text style={[styles.value, isDark && styles.valueDark]}>{formatAmenityType(amenity)}</Text>
              </View>
            )}

            {buildingType && buildingType !== "yes" && (
              <View style={styles.row}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Building:</Text>
                <Text style={[styles.value, isDark && styles.valueDark]}>{formatBuildingType(buildingType)}</Text>
              </View>
            )}

            {universityFunction && (
              <View style={styles.row}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Function:</Text>
                <Text style={[styles.value, isDark && styles.valueDark]}>{formatUniversityFunction(universityFunction)}</Text>
              </View>
            )}

            {address && (
              <View style={styles.row}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Address:</Text>
                <Text style={[styles.value, isDark && styles.valueDark]}>{address}</Text>
              </View>
            )}

            {props["building:levels"] && (
              <View style={styles.row}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Levels:</Text>
                <Text style={[styles.value, isDark && styles.valueDark]}>{props["building:levels"]}</Text>
              </View>
            )}

            {props.wheelchair && (
              <View style={styles.row}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Wheelchair Accessible:</Text>
                <Text style={[styles.value, isDark && styles.valueDark]}>{props.wheelchair === "yes" ? "Yes" : "No"}</Text>
              </View>
            )}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Directions to ${name}`}
              onPress={() => {
                onNavigate(building);
                onClose();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Directions</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatAmenityType(amenity: string): string {
  return amenity
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatBuildingType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatUniversityFunction(func: string): string {
  return func.charAt(0).toUpperCase() + func.slice(1);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  popup: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    width: "85%",
    maxWidth: 400,
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  popupDark: {
    backgroundColor: "#1C1F26",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerDark: {
    borderBottomColor: "#3A4048",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  titleDark: {
    color: "#F1F3F5",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonDark: {
    backgroundColor: "#2A2F38",
  },
  closeButtonText: {
    fontSize: 18,
    color: "#6B7280",
    fontWeight: "600",
  },
  closeButtonTextDark: {
    color: "#E6E8EB",
  },
  content: {
    padding: 16,
  },
  actions: {
    padding: 16,
    paddingTop: 0,
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  labelDark: {
    color: "#CBD5E1",
  },
  value: {
    fontSize: 16,
    color: "#111827",
  },
  valueDark: {
    color: "#F1F3F5",
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonPressed: {
    backgroundColor: "#2563EB",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
