import React, { useEffect } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MapProvider, useMapContext } from '../context/MapContext';
import { SavedPlacesProvider } from '../context/SavedPlacesContext';
import { MapContainer } from '../components/map/MapContainer';
import { BuildingLayer } from '../components/map/layers/BuildingLayer';
import { ClassZonesLayer } from '../components/map/layers/ClassZonesLayer';
import { AmenitiesLayer } from '../components/map/layers/AmenitiesLayer';
import { FavoritesLayer } from '../components/map/layers/FavoritesLayer';
import { RouteLineLayer } from '../components/map/layers/RouteLineLayer';
import type { BuildingFilterOption, AmenityFilterOption } from '../components/features/map/MapFilters';
import { usePathGraph } from '../hooks/usePathGraph';
import { findPath } from '../lib/routing/pathfinder';
import { LocationProvider } from "../context/UserLocationContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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
  { id: "elevator", label: "Elevators" },
];

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LocationProvider>
        <MapProvider>
          <SavedPlacesProvider>
            <SafeAreaView style={{ flex: 1 }}>
              <MapScreen
                buildingOptions={BUILDING_OPTIONS}
                amenityOptions={AMENITY_OPTIONS}
              />
            </SafeAreaView>
          </SavedPlacesProvider>
        </MapProvider>
        </LocationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
    mapMode,
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
      <BuildingLayer buildingTypes={buildingTypeIds} />
      <ClassZonesLayer />
      {mapMode === "buildings" && <FavoritesLayer />}
      <AmenitiesLayer amenityTypes={amenityTypeIds} />
      <RouteLineLayer />
    </MapContainer>
  );
}
