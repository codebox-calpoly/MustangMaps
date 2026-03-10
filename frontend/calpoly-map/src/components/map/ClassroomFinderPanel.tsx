import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import type { SharedValue } from "react-native-reanimated";

interface ClassroomFinderPanelProps {
  visible: boolean;
  buildingName: string | null;
  classrooms: string[];
  onClose: () => void;
  onSelectClassroom: (room: string) => void;
  bottomSheetPosition: SharedValue<number>;
}

export function ClassroomFinderPanel({
  visible,
  buildingName,
  classrooms,
  onClose,
  onSelectClassroom,
  bottomSheetPosition,
}: ClassroomFinderPanelProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const [query, setQuery] = useState("");

  const snapPoints = useMemo(() => ["28%", "50%", "65%", "85%"], []);

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(2);
      });
    } else {
      setQuery("");
    }
  }, [visible]);

  const filteredClassrooms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return classrooms.slice(0, 50);
    }

    return classrooms.filter((room) =>
      String(room).toLowerCase().includes(normalizedQuery)
    );
  }, [classrooms, query]);

  if (!visible) {
    return null;
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={2}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      animatedPosition={bottomSheetPosition}
      handleStyle={styles.handleStyle}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      enableContentPanningGesture
      enableHandlePanningGesture
      enablePanDownToClose={false}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              Find Classroom{buildingName ? ` · ${buildingName}` : ""}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close classroom finder"
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <BottomSheetTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search classroom number"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <BottomSheetFlatList
          data={filteredClassrooms}
          keyExtractor={(item) => String(item)}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          style={styles.resultsList}
          contentContainerStyle={
            filteredClassrooms.length === 0
              ? styles.emptyListContent
              : styles.resultsListContent
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.resultItem,
                pressed && styles.resultItemPressed,
              ]}
              onPress={() => {
                setQuery(String(item));
                onSelectClassroom(String(item));
              }}
            >
              <Text style={styles.resultText}>{item}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No classrooms found.</Text>
          }
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  handleStyle: {
    position: "absolute",
    left: -20,
    right: -20,
    paddingBottom: 30,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginRight: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  closeButtonPressed: {
    backgroundColor: "#E5E7EB",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 8,
    textAlign: "center",
    backgroundColor: "#FFFFFF",
  },
  resultsList: {
    flex: 1,
  },
  resultsListContent: {
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
  emptyListContent: {
    paddingHorizontal: 10,
    paddingBottom: 24,
    flexGrow: 1,
  },
  resultItem: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  resultItemPressed: {
    backgroundColor: "#D2E6FF",
  },
  resultText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  emptyText: {
    paddingVertical: 18,
    color: "#6B7280",
    textAlign: "center",
  },
});