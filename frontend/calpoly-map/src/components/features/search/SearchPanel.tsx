import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { Dimensions, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import type { Geometry } from "geojson";
import {
  useAnimatedReaction,
  type SharedValue,
} from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";

import { useMapContext } from "../../../context/MapContext";
import {
  useSavedPlaces,
  type SavedPlace,
} from "../../../context/SavedPlacesContext";

import geoData from "./test.json";

interface Props {
  cameraMove: (coordinates: number[]) => void;
  cameraFitRoute: (start: number[], end: number[]) => void;
  bottomSheetPosition: SharedValue<number>;
}

type SectionKind = "favorite" | "history" | "result";
const UNIVERSAL_BUILDING_IMAGE_URI =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Cal_Poly_Campus.jpg/640px-Cal_Poly_Campus.jpg";

interface SearchSection {
  title: string;
  data: SavedPlace[];
  kind: SectionKind;
}

type SearchRow =
  | {
      id: string;
      type: "header";
      section: SearchSection;
    }
  | {
      id: string;
      type: "item";
      sectionKind: SectionKind;
      item: SavedPlace;
    };

export function SearchPanel({ cameraMove, cameraFitRoute, bottomSheetPosition }: Props) {
  // Bottom sheet controls
  const sheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(() => ["27%", "35%", "55%", "75%"], []);

  const openSheet = useCallback(() => {
    sheetRef.current?.snapToIndex(3);
  }, []);

  const [focused, setFocused] = useState(false);
  const [mainSearchInput, setMainSearchInput] = useState("");

  const {
    searchQuery,
    setSearchQuery,
    userLocation,
    selectedBuilding,
  } = useMapContext();

  const {
    history,
    favorites,
    addToHistory,
    removeFromHistory,
    clearHistory,
    toggleFavorite,
    isFavorite,
  } = useSavedPlaces();

  const isValidCoordinate = useCallback(
    (coord?: number[] | null): coord is [number, number] => {
      return (
        Array.isArray(coord) &&
        coord.length === 2 &&
        coord.every((value) => Number.isFinite(value))
      );
    },
    [],
  );

  const handleSearch = useCallback(
    (input: string) => {
      setMainSearchInput(input);
      setSearchQuery(input);
      setFocused(true);
    },
    [setSearchQuery],
  );

  const commitSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);
      setFocused(Boolean(text));
    },
    [setSearchQuery],
  );

  const data = geoData.features;

  // data filters off a regex match with input in search bar
  const filteredData = useMemo(() => {
    const filteredData = data.filter((item) => {
      const name = item.properties?.name;
      if (!name) {
        return false;
      }
      const match = name.toLowerCase().match(searchQuery.toLowerCase());
      return match && match.length > 0;
    });

    // sort and return results
    return filteredData.sort((a, b) => {
      const nameA = a.properties?.name ?? "";
      const nameB = b.properties?.name ?? "";
      return nameA.localeCompare(nameB);
    });
  }, [data, searchQuery]);

  const buildPlaceId = useCallback((name: string, coord: number[]) => {
    const [lng, lat] = coord;
    return `${name}:${lng.toFixed(6)}:${lat.toFixed(6)}`;
  }, []);

  // averages the middle of a building based off all its constituent coordinates
  const middle = useCallback((coordinates: number[][]) => {
    let result: number[] = [0.0, 0.0];
    let count = 0;

    coordinates.forEach((position: number[]) => {
      result[0] += position[0];
      result[1] += position[1];
      count++;
    });

    result[0] /= count;
    result[1] /= count;
    return result;
  }, []);

  const getRingCoordinates = useCallback(
    (geometry: Geometry): number[][] | null => {
      if (geometry.type === "Polygon") {
        return geometry.coordinates[0] ?? null;
      }
      if (geometry.type === "MultiPolygon") {
        return geometry.coordinates[0]?.[0] ?? null;
      }
      return null;
    },
    [],
  );

  const placeFromFeature = useCallback(
    (feature: any): SavedPlace | null => {
      const ring = getRingCoordinates(feature.geometry as Geometry);
      if (!ring || ring.length === 0) {
        return null;
      }
      const coord = middle(ring) as [number, number];
      const name = feature.properties?.name ?? "Unknown";

      return {
        id: buildPlaceId(name, coord),
        name,
        coordinate: coord,
        // Search results are transient; keep a stable timestamp to avoid list resets.
        updatedAt: 0,
      };
    },
    [buildPlaceId, getRingCoordinates, middle],
  );

  // If user location is valid, create a "My location" place to show in results
  const myLocationPlace = useMemo<SavedPlace | null>(() => {
    if (!isValidCoordinate(userLocation)) {
      return null;
    }
    return {
      id: "my-location",
      name: "My location",
      coordinate: userLocation,
      // Keep stable across renders so the list does not reset during location updates.
      updatedAt: 0,
    };
  }, [isValidCoordinate, userLocation]);

  const baseResultsAsPlaces = useMemo(
    () =>
      filteredData
        .map(placeFromFeature)
        .filter((place): place is SavedPlace => Boolean(place)),
    [filteredData, placeFromFeature],
  );

  const handleSelectPlace = useCallback(
    (place: SavedPlace) => {
      if (!isValidCoordinate(place.coordinate)) {
        return;
      }

      setSearchQuery(place.name);
      setMainSearchInput(place.name);

      addToHistory(place);
      cameraMove(place.coordinate);

      // UX: hide results and collapse sheet a bit
      setFocused(false);
      sheetRef.current?.snapToIndex(0);
    },
    [
      addToHistory,
      cameraMove,
      isValidCoordinate,
      setSearchQuery,
    ],
  );

  const resultsAsPlaces = useMemo(() => {
    if (!myLocationPlace) {
      return baseResultsAsPlaces;
    }
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery.length === 0) {
      return baseResultsAsPlaces;
    }
    if ("my location".includes(normalizedQuery)) {
      return [myLocationPlace, ...baseResultsAsPlaces];
    }
    return baseResultsAsPlaces;
  }, [baseResultsAsPlaces, myLocationPlace, searchQuery]);

  const sections = useMemo(() => {
    const list: SearchSection[] = [];

    if (favorites.length > 0) {
      list.push({
        title: "Favorites",
        data: favorites,
        kind: "favorite" as const,
      });
    }
    if (history.length > 0) {
      list.push({ title: "History", data: history, kind: "history" as const });
    }
    if (focused || searchQuery.trim().length > 0) {
      list.push({
        title: "Results",
        data: resultsAsPlaces,
        kind: "result" as const,
      });
    }

    return list;
  }, [favorites, history, focused, resultsAsPlaces, searchQuery]);

  const dismissThreshold = Dimensions.get("window").height * 0.58;
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);
  useAnimatedReaction(
    () => bottomSheetPosition.value,
    (current, previous) => {
      if (previous == null) {
        return;
      }
      if (previous <= dismissThreshold && current > dismissThreshold) {
        runOnJS(dismissKeyboard)();
      }
    },
    [dismissKeyboard, dismissThreshold],
  );

  const searchRows = useMemo(() => {
    const rows: SearchRow[] = [];
    sections.forEach((section) => {
      rows.push({
        id: `header-${section.kind}`,
        type: "header",
        section,
      });
      section.data.forEach((item) => {
        rows.push({
          id: `${section.kind}-${item.id}`,
          type: "item",
          sectionKind: section.kind,
          item,
        });
      });
    });
    return rows;
  }, [sections]);

  const renderSearchRow = useCallback(
    ({ item }: { item: SearchRow }) => {
      if (item.type === "header") {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{item.section.title}</Text>
            {item.section.kind === "history" && (
              <Pressable onPress={clearHistory} style={styles.sectionAction}>
                <Text style={styles.sectionActionText}>Clear</Text>
              </Pressable>
            )}
          </View>
        );
      }

      const place = item.item;
      return (
        <Pressable
          onPress={() => handleSelectPlace(place)}
          style={({ pressed }) => [
            { backgroundColor: pressed ? "#D2E6FF" : "white" },
            styles.itemContainer,
          ]}
        >
          <Text style={styles.itemIcon}>
            {place.name.charAt(0).toUpperCase()}
          </Text>

          <View style={styles.itemMeta}>
            <Text style={styles.buildingName}>{place.name}</Text>
            <Text style={styles.subscript}>
              {place.coordinate[1].toFixed(5)}, {place.coordinate[0].toFixed(5)}
            </Text>
          </View>

          <View style={styles.itemActions}>
            <Pressable
              onPress={() => toggleFavorite(place)}
              style={styles.actionChip}
            >
              <Text style={styles.actionChipText}>
                {isFavorite(place.id) ? "Unfav" : "Fav"}
              </Text>
            </Pressable>

            {item.sectionKind === "history" && (
              <Pressable
                onPress={() => removeFromHistory(place.id)}
                style={[styles.actionChip, styles.removeChip]}
              >
                <Text style={styles.actionChipText}>Remove</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      );
    },
    [
      clearHistory,
      handleSelectPlace,
      isFavorite,
      removeFromHistory,
      toggleFavorite,
    ],
  );

  const extractSearchRowKey = useCallback((item: SearchRow) => item.id, []);

  const renderMainSheetHeader = useCallback(
    () => (
      <>
        <Text style={styles.directionHeader}>Search</Text>
        <BottomSheetTextInput
          style={styles.input}
          placeholder="Type Destination Here..."
          clearButtonMode="always"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={handleSearch}
          value={mainSearchInput}
          onFocus={() => {
            openSheet();
            setFocused(true);
            setSearchQuery(mainSearchInput);
          }}
          onSubmitEditing={() => commitSearch(mainSearchInput)}
          onBlur={() => commitSearch(mainSearchInput)}
          returnKeyType="search"
        />
      </>
    ),
    [commitSearch, handleSearch, mainSearchInput, openSheet, setSearchQuery],
  );

  useEffect(() => {
    if (!selectedBuilding) {
      return;
    }
    sheetRef.current?.snapToIndex(2);
  }, [selectedBuilding]);

  return (
    <View style={{ flex: 1 }}>
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        animatedPosition={bottomSheetPosition}
        enableContentPanningGesture={false}
        handleStyle={styles.handleStyle}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetFlatList
          data={searchRows}
          keyExtractor={extractSearchRowKey}
          renderItem={renderSearchRow}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          style={styles.resultsList}
          contentContainerStyle={styles.resultsListContent}
          ListHeaderComponent={
              <View style={styles.fixedHeader}>{renderMainSheetHeader()}</View>
            }
            stickyHeaderIndices={[0]}
        />
      </BottomSheet>
    </View>
  );
}

