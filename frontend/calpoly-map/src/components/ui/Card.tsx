import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureResponderEvent } from "react-native/Libraries/Types/CoreEventTypes.d.ts";
import { StyleProp } from "react-native/Libraries/StyleSheet/StyleSheet";
import { ViewStyle } from "react-native/Libraries/StyleSheet/StyleSheetTypes";

interface CardProps {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  onPress?: null | ((event: GestureResponderEvent) => void) | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}

export function Card({ title, subtitle, children, onPress, style }: CardProps) {
  return (
    <SafeAreaView>
      <Pressable onPress={onPress}>
        <View style={[style, { flex: 1 }]}>
          <text style={styles.title}>{title}</text>
          <text style={styles.subtitle}>{subtitle}</text>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  defaultViewStyle: {
    backgroundColor: "#D2E6FF",
    borderColor: "#ccc",
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
    marginTop: 10,
  },
  title: {
    fontSize: 17,
    marginLeft: 10,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    marginLeft: 10,
    color: "grey",
  },
});
