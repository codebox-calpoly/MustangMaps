import React, { useCallback, useMemo, useState } from "react";
import {
  Button,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSearch } from "../../../hooks/useSearch";
import { SafeAreaView } from "react-native-safe-area-context";

import geoData from "./test.json";

interface Props {
  cameraMove: (coordinates: number[]) => {};
}

export function SearchPanel({ cameraMove }: Props) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSearch = useCallback(
    (input: string) => {
      setSearch(input);
      // show results if user is searching for a building
      if (input) {
        setFocused(true);
      } else {
        setFocused(false);
      }
    },
    [setSearch],
  );

  const data = geoData.features;

  // data filters off a regex match with input in search bar
  const filteredData = useMemo(() => {
    const filteredData = data.filter((item) => {
      const name = item.properties.name;
      const match = name?.toLowerCase().match(search.toLowerCase());
      return name && match && match.length > 0;
    });

    // sort and return results
    return filteredData.sort();
  }, [data, search]);

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

  return (
    <SafeAreaView style={styles.searchContainer}>
      <TextInput
        style={styles.input}
        placeholder="Type Destination Here..."
        clearButtonMode="always"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={handleSearch}
        value={search}
      />
      {focused && (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => {
            return item.id;
          }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                cameraMove(middle(item.geometry.coordinates[0]));
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
                {item.properties.building.charAt(0).toUpperCase()}
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
