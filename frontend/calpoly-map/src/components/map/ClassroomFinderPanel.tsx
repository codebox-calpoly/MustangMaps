import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, Keyboard } from "react-native";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import type { SharedValue } from "react-native-reanimated";
import { useMapContext } from "../../context/MapContext";

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
  const { mapStyle } = useMapContext();
  const dark = mapStyle === "dark";

  const snapPoints = useMemo(() => ["28%", "50%", "65%", "85%"], []);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      sheetRef.current?.close();
    }
  }, [visible]);

  const filteredClassrooms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return classrooms;
    }

    return classrooms.filter((room) =>
      String(room).toLowerCase().includes(normalizedQuery)
    );
  }, [classrooms, query]);

  const handlePressClose = () => {
    onClose();
  };

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
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={dark ? { backgroundColor: "#1C1F26" } : undefined}
      handleIndicatorStyle={dark ? { backgroundColor: "#6B7280" } : undefined}
    >
      <View style={[styles.container, dark && styles.containerDark]}>
        <View style={[styles.header, dark && styles.headerDark]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, dark && styles.titleDark]}>
              Find Classroom{buildingName ? ` · ${buildingName}` : ""}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close classroom finder"
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              onPress={handlePressClose}
              style={({ pressed }) => [
                styles.closeButton,
                dark && styles.closeButtonDark,
                pressed && styles.closeButtonPressed,
              ]}
            >
              <Text style={[styles.closeButtonText, dark && styles.closeButtonTextDark]}>✕</Text>
            </Pressable>
          </View>

          <BottomSheetTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search classroom number"
            placeholderTextColor={dark ? "#6B7280" : "#9CA3AF"}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardAppearance={dark ? "dark" : "light"}
            style={[styles.input, dark && styles.inputDark]}
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
                dark && styles.resultItemDark,
                pressed && (dark ? styles.resultItemPressedDark : styles.resultItemPressed),
              ]}
              onPress={() => {
                Keyboard.dismiss()
                setQuery(String(item));
                onSelectClassroom(String(item));
                sheetRef.current?.snapToIndex(0);
              }}
            >
              <Text style={[styles.resultText, dark && styles.resultTextDark]}>{item}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, dark && styles.emptyTextDark]}>No classrooms found.</Text>
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
    paddingBottom: 10,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  containerDark: {
    backgroundColor: "#1C1F26",
  },
  header: {
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerDark: {
    backgroundColor: "#1C1F26",
    borderBottomColor: "#3A4048",
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
  titleDark: {
    color: "#F9FAFB",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    zIndex: 10,
    elevation: 10,
  },
  closeButtonDark: {
    backgroundColor: "#2A2F38",
    borderColor: "#3A4048",
  },
  closeButtonPressed: {
    backgroundColor: "#E5E7EB",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  closeButtonTextDark: {
    color: "#9CA3AF",
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 8,
    textAlign: "center",
    backgroundColor: "#FFFFFF",
    color: "#111827",
  },
  inputDark: {
    backgroundColor: "#2A2F38",
    borderColor: "#3A4048",
    color: "#F9FAFB",
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
  resultItemDark: {
    backgroundColor: "#1C1F26",
    borderBottomColor: "#3A4048",
  },
  resultItemPressed: {
    backgroundColor: "#D2E6FF",
  },
  resultItemPressedDark: {
    backgroundColor: "#2A2F38",
  },
  resultText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  resultTextDark: {
    color: "#F9FAFB",
  },
  emptyText: {
    paddingVertical: 18,
    color: "#6B7280",
    textAlign: "center",
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },
});