const screenWidth = Math.round(Dimensions.get("window").width);
const styles = StyleSheet.create({
  handleStyle: {
    position: "absolute",
    left: - 20,
    paddingBottom: 30,
    paddingHorizontal: screenWidth / 2,
  },
  fixedHeader: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 6,
    backgroundColor: "#FFFFFF",
    zIndex: 1,
  },
  resultsPanel: {
    marginTop: 6,
    flex: 1,
    minHeight: 0,
  },
  resultsList: {
    flex: 1,
  },
  resultsListContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 24,
  },
  floatingOpenButton: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    zIndex: 50,
  },
  floatingOpenButtonText: {
    color: "white",
    fontWeight: "700",
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
    marginTop: 10,
    paddingVertical: 6,
    paddingRight: 10,
    borderRadius: 8,
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  itemIcon: {
    fontSize: 34,
    width: 44,
    textAlign: "center",
  },
  itemMeta: {
    flex: 1,
  },
  buildingName: {
    fontSize: 17,
    marginLeft: 10,
    fontWeight: "600",
  },
  subscript: {
    fontSize: 14,
    marginLeft: 10,
    color: "grey",
  },
  itemActions: {
    flexDirection: "row",
    gap: 6,
  },
  actionChip: {
    borderRadius: 12,
    backgroundColor: "#111827",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  removeChip: {
    backgroundColor: "#B91C1C",
  },
  actionChipText: {
    color: "#F9FAFB",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    marginTop: 12,
    marginLeft: 10,
    marginRight: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  sectionAction: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  sectionActionText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "600",
  },
  sheetHeaderRow: {
    marginLeft: 10,
    marginRight: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  directionHeader: {
    fontSize: 25,
    fontWeight: "900",
  },
  buildingPanel: {
    marginTop: 8,
    marginHorizontal: 10,
    gap: 10,
  },
  buildingPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buildingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
    borderWidth: 1,
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  buildingHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buildingIconAction: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
  },
  buildingIconActionText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 14,
  },
  buildingPanelTitle: {
    fontSize: 22,
    color: "#111827",
    fontWeight: "800",
  },
  buildingPanelSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textTransform: "capitalize",
  },
  buildingPanelActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  buildingDirectionsButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  buildingDirectionsButtonPressed: {
    backgroundColor: "#15803D",
  },
  buildingDirectionsButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  buildingPanelImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#E5E7EB",
  },
});
