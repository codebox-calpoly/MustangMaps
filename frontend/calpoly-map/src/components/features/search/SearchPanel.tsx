import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import type { Geometry } from "geojson";
import type { SharedValue } from "react-native-reanimated";

import { useMapContext } from "../../../context/MapContext";
import {
  useSavedPlaces,
  type SavedPlace,
} from "../../../context/SavedPlacesContext";
import { useUserLocation } from "../../../context/UserLocationContext";

import geoData from "./test.json";

interface Props {
  cameraMove: (coordinates: number[]) => void;
  cameraFitRoute: (start: number[], end: number[]) => void;
  bottomSheetPosition: SharedValue<number>;
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

export function SearchPanel({ cameraMove, cameraFitRoute, bottomSheetPosition }: Props) {
  // Bottom sheet controls
  const sheetRef = useRef<BottomSheet>(null);
  const routingSearchSheetRef = useRef<BottomSheet>(null);
  const routeStartInputRef = useRef<TextInput>(null);
  const routeEndInputRef = useRef<TextInput>(null);
  const routingSearchInputRef = useRef<TextInput>(null);

  const snapPoints = useMemo(() => ["27%", "35%", "55%", "75%"], []);
  const routingSearchSnapPoints = useMemo(() => ["85%"], []);

  const openSheet = useCallback(() => {
    sheetRef.current?.snapToIndex(1);
  }, []);

  const [focused, setFocused] = useState(false);
  const [routingSearchSheetOpen, setRoutingSearchSheetOpen] = useState(false);
  const [hasAutoFilledStart, setHasAutoFilledStart] = useState(false);
  const [activeField, setActiveField] = useState<"start" | "end">("end");
  const [startValue, setStartValue] = useState("");
  const [endValue, setEndValue] = useState("");
  const lastFittedRouteRef = useRef<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    userLocation,
    routeStart,
    routeEnd,
    activePath,
    routeError,
    routingActive,
    setRouteStart,
    setRouteEnd,
    setRouteRequested,
    setRouteStartIsCurrentLocation,
    clearRoute,
    setUserLocation,
  } = useMapContext();
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

