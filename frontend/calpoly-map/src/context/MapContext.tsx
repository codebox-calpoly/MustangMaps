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
  mapMode: "buildings" | "amenities" | "routing";
  buildingFilterId: string;
  amenityTypeIds: string[];
  selectedBuilding: SelectedBuilding | null;
  searchQuery: string;
  userLocation: Coordinates | null;
  mapDataLoading: Record<string, boolean>;
  mapDataErrors: Record<string, string | null>;
  mapDataRetryToken: number;
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
  setMapMode: (mode: "buildings" | "amenities" | "routing") => void;
  setBuildingFilterId: (id: string) => void;
  setAmenityTypeIds: (ids: string[]) => void;
  setRouteRequested: (requested: boolean) => void;
  setRouteStartIsCurrentLocation: (value: boolean) => void;
  setMapDataStatus: (
    key: string,
    status: { loading?: boolean; error?: string | null },
  ) => void;
  retryMapData: () => void;
  clearRoute: () => void;
}

const MapContext = createContext<MapContextValue | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode }) {
  // filter state shared across the app
  const [mapMode, setMapMode] =
    useState<"buildings" | "amenities" | "routing">("buildings");
  const [buildingFilterId, setBuildingFilterId] = useState("all");
  const [amenityTypeIds, setAmenityTypeIds] = useState<string[]>([]);
  const [selectedBuilding, setSelectedBuilding] =
    useState<SelectedBuilding | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [mapDataLoading, setMapDataLoading] = useState<Record<string, boolean>>({});
  const [mapDataErrors, setMapDataErrors] = useState<Record<string, string | null>>({});
  const [mapDataRetryToken, setMapDataRetryToken] = useState(0);
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

  const setMapDataStatus = useCallback(
    (key: string, status: { loading?: boolean; error?: string | null }) => {
      if (status.loading !== undefined) {
        setMapDataLoading((prev) => ({ ...prev, [key]: status.loading }));
      }
      if (status.error !== undefined) {
        setMapDataErrors((prev) => ({ ...prev, [key]: status.error }));
      }
    },
    [],
  );

  const retryMapData = useCallback(() => {
    setMapDataRetryToken((prev) => prev + 1);
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
      mapMode,
      buildingFilterId,
      amenityTypeIds,
      selectedBuilding,
      searchQuery,
      userLocation,
      mapDataLoading,
      mapDataErrors,
      mapDataRetryToken,
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
      setMapMode,
      setBuildingFilterId,
      setAmenityTypeIds,
      setRouteRequested,
      setRouteStartIsCurrentLocation,
      setMapDataStatus,
      retryMapData,
      clearRoute,
    }),
    [
      mapMode,
      buildingFilterId,
      amenityTypeIds,
      selectedBuilding,
      searchQuery,
      userLocation,
      mapDataLoading,
      mapDataErrors,
      mapDataRetryToken,
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
      setMapMode,
      setBuildingFilterId,
      setAmenityTypeIds,
      setRouteRequested,
      setRouteStartIsCurrentLocation,
      setMapDataStatus,
      retryMapData,
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
