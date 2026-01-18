import React, { useCallback, useMemo, useState } from "react";
import {
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

export function SearchPanel() {
  const [search, setSearch] = useState("");
  const [count, setcount] = useState(0);

  const handleSearch = useCallback(
    (input: string) => {
      setSearch(input);
    },
    [setSearch],
  );

  const data = geoData.features;

  const filteredData = useMemo(() => {
    const filteredData = data.filter((item) => {
      const name = item.properties.name;
      const match = name?.toLowerCase().match(search.toLowerCase());
      return name && match && match.length > 0;
    });

    return filteredData;
  }, [data, search]);

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

      <FlatList
        data={filteredData}
        keyExtractor={(item) => {
          return item.id;
        }}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            {/* insert logo based on type of building */}
            <Text style={{ fontSize: 50 }}>
              {item.properties.building.charAt(0).toUpperCase()}
            </Text>
            <View>
              <Text style={styles.buildingName}>
                {item.properties.name ? item.properties.name : "none"}
              </Text>
              <Text style={styles.subscript}>{item.id}</Text>
            </View>
          </View>
        )}
      />
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
