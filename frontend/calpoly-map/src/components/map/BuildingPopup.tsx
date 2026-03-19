import React from "react";
import { Modal, Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import type { Feature, Geometry, GeoJsonProperties } from "geojson";

interface BuildingPopupProps {
  visible: boolean;
  building: Feature<Geometry, GeoJsonProperties> | null;
  onClose: () => void;
  onNavigate: (building: Feature<Geometry, GeoJsonProperties>) => void;
}

export function BuildingPopup({ visible, building, onClose, onNavigate }: BuildingPopupProps) {
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
        <Pressable style={styles.popup} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{name}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            {amenity && (
              <View style={styles.row}>
                <Text style={styles.label}>Type:</Text>
                <Text style={styles.value}>{formatAmenityType(amenity)}</Text>
              </View>
            )}

            {buildingType && buildingType !== "yes" && (
              <View style={styles.row}>
                <Text style={styles.label}>Building:</Text>
                <Text style={styles.value}>{formatBuildingType(buildingType)}</Text>
              </View>
            )}

            {universityFunction && (
              <View style={styles.row}>
                <Text style={styles.label}>Function:</Text>
                <Text style={styles.value}>{formatUniversityFunction(universityFunction)}</Text>
              </View>
            )}

            {address && (
              <View style={styles.row}>
                <Text style={styles.label}>Address:</Text>
                <Text style={styles.value}>{address}</Text>
              </View>
            )}

            {props["building:levels"] && (
              <View style={styles.row}>
                <Text style={styles.label}>Levels:</Text>
                <Text style={styles.value}>{props["building:levels"]}</Text>
              </View>
            )}

            {props.wheelchair && (
              <View style={styles.row}>
                <Text style={styles.label}>Wheelchair Accessible:</Text>
                <Text style={styles.value}>{props.wheelchair === "yes" ? "Yes" : "No"}</Text>
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
    width: "75%",
    maxWidth: 320,
    maxHeight: "45%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  closeButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  content: {
    padding: 12,
  },
  actions: {
    padding: 12,
    paddingTop: 0,
  },
  row: {
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    color: "#111827",
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  primaryButtonPressed: {
    backgroundColor: "#2563EB",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
