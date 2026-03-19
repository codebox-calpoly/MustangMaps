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
  Alert,
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
import { AmenityPopup } from "./AmenityPopup";
import { useUserLocation } from "../../context/UserLocationContext";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSavedPlaces } from "../../context/SavedPlacesContext";
import {
  featureCenter as featureCenterUtil,
  buildSelectedBuildingMarker,
} from "../../lib/map/markerPlacement";

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
  const programmaticMoveRef = useRef(false);
  const pendingRouteFitRef = useRef<{
    start: [number, number];
    end: [number, number];
  } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapReadyRef = useRef(false);
  useEffect(() => {
    mapReadyRef.current = mapReady;
  }, [mapReady]);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [mapGesturesEnabled, setMapGesturesEnabled] = useState(true);
  const {
    selectedBuilding,
    selectBuilding,
    clearSelection,
    selectedAmenity,
    amenityLevels,
    clearAmenitySelection,
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
    setRouteStart,
    setRouteStartIsCurrentLocation,
    setRouteDestination,
    setRouteEnd,
    setRouteRequested,
    setRoutingActive,
    setUserLocation,
    setLocationAccuracy,
    trackingMode,
  } = useMapContext();
  const mapStyleUrl =
    mapStyle === "dark"
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

  const { latitude, longitude, accuracy } = useUserLocation();
  const { favorites, isFavorite } = useSavedPlaces();
  const userLocation =
    latitude != null && longitude != null ? [longitude, latitude] : null;
  const recenterSeqRef = useRef(0);

  useEffect(() => {
    if (latitude == null || longitude == null) {
      return;
    }
    setUserLocation([longitude, latitude]);
    setLocationAccuracy(accuracy);
  }, [latitude, longitude, accuracy, setUserLocation, setLocationAccuracy]);

  // When tracking mode activates, recenter on the user's location.
  useEffect(() => {
    if (trackingMode) {
      recenterOnUser();
    }
  }, [trackingMode]);

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

  const handleRetry = useCallback(() => {
    retryMapData();
  }, [retryMapData]);

  const featureCenter = featureCenterUtil;

  const selectedBuildingMarker = useMemo<FeatureCollection<Point> | null>(
    () => buildSelectedBuildingMarker(selectedBuilding),
    [selectedBuilding],
  );

  // Hide the selected-building marker when that building already exists in favorites.
  const selectedBuildingIsFavorite = useMemo(() => {
    if (!selectedBuilding) {
      return false;
    }

    const center = featureCenter(selectedBuilding);
    if (!center) {
      return false;
    }

    const name = String(selectedBuilding.properties?.name ?? "Unknown");
    const selectedRef= selectedBuilding.properties?.ref;
    // Preferred match path: stable building ref when available.
    if (selectedRef) {
      const matchedByRef = favorites.some((item) => {
        const favoriteRef = item.ref
        return Boolean(favoriteRef) && favoriteRef === selectedRef;
      });
      if (matchedByRef) {
        return true;
      }
    }

    // Fallback for geometry drift between data sources.
    const [lng, lat] = center;
    return favorites.some((item) => {
      if (item.name !== name) {
        return false;
      }
      const [favLng, favLat] = item.coordinate;
      return (
        Math.abs(favLng - lng) <= 0.00005 &&
        Math.abs(favLat - lat) <= 0.00005
      );
    });
  }, [selectedBuilding, favorites, featureCenter, isFavorite]);

  const searchPanelHeight = useSharedValue<number>(0);
  const windowHeight = Dimensions.get("window").height;

  // Hide the recenter button when the bottom sheet extends past it
  const locationButtonStyle = useAnimatedStyle(() => {
    const buttonTop = 175;
    const sheetTop = searchPanelHeight.value;
    return {
      opacity: sheetTop < buttonTop + 44 ? 0 : 1,
      pointerEvents: sheetTop < buttonTop + 44 ? "none" as const : "auto" as const,
    };
  }, []);

  function UserLocationButton() {
    if (!userLocation) {
      return null;
    }
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Center User Location"
        onPress={recenterOnUser}
        style={styles.locationButton}
      >
        <View style={styles.locationIcon}>
          <View style={styles.locationIconRing} />
          <View style={styles.locationIconDot} />
        </View>
      </Pressable>
    );
  }

  // Recenter map on user location. Each press fires a new setCamera call
  // unconditionally so rapid taps always work — the last one wins.
  const recenterOnUser = () => {
    const camera = cameraRef.current;
    if (!userLocation || !mapReady || !camera) {
      return;
    }

    const seq = ++recenterSeqRef.current;
    const safeLoc = clampCoordinate([userLocation[0], userLocation[1]]);

    programmaticMoveRef.current = true;
    // Vary duration slightly so MapLibre's native bridge never deduplicates
    // consecutive calls to the same destination.
    camera.setCamera({
      centerCoordinate: safeLoc,
      zoomLevel: 18,
      animationDuration: 350 + (seq % 10),
    });
    setTimeout(() => {
      // Only clear the flag if no newer recenter has started.
      if (recenterSeqRef.current === seq) {
        programmaticMoveRef.current = false;
      }
    }, 400);
  };

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
        const stopKey = `${safeLoc[0].toFixed(6)}:${safeLoc[1].toFixed(6)}`;
        // Skip if the camera is already animating to this exact location.
        if (cameraBusyRef.current && lastCameraStopRef.current === stopKey) {
          return;
        }
        cameraBusyRef.current = true;
        programmaticMoveRef.current = true;
        lastCameraStopRef.current = stopKey;
        requestAnimationFrame(() => {
          camera.flyTo(safeLoc, 250);
          setTimeout(() => {
            cameraBusyRef.current = false;
            programmaticMoveRef.current = false;
          }, 300);
        });

        // Retry camera movement on iOS after delay
        if (Platform.OS === "ios") {
          setTimeout(() => {
            const retryMap = mapRef.current;
            const retryCamera = cameraRef.current;
            if (!mapReadyRef.current || !retryMap || !retryCamera) {
              return;
            }
            programmaticMoveRef.current = true;
            retryCamera.flyTo(safeLoc, 250);
            setTimeout(() => {
              cameraBusyRef.current = false;
              programmaticMoveRef.current = false;
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
          if (!mapReadyRef.current || !retryMap || !retryCamera) {
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

  const featureJustSelectedRef = useRef(false);

  const handleBuildingPress = useCallback(
    (feature: any) => {
      // Ignore building taps during tracking mode so the user can't
      // accidentally select a building while following a route.
      if (trackingMode) return;

      // Handle building press from BuildingLayer
      const properties = feature.properties;
      if (properties && (properties.building || properties.amenity)) {
        featureJustSelectedRef.current = true;
        setTimeout(() => { featureJustSelectedRef.current = false; }, 200);
        const building = feature as Feature<Geometry, GeoJsonProperties>;
        selectBuilding(building);
        // Prefer tap coordinates for camera centering so the view stays
        // anchored to where the user actually tapped.
        const tapLng = building.properties?._tapLng as number | undefined;
        const tapLat = building.properties?._tapLat as number | undefined;
        const center =
          tapLng != null && tapLat != null
            ? [tapLng, tapLat]
            : featureCenter(building);
        if (center) {
          handleCameraMove(center);
        }
      }
    },
    [featureCenter, handleCameraMove, selectBuilding, trackingMode],
  );

  const CAL_POLY_BOUNDS = {
    minLng: -120.670,
    maxLng: -120.650,
    minLat: 35.295,
    maxLat: 35.315,
  };

  const handleNavigate = useCallback(
    (feature: Feature<Geometry, GeoJsonProperties>) => {
      if (userLocation && isValidCoordinate(userLocation)) {
        const [lng, lat] = userLocation;
        const inBounds =
          lng >= CAL_POLY_BOUNDS.minLng &&
          lng <= CAL_POLY_BOUNDS.maxLng &&
          lat >= CAL_POLY_BOUNDS.minLat &&
          lat <= CAL_POLY_BOUNDS.maxLat;
        if (!inBounds) {
          Alert.alert(
            "Outside Campus",
            "Please do not route outside of Cal Poly.",
          );
          return;
        }
        setRouteStart(userLocation);
        setRouteStartIsCurrentLocation(true);
      } else {
        setRouteStart(null);
        setRouteStartIsCurrentLocation(false);
      }
      const center = featureCenter(feature);
      if (center) {
        setRouteEnd(center);
        setRouteRequested(true);
      }
      setRoutingActive(true);
      setRouteDestination(feature);
    },
    [
      featureCenter,
      isValidCoordinate,
      setRouteDestination,
      setRouteEnd,
      setRouteRequested,
      setRouteStart,
      setRouteStartIsCurrentLocation,
      setRoutingActive,
      userLocation,
    ],
  );

  const handleMapPress = useCallback(
    async (feature: Feature<Geometry, GeoJsonProperties>) => {
      const map = mapRef.current;
      if (!map) return;

      // ShapeSource.onPress fires before MapView.onPress for the same tap.
      // Skip clearing when a building/amenity was just selected.
      if (featureJustSelectedRef.current) return;

      const properties = feature.properties;
      if (!properties || (!properties.building && !properties.amenity)) {
        clearSelection();
      }

      if (onMapPress) {
        onMapPress(feature);
      }
    },
    [clearSelection, onMapPress],
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
        onDidFinishLoadingMap={() => {
          // Hide the base map's building layers so only our custom BuildingLayer renders,
          // preventing double-shading that makes some buildings appear darker.
          mapRef.current?.setSourceVisibility(false, "carto", "building");
          setMapReady(true);
        }}
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
        {selectedBuildingMarker && mapMode !== "amenities" && !selectedBuildingIsFavorite && (
          <ShapeSource id="selected-building-marker-source" shape={selectedBuildingMarker}>
            <CircleLayer
              id="selected-building-marker"
              style={{
                circleRadius: 10,
                circleColor: "#EF4444",
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 3,
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

      <SearchPanel
        cameraMove={handleCameraMove}
        cameraFitRoute={handleCameraFitRoute}
        bottomSheetPosition={searchPanelHeight}
        onNavigate={handleNavigate}
      />

      <Animated.View style={[styles.locationButtonContainer, locationButtonStyle]}>
        <UserLocationButton />
      </Animated.View>

      <AmenityPopup
        visible={!!selectedAmenity}
        amenity={selectedAmenity}
        levels={amenityLevels}
        onClose={clearAmenitySelection}
        onNavigate={handleNavigate}
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
  locationButtonContainer: {
    position: "absolute",
    right: 16,
    top: 175,
    zIndex: 3,
  },
  locationButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  locationIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  locationIconRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: "#6B7280",
  },
  locationIconDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#6B7280",
  },
  arrivalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  arrivalCard: {
    width: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  arrivalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  arrivalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  arrivalButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 14,
    backgroundColor: "#2563EB",
  },
  arrivalButtonPressed: {
    backgroundColor: "#1D4ED8",
  },
  arrivalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