  const { latitude, longitude } = useUserLocation();

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    setUserLocation([longitude, latitude]);
  }, [latitude, longitude, setUserLocation]);

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
      setSearchQuery(input);
      if (input) {
        setFocused(true);
      } else {
        setFocused(false);
      }
    },
    [setSearchQuery],
  );

  // Opens the routing search based on which field is selected
  const openRoutingSearchSheet = useCallback(
    (field: "start" | "end") => {
      const value = field === "start" ? startValue : endValue;
      setActiveField(field);
      setSearchQuery(value);
      setFocused(true);
      setRoutingSearchSheetOpen(true);

      requestAnimationFrame(() => {
        routingSearchSheetRef.current?.snapToIndex(0);
        // Auto-focus routing searchbar when sheet opens
        setTimeout(() => {
          routingSearchInputRef.current?.focus();
        }, 60);
      });
    },
    [endValue, setSearchQuery, startValue],
  );

  const blurRoutingInputs = useCallback(() => {
    routeStartInputRef.current?.blur();
    routeEndInputRef.current?.blur();
  }, []);

  const closeRoutingSearchSheet = useCallback(() => {
    setRoutingSearchSheetOpen(false);
    setFocused(false);
    blurRoutingInputs();
    routingSearchSheetRef.current?.close();
  }, [blurRoutingInputs]);

  const handleRoutingSearchChange = useCallback(
    (text: string) => {
      if (activeField === "start") {
        setStartValue(text);
        setRouteStart(null);
        setRouteStartIsCurrentLocation(false);
      } else {
        setEndValue(text);
        setRouteEnd(null);
      }
      setSearchQuery(text);
      setFocused(Boolean(text));
      setRouteRequested(false);
    },
    [
      activeField,
      setRouteEnd,
      setRouteRequested,
      setRouteStart,
      setRouteStartIsCurrentLocation,
      setSearchQuery,
    ],
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
      const isMyLocation = place.id === "my-location";

      if (routingActive) {
        if (activeField === "start") {
          setRouteStart(place.coordinate);
          setStartValue(place.name);
          setRouteStartIsCurrentLocation(isMyLocation);
        } else {
          setRouteEnd(place.coordinate);
          setEndValue(place.name);
        }
        setRouteRequested(false);
      } else {
        setSearchQuery(place.name);
      }

      addToHistory(place);
      cameraMove(place.coordinate);

      // UX: hide results and collapse sheet a bit
      setFocused(false);

      if (routingActive) {
        closeRoutingSearchSheet();
      } else {
        sheetRef.current?.snapToIndex(0);
      }
    },
    [
      activeField,
      addToHistory,
      cameraMove,
      closeRoutingSearchSheet,
      isValidCoordinate,
      routingActive,
      setEndValue,
      setRouteEnd,
      setRouteRequested,
      setRouteStart,
      setRouteStartIsCurrentLocation,
      setSearchQuery,
      setStartValue,
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
    if (focused) {
      list.push({
        title: "Results",
        data: resultsAsPlaces,
        kind: "result" as const,
      });
    }

    return list;
  }, [favorites, history, focused, resultsAsPlaces]);

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

  // Route summary formatters time, distance, and ETA based on activePath and user location
  const formatTime = () => {
    if (!activePath) return "—";
    const distanceMeters = activePath.distance;
    const speedMetersPerSecond = 1.3; // walking
    const minutes = distanceMeters / speedMetersPerSecond / 60;
    return `${minutes.toFixed(0)} min`;
  };

  const formatDistance = () => {
    if (!activePath) return "—";
    const miles = activePath.distance * 0.000621371;
    return `${miles.toFixed(1)} mi`;
  };

  const formatETA = () => {
    if (!activePath) return "—";
    const speedMetersPerSecond = 1.3;
    const secondsToArrival = activePath.distance / speedMetersPerSecond;
    const arrival = new Date(Date.now() + secondsToArrival * 1000);

    return (
      arrival.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }) + " Arrival"
    );
  };

  const showMainResults = sections.length > 0 && !routingActive;
  const showRoutingResults = sections.length > 0;

  const renderMainSheetHeader = useCallback(
    () => (
      <>
        <Text style={styles.directionHeader}>
          {routingActive ? "Directions" : "Search"}
        </Text>

        {routingActive ? (
          <View style={styles.routeInputs}>
            <TextInput
              ref={routeStartInputRef}
              style={styles.input}
              placeholder="Starting point"
              value={startValue}
              clearButtonMode="always"
              onFocus={() => openRoutingSearchSheet("start")}
              onChangeText={(text) => {
                setStartValue(text);
                setActiveField("start");
                setRouteStart(null);
                setRouteRequested(false);
                setRouteStartIsCurrentLocation(false);
              }}
            />

            <TextInput
              ref={routeEndInputRef}
              style={styles.input}
              placeholder="Destination"
              clearButtonMode="always"
              autoCapitalize="none"
              autoCorrect={false}
              value={endValue}
              onFocus={() => openRoutingSearchSheet("end")}
              onChangeText={(text) => {
                setEndValue(text);
                setActiveField("end");
                setRouteEnd(null);
                setRouteRequested(false);
              }}
            />

            <View style={styles.routeActions}>
              <Pressable
                onPress={() => {
                  clearRoute();
                  setStartValue("");
                  setEndValue("");
                  setSearchQuery("");
                  setActiveField("end");
                  closeRoutingSearchSheet();
                }}
                style={styles.clearChip}
              >
                <Text style={styles.clearChipText}>Clear</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Type Destination Here..."
            clearButtonMode="always"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={handleSearch}
            value={searchQuery}
            onFocus={() => {
              openSheet();
              setFocused(Boolean(searchQuery));
            }}
          />
        )}

        <View style={styles.statusRow}>
          <Text style={styles.statusText}>
            Start: {routeStart ? "set" : "not set"}
          </Text>
          <Text style={styles.statusText}>
            End: {routeEnd ? "set" : "not set"}
          </Text>
          {activePath && (
            <Text style={styles.statusText}>
              Distance: {Math.round(activePath.distance)}m
            </Text>
          )}
          {routeError && <Text style={styles.errorText}>{routeError}</Text>}
        </View>

        {summaryVisible && (
          <View style={styles.routeSummaryContainer}>
            <View style={styles.routeSummaryLeft}>
              <Text style={styles.routeSummaryTime}>{formatTime()}</Text>
              <Text style={styles.routeSummaryMeta}>
                {formatDistance()} • {formatETA()}
              </Text>
            </View>

            <Pressable
              style={styles.goButton}
              onPress={() => {
                console.log("Starting navigation...");
                setRouteRequested(true);
              }}
            >
              <Text style={styles.goButtonText}>GO</Text>
            </Pressable>
          </View>
        )}
      </>
    ),
    [
      activePath,
      clearRoute,
      closeRoutingSearchSheet,
      endValue,
      formatDistance,
      formatETA,
      formatTime,
      handleSearch,
      openRoutingSearchSheet,
      openSheet,
      routeEnd,
      routeError,
      routeStart,
      routingActive,
      searchQuery,
      setRouteEnd,
      setRouteRequested,
      setRouteStart,
      setRouteStartIsCurrentLocation,
      setSearchQuery,
      startValue,
      summaryVisible,
    ],
  );

  const renderRoutingSearchHeader = useCallback(
    () => (
      <>
        <View style={styles.routingSearchHeader}>
          <Text style={styles.routingSearchPanelTitle}>
            Search for{" "}
            {activeField === "start" ? "starting point" : "destination"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close search panel"
            onPress={closeRoutingSearchSheet}
            style={styles.routingSearchCloseButton}
          >
            <Text style={styles.routingSearchCloseButtonText}>X</Text>
          </Pressable>
        </View>

        <TextInput
          ref={routingSearchInputRef}
          style={styles.input}
          placeholder={
            activeField === "start"
              ? "Search starting point"
              : "Search destination"
          }
          clearButtonMode="always"
          autoCapitalize="none"
          autoCorrect={false}
          value={activeField === "start" ? startValue : endValue}
          onChangeText={handleRoutingSearchChange}
          autoFocus={routingSearchSheetOpen}
          selectTextOnFocus={false}
        />
      </>
    ),
    [
      activeField,
      closeRoutingSearchSheet,
      endValue,
      handleRoutingSearchChange,
      routingSearchSheetOpen,
      startValue,
    ],
  );

  // Auto-fill start as "My location" when routing becomes active
  useEffect(() => {
    if (
      routingActive &&
      !hasAutoFilledStart &&
      userLocation &&
      !routeStart &&
      startValue.length === 0
    ) {
      setRouteStart(userLocation);
      setStartValue("My location");
      setRouteStartIsCurrentLocation(true);
      setHasAutoFilledStart(true);
    }
  }, [
    hasAutoFilledStart,
    routingActive,
    userLocation,
    routeStart,
    setHasAutoFilledStart,
    setRouteStart,
    startValue,
    setRouteStartIsCurrentLocation,
  ]);

  // Reset routing UI when routing is turned off
  useEffect(() => {
    if (!routingActive) {
      setStartValue("");
      setEndValue("");
      setActiveField("end");
      setFocused(false);
      setRoutingSearchSheetOpen(false);
      setHasAutoFilledStart(false);
      setSearchQuery("");
      setRouteRequested(false);
    }
  }, [routingActive, setSearchQuery, setRouteRequested]);

  // Trigger route calculation when both start and end are set and routing is active
  useEffect(() => {
    if (!routingActive) {
      return;
    }
    setRouteRequested(Boolean(routeStart && routeEnd));
  }, [routeEnd, routeStart, routingActive, setRouteRequested]);

  // Ensure route summary is visible by expanding the main sheet when it appears
  useEffect(() => {
    if (!summaryVisible || routingSearchSheetOpen) {
      return;
    }
    sheetRef.current?.snapToIndex(2);
  }, [summaryVisible, routingSearchSheetOpen]);

  // Fit the camera to both route endpoints when a valid route is ready.
  useEffect(() => {
    if (
      !summaryVisible ||
      !isValidCoordinate(routeStart) ||
      !isValidCoordinate(routeEnd)
    ) {
      return;
    }

    const routeKey = `${routeStart[0].toFixed(6)}:${routeStart[1].toFixed(6)}:${routeEnd[0].toFixed(6)}:${routeEnd[1].toFixed(6)}`;
    if (lastFittedRouteRef.current === routeKey) {
      return;
    }
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
        animatedPosition={bottomSheetPosition}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        {showMainResults ? (
          <BottomSheetFlatList
            data={searchRows}
            keyExtractor={extractSearchRowKey}
            renderItem={renderSearchRow}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            style={styles.resultsList}
            contentContainerStyle={styles.resultsListContent}
            ListHeaderComponent={renderMainSheetHeader()}
          />
        ) : (
          <BottomSheetView style={styles.sheetContent}>
            {renderMainSheetHeader()}
          </BottomSheetView>
        )}
      </BottomSheet>

      {/* ROUTING SEARCH SHEET (overlay) */}
      {routingActive && (
        <BottomSheet
          ref={routingSearchSheetRef}
          index={-1}
          snapPoints={routingSearchSnapPoints}
          enableDynamicSizing={false}
          enableContentPanningGesture
          enableHandlePanningGesture
          enablePanDownToClose
          enableOverDrag={false}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          onChange={(index) => {
            if (index < 0) {
              setRoutingSearchSheetOpen(false);
              setFocused(false);
              blurRoutingInputs();
            }
          }}
          onClose={() => {
            setRoutingSearchSheetOpen(false);
            setFocused(false);
            blurRoutingInputs();
          }}
        >
          {showRoutingResults ? (
            <BottomSheetFlatList
              data={searchRows}
              keyExtractor={extractSearchRowKey}
              renderItem={renderSearchRow}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={styles.resultsList}
              contentContainerStyle={styles.resultsListContent}
              ListHeaderComponent={renderRoutingSearchHeader()}
            />
          ) : (
            <BottomSheetView style={styles.routingSearchSheetContent}>
              {renderRoutingSearchHeader()}
            </BottomSheetView>
          )}
        </BottomSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 16,
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
  routingSearchSheetContent: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 8,
  },
  routingSearchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routingSearchPanelTitle: {
    marginLeft: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  routingSearchCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  routingSearchCloseButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
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
  routeInputs: {
    gap: 8,
  },
  routeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  statusText: {
    fontSize: 12,
    color: "#374151",
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
  directionHeader: {
    fontSize: 25,
    fontWeight: "900",
    top: -15,
    marginLeft: 10,
    marginRight: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  // Inline route summary card
  routeSummaryContainer: {
    marginTop: 16,
    marginHorizontal: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  goButton: {
    width: 64,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22C55E",
  },
  goButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },
});
