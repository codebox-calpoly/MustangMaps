import React, { useCallback, useMemo, useState } from "react";
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
  const [selectionMode, setSelectionMode] = useState<"start" | "end">("end");
  const {
    searchQuery,
    setSearchQuery,
    routeStart,
    routeEnd,
    activePath,
    routeError,
    setRouteStart,
    setRouteEnd,
    clearRoute,
  } = useMapContext();

  const handleSearch = useCallback(
    (input: string) => {
      setSearchQuery(input);
      // show results if user is searching for a building
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

  return (
    <SafeAreaView style={styles.searchContainer}>
      <TextInput
        style={styles.input}
        placeholder="Type Destination Here..."
        clearButtonMode="always"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={handleSearch}
        value={searchQuery}
      />
      <View style={styles.modeRow}>
        <Pressable
          onPress={() => {
            setSelectionMode("start");
            setSearchQuery("");
          }}
          style={[
            styles.modeChip,
            selectionMode === "start" && styles.modeChipActive,
          ]}
        >
          <Text
            style={[
              styles.modeChipText,
              selectionMode === "start" && styles.modeChipTextActive,
            ]}
          >
            Start
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setSelectionMode("end");
            setSearchQuery("");
          }}
          style={[
            styles.modeChip,
            selectionMode === "end" && styles.modeChipActive,
          ]}
        >
          <Text
            style={[
              styles.modeChipText,
              selectionMode === "end" && styles.modeChipTextActive,
            ]}
          >
            End
          </Text>
        </Pressable>
        <Pressable onPress={clearRoute} style={styles.clearChip}>
          <Text style={styles.clearChipText}>Clear</Text>
        </Pressable>
      </View>
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
                if (selectionMode === "start") {
                  setRouteStart(coord);
                  if (name) {
                    setSearchQuery(`Start: ${name}`);
                  }
                  setSelectionMode("end");
                } else {
                  setRouteEnd(coord);
                  if (name) {
                    setSearchQuery(`End: ${name}`);
                  }
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
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  modeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
  },
  modeChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  modeChipText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
  },
  modeChipTextActive: {
    color: "#F9FAFB",
  },
  clearChip: {
    marginLeft: "auto",
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
