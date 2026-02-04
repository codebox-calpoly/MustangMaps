import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMapContext } from "../../../context/MapContext";
import type { Geometry } from "geojson";

import geoData from "./test.json";

interface Props {
  cameraMove: (coordinates: number[]) => void;
}

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

  const getRingCoordinates = useCallback((geometry: Geometry): number[][] | null => {
    if (geometry.type === "Polygon") {
      return geometry.coordinates[0] ?? null;
    }
    if (geometry.type === "MultiPolygon") {
      return geometry.coordinates[0]?.[0] ?? null;
    }
    return null;
  }, []);

  useEffect(() => {
    if (routingActive && userLocation && !routeStart && startValue.length === 0) {
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
      {focused && (
        <FlatList
          data={filteredData}
          keyExtractor={(item, index) => {
            return item.id ?? item.properties?.name ?? String(index);
          }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                const ring = getRingCoordinates(item.geometry as Geometry);
                if (!ring || ring.length === 0) {
                  return;
                }
                const coord = middle(ring) as [number, number];
                const name = item.properties?.name ?? "";
                if (routingActive) {
                  if (activeField === "start") {
                    setRouteStart(coord);
                    if (name) {
                      setStartValue(name);
                    }
                    setRouteStartIsCurrentLocation(false);
                  } else {
                    setRouteEnd(coord);
                    if (name) {
                      setEndValue(name);
                    }
                  }
                  setRouteRequested(false);
                }
                cameraMove(coord);
                setFocused(false);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: pressed ? "#D2E6FF" : "white",
                },
                styles.itemContainer,
              ]}
            >
              {/* TODO: insert logo based on type of building */}
              <Text style={{ fontSize: 50 }}>
                {(item.properties?.building ??
                  item.properties?.amenity ??
                  item.properties?.name ??
                  "?")
                  .charAt(0)
                  .toUpperCase()}
              </Text>
              <View>
                <Text style={styles.buildingName}>
                  {item.properties.name ? item.properties.name : "none"}
                </Text>
                <Text style={styles.subscript}>{item.id}</Text>
              </View>
            </Pressable>
          )}
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
  },
  button: {},
  icon: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
});
