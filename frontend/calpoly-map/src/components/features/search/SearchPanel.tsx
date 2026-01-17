import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSearch } from "../../../hooks/useSearch";
import { SafeAreaView } from "react-native-safe-area-context";

export function SearchPanel() {
  const [ search, setSearch ] = useState("")

  const handleSearch = useCallback((input: string) => {
    setSearch(input)
  }, [])

  return (
    <SafeAreaView
    style={styles.searchContainer}>
      <TextInput
      style={styles.input}
        placeholder="Type Destination Here..."
        clearButtonMode="always"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={handleSearch}
        value={search}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    marginHorizontal: 20,
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
  },
});
