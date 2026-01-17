import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { handleSearch, search } from "../../../hooks/useSearch";

export function SearchPanel() {

  return (
      <TextInput
        placeholder="Type Destination Here..."
        onChangeText={handleSearch}
        value={search} 
      />
    )
}

const styles = StyleSheet.create({
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
});
