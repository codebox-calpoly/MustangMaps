import React, { useCallback, useEffect, useRef } from "react";
import {
  MapView,
  Camera,
  setAccessToken,
  type MapViewRef,
  type CameraRef,
  type OnPressEvent,
} from "@maplibre/maplibre-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { SearchPanel } from "../features/search/SearchPanel";
import useLocation from "../../hooks/useLocation";
import UserLocationMarker from "./markers/UserLocationMarker";

// Disable telemetry
setAccessToken(null);

export function MapContainer({
  children,
  onMapPress,
}: {
  children?: React.ReactNode;
  onMapPress?: (e: OnPressEvent) => void;
}) {
  // Loads user's current lat and long
  const { latitude, longitude } = useLocation();

  const mapRef = useRef<MapViewRef | null>(null);
  const cameraRef = useRef<CameraRef | null>(null);
  const didInitialCenterZoom = useRef(false);

  // Only does initial center and zoom once
  useEffect(() => {
    if (didInitialCenterZoom.current) return;
    if (!cameraRef.current) return;

    didInitialCenterZoom.current = true;

    cameraRef.current?.setCamera({
      centerCoordinate: [-120.6596, 35.305],
      zoomLevel: 15,
      animationDuration: 600,
    });
  });

  const handleZoom = useCallback(async (delta: number) => {
    const map = mapRef.current;
    const camera = cameraRef.current;
    if (!map || !camera) return;

    try {
      const zoom = await map.getZoom();
      const nextZoom = Math.max(0, Math.min(zoom + delta, 22));
      camera.zoomTo(nextZoom, 150);
    } catch {
      // Ignore transient zoom errors to keep taps safe.
    }
  }, []);

  const handleCameraMove = useCallback(async (loc: number[]) => {
    const camera = cameraRef.current;
    if (!camera) return;

    try {
      camera.flyTo(loc, 200);
      camera.zoomTo(17, 150);
    } catch {
      // Ignore transient camera errors.
    }
  }, []);

  return (
    <View style={styles.container}>
      <SearchPanel cameraMove={handleCameraMove} />

      <MapView
        ref={mapRef}
        style={styles.map}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        logoEnabled={false}
        zoomEnabled
        scrollEnabled
        onPress={onMapPress}
      >

        {/* Renders user's location */}
        <UserLocationMarker />

        <Camera 
        ref={cameraRef}  
        />

        {children}
      </MapView>

      <View style={styles.zoomControls} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          onPress={() => handleZoom(1)}
          style={styles.zoomButton}
        >
          <View style={styles.zoomIcon}>
            <View style={styles.zoomIconBarHorizontal} />
            <View style={styles.zoomIconBarVertical} />
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          onPress={() => handleZoom(-1)}
          style={styles.zoomButton}
        >
          <View style={styles.zoomIcon}>
            <View style={styles.zoomIconBarHorizontal} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  zoomControls: {
    position: "absolute",
    right: 16,
    bottom: 32,
    gap: 10,
    alignItems: "center",
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoomIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomIconBarHorizontal: {
    width: 18,
    height: 2,
    backgroundColor: "#F9FAFB",
  },
  zoomIconBarVertical: {
    position: "absolute",
    width: 2,
    height: 18,
    backgroundColor: "#F9FAFB",
  },
});
