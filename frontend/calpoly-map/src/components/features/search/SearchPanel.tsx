import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMapContext } from "../../../context/MapContext";
import {
  useSavedPlaces,
  type SavedPlace,
} from "../../../context/SavedPlacesContext";
import type { Geometry } from "geojson";
import { useUserLocation } from "../../../context/UserLocationContext";

import geoData from "./test.json";

interface Props {
  cameraMove: (coordinates: number[]) => void;
}

type SectionKind = "favorite" | "history" | "result";

export function SearchPanel({ cameraMove }: Props) {
  const [focused, setFocused] = useState(false);
  const [activeField, setActiveField] = useState<"start" | "end">("end");
  const [startValue, setStartValue] = useState("");
  const [endValue, setEndValue] = useState("");
  const {
    searchQuery,
    setSearchQuery,
    userLocation,
    routeStart,
    routeEnd,
    activePath,
    routeError,
    routingActive,
    routeRequested,
    setRouteStart,
    setRouteEnd,
    setRouteRequested,
    setRouteStartIsCurrentLocation,
    clearRoute,
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

  const { latitude, longitude } = useUserLocation();
  const { setUserLocation } = useMapContext();

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    setUserLocation([longitude, latitude]);
  }, [latitude, longitude, setUserLocation]);

  const isValidCoordinate = useCallback((coord?: number[] | null): coord is [number, number] => {
    return Array.isArray(coord) &&
      coord.length === 2 &&
      coord.every((value) => Number.isFinite(value));
  }, []);

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
        updatedAt: Date.now(),
      };
    },
    [buildPlaceId, getRingCoordinates, middle],
  );

  const handleSelectPlace = useCallback(
    (place: SavedPlace) => {
      if (!isValidCoordinate(place.coordinate)) {
        return;
      }
      if (routingActive) {
        if (activeField === "start") {
          setRouteStart(place.coordinate);
          setStartValue(place.name);
          setRouteStartIsCurrentLocation(false);
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
      setFocused(false);
    },
    [
      activeField,
      addToHistory,
      cameraMove,
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
    return filteredData
      .map(placeFromFeature)
      .filter((place): place is SavedPlace => Boolean(place));
  }, [filteredData, placeFromFeature]);

  const sections = useMemo(() => {
    const list: Array<{
      title: string;
      data: SavedPlace[];
      kind: SectionKind;
    }> = [];
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

  useEffect(() => {
    if (
      routingActive &&
      userLocation &&
      !routeStart &&
      startValue.length === 0
    ) {
      setRouteStart(userLocation);
      setStartValue("Current location");
      setRouteStartIsCurrentLocation(true);
    }
  }, [
    routingActive,
    userLocation,
    routeStart,
    setRouteStart,
    startValue,
    setRouteStartIsCurrentLocation,
  ]);

  useEffect(() => {
    if (!routingActive) {
      setStartValue("");
      setEndValue("");
      setActiveField("end");
      setFocused(false);
      setSearchQuery("");
      setRouteRequested(false);
    }
  }, [routingActive, setSearchQuery, setRouteRequested]);

  return (
    <SafeAreaView style={styles.searchContainer}>
      {routingActive ? (
        <View style={styles.routeInputs}>
          <TextInput
            style={styles.input}
            placeholder="Starting point"
            value={startValue}
            clearButtonMode="always"
            onFocus={() => {
              setActiveField("start");
              if (startValue) {
                setSearchQuery(startValue);
                setFocused(true);
              }
            }}
            onChangeText={(text) => {
              setStartValue(text);
              setActiveField("start");
              setSearchQuery(text);
              setFocused(Boolean(text));
              setRouteRequested(false);
              setRouteStartIsCurrentLocation(false);
            }}
          />
          <TextInput
            style={styles.input}
            placeholder="Destination"
            clearButtonMode="always"
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => {
              setActiveField("end");
              if (endValue) {
                setSearchQuery(endValue);
                setFocused(true);
              }
            }}
            onChangeText={(text) => {
              setEndValue(text);
              setActiveField("end");
              setSearchQuery(text);
              setFocused(Boolean(text));
              setRouteRequested(false);
            }}
            value={endValue}
          />
          <View style={styles.routeActions}>
            <Pressable
              onPress={() => {
                if (routeStart && routeEnd) {
                  setRouteRequested(true);
                }
              }}
              style={[
                styles.routeButton,
                !(routeStart && routeEnd) && styles.routeButtonDisabled,
              ]}
            >
              <Text style={styles.routeButtonText}>
                {routeRequested ? "Route set" : "Route"}
              </Text>
            </Pressable>
            <Pressable onPress={clearRoute} style={styles.clearChip}>
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
      {sections.length > 0 && (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.kind === "history" && (
                <Pressable onPress={clearHistory} style={styles.sectionAction}>
                  <Text style={styles.sectionActionText}>Clear</Text>
                </Pressable>
              )}
            </View>
          )}
          renderItem={({ item, section }) => (
            <Pressable
              onPress={() => handleSelectPlace(item)}
              style={({ pressed }) => [
                {
                  backgroundColor: pressed ? "#D2E6FF" : "white",
                },
                styles.itemContainer,
              ]}
            >
              {/* TODO: insert logo based on type of building */}
              <Text style={styles.itemIcon}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
              <View style={styles.itemMeta}>
                <Text style={styles.buildingName}>{item.name}</Text>
                <Text style={styles.subscript}>
                  {item.coordinate[1].toFixed(5)},{" "}
                  {item.coordinate[0].toFixed(5)}
                </Text>
              </View>
              <View style={styles.itemActions}>
                <Pressable
                  onPress={() => toggleFavorite(item)}
                  style={styles.actionChip}
                >
                  <Text style={styles.actionChipText}>
                    {isFavorite(item.id) ? "Unfav" : "Fav"}
                  </Text>
                </Pressable>
                {section.kind === "history" && (
                  <Pressable
                    onPress={() => removeFromHistory(item.id)}
                    style={[styles.actionChip, styles.removeChip]}
                  >
                    <Text style={styles.actionChipText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          )}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    marginHorizontal: 10,
    marginTop: 120,
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
  routeButton: {
    borderRadius: 10,
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  routeButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  routeButtonText: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "600",
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
  button: {},
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
});
