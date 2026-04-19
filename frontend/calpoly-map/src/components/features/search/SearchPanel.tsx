import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { Dimensions, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import type { Feature, Geometry, GeoJsonProperties } from "geojson";
import {
  useAnimatedReaction,
  type SharedValue,
} from "react-native-reanimated";
import { runOnJS } from "react-native-reanimated";

import { useMapContext } from "../../../context/MapContext";
import {
  useSavedPlaces,
  type SavedPlace,
} from "../../../context/SavedPlacesContext";

type BuildingFeature = Feature<Geometry, GeoJsonProperties>;

interface Props {
  cameraMove: (coordinates: number[]) => void;
  cameraFitRoute: (start: number[], end: number[]) => void;
  bottomSheetPosition: SharedValue<number>;
  onNavigate: (feature: Feature<Geometry, GeoJsonProperties>) => void;
  onOpenClassroomFinder: (building: Feature<Geometry, GeoJsonProperties>) => void;
  buildingsWithClassZones: Set<string>;
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

export function SearchPanel({ cameraMove, cameraFitRoute, bottomSheetPosition, onNavigate, onOpenClassroomFinder, buildingsWithClassZones }: Props) {
  // Bottom sheet controls
  const sheetRef = useRef<BottomSheet>(null);
  const lastFittedRouteRef = useRef<string | null>(null);

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
    mapStyle,
  } = useMapContext();

  const openSheet = useCallback(() => {
    sheetRef.current?.snapToIndex(routingActive ? 3 : 4);
  }, [routingActive]);

  const dark = mapStyle === "dark";

  const snapPoints = useMemo(
    () => routingActive ? ["28%", "50%", "65%", "85%"] : ["14%", "22%", "35%", "55%", "75%"],
    [routingActive],
  );

  const summaryVisible =
    routingActive &&
    Boolean(routeStart && routeEnd && activePath && !routeError);

  const {
    favorites,
    addToHistory,
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

  const normalizeSearchText = (value: string) => value.trim().toLowerCase();

  // splits buildingName (38) into buildingName and 38
  const parseBuildingName = (rawName: string, rawRef?: string) => {
    const normalizedName = rawName.replace(/\s+/g, " ").trim();
    const trailingRefMatch = normalizedName.match(/\(([^()]+)\)\s*$/);

    const parsedRef = trailingRefMatch?.[1]?.trim();
    const displayName =
      trailingRefMatch && trailingRefMatch.index !== undefined
        ? normalizedName.slice(0, trailingRefMatch.index).trim()
        : normalizedName;

    return {
      displayName: displayName || normalizedName,
      buildingRef: rawRef?.trim() || parsedRef || undefined,
    };
  };

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

  const [data, setData] = useState<BuildingFeature[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(
          require("../../../../geojson_files/buildings.geojson"),
        );
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        const text = await FileSystem.readAsStringAsync(uri);
        const parsed = JSON.parse(text);
        if (cancelled) return;
        if (parsed?.type === "FeatureCollection" && Array.isArray(parsed.features)) {
          setData(parsed.features as BuildingFeature[]);
        }
      } catch {
        if (!cancelled) setData([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter safely with plain string matching (no user-input RegExp).
  const filteredData = useMemo(() => {
    const query = normalizeSearchText(searchQuery);

    const filtered = data.filter((item) => {
      const rawName = String(item.properties?.name ?? "");
      if (!rawName) return false;

      const rawRef =
        typeof item.properties?.ref === "string"
          ? item.properties.ref
          : undefined;

      const { displayName, buildingRef } = parseBuildingName(rawName, rawRef);

      if (query.length === 0) return true;

      const normalizedDisplayName = normalizeSearchText(displayName);
      const normalizedRawName = normalizeSearchText(rawName);
      const normalizedRef = normalizeSearchText(buildingRef ?? "");

      return (
        normalizedDisplayName.includes(query) ||
        normalizedRawName.includes(query) ||
        (normalizedRef.length > 0 &&
          (normalizedRef.includes(query) ||
            `building ${normalizedRef}`.includes(query)))
      );
    });

    return filtered.sort((a, b) => {
      const nameA = String(a.properties?.name ?? "");
      const nameB = String(b.properties?.name ?? "");
      return nameA.localeCompare(nameB);
    });
  }, [data, searchQuery]);


  const buildPlaceId = useCallback((name: string, coord: number[]) => {
    const [lng, lat] = coord;
    return `${name}:${lng.toFixed(6)}:${lat.toFixed(6)}`;
  }, []);

  const middle = useCallback((coordinates: number[][]) => {
    if (coordinates.length === 0) return [0, 0];
    let result: number[] = [0.0, 0.0];
    coordinates.forEach((position: number[]) => {
      result[0] += position[0];
      result[1] += position[1];
    });
    result[0] /= coordinates.length;
    result[1] /= coordinates.length;
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
      if (!ring || ring.length === 0) {
        return null;
      }

      const coord = middle(ring) as [number, number];
      const rawName = String(feature.properties?.name ?? "Unknown");
      const rawRef =
        typeof feature.properties?.ref === "string"
          ? feature.properties.ref
          : undefined;

      const { displayName, buildingRef } = parseBuildingName(rawName, rawRef);

      return {
        id: buildPlaceId(displayName, coord),
        name: displayName,
        coordinate: coord,
        updatedAt: 0,
        ref: buildingRef,
      };
    },
    [buildPlaceId, getRingCoordinates, middle],
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

        // Find the matching GeoJSON feature and select it to show a marker
        if (!isMyLocation) {
          const matchingFeature = data.find((f) => {
            const rawName = String(f.properties?.name ?? "");
            const rawRef =
              typeof f.properties?.ref === "string" ? f.properties.ref : undefined;
            const { displayName, buildingRef } = parseBuildingName(rawName, rawRef);

            if (displayName !== place.name) return false;
            if (place.ref && buildingRef) return place.ref === buildingRef;
            return true;
          });

          if (matchingFeature) {
            selectBuilding(
              matchingFeature as Feature<Geometry, GeoJsonProperties>,
            );
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
    const hasQuery = searchQuery.trim().length > 0;
    if (!hasQuery && favorites.length > 0 && focused) {
      list.push({ title: "Favorites", data: favorites, kind: "favorite" as const });
    }
    if (focused || hasQuery) {
      list.push({ title: "Results", data: resultsAsPlaces, kind: "result" as const });
    }
    return list;
  }, [favorites, focused, resultsAsPlaces, searchQuery]);

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
            <Text style={[styles.sectionTitle, dark && { color: "#D1D5DB" }]}>{item.section.title}</Text>
          </View>
        );
      }

      const place = item.item;
      return (
        <Pressable
          onPress={() => handleSelectPlace(place)}
          style={({ pressed }) => [
            { backgroundColor: pressed ? (dark ? "#2A2F38" : "#D2E6FF") : (dark ? "#1C1F26" : "white") },
            styles.itemContainer,
          ]}
        >
          <View style={styles.itemMeta}>
            <Text style={[styles.buildingName, dark && { color: "#F9FAFB" }]}>{place.name}</Text>
            {place.ref && (
              <Text style={[styles.buildingNumber, dark && { color: "#9CA3AF" }]}>Building {place.ref}</Text>
            )}
          </View>
          <View style={styles.itemActions}>
            <Pressable onPress={() => toggleFavorite(place)} style={styles.iconButton}>
              <Text style={[styles.heartIcon, isFavorite(place.id) && styles.heartIconActive]}>
                {isFavorite(place.id) ? "♥" : "♡"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [dark, handleSelectPlace, isFavorite, toggleFavorite],
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

  const selectedBuildingName = useMemo(() => {
    const rawName = selectedBuilding?.properties?.name;
    if (rawName) return stripBuildingNumber(rawName);
    if (!selectedBuilding) return "Unknown Building";
    const ring = getRingCoordinates(selectedBuilding.geometry as Geometry);
    if (ring && ring.length > 0) {
      const center = middle(ring);
      return `${center[1].toFixed(4)}, ${center[0].toFixed(4)}`;
    }
    return "Unknown Building";
  }, [selectedBuilding, getRingCoordinates, middle, stripBuildingNumber]);
  const selectedBuildingRef =
    (selectedBuilding?.properties?.ref as string | undefined) ??
    extractBuildingRef(selectedBuilding?.properties?.name ?? "");
  const rawBuildingType = selectedBuilding?.properties?.["university-function"] ??
    selectedBuilding?.properties?.amenity ??
    selectedBuilding?.properties?.building;
  const selectedBuildingSubtitle = selectedBuildingRef
    ? `Building ${selectedBuildingRef}`
    : String(
        rawBuildingType && rawBuildingType !== "yes"
          ? rawBuildingType
          : "Campus building",
      );

  const renderMainSheetHeader = useCallback(() => {
    if (selectedBuilding && !routingActive) {
      return (
        <View style={styles.buildingInfoCard}>
          <View style={styles.buildingInfoHeader}>
            <View style={styles.buildingInfoText}>
              <Text style={[styles.buildingInfoName, dark && { color: "#F9FAFB" }]}>{selectedBuildingName}</Text>
              <Text style={[styles.buildingInfoSubtitle, dark && { color: "#9CA3AF" }]}>{selectedBuildingSubtitle}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close building info"
              onPress={clearSelection}
              style={[styles.buildingInfoClose, dark && { backgroundColor: "#2A2F38", borderColor: "#3A4048" }]}
            >
              <Text style={[styles.buildingInfoCloseText, dark && { color: "#9CA3AF" }]}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.buildingActionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Directions to ${selectedBuildingName}`}
              onPress={() => {
                onNavigate(selectedBuilding);
                clearSelection();
              }}
              style={[styles.buildingDirectionsButton, { flex: 1 }]}
            >
              <Text style={styles.buildingDirectionsButtonText}>Directions</Text>
            </Pressable>
            {(() => {
              const bid = (selectedBuilding as any).id ?? selectedBuilding.properties?.["@id"];
              return typeof bid === "string" && buildingsWithClassZones.has(bid);
            })() && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Find classroom in ${selectedBuildingName}`}
                onPress={() => onOpenClassroomFinder(selectedBuilding)}
                style={styles.buildingFindClassroomButton}
              >
                <Text style={styles.buildingFindClassroomButtonText}>Find Classroom</Text>
              </Pressable>
            )}
          </View>
        </View>
      );
    }

    return (
      <>
        <View style={styles.directionHeaderRow}>
          <Text style={[styles.directionHeader, dark && { color: "#F9FAFB" }]}>
            {routingActive ? "Directions" : "Search"}
          </Text>
          {routingActive && (
            <TouchableOpacity
              onPress={() => { clearRoute(); setSearchQuery(""); }}
              style={[styles.clearChip, dark && { backgroundColor: "#2A2F38" }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.6}
            >
              <Text style={[styles.clearChipText, dark && { color: "#9CA3AF" }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

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
                dark && { backgroundColor: "#2A2F38", borderColor: "#3A4048" },
                routeAccessibleOnly && styles.accessibleToggleActive,
                pressed && styles.accessibleTogglePressed,
              ]}
            >
              <View style={[styles.accessibleCheckbox, dark && { backgroundColor: "#1C1F26", borderColor: "#6B7280" }, routeAccessibleOnly && styles.accessibleCheckboxActive]}>
                {routeAccessibleOnly && <Text style={styles.accessibleCheckmark}>✓</Text>}
              </View>
              <Text style={[styles.accessibleToggleText, dark && { color: "#F9FAFB" }]}>Accessible Routes Only</Text>
              <Text style={[styles.accessibleToggleIcon, dark && { color: "#D1D5DB" }]}>♿</Text>
            </Pressable>
          </View>
        ) : (
          <BottomSheetTextInput
            style={[styles.input, dark && { backgroundColor: "#2A2F38", borderColor: "#3A4048", color: "#F9FAFB" }]}
            placeholder="Type Destination Here..."
            placeholderTextColor={dark ? "#6B7280" : undefined}
            clearButtonMode="always"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance={dark ? "dark" : "light"}
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
          <View style={[styles.routeSummaryContainer, dark && { backgroundColor: "#2A2F38", borderColor: "#3A4048" }]}>
            <View style={styles.routeSummaryLeft}>
              <Text style={[styles.routeSummaryTime, dark && { color: "#F9FAFB" }]}>{formatTime()}</Text>
              <Text style={[styles.routeSummaryMeta, dark && { color: "#9CA3AF" }]}>
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
    dark,
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


  // Reset routing UI when routing is turned off
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

  // Expand sheet when a building is selected so the info card is visible;
  // snap back to default search size when selection is cleared
  useEffect(() => {
    if (selectedBuilding && !routingActive) {
      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(1);
      });
    } else if (!selectedBuilding && !routingActive) {
      sheetRef.current?.snapToIndex(0);
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

  useEffect(() => {
    if (!selectedBuilding || routingActive) {
      return;
    }
    // Use setTimeout to ensure the snap happens after the BottomSheet
    // has fully mounted (e.g. after switching back from ClassroomFinderPanel)
    const id = setTimeout(() => {
      sheetRef.current?.snapToIndex(1);
    }, 50);
    return () => clearTimeout(id);
  }, [routingActive, selectedBuilding]);


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
        backgroundStyle={dark ? { backgroundColor: "#1C1F26" } : undefined}
        handleIndicatorStyle={dark ? { backgroundColor: "#6B7280" } : undefined}
      >
        <BottomSheetFlatList
          data={!routingActive && !selectedBuilding ? searchRows : []}
          keyExtractor={extractSearchRowKey}
          renderItem={renderSearchRow}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
          overScrollMode="never"
          removeClippedSubviews={false}
          style={styles.resultsList}
          contentContainerStyle={[styles.resultsListContent, searchRows.length === 0 && { paddingBottom: 0 }]}
          ListHeaderComponent={
            <View style={[styles.fixedHeader, dark && { backgroundColor: "#1C1F26" }]}>{renderMainSheetHeader()}</View>
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
    left: -20,
    paddingBottom: 10,
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
    paddingHorizontal: 16,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  clearChipText: {
    color: "#6B7280",
    fontSize: 18,
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
  directionHeaderRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
  },
  directionHeader: {
    fontSize: 25,
    fontWeight: "900",
    marginBottom: 6,
  },
  buildingInfoCard: {
    marginTop: 8,
    gap: 10,
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
  },
  buildingActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  buildingFindClassroomButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  buildingFindClassroomButtonPressed: {
    backgroundColor: "#E5E7EB",
  },
  buildingFindClassroomButtonText: {
    color: "#111827",
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
