import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { Route } from "../types/index";
import {
  findPath,
  type PathfinderResult,
  type PathGraph,
} from "../lib/routing/pathfinder";
import {
  buildDirectionsFromPath,
  type DirectionStep,
} from "../lib/routing/directions";

type Coordinates = [number, number];
export type SelectedBuilding = Feature<Geometry, GeoJsonProperties>;

const STEP_REACHED_THRESHOLD_METERS = 18;
const STEP_PROGRESS_SNAP_METERS = 60;
const DEVIATION_THRESHOLD_METERS = 15;
const REROUTE_COOLDOWN_MS = 2000;

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

/** Shortest distance (meters) from a point to any segment in a path. */
function minDistanceToPath(
  point: Coordinates,
  path: [number, number][],
): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) return distanceBetweenCoordinatesMeters(point, path[0]);

  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length - 1; i++) {
    const dist = pointToSegmentDistance(point, path[i], path[i + 1]);
    if (dist < min) min = dist;
  }
  return min;
}

/**
 * Approximate distance from a point to a line segment using flat‑Earth
 * projection (accurate enough at campus scale).
 */
function pointToSegmentDistance(
  point: Coordinates,
  segA: [number, number],
  segB: [number, number],
): number {
  const toRad = Math.PI / 180;
  const cosLat = Math.cos(((segA[1] + segB[1]) / 2) * toRad);

  // Project to flat meters (lon=x, lat=y)
  const px = (point[0] - segA[0]) * cosLat * 111_320;
  const py = (point[1] - segA[1]) * 111_320;
  const ax = 0;
  const ay = 0;
  const bx = (segB[0] - segA[0]) * cosLat * 111_320;
  const by = (segB[1] - segA[1]) * 111_320;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 0) {
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  }

  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return Math.sqrt(ex * ex + ey * ey);
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
  graph: PathGraph | null;
  setGraph: (graph: PathGraph | null) => void;
  isRerouting: boolean;
  hasArrived: boolean;
  dismissArrival: () => void;
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

  // path graph (set from App.tsx after loading)
  const [graph, setGraph] = useState<PathGraph | null>(null);

  // navigation mode state
  const [navigationMode, setNavigationMode] = useState(false);
  const [navSteps, setNavSteps] = useState<DirectionStep[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isRerouting, setIsRerouting] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const lastRerouteTimeRef = useRef(0);
  const rerouteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep routeStart in sync with live location when starting from current position
  useEffect(() => {
    if (routeStartIsCurrentLocation && userLocation && !navigationMode) {
      setRouteStart(userLocation);
    }
  }, [routeStartIsCurrentLocation, userLocation, navigationMode]);

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

  // Deviation-based rerouting during active navigation
  useEffect(() => {
    if (!navigationMode || !activePath || !userLocation || !graph || !routeEnd) {
      return;
    }

    // Don't reroute if user has reached the arrive step
    const finalStepIdx = navSteps.length - 1;
    if (finalStepIdx >= 0 && activeStepIndex >= finalStepIdx) {
      return;
    }

    const deviation = minDistanceToPath(
      userLocation,
      activePath.path as [number, number][],
    );
    if (deviation <= DEVIATION_THRESHOLD_METERS) {
      return;
    }

    const now = Date.now();
    if (now - lastRerouteTimeRef.current < REROUTE_COOLDOWN_MS) {
      return;
    }
    lastRerouteTimeRef.current = now;

    setIsRerouting(true);
    // Clear any previous dismiss timer
    if (rerouteTimerRef.current) clearTimeout(rerouteTimerRef.current);

    let result = findPath(graph, userLocation, routeEnd);
    if (!result) {
      result = findPath(graph, userLocation, routeEnd, {
        snapRadiusMeters: 150,
      });
    }
    if (!result) {
      setIsRerouting(false);
      return; // keep current route — user may return to path
    }

    setActivePath(result);
    const newSteps = buildDirectionsFromPath(result);
    setNavSteps(newSteps);
    setActiveStepIndex(0);

    // Dismiss rerouting indicator after 2 seconds
    rerouteTimerRef.current = setTimeout(() => {
      setIsRerouting(false);
    }, 2000);
  }, [activeStepIndex, activePath, graph, navigationMode, navSteps.length, routeEnd, userLocation]);

  // Auto-exit navigation when user reaches the destination (arrive step)
  useEffect(() => {
    if (!navigationMode || navSteps.length === 0 || !userLocation) {
      return;
    }

    const lastStep = navSteps[navSteps.length - 1];
    if (lastStep.maneuver !== "arrive") {
      return;
    }

    const distToDestination = distanceBetweenCoordinatesMeters(
      userLocation,
      lastStep.to,
    );
    if (distToDestination <= STEP_REACHED_THRESHOLD_METERS) {
      exitNavigation();
      setHasArrived(true);
    }
  }, [exitNavigation, navigationMode, navSteps, userLocation]);

  const clearRoute = useCallback(() => {
    setRouteStart(null);
    setRouteEnd(null);
    setActivePath(null);
    setRouteError(null);
    setRouteRequested(false);
    setRouteStartIsCurrentLocation(false);
  }, []);

  const dismissArrival = useCallback(() => {
    setHasArrived(false);
    setRouteStart(null);
    setRouteEnd(null);
    setActivePath(null);
    setRouteError(null);
    setRouteRequested(false);
    setRouteStartIsCurrentLocation(false);
    setRouteDestination(null);
    setActiveRoute(null);
    setMapMode("buildings");
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
      graph,
      setGraph,
      isRerouting,
      hasArrived,
      dismissArrival,
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
      graph,
      isRerouting,
      hasArrived,
      dismissArrival,
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
