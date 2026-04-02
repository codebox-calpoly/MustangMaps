import React, { useEffect } from "react";
import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";
import { Alert } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { PostHogProvider } from 'posthog-react-native';
import { MapProvider, useMapContext } from '../context/MapContext';
import { SavedPlacesProvider } from '../context/SavedPlacesContext';
import { MapContainer } from '../components/map/MapContainer';
import { BuildingLayer } from '../components/map/layers/BuildingLayer';
import { AmenitiesLayer } from '../components/map/layers/AmenitiesLayer';
import { FavoritesLayer } from '../components/map/layers/FavoritesLayer';
import { RouteLineLayer } from '../components/map/layers/RouteLineLayer';
import type { BuildingFilterOption, AmenityFilterOption } from '../components/features/map/MapFilters';
import { usePathGraph } from '../hooks/usePathGraph';
import { findPath } from '../lib/routing/pathfinder';
import { LocationProvider } from "../context/UserLocationContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ClassZonesLayer } from "../components/map/layers/ClassZonesLayer";

const BUILDING_OPTIONS: BuildingFilterOption[] = [
  { id: "all", label: "All" },
  { id: "academic", label: "Academic" },
  { id: "residential", label: "Residential" },
  { id: "dining", label: "Dining" },
];

const AMENITY_OPTIONS: AmenityFilterOption[] = [
  { id: "all", label: "All" },
  { id: "bathroom", label: "Bathrooms" },
  { id: "water_fountain", label: "Water Fountains" },
  { id: "printer", label: "Printers" },
];

if (!__DEV__) {
  Sentry.init({
    dsn: "https://348bb00969a4dae4c55101664e2d9543@o4511145737453568.ingest.us.sentry.io/4511145747218432",
    tracesSampleRate: 1.0,
  });
}

function ThemedSafeArea({ children }: { children: React.ReactNode }) {
  const { mapStyle } = useMapContext();
  const dark = mapStyle === "dark";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark ? "#111827" : "#FFFFFF" }}>
      {children}
    </SafeAreaView>
  );
}

function useOTAUpdates() {
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            "Update Available",
            "A new version has been downloaded. Restart to apply.",
            [
              { text: "Later", style: "cancel" },
              { text: "Restart", onPress: () => Updates.reloadAsync() },
            ],
          );
        }
      } catch (e) {
        // Silently fail — don't block the app for update errors
      }
    })();
  }, []);
}

function App() {
  useOTAUpdates();
  return (
    <PostHogProvider
      apiKey="phc_xBVGBfGzLCjimQ7sppjTtqzoVh2Nx8gN6L7oUYifMyDf"
      options={{
        host: "https://us.i.posthog.com",
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <LocationProvider>
          <MapProvider>
            <SavedPlacesProvider>
              <ThemedSafeArea>
                <MapScreen
                  buildingOptions={BUILDING_OPTIONS}
                  amenityOptions={AMENITY_OPTIONS}
                />
              </ThemedSafeArea>
            </SavedPlacesProvider>
          </MapProvider>
          </LocationProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </PostHogProvider>
  );
}

function MapScreen({
  buildingOptions,
  amenityOptions,
}: {
  buildingOptions: BuildingFilterOption[];
  amenityOptions: AmenityFilterOption[];
}) {
  const {
    buildingTypeIds,
    amenityTypeIds,
    routeStart,
    routeEnd,
    routingActive,
    routeRequested,
    routeStartIsCurrentLocation,
    routeAccessibleOnly,
    setActivePath,
    setRouteError,
  } = useMapContext();
  const { graph: loadedGraph, error } = usePathGraph();

  useEffect(() => {
    if (error) {
      setRouteError("Failed to load paths data");
    }
  }, [error, setRouteError]);

  useEffect(() => {
    if (!routingActive || !routeRequested || !routeStart || !routeEnd || !loadedGraph) {
      setActivePath(null);
      if (routingActive && routeRequested && routeStart && routeEnd && !loadedGraph) {
        setRouteError("Loading paths data...");
      } else {
        setRouteError(null);
      }
      return;
    }

    let result = findPath(loadedGraph, routeStart, routeEnd, {
      onlyAccessible: routeAccessibleOnly,
    });
    if (!result) {
      result = findPath(loadedGraph, routeStart, routeEnd, {
        snapRadiusMeters: 150,
        onlyAccessible: routeAccessibleOnly,
      });
    }
    if (!result && routeStartIsCurrentLocation) {
      result = findPath(loadedGraph, routeStart, routeEnd, {
        snapRadiusMeters: 300,
        onlyAccessible: routeAccessibleOnly,
      });
    }
    if (!result) {
      setActivePath(null);
      setRouteError(
        routeAccessibleOnly
          ? "No accessible route found between those points."
          : routeStartIsCurrentLocation
            ? "Current location isn't on the path network. Choose a start point."
            : "No path found between those points",
      );
      return;
    }

    setRouteError(null);
    setActivePath(result);
  }, [
    loadedGraph,
    routeStart,
    routeEnd,
    routingActive,
    routeRequested,
    routeAccessibleOnly,
    setActivePath,
    setRouteError,
  ]);

  return (
    <MapContainer
      buildingOptions={buildingOptions}
      amenityOptions={amenityOptions}
    >
      <BuildingLayer key="buildings" buildingTypes={buildingTypeIds} />
      <ClassZonesLayer key="class-zones" />
      <FavoritesLayer key="favorites" />
      <AmenitiesLayer key="amenities" amenityTypes={amenityTypeIds} />
      <RouteLineLayer key="route-line" />
    </MapContainer>
  );
}

export default __DEV__ ? App : Sentry.wrap(App);
