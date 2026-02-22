import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapView,
  Camera,
  CircleLayer,
  ShapeSource,
  setAccessToken,
  type MapViewRef,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SearchPanel } from "../features/search/SearchPanel";
import {
  MapFilters,
  type AmenityFilterOption,
  type BuildingFilterOption,
} from "../features/map/MapFilters";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  Point,
} from "geojson";
import { useMapContext } from "../../context/MapContext";
import UserLocationMarker from "./markers/UserLocationMarker";
import { useUserLocation } from "../../context/UserLocationContext";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

// Disable telemetry
setAccessToken(null);

export function MapContainer({
  children,
  onMapPress,
  buildingOptions,
  amenityOptions,
  onBuildingPress,
}: {
  children?: React.ReactNode;
  onMapPress?: (feature: Feature<Geometry, GeoJsonProperties>) => void;
  buildingOptions: BuildingFilterOption[];
  amenityOptions: AmenityFilterOption[];
  onBuildingPress?: (feature: any) => void;
}) {
  const mapRef = useRef<MapViewRef | null>(null);
  const cameraRef = useRef<CameraRef | null>(null);
  const lastCameraStopRef = useRef<string | null>(null);
  const cameraBusyRef = useRef(false);
  const pendingRouteFitRef = useRef<{
    start: [number, number];
    end: [number, number];
  } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Feature<
    Geometry,
    GeoJsonProperties
  > | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [mapGesturesEnabled, setMapGesturesEnabled] = useState(true);
  const {
    selectedBuilding,
    selectBuilding,
    clearSelection,
    mapMode,
    setMapMode,
    mapStyle,
    buildingTypeIds,
    setBuildingTypeIds,
    amenityTypeIds,
    setAmenityTypeIds,
    mapDataLoading,
    mapDataErrors,
    retryMapData,
  } = useMapContext();
  const mapStyleUrl =
    mapStyle === "dark"
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

  const { latitude, longitude } = useUserLocation();
  const userLocation =
    latitude != null && longitude != null ? [longitude, latitude] : null;
  const [followUser, setFollowUser] = useState<boolean>(false);

  const isValidCoordinate = useCallback(
    (coord?: number[] | null): coord is [number, number] => {
      return (
        Array.isArray(coord) &&
        coord.length === 2 &&
        coord.every((value) => Number.isFinite(value))
      );
    },
    [],
  );

  const clampCoordinate = useCallback(
    (coord: [number, number]): [number, number] => {
      const [lng, lat] = coord;
      const safeLng = Math.max(-180, Math.min(180, lng));
      const safeLat = Math.max(-85, Math.min(85, lat));
      return [safeLng, safeLat];
    },
    [],
  );
  const hasLoading = Object.values(mapDataLoading).some(Boolean);
  const errorMessage =
    Object.values(mapDataErrors).find((value) => Boolean(value)) ?? null;

  const searchPanelHeight = useSharedValue<number>(0);
  const windowHeight = Dimensions.get("window").height;

  const controlsAnimatedStyle = useAnimatedStyle(() => {
    const bottom = windowHeight - searchPanelHeight.value - 70;
    if (searchPanelHeight.value / windowHeight > 0.265) {
      return { bottom: bottom };
    } else {
      return { bottom: -100 };
    }
  }, [windowHeight]);

  const handleZoom = useCallback(
    async (delta: number) => {
      const map = mapRef.current;
      const camera = cameraRef.current;
      if (!mapReady || !map || !camera) {
        return;
      }

      try {
        const zoom = await map.getZoom();
        const nextZoom = Math.max(0, Math.min(zoom + delta, 22));
        camera.zoomTo(nextZoom, 150);
      } catch {
        // Ignore transient zoom errors to keep taps safe.
      }
    },
    [mapReady],
  );

  // Show user location button if we have a valid location, and center map on tap.
  function UserLocationButton() {
    if (!userLocation) {
      return;
    }
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Center User Location"
        onPress={toggleFollowUser}
        style={[styles.zoomButton, followUser && styles.locationButtonActive]}
      >
        <View style={styles.zoomIcon}>
          <View style={styles.locationIconInner} />
          <View style={styles.locationIconOuter} />
        </View>
      </Pressable>
    );
  }

  // Toggle follow user mode on/off. When on, the map will center on the user's location and follow it as it moves.
  const toggleFollowUser = () => {
    const camera = cameraRef.current;
    const map = mapRef.current;
    if (!userLocation || !mapReady || !map || !camera) {
      return;
    }

    if (followUser) {
      setFollowUser(false);
      return;
    }

    lastCameraStopRef.current = null;
    setFollowUser(true);
    handleCameraMove(userLocation);
  };

  // Center map on user location when it changes, but only if follow user mode is active.
  useEffect(() => {
    if (!userLocation || !followUser) {
      return;
    }
    handleCameraMove(userLocation);
  }, [userLocation]);

  // Disable follow user mode if the user manually moves the map.
  const handleRegionChange = useCallback(
    (feature: any) => {
      if (!followUser) {
        return;
      }
      if (feature?.properties?.isUserInteraction) {
        setFollowUser(false);
        lastCameraStopRef.current = null;
      }
    },
    [followUser],
  );

  const handleCameraMove = useCallback(
    async (loc: number[]) => {
      const map = mapRef.current;
      const camera = cameraRef.current;
      if (!mapReady || !map || !camera) {
        return;
      }
      if (!isValidCoordinate(loc)) {
        return;
      }

      try {
        const safeLoc = clampCoordinate(loc as [number, number]);
        const stopKey = `${safeLoc[0].toFixed(6)}:${safeLoc[1].toFixed(6)}:17`;
        if (cameraBusyRef.current || lastCameraStopRef.current === stopKey) {
          return;
        }
        cameraBusyRef.current = true;
        lastCameraStopRef.current = stopKey;
        requestAnimationFrame(() => {
          camera.flyTo(safeLoc, 250);
          camera.setCamera({
            animationDuration: 250,
          });
          setTimeout(() => {
            cameraBusyRef.current = false;
          }, 300);
        });

        // Retry camera movement on IOS after delay
        if (Platform.OS === "ios") {
          setTimeout(() => {
            const retryMap = mapRef.current;
            const retryCamera = cameraRef.current;
            if (!mapReady || !retryMap || !retryCamera) {
              return;
            }
            retryCamera.flyTo(safeLoc, 250);
            setTimeout(() => {
              cameraBusyRef.current = false;
            }, 300);
          }, 320);
        }
      } catch {
        // Ignore transient zoom errors to keep taps safe.
        cameraBusyRef.current = false;
      }
    },
    [clampCoordinate, isValidCoordinate, mapReady],
  );

  const fitRouteBounds = useCallback(
    (start: [number, number], end: [number, number]) => {
      const map = mapRef.current;
      const camera = cameraRef.current;
      if (!mapReady || !map || !camera) {
        return false;
      }

      const ne: [number, number] = [
        Math.max(start[0], end[0]),
        Math.max(start[1], end[1]),
      ];
      const sw: [number, number] = [
        Math.min(start[0], end[0]),
        Math.min(start[1], end[1]),
      ];

      const topPadding = Math.round(windowHeight * 0.18);
      const bottomPadding = Math.round(windowHeight * 0.58);
      const padding: [number, number, number, number] = [
        topPadding,
        56,
        bottomPadding,
        56,
      ];

      camera.fitBounds(ne, sw, padding, 350);

      // iOS can apply stale layout metrics during bottom-sheet animation; a short retry stabilizes framing.
      if (Platform.OS === "ios") {
        setTimeout(() => {
          const retryMap = mapRef.current;
          const retryCamera = cameraRef.current;
          if (!mapReady || !retryMap || !retryCamera) {
            return;
          }
          retryCamera.fitBounds(ne, sw, padding, 250);
        }, 320);
      }

      return true;
    },
    [mapReady],
  );

  // Keep both route start/end points visible when a route is active.
  const handleCameraFitRoute = useCallback(
    (start: number[], end: number[]) => {
      if (!isValidCoordinate(start) || !isValidCoordinate(end)) {
        return;
      }

      const safeStart = clampCoordinate(start as [number, number]);
      const safeEnd = clampCoordinate(end as [number, number]);

      const didFit = fitRouteBounds(safeStart, safeEnd);
      if (!didFit) {
        pendingRouteFitRef.current = { start: safeStart, end: safeEnd };
        return;
      }

      pendingRouteFitRef.current = null;
    },
    [clampCoordinate, fitRouteBounds, isValidCoordinate],
  );

  useEffect(() => {
    if (!mapReady || !pendingRouteFitRef.current) {
      return;
    }
    const pending = pendingRouteFitRef.current;
    const didFit = fitRouteBounds(pending.start, pending.end);
    if (didFit) {
      pendingRouteFitRef.current = null;
    }
  }, [fitRouteBounds, mapReady]);

  const handleBuildingPress = useCallback((feature: any) => {
    // Handle building press from BuildingLayer
    const properties = feature.properties;
    if (properties && (properties.building || properties.amenity)) {
      const building = feature as Feature<Geometry, GeoJsonProperties>;
      selectBuilding(building);
      const center = featureCenter(building);
      if (center) {
        handleCameraMove(center);
      }
    }
  }, []);

  const handleNavigate = useCallback(
    (feature: Feature<Geometry, GeoJsonProperties>) => {
      setRouteDestination(feature);
      setMapMode("routing");
    },
    [setMapMode, setRouteDestination],
  );

  const handleMapPress = useCallback(
    async (feature: Feature<Geometry, GeoJsonProperties>) => {
      const map = mapRef.current;
      if (!map) return;

      const properties = feature.properties;
      if (!properties || (!properties.building && !properties.amenity)) {
        setSelectedBuilding(null);
      }

      if (onMapPress) {
        onMapPress(feature);
      }
    },
    [onMapPress],
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyleUrl}
        logoEnabled={false}
        zoomEnabled={mapGesturesEnabled}
        scrollEnabled={mapGesturesEnabled}
        onPress={handleMapPress}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onRegionWillChange={handleRegionChange}
      >
        <UserLocationMarker />
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [-120.6596, 35.305],
            zoomLevel: 15,
          }}
        />
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              onBuildingPress: handleBuildingPress,
            } as any);
          }
          return child;
        })}
        {selectedBuildingMarker && (
          <ShapeSource id="selected-building-marker-source" shape={selectedBuildingMarker}>
            <CircleLayer
              id="selected-building-marker"
              style={{
                circleRadius: 7,
                circleColor: "#2563EB",
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      <MapFilters
        mapMode={mapMode}
        onMapModeChange={setMapMode}
        buildingTypeIds={buildingTypeIds}
        onBuildingTypesChange={setBuildingTypeIds}
        amenityTypeIds={amenityTypeIds}
        onAmenityTypesChange={setAmenityTypeIds}
        buildingOptions={buildingOptions}
        amenityOptions={amenityOptions}
      />

      {(hasLoading || errorMessage) && (
        <View style={styles.statusOverlay} pointerEvents="auto">
          {errorMessage ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>Map data failed to load</Text>
              <Text style={styles.statusMessage}>{errorMessage}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading map data"
                onPress={handleRetry}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.retryButtonPressed,
                ]}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#111827" />
              <Text style={styles.loadingText}>Loading map data...</Text>
            </View>
          )}
        </View>
      )}

      <Animated.View
        style={[styles.zoomControls, controlsAnimatedStyle]}
        pointerEvents="box-none"
      >
        <UserLocationButton />

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
      </Animated.View>

      <SearchPanel
        cameraMove={handleCameraMove}
        cameraFitRoute={handleCameraFitRoute}
        bottomSheetPosition={searchPanelHeight}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  statusOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  statusCard: {
    width: "100%",
    maxWidth: 360,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  statusMessage: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#111827",
  },
  retryButtonPressed: {
    backgroundColor: "#1F2937",
  },
  retryButtonText: {
    color: "#F9FAFB",
    fontSize: 13,
    fontWeight: "600",
  },
  loadingCard: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  loadingText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
  zoomControls: {
    position: "absolute",
    right: 16,
    gap: 10,
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
  locationControls: {
    position: "absolute",
    left: 16,
    gap: 10,
  },
  locationIconInner: {
    width: 10,
    height: 10,
    borderRadius: 4,
    backgroundColor: "#ffffffff",
  },
  locationIconOuter: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  locationButtonActive: {
    backgroundColor: "#0B5FFF",
  },
});
