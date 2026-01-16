import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

export function SearchPanel() {
  const [text, onChangeText] = React.useState("");

  return <TextInput style={styles.input} />;
}

const styles = StyleSheet.create({
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
});
