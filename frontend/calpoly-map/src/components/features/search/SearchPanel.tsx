import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { Dimensions, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
import { useUserLocation } from "../../../context/UserLocationContext";

import geoData from "./test.json";

interface Props {
  cameraMove: (coordinates: number[]) => void;
  cameraFitRoute: (start: number[], end: number[]) => void;
  bottomSheetPosition: SharedValue<number>;
  onNavigate: (feature: Feature<Geometry, GeoJsonProperties>) => void;
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

export function SearchPanel({ cameraMove, cameraFitRoute, bottomSheetPosition, onNavigate }: Props) {
  // Bottom sheet controls
  const sheetRef = useRef<BottomSheet>(null);
  const routingSearchSheetRef = useRef<BottomSheet>(null);
  const routeStartInputRef = useRef<TextInput>(null);
  const routeEndInputRef = useRef<TextInput>(null);

  const snapPoints = useMemo(() => ["14%", "35%", "55%", "75%"], []);
  const routingSearchSnapPoints = useMemo(() => ["85%"], []);

  const openSheet = useCallback(() => {
    sheetRef.current?.snapToIndex(3);
  }, []);

  const [focused, setFocused] = useState(false);
  const [routingSearchSheetOpen, setRoutingSearchSheetOpen] = useState(false);
  const [hasAutoFilledStart, setHasAutoFilledStart] = useState(false);
  const [activeField, setActiveField] = useState<"start" | "end">("end");
  const [startValue, setStartValue] = useState("");
  const [endValue, setEndValue] = useState("");
  const [mainSearchInput, setMainSearchInput] = useState("");
  const lastFittedRouteRef = useRef<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    userLocation,
    selectedBuilding,
    selectBuilding,
    routeDestination,
    routeStart,
    routeEnd,
    activePath,
    routeError,
    routingActive,
    clearSelection,
    setMapMode,
    setRouteStart,
    setRouteEnd,
    setRouteDestination,
    setRoutingActive,
    setRouteRequested,
    routeStartIsCurrentLocation,
    setRouteStartIsCurrentLocation,
    clearRoute,
    setUserLocation,
    startNavigation,
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
        setMainSearchInput(place.name);

        // Find the matching GeoJSON feature and select it to show a marker
        if (!isMyLocation) {
          const matchingFeature = data.find(
            (f) => f.properties?.name === place.name,
          );
          if (matchingFeature) {
            selectBuilding(
              matchingFeature as Feature<Geometry, GeoJsonProperties>,
            );
          }
        }
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
      data,
      isValidCoordinate,
      routingActive,
      selectBuilding,
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

  const selectedBuildingName = selectedBuilding?.properties?.name ?? "Unknown Building";
  const selectedBuildingSubtitle =
    String(
      selectedBuilding?.properties?.["university-function"] ??
      selectedBuilding?.properties?.amenity ??
      selectedBuilding?.properties?.building ??
      "Campus building",
    );

  const renderMainSheetHeader = useCallback(
    () => {
      // When a building is selected and we're not routing, show building info
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
              style={({ pressed }) => [
                styles.buildingDirectionsButton,
                pressed && styles.buildingDirectionsButtonPressed,
              ]}
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
            <View style={styles.routeInputs}>
              <View style={styles.routeInputRow}>
                <View style={styles.routeInputFields}>
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
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Swap start and destination"
                  onPress={() => {
                    const prevStart = startValue;
                    const prevEnd = endValue;
                    const prevRouteStart = routeStart;
                    const prevRouteEnd = routeEnd;

                    setStartValue(prevEnd);
                    setEndValue(prevStart);
                    setRouteStart(prevRouteEnd);
                    setRouteEnd(prevRouteStart);
                    setRouteStartIsCurrentLocation(false);
                    setRouteRequested(Boolean(prevRouteEnd && prevRouteStart));
                  }}
                  style={styles.swapButton}
                >
                  <Text style={styles.swapButtonText}>↕</Text>
                </Pressable>
              </View>

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

              <Pressable
                style={styles.goButton}
                onPress={() => {
                  startNavigation();
                }}
              >
                <Text style={styles.goButtonText}>GO</Text>
              </Pressable>
            </View>
          )}
        </>
      );
    },
    [
      activePath,
      clearRoute,
      clearSelection,
      closeRoutingSearchSheet,
      endValue,
      formatDistance,
      formatETA,
      formatTime,
      commitSearch,
      handleSearch,
      mainSearchInput,
      onNavigate,
      openRoutingSearchSheet,
      openSheet,
      routeEnd,
      routeError,
      routeStart,
      routingActive,
      selectedBuilding,
      selectedBuildingName,
      selectedBuildingSubtitle,
      setRouteEnd,
      setRouteRequested,
      setRouteStart,
      setRouteStartIsCurrentLocation,
      setSearchQuery,
      startNavigation,
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

        <BottomSheetTextInput
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
    if (!routingActive || hasAutoFilledStart || !userLocation) return;

    if (!routeStart && startValue.length === 0) {
      // No start set yet — fill in user location
      setRouteStart(userLocation);
      setStartValue("My location");
      setRouteStartIsCurrentLocation(true);
      setHasAutoFilledStart(true);
    } else if (routeStartIsCurrentLocation && startValue.length === 0) {
      // Start coordinate was already set (e.g. by handleNavigate) but display text is empty
      setStartValue("My location");
      setHasAutoFilledStart(true);
    }
  }, [
    hasAutoFilledStart,
    routingActive,
    userLocation,
    routeStart,
    routeStartIsCurrentLocation,
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
      setMainSearchInput("");
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


  useEffect(() => {
    if (!routingActive || !routeDestination) {
      return;
    }

    const destination = placeFromFeature(routeDestination);
    if (!destination || !isValidCoordinate(destination.coordinate)) {
      setRouteDestination(null);
      return;
    }

    setRouteEnd(destination.coordinate);
    setEndValue(destination.name);
    setRouteRequested(Boolean(routeStart && destination.coordinate));
    setFocused(false);
    setSearchQuery("");
    setRouteDestination(null);
  }, [
    isValidCoordinate,
    placeFromFeature,
    routeDestination,
    routeStart,
    routingActive,
    setRouteDestination,
    setRouteEnd,
    setRouteRequested,
    setSearchQuery,
  ]);

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
          data={!routingActive ? searchRows : []}
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
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          onChange={(index: number) => {
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
          <BottomSheetFlatList
            data={searchRows}
            keyExtractor={extractSearchRowKey}
            renderItem={renderSearchRow}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            style={styles.resultsList}
            contentContainerStyle={styles.resultsListContent}
            ListHeaderComponent={
              <View style={styles.fixedHeader}>{renderRoutingSearchHeader()}</View>
            }
            stickyHeaderIndices={[0]}
          />
        </BottomSheet>
      )}
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
  inputSpacer: {
    height: 20,
  },
  fixedHeader: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
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
    paddingBottom: 24,
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
    textAlign: "center",
  },
  routeInputs: {
    gap: 8,
  },
  routeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeInputFields: {
    flex: 1,
    gap: 8,
  },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  swapButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
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
