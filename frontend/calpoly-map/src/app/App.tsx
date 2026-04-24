import React, { useEffect } from "react";
import { Text } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
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

const BUILDING_OPTIONS: BuildingFilterOption[] = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites" },
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

function ThemedSafeArea({ children }: { children: React.ReactNode }) {
  const { mapStyle } = useMapContext();
  const dark = mapStyle === "dark";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark ? "#111827" : "#FFFFFF" }}>
      {children}
    </SafeAreaView>
  );
}

function pickFontFamily(weight?: unknown): string {
  const w = typeof weight === "number" ? String(weight) : String(weight ?? "400");
  if (w === "700" || w === "bold" || w === "800" || w === "900") return "SpaceGrotesk_700Bold";
  if (w === "600") return "SpaceGrotesk_600SemiBold";
  if (w === "500") return "SpaceGrotesk_500Medium";
  return "SpaceGrotesk_400Regular";
}

function transformTextProps(props: Record<string, unknown>): Record<string, unknown> {
  const styleProp = (props as { style?: unknown }).style;
  const flattened = [styleProp].flat(Infinity).filter(Boolean) as Array<{
    fontWeight?: unknown;
    fontFamily?: unknown;
  }>;
  const hasFontFamily = flattened.some(
    (s) => s && typeof s === "object" && "fontFamily" in s && s.fontFamily,
  );
  if (hasFontFamily) return props;
  const weight = flattened.reduce<unknown>(
    (acc, s) =>
      s && typeof s === "object" && "fontWeight" in s && s.fontWeight
        ? s.fontWeight
        : acc,
    undefined,
  );
  return {
    ...props,
    style: [{ fontFamily: pickFontFamily(weight) }, styleProp],
  };
}

let fontOverrideApplied = false;
function applyDefaultFont() {
  if (fontOverrideApplied) return;
  fontOverrideApplied = true;

  const ReactAny = React as unknown as {
    createElement: typeof React.createElement;
  };
  const originalCreateElement = ReactAny.createElement;
  ReactAny.createElement = function patchedCreateElement(
    type: unknown,
    props: Record<string, unknown> | null | undefined,
    ...children: unknown[]
  ) {
    if (type === Text && props) {
      return originalCreateElement.call(
        this,
        type as React.ElementType,
        transformTextProps(props),
        ...children,
      );
    }
    return originalCreateElement.call(
      this,
      type as React.ElementType,
      props as Record<string, unknown>,
      ...children,
    );
  } as typeof React.createElement;

  const patchJsxFn = (
    mod: Record<string, unknown>,
    name: string,
  ) => {
    const fn = mod[name];
    if (typeof fn !== "function") return;
    const original = fn as (
      type: unknown,
      props: Record<string, unknown> | null | undefined,
      ...rest: unknown[]
    ) => unknown;
    mod[name] = function patchedJsx(
      type: unknown,
      props: Record<string, unknown> | null | undefined,
      ...rest: unknown[]
    ) {
      if (type === Text && props) {
        return original.call(this, type, transformTextProps(props), ...rest);
      }
      return original.call(this, type, props, ...rest);
    };
  };

  // Use require() to get the real singleton module object. `import *` would
  // go through Babel's interopRequireWildcard, which wraps CJS modules in a
  // new object, so mutations wouldn't reach the real jsx-runtime that every
  // other compiled file's JSX calls through.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jsxRuntime = require("react/jsx-runtime") as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jsxDevRuntime = require("react/jsx-dev-runtime") as Record<string, unknown>;
  patchJsxFn(jsxRuntime, "jsx");
  patchJsxFn(jsxRuntime, "jsxs");
  patchJsxFn(jsxDevRuntime, "jsxDEV");
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  if (fontsLoaded && !fontOverrideApplied) {
    applyDefaultFont();
    fontOverrideApplied = true;
  }

  if (!fontsLoaded) return null;

  return (
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
      <FavoritesLayer key="favorites" />
      <AmenitiesLayer key="amenities" amenityTypes={amenityTypeIds} />
      <RouteLineLayer key="route-line" />
    </MapContainer>
  );
}
