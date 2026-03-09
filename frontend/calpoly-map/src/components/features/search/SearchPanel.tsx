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
import type { Feature, Geometry, GeoJsonProperties } from "geojson";
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
  onNavigate: (feature: Feature<Geometry, GeoJsonProperties>) => void;
}

type SectionKind = "favorite" | "history" | "result";

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

export function SearchPanel({ cameraMove, cameraFitRoute, bottomSheetPosition, onNavigate }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const lastFittedRouteRef = useRef<string | null>(null);

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
    selectBuilding,
    routeStart,
    routeEnd,
    activePath,
    routeError,
    routingActive,
    clearSelection,
    routeAccessibleOnly,
    setRouteAccessibleOnly,
    setRouteRequested,
    clearRoute,
  } = useMapContext();

  const snapPoints = useMemo(
    () => routingActive ? ["28%", "50%", "65%", "85%"] : ["14%", "35%", "55%", "75%"],
    [routingActive],
  );

  const summaryVisible =
    routingActive &&
    Boolean(routeStart && routeEnd && activePath && !routeError);

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
    },
    [setSearchQuery],
  );

  const data = geoData.features;

  const filteredData = useMemo(() => {
    const filtered = data.filter((item) => {
      const name = item.properties?.name;
      if (!name) return false;
      const q = searchQuery.toLowerCase();
      if (name.toLowerCase().match(q)) return true;
      const ref = item.properties?.ref as string | undefined;
      if (ref && ref === searchQuery.trim()) return true;
      return false;
    });
    return filtered.sort((a, b) => {
      const nameA = a.properties?.name ?? "";
      const nameB = b.properties?.name ?? "";
      return nameA.localeCompare(nameB);
    });
  }, [data, searchQuery]);

  const buildPlaceId = useCallback((name: string, coord: number[]) => {
    const [lng, lat] = coord;
    return `${name}:${lng.toFixed(6)}:${lat.toFixed(6)}`;
  }, []);

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
      if (geometry.type === "Polygon") return geometry.coordinates[0] ?? null;
      if (geometry.type === "MultiPolygon") return geometry.coordinates[0]?.[0] ?? null;
      return null;
    },
    [],
  );

  const stripBuildingNumber = useCallback((name: string): string => {
    return name.replace(/\s*\(\d+\)\s*$/, "").trim();
  }, []);

  const extractBuildingRef = useCallback((name: string): string | undefined => {
    const match = name.match(/\((\d+)\)\s*$/);
    return match ? match[1] : undefined;
  }, []);

  const placeFromFeature = useCallback(
    (feature: any): SavedPlace | null => {
      const ring = getRingCoordinates(feature.geometry as Geometry);
      if (!ring || ring.length === 0) return null;
      const coord = middle(ring) as [number, number];
      const rawName = feature.properties?.name ?? "Unknown";
      const name = stripBuildingNumber(rawName);
      const ref = (feature.properties?.ref as string | undefined) ?? extractBuildingRef(rawName);
      return {
        id: buildPlaceId(name, coord),
        name,
        coordinate: coord,
        updatedAt: 0,
        ref,
      };
    },
    [buildPlaceId, extractBuildingRef, getRingCoordinates, middle, stripBuildingNumber],
  );

  const myLocationPlace = useMemo<SavedPlace | null>(() => {
    if (!isValidCoordinate(userLocation)) return null;
    return {
      id: "my-location",
      name: "My location",
      coordinate: userLocation,
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
      if (!isValidCoordinate(place.coordinate)) return;
      const isMyLocation = place.id === "my-location";

      setSearchQuery(place.name);
      setMainSearchInput(place.name);

      if (!isMyLocation) {
        const matchingFeature = data.find(
          (f) => f.properties?.name === place.name,
        );
        if (matchingFeature) {
          selectBuilding(matchingFeature as Feature<Geometry, GeoJsonProperties>);
        }
      }

      addToHistory(place);
      cameraMove(place.coordinate);
      setFocused(false);
      sheetRef.current?.snapToIndex(1);
    },
    [
      addToHistory,
      cameraMove,
      data,
      isValidCoordinate,
      selectBuilding,
      setSearchQuery,
    ],
  );

  const resultsAsPlaces = useMemo(() => {
    if (!myLocationPlace) return baseResultsAsPlaces;
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery.length === 0) return baseResultsAsPlaces;
    if ("my location".includes(normalizedQuery)) return [myLocationPlace, ...baseResultsAsPlaces];
    return baseResultsAsPlaces;
  }, [baseResultsAsPlaces, myLocationPlace, searchQuery]);

  const sections = useMemo(() => {
    const list: SearchSection[] = [];
    if (favorites.length > 0 && (focused || searchQuery.trim().length > 0)) {
      list.push({ title: "Favorites", data: favorites, kind: "favorite" as const });
    }
    if (history.length > 0 && (focused || searchQuery.trim().length > 0)) {
      list.push({ title: "History", data: history, kind: "history" as const });
    }
    if (focused || searchQuery.trim().length > 0) {
      list.push({ title: "Results", data: resultsAsPlaces, kind: "result" as const });
    }
    return list;
  }, [favorites, history, focused, resultsAsPlaces, searchQuery]);

  const dismissThreshold = Dimensions.get("window").height * 0.58;
  const dismissKeyboard = useCallback(() => { Keyboard.dismiss(); }, []);
  useAnimatedReaction(
    () => bottomSheetPosition.value,
    (current, previous) => {
      if (previous == null) return;
      if (previous <= dismissThreshold && current > dismissThreshold) {
        runOnJS(dismissKeyboard)();
      }
    },
    [dismissKeyboard, dismissThreshold],
  );

  const searchRows = useMemo(() => {
    const rows: SearchRow[] = [];
    sections.forEach((section) => {
      rows.push({ id: `header-${section.kind}`, type: "header", section });
      section.data.forEach((item) => {
        rows.push({ id: `${section.kind}-${item.id}`, type: "item", sectionKind: section.kind, item });
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
          <View style={styles.itemMeta}>
            <Text style={styles.buildingName}>{place.name}</Text>
            {place.ref && (
              <Text style={styles.buildingNumber}>Building {place.ref}</Text>
            )}
          </View>
          <View style={styles.itemActions}>
            <Pressable onPress={() => toggleFavorite(place)} style={styles.iconButton}>
              <Text style={[styles.heartIcon, isFavorite(place.id) && styles.heartIconActive]}>
                {isFavorite(place.id) ? "♥" : "♡"}
              </Text>
            </Pressable>
            {item.sectionKind === "history" && (
              <Pressable onPress={() => removeFromHistory(place.id)} style={styles.iconButton}>
                <Text style={styles.removeIcon}>✕</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      );
    },
    [clearHistory, handleSelectPlace, isFavorite, removeFromHistory, toggleFavorite],
  );

  const extractSearchRowKey = useCallback((item: SearchRow) => item.id, []);

  const formatTime = () => {
    if (!activePath) return "—";
    const minutes = activePath.distance / 1.3 / 60;
    return `${minutes.toFixed(0)} min`;
  };

  const formatDistance = () => {
    if (!activePath) return "—";
    return `${(activePath.distance * 0.000621371).toFixed(1)} mi`;
  };

  const formatETA = () => {
    if (!activePath) return "—";
    const arrival = new Date(Date.now() + (activePath.distance / 1.3) * 1000);
    return arrival.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " Arrival";
  };

  const selectedBuildingName = stripBuildingNumber(
    selectedBuilding?.properties?.name ?? "Unknown Building",
  );
  const selectedBuildingRef =
    (selectedBuilding?.properties?.ref as string | undefined) ??
    extractBuildingRef(selectedBuilding?.properties?.name ?? "");
  const selectedBuildingSubtitle = selectedBuildingRef
    ? `Building ${selectedBuildingRef}`
    : String(
        selectedBuilding?.properties?.["university-function"] ??
        selectedBuilding?.properties?.amenity ??
        selectedBuilding?.properties?.building ??
        "Campus building",
      );

  const renderMainSheetHeader = useCallback(() => {
    if (selectedBuilding && !routingActive) {
      return (
        <View style={styles.buildingInfoCard}>
          <View style={styles.buildingInfoHeader}>
            <View style={styles.buildingInfoText}>
              <Text style={styles.buildingInfoName}>{selectedBuildingName}</Text>
              <Text style={styles.buildingInfoSubtitle}>{selectedBuildingSubtitle}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close building info"
              onPress={clearSelection}
              style={styles.buildingInfoClose}
            >
              <Text style={styles.buildingInfoCloseText}>✕</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Directions to ${selectedBuildingName}`}
            onPress={() => {
              onNavigate(selectedBuilding);
              clearSelection();
            }}
            style={styles.buildingDirectionsButton}
          >
            <Text style={styles.buildingDirectionsButtonText}>Directions</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <Text style={styles.directionHeader}>
          {routingActive ? "Directions" : "Search"}
        </Text>

        {!routingActive && <View style={styles.inputSpacer} />}

        {routingActive ? (
          <View style={styles.routeActions}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: routeAccessibleOnly }}
              accessibilityLabel="Accessible Routes Only"
              onPress={() => {
                const next = !routeAccessibleOnly;
                setRouteAccessibleOnly(next);
                setRouteRequested(Boolean(routeStart && routeEnd));
              }}
              style={({ pressed }) => [
                styles.accessibleToggle,
                routeAccessibleOnly && styles.accessibleToggleActive,
                pressed && styles.accessibleTogglePressed,
              ]}
            >
              <View style={[styles.accessibleCheckbox, routeAccessibleOnly && styles.accessibleCheckboxActive]}>
                {routeAccessibleOnly && <Text style={styles.accessibleCheckmark}>✓</Text>}
              </View>
              <Text style={styles.accessibleToggleText}>Accessible Routes Only</Text>
              <Text style={styles.accessibleToggleIcon}>♿</Text>
            </Pressable>

            <Pressable
              onPress={() => { clearRoute(); setSearchQuery(""); }}
              style={styles.clearChip}
            >
              <Text style={styles.clearChipText}>Clear</Text>
            </Pressable>
          </View>
        ) : (
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
            returnKeyType="default"
          />
        )}

        {routeError && (
          <View style={styles.statusRow}>
            <Text style={styles.errorText}>{routeError}</Text>
          </View>
        )}

        {summaryVisible && (
          <View style={styles.routeSummaryContainer}>
            <View style={styles.routeSummaryLeft}>
              <Text style={styles.routeSummaryTime}>{formatTime()}</Text>
              <Text style={styles.routeSummaryMeta}>
                {formatDistance()} • {formatETA()}
              </Text>
            </View>
          </View>
        )}
      </>
    );
  }, [
    activePath,
    clearRoute,
    clearSelection,
    commitSearch,
    handleSearch,
    mainSearchInput,
    onNavigate,
    openSheet,
    routeEnd,
    routeError,
    routeStart,
    routeAccessibleOnly,
    routingActive,
    selectedBuilding,
    selectedBuildingName,
    selectedBuildingSubtitle,
    setRouteAccessibleOnly,
    setRouteRequested,
    setSearchQuery,
    summaryVisible,
  ]);

  // Reset search UI when routing is turned off
  useEffect(() => {
    if (!routingActive) {
      setFocused(false);
      setSearchQuery("");
      setMainSearchInput("");
      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(0);
      });
    }
  }, [routingActive, setSearchQuery]);

  // Expand sheet when a building is selected so the info card is visible
  useEffect(() => {
    if (selectedBuilding && !routingActive) {
      sheetRef.current?.snapToIndex(1);
    }
  }, [selectedBuilding, routingActive]);

  // Expand sheet when routing becomes active
  useEffect(() => {
    if (routingActive) {
      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(0);
      });
    }
  }, [routingActive]);

  // Expand sheet when route summary appears
  useEffect(() => {
    if (!summaryVisible) return;
    sheetRef.current?.snapToIndex(2);
  }, [summaryVisible]);

  // Fit camera to route endpoints when a valid route is ready
  useEffect(() => {
    if (!summaryVisible || !isValidCoordinate(routeStart) || !isValidCoordinate(routeEnd)) return;
    const routeKey = `${routeStart[0].toFixed(6)}:${routeStart[1].toFixed(6)}:${routeEnd[0].toFixed(6)}:${routeEnd[1].toFixed(6)}`;
    if (lastFittedRouteRef.current === routeKey) return;
    lastFittedRouteRef.current = routeKey;
    cameraFitRoute(routeStart, routeEnd);
  }, [cameraFitRoute, isValidCoordinate, routeEnd, routeStart, summaryVisible]);

  useEffect(() => {
    if (!routingActive) {
      lastFittedRouteRef.current = null;
    }
  }, [routingActive]);

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
        keyboardBlurBehavior="none"
      >
        <View style={styles.fixedHeader}>{renderMainSheetHeader()}</View>
        <BottomSheetFlatList
          data={!routingActive && !selectedBuilding ? searchRows : []}
          keyExtractor={extractSearchRowKey}
          renderItem={renderSearchRow}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          bounces={false}
          overScrollMode="never"
          removeClippedSubviews={false}
          style={styles.resultsList}
          contentContainerStyle={[styles.resultsListContent, searchRows.length === 0 && { paddingBottom: 0 }]}
        />
      </BottomSheet>
    </View>
  );
}

const screenWidth = Math.round(Dimensions.get("window").width);
const styles = StyleSheet.create({
  handleStyle: {
    position: "absolute",
    left: -20,
    paddingBottom: 30,
    paddingHorizontal: screenWidth / 2,
  },
  inputSpacer: {
    height: 20,
  },
  fixedHeader: {
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    zIndex: 1,
  },
  resultsList: {
    flex: 1,
  },
  resultsListContent: {
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    textAlign: "center",
  },
  routeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  accessibleToggle: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
  },
  accessibleToggleActive: {
    borderColor: "#15803D",
    backgroundColor: "#ECFDF3",
  },
  accessibleTogglePressed: {
    opacity: 0.85,
  },
  accessibleCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  accessibleCheckboxActive: {
    borderColor: "#15803D",
    backgroundColor: "#16A34A",
  },
  accessibleCheckmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
  accessibleToggleText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
  },
  accessibleToggleIcon: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },
  clearChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FEE2E2",
  },
  clearChipText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "600",
  },
  statusRow: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  errorText: {
    fontSize: 12,
    color: "#B91C1C",
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
  itemMeta: {
    flex: 1,
  },
  buildingName: {
    fontSize: 17,
    fontWeight: "600",
  },
  buildingNumber: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  itemActions: {
    flexDirection: "row",
    gap: 6,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heartIcon: {
    fontSize: 20,
    color: "#9CA3AF",
  },
  heartIconActive: {
    color: "#EF4444",
  },
  removeIcon: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9CA3AF",
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
  directionHeader: {
    fontSize: 25,
    fontWeight: "900",
    marginBottom: 6,
  },
  buildingInfoCard: {
    marginTop: 24,
    gap: 12,
  },
  buildingInfoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  buildingInfoText: {
    flex: 1,
    marginRight: 8,
  },
  buildingInfoName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  buildingInfoSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textTransform: "capitalize",
    marginTop: 2,
  },
  buildingInfoClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  buildingInfoCloseText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  buildingDirectionsButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  buildingDirectionsButtonPressed: {
    backgroundColor: "#15803D",
  },
  buildingDirectionsButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  routeSummaryContainer: {
    marginTop: 16,
    marginHorizontal: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  routeSummaryLeft: {
    flexDirection: "column",
    gap: 2,
  },
  routeSummaryTime: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  routeSummaryMeta: {
    fontSize: 13,
    color: "#6B7280",
  },
});
