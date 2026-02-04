import React, { useCallback, useRef, useState } from "react";
import {
  MapView,
  Camera,
  setAccessToken,
  UserLocation,
  type MapViewRef,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { SearchPanel } from "../features/search/SearchPanel";
import {
  MapFilters,
  type AmenityFilterOption,
  type BuildingFilterOption,
} from "../features/map/MapFilters";
import { BuildingPopup } from "./BuildingPopup";
import type { Feature, Geometry, GeoJsonProperties } from "geojson";
import { useMapContext } from "../../context/MapContext";

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
  const [selectedBuilding, setSelectedBuilding] = useState<Feature<Geometry, GeoJsonProperties> | null>(null);
<<<<<<< 37-implement-filter-state-management
  const {
    setRouteDestination,
    mapMode,
    setMapMode,
    buildingFilterId,
    setBuildingFilterId,
    amenityTypeIds,
    setAmenityTypeIds,
  } = useMapContext();
=======
  const [mapReady, setMapReady] = useState(false);
  const { setRouteDestination } = useMapContext();
>>>>>>> main

  const isValidCoordinate = useCallback((coord?: number[] | null): coord is [number, number] => {
    return Array.isArray(coord) &&
      coord.length === 2 &&
      coord.every((value) => Number.isFinite(value));
  }, []);

  const clampCoordinate = useCallback((coord: [number, number]): [number, number] => {
    const [lng, lat] = coord;
    const safeLng = Math.max(-180, Math.min(180, lng));
    const safeLat = Math.max(-85, Math.min(85, lat));
    return [safeLng, safeLat];
  }, []);

  const handleZoom = useCallback(async (delta: number) => {
    const map = mapRef.current;
    const camera = cameraRef.current;
    if (!mapReady || !map || !camera) {
      return;
    }

    try {
      const zoom = await map.getZoom();
      const nextZoom = Math.max(0, Math.min(zoom + delta, 22));
      camera.setCamera({
        zoomLevel: nextZoom,
        animationDuration: 150,
      });
    } catch {
      // Ignore transient zoom errors to keep taps safe.
    }
  }, [mapReady]);

  const handleCameraMove = useCallback(async (loc: number[]) => {
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
        camera.setCamera({
          centerCoordinate: safeLoc,
          zoomLevel: 17,
          animationDuration: 250,
        });
        setTimeout(() => {
          cameraBusyRef.current = false;
        }, 300);
      });
    } catch {
      // Ignore transient zoom errors to keep taps safe.
      cameraBusyRef.current = false;
    }
  }, [clampCoordinate, isValidCoordinate, mapReady]);

  const handleBuildingPress = useCallback((feature: any) => {
    // Handle building press from BuildingLayer
    const properties = feature.properties;
    if (properties && (properties.building || properties.amenity)) {
      setSelectedBuilding(feature as Feature<Geometry, GeoJsonProperties>);
    }
  }, []);

  const handleNavigate = useCallback((feature: Feature<Geometry, GeoJsonProperties>) => {
    setRouteDestination(feature);
    setMapMode("routing");
  }, [setMapMode, setRouteDestination]);

  const handleMapPress = useCallback(async (feature: Feature<Geometry, GeoJsonProperties>) => {
    // MapView onPress for general map interactions
    // Building selection is handled by handleBuildingPress callback
    const map = mapRef.current;
    if (!map) return;

    // If clicking empty map area, clear building selection
    const properties = feature.properties;
    if (!properties || (!properties.building && !properties.amenity)) {
      setSelectedBuilding(null);
    }

    // Call the parent's onMapPress if provided
    if (onMapPress) {
      onMapPress(feature);
    }
  }, [onMapPress]);

  return (
    <View style={styles.container}>
      <SearchPanel 
        cameraMove={handleCameraMove}/>
      <MapFilters
        mapMode={mapMode}
        onMapModeChange={setMapMode}
        buildingFilterId={buildingFilterId}
        onBuildingFilterChange={setBuildingFilterId}
        amenityTypeIds={amenityTypeIds}
        onAmenityTypesChange={setAmenityTypeIds}
        buildingOptions={buildingOptions}
        amenityOptions={amenityOptions}
      />
      <MapView
        ref={mapRef}
        style={styles.map}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        logoEnabled={false}
        zoomEnabled
        scrollEnabled
        onPress={handleMapPress}
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <UserLocation
        // Renders user's location as dot with arrow for facing direction
          visible={true}
          showsUserHeadingIndicator={true}
        />
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [-120.6596, 35.305],
            zoomLevel: 15,
          }}
        />
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            // Inject onBuildingPress into BuildingLayer
            return React.cloneElement(child, { onBuildingPress: handleBuildingPress } as any);
          }
          return child;
        })}
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
      <BuildingPopup
        visible={selectedBuilding !== null}
        building={selectedBuilding}
        onClose={() => setSelectedBuilding(null)}
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
