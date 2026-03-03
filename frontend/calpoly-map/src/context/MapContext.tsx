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
import {
  buildDirectionsFromPath,
  type DirectionStep,
} from "../lib/routing/directions";

type Coordinates = [number, number];
export type SelectedBuilding = Feature<Geometry, GeoJsonProperties>;

const STEP_REACHED_THRESHOLD_METERS = 18;
const STEP_PROGRESS_SNAP_METERS = 60;

function distanceBetweenCoordinatesMeters(
  from: Coordinates,
  to: Coordinates,
) {
  const toRadians = Math.PI / 180;
  const lat1 = from[1] * toRadians;
  const lat2 = to[1] * toRadians;
  const latDelta = (to[1] - from[1]) * toRadians;
  const lonDelta = (to[0] - from[0]) * toRadians;

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(lonDelta / 2) *
      Math.sin(lonDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6_371_000 * c;
}

interface MapContextValue {
  mapMode: "buildings" | "amenities" | "routing";
  mapStyle: "light" | "dark";
  buildingTypeIds: string[];
  amenityTypeIds: string[];
  selectedBuilding: SelectedBuilding | null;
  selectedAmenity: Feature<Geometry, GeoJsonProperties> | null;
  amenityLevels: number[];
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
  selectAmenity: (amenity: Feature<Geometry, GeoJsonProperties>, levels: number[]) => void;
  clearAmenitySelection: () => void;
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
  setMapStyle: (style: "light" | "dark") => void;
  setBuildingTypeIds: (ids: string[]) => void;
  setAmenityTypeIds: (ids: string[]) => void;
  setRouteRequested: (requested: boolean) => void;
  setRouteStartIsCurrentLocation: (value: boolean) => void;
  setMapDataStatus: (
    key: string,
    status: { loading?: boolean; error?: string | null },
  ) => void;
  retryMapData: () => void;
  clearRoute: () => void;
  navigationMode: boolean;
  navSteps: DirectionStep[];
  activeStepIndex: number;
  startNavigation: () => void;
  exitNavigation: () => void;
}

const MapContext = createContext<MapContextValue | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode }) {
  // filter state shared across the app
  const [mapMode, setMapMode] =
    useState<"buildings" | "amenities" | "routing">("buildings");
  const [mapStyle, setMapStyle] = useState<"light" | "dark">("light");
  const [buildingTypeIds, setBuildingTypeIds] = useState<string[]>([]);
  const [amenityTypeIds, setAmenityTypeIds] = useState<string[]>([]);
  const [selectedBuilding, setSelectedBuilding] =
    useState<SelectedBuilding | null>(null);
  const [selectedAmenity, setSelectedAmenity] =
    useState<Feature<Geometry, GeoJsonProperties> | null>(null);
  const [amenityLevels, setAmenityLevels] = useState<number[]>([]);
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

  // navigation mode state
  const [navigationMode, setNavigationMode] = useState(false);
  const [navSteps, setNavSteps] = useState<DirectionStep[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

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

  const selectAmenity = useCallback(
    (amenity: Feature<Geometry, GeoJsonProperties>, levels: number[]) => {
      setSelectedAmenity(amenity);
      setAmenityLevels(levels);
    },
    [],
  );

  const clearAmenitySelection = useCallback(() => {
    setSelectedAmenity(null);
    setAmenityLevels([]);
  }, []);

  const setRoute = useCallback((route: Route | null) => {
    setActiveRoute(route);
  }, []);

  const setMapDataStatus = useCallback(
    (key: string, status: { loading?: boolean; error?: string | null }) => {
      if (status.loading !== undefined) {
        const loading = status.loading;
        setMapDataLoading((prev) => ({ ...prev, [key]: loading }));
      }
      if (status.error !== undefined) {
        const error = status.error;
        setMapDataErrors((prev) => ({ ...prev, [key]: error }));
      }
    },
    [],
  );

  const retryMapData = useCallback(() => {
    setMapDataRetryToken((prev) => prev + 1);
  }, []);

  const startNavigation = useCallback(() => {
    if (!activePath) return;

    const steps = buildDirectionsFromPath(activePath);

    setNavSteps(steps);
    setActiveStepIndex(0);
    setNavigationMode(true);
  }, [activePath]);

  const exitNavigation = useCallback(() => {
    setNavigationMode(false);
    setNavSteps([]);
    setActiveStepIndex(0);
  }, []);

  useEffect(() => {
    if (!navigationMode || navSteps.length === 0 || !userLocation) {
      return;
    }

    const finalStepIndex = navSteps.length - 1;
    if (activeStepIndex >= finalStepIndex) {
      return;
    }

    let nextStepIndex = activeStepIndex;
    while (nextStepIndex < finalStepIndex) {
      const step = navSteps[nextStepIndex];
      const distanceToStepEnd = distanceBetweenCoordinatesMeters(
        userLocation,
        step.to,
      );
      if (distanceToStepEnd > STEP_REACHED_THRESHOLD_METERS) {
        break;
      }
      nextStepIndex += 1;
    }

    if (nextStepIndex === activeStepIndex) {
      let nearestForwardIndex = activeStepIndex;
      let nearestForwardDistance = Number.POSITIVE_INFINITY;

      for (let index = activeStepIndex; index <= finalStepIndex; index += 1) {
        const distanceToStepEnd = distanceBetweenCoordinatesMeters(
          userLocation,
          navSteps[index].to,
        );
        if (distanceToStepEnd < nearestForwardDistance) {
          nearestForwardDistance = distanceToStepEnd;
          nearestForwardIndex = index;
        }
      }

      if (
        nearestForwardIndex > activeStepIndex &&
        nearestForwardDistance <= STEP_PROGRESS_SNAP_METERS
      ) {
        nextStepIndex = nearestForwardIndex;
      }
    }

    if (nextStepIndex !== activeStepIndex) {
      setActiveStepIndex(nextStepIndex);
    }
  }, [activeStepIndex, navSteps, navigationMode, userLocation]);

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
      mapStyle,
      buildingTypeIds,
      amenityTypeIds,
      selectedBuilding,
      selectedAmenity,
      amenityLevels,
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
      selectAmenity,
      clearAmenitySelection,
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
      setMapStyle,
      setBuildingTypeIds,
      setAmenityTypeIds,
      setRouteRequested,
      setRouteStartIsCurrentLocation,
      setMapDataStatus,
      retryMapData,
      clearRoute,
      navigationMode,
      navSteps,
      activeStepIndex,
      startNavigation,
      exitNavigation,
    }),
    [
      mapMode,
      mapStyle,
      buildingTypeIds,
      amenityTypeIds,
      selectedBuilding,
      selectedAmenity,
      amenityLevels,
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
      selectAmenity,
      clearAmenitySelection,
      setRoute,
      setRouteDestination,
      setRouteStart,
      setRouteEnd,
      setActivePath,
      setRouteError,
      setRoutingActive,
      setMapMode,
      setMapStyle,
      setBuildingTypeIds,
      setAmenityTypeIds,
      setRouteRequested,
      setRouteStartIsCurrentLocation,
      setMapDataStatus,
      retryMapData,
      clearRoute,
      navigationMode,
      navSteps,
      activeStepIndex,
      startNavigation,
      exitNavigation,
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
