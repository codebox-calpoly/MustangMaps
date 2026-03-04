import React from "react";
import { Modal, Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import type { Feature, Geometry, GeoJsonProperties } from "geojson";
import { useMapContext } from "../../context/MapContext";

interface AmenityPopupProps {
  visible: boolean;
  amenity: Feature<Geometry, GeoJsonProperties> | null;
  levels: number[];
  onClose: () => void;
  onNavigate: (amenity: Feature<Geometry, GeoJsonProperties>) => void;
}

export function AmenityPopup({ visible, amenity, levels, onClose }: AmenityPopupProps) {
  const { mapStyle } = useMapContext();
  const isDark = mapStyle === "dark";

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
        <Pressable style={[styles.popup, isDark && styles.popupDark]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.header, isDark && styles.headerDark]}>
            <Text style={[styles.title, isDark && styles.titleDark]}>{name}</Text>
            <Pressable onPress={onClose} style={[styles.closeButton, isDark && styles.closeButtonDark]}>
              <Text style={[styles.closeButtonText, isDark && styles.closeButtonTextDark]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            {category && (
              <View style={styles.row}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Category:</Text>
                <Text style={[styles.value, isDark && styles.valueDark]}>{formatCategory(category)}</Text>
              </View>
            )}

            {building && (
              <View style={styles.row}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Building:</Text>
                <Text style={[styles.value, isDark && styles.valueDark]}>{building}</Text>
              </View>
            )}

            {levels.length > 0 && (
              <View style={styles.row}>
                <Text style={[styles.label, isDark && styles.labelDark]}>
                  {levels.length === 1 ? "Level:" : "Available on Levels:"}
                </Text>
                <View style={styles.levelsContainer}>
                  {levels.map((level) => (
                    <View key={level} style={[styles.levelBadge, isDark && styles.levelBadgeDark]}>
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
  levelBadgeDark: {
    backgroundColor: "#1E3A8A",
    borderColor: "#1D4ED8",
  },
  levelBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
  },
});
