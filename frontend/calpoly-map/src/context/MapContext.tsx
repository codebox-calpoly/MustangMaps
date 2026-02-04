import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import * as Location from "expo-location";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { Route } from "../types/index";
import type { PathfinderResult } from "../lib/routing/pathfinder";

type Coordinates = [number, number];
export type SelectedBuilding = Feature<Geometry, GeoJsonProperties>;

interface MapContextValue {
  selectedBuilding: SelectedBuilding | null;
  searchQuery: string;
  userLocation: Coordinates | null;
  activeRoute: Route | null;
  routeDestination: SelectedBuilding | null;
  routeStart: Coordinates | null;
  routeEnd: Coordinates | null;
  activePath: PathfinderResult | null;
  routeError: string | null;
  routingActive: boolean;
  routeRequested: boolean;
  routeStartIsCurrentLocation: boolean;
  selectBuilding: (building: SelectedBuilding) => void;
  clearSelection: () => void;
  setRoute: (route: Route | null) => void;
  setRouteDestination: (building: SelectedBuilding | null) => void;
  setSearchQuery: (query: string) => void;
  setUserLocation: (location: Coordinates | null) => void;
  setRouteStart: (location: Coordinates | null) => void;
  setRouteEnd: (location: Coordinates | null) => void;
  setActivePath: (route: PathfinderResult | null) => void;
  setRouteError: (message: string | null) => void;
  setRoutingActive: (active: boolean) => void;
  setRouteRequested: (requested: boolean) => void;
  setRouteStartIsCurrentLocation: (value: boolean) => void;
  clearRoute: () => void;
}

const MapContext = createContext<MapContextValue | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode }) {
  const [selectedBuilding, setSelectedBuilding] =
    useState<SelectedBuilding | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [routeDestination, setRouteDestination] =
    useState<SelectedBuilding | null>(null);
  const [routeStart, setRouteStart] = useState<Coordinates | null>(null);
  const [routeEnd, setRouteEnd] = useState<Coordinates | null>(null);
  const [activePath, setActivePath] = useState<PathfinderResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routingActive, setRoutingActive] = useState(false);
  const [routeRequested, setRouteRequested] = useState(false);
  const [routeStartIsCurrentLocation, setRouteStartIsCurrentLocation] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          return;
        }
        const { coords } = await Location.getCurrentPositionAsync({});
        if (!cancelled && coords) {
          setUserLocation([coords.longitude, coords.latitude]);
        }
      } catch {
        // ignore location errors; routing will still work with manual points
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectBuilding = useCallback((building: SelectedBuilding) => {
    setSelectedBuilding(building);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBuilding(null);
  }, []);

  const setRoute = useCallback((route: Route | null) => {
    setActiveRoute(route);
  }, []);

  const clearRoute = useCallback(() => {
    setRouteStart(null);
    setRouteEnd(null);
    setActivePath(null);
    setRouteError(null);
    setRouteRequested(false);
    setRouteStartIsCurrentLocation(false);
  }, []);

  const value = useMemo(
    () => ({
      selectedBuilding,
      searchQuery,
      userLocation,
      activeRoute,
      routeDestination,
      routeStart,
      routeEnd,
      activePath,
      routeError,
      routingActive,
      routeRequested,
      routeStartIsCurrentLocation,
      selectBuilding,
      clearSelection,
      setRoute,
      setRouteDestination,
      setSearchQuery,
      setUserLocation,
      setRouteStart,
      setRouteEnd,
      setActivePath,
      setRouteError,
      setRoutingActive,
      setRouteRequested,
      setRouteStartIsCurrentLocation,
      clearRoute,
    }),
    [
      selectedBuilding,
      searchQuery,
      userLocation,
      activeRoute,
      routeDestination,
      routeStart,
      routeEnd,
      activePath,
      routeError,
      routingActive,
      routeRequested,
      routeStartIsCurrentLocation,
      selectBuilding,
      clearSelection,
      setRoute,
      setRouteDestination,
      setRouteStart,
      setRouteEnd,
      setActivePath,
      setRouteError,
      setRoutingActive,
      setRouteRequested,
      setRouteStartIsCurrentLocation,
      clearRoute,
    ],
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMapContext() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMapContext must be used within MapProvider");
  }
  return context;
}
