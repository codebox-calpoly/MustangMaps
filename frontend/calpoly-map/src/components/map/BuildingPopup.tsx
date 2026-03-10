import React from "react";
import { Modal, Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import type { Feature, Geometry, GeoJsonProperties } from "geojson";

interface BuildingPopupProps {
  visible: boolean;
  building: Feature<Geometry, GeoJsonProperties> | null;
  onClose: () => void;
  onNavigate: (building: Feature<Geometry, GeoJsonProperties>) => void;
  onOpenClassroomFinder: (building: Feature<Geometry, GeoJsonProperties>) => void;
}

export function BuildingPopup({
  visible,
  building,
  onClose,
  onNavigate,
  onOpenClassroomFinder,
}: BuildingPopupProps) {
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
                styles.actionButton,
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Directions</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Find classroom in ${name}`}
              onPress={() => {
                onOpenClassroomFinder(building);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Find Classroom</Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 18,
    color: "#6B7280",
    fontWeight: "600",
  },
  content: {
    padding: 16,
  },
  actions: {
    padding: 16,
    paddingTop: 0,
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
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
  value: {
    fontSize: 16,
    color: "#111827",
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
  },
  primaryButtonPressed: {
    backgroundColor: "#2563EB",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  secondaryButtonPressed: {
    backgroundColor: "#E5E7EB",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
});