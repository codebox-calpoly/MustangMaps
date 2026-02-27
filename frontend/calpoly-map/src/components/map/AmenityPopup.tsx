import React from "react";
import { Modal, Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import type { Feature, Geometry, GeoJsonProperties } from "geojson";

interface AmenityPopupProps {
  visible: boolean;
  amenity: Feature<Geometry, GeoJsonProperties> | null;
  levels: number[];
  onClose: () => void;
  onNavigate: (amenity: Feature<Geometry, GeoJsonProperties>) => void;
}

export function AmenityPopup({ visible, amenity, levels, onClose }: AmenityPopupProps) {
  if (!amenity || !visible) return null;

  const props = amenity.properties || {};
  const name = props.name || "Unknown Amenity";
  const category = props.category;
  const building = props.building;

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
            {category && (
              <View style={styles.row}>
                <Text style={styles.label}>Category:</Text>
                <Text style={styles.value}>{formatCategory(category)}</Text>
              </View>
            )}

            {building && (
              <View style={styles.row}>
                <Text style={styles.label}>Building:</Text>
                <Text style={styles.value}>{building}</Text>
              </View>
            )}

            {levels.length > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>
                  {levels.length === 1 ? "Level:" : "Available on Levels:"}
                </Text>
                <View style={styles.levelsContainer}>
                  {levels.map((level) => (
                    <View key={level} style={styles.levelBadge}>
                      <Text style={styles.levelBadgeText}>{level}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

          </ScrollView>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatCategory(category: string): string {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  levelsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  levelBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  levelBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
  },
});
