import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { PointAnnotation} from "@maplibre/maplibre-react-native";
import useLocation from "../../../hooks/useLocation";

export default function UserLocationMarker() {
  const { latitude, longitude, errorMsg } = useLocation();

  if (latitude == null || longitude == null) {
    console.log("UserLocationMarker:", errorMsg);
    return null;
  }

  const coord: [number, number] = [longitude, latitude];

  return (
    <PointAnnotation id={"user-marker"} coordinate={coord}>
      <View style={styles.markerOuter}>
        <View style={styles.markerInner} />
      </View>
    </PointAnnotation>
  );
}

const styles = StyleSheet.create({
  markerOuter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  markerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#007AFF",
  },
});
