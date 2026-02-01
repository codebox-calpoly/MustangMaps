import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
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
  routeStart: Coordinates | null;
  routeEnd: Coordinates | null;
  activePath: PathfinderResult | null;
  routeError: string | null;
  selectBuilding: (building: SelectedBuilding) => void;
  clearSelection: () => void;
  setRoute: (route: Route | null) => void;
  setSearchQuery: (query: string) => void;
  setUserLocation: (location: Coordinates | null) => void;
  setRouteStart: (location: Coordinates | null) => void;
  setRouteEnd: (location: Coordinates | null) => void;
  setActivePath: (route: PathfinderResult | null) => void;
  setRouteError: (message: string | null) => void;
  clearRoute: () => void;
}

const MapContext = createContext<MapContextValue | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode }) {
  const [selectedBuilding, setSelectedBuilding] =
    useState<SelectedBuilding | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [routeStart, setRouteStart] = useState<Coordinates | null>(null);
  const [routeEnd, setRouteEnd] = useState<Coordinates | null>(null);
  const [activePath, setActivePath] = useState<PathfinderResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

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
  }, []);

  const value = useMemo(
    () => ({
      selectedBuilding,
      searchQuery,
      userLocation,
      activeRoute,
      routeStart,
      routeEnd,
      activePath,
      routeError,
      selectBuilding,
      clearSelection,
      setRoute,
      setSearchQuery,
      setUserLocation,
      setRouteStart,
      setRouteEnd,
      setActivePath,
      setRouteError,
      clearRoute,
    }),
    [
      selectedBuilding,
      searchQuery,
      userLocation,
      activeRoute,
      routeStart,
      routeEnd,
      activePath,
      routeError,
      selectBuilding,
      clearSelection,
      setRoute,
      setRouteStart,
      setRouteEnd,
      setActivePath,
      setRouteError,
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
