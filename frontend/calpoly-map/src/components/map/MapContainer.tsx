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
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Cal Poly campus bbox (with a little margin). Pins outside this are rejected
// to keep shared links from pointing somewhere unrelated to campus.
const CAL_POLY_BBOX = {
  minLat: 35.295,
  maxLat: 35.315,
  minLng: -120.680,
  maxLng: -120.645,
};

interface ParsedShareLink {
  coord: [number, number];
  note: string;
}

function parseShareLink(rawUrl: string): ParsedShareLink | null {
  // Accept either the Universal Link or the custom scheme.
  //   https://mustangmaps.vercel.app/p?lat=...&lng=...&n=...
  //   mustangmaps://p?lat=...&lng=...&n=...
  const match = rawUrl.match(
    /^(?:https:\/\/mustangmaps\.vercel\.app\/p\/?|mustangmaps:\/\/p\/?)\??(.*)$/i,
  );
  if (!match) return null;
  const params = new URLSearchParams(match[1] ?? "");
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < CAL_POLY_BBOX.minLat || lat > CAL_POLY_BBOX.maxLat) return null;
  if (lng < CAL_POLY_BBOX.minLng || lng > CAL_POLY_BBOX.maxLng) return null;
  return { coord: [lng, lat], note: params.get("n") ?? "" };
}
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
import { useUserLocation } from "../../context/UserLocationContext";
import { useSavedPlaces } from "../../context/SavedPlacesContext";

import UserLocationMarker from "./markers/UserLocationMarker";
import { AmenityPopup } from "./AmenityPopup";
import { BlueprintViewer } from "./BlueprintViewer";
import { DropPinCard } from "./DropPinCard";
import { BLUEPRINT_OSM_IDS } from "../../config/blueprints.generated";

const SHARE_BASE_URL = "https://mustangmaps.vercel.app/p";

import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
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
    routeDestination,
    setRouteDestination,
    setRouteEnd,
    setRouteRequested,
    routingActive,
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
  const { favorites } = useSavedPlaces();

  const userLocation =
    latitude != null && longitude != null ? [longitude, latitude] : null;

  const [followUser, setFollowUser] = useState<boolean>(false);

  const [tapMarkerCoord, setTapMarkerCoord] = useState<[number, number] | null>(null);
  const [sharePin, setSharePin] = useState<[number, number] | null>(null);
  const [sharePinNote, setSharePinNote] = useState<string>("");
  const [sharePinReceived, setSharePinReceived] = useState<boolean>(false);
  const pendingCenterRef = useRef<[number, number] | null>(null);

  const [classroomFinderVisible, setClassroomFinderVisible] = useState(false);
  const [classroomFinderBuilding, setClassroomFinderBuilding] =
    useState<Feature<Geometry, GeoJsonProperties> | null>(null);

  useEffect(() => {
    if (latitude == null || longitude == null) {
      return;
    }
    setUserLocation([longitude, latitude]);
    setLocationAccuracy(accuracy);
  }, [latitude, longitude, accuracy, setUserLocation, setLocationAccuracy]);

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

  const tapMarkerGeoJSON = useMemo<FeatureCollection<Point> | null>(() => {
    if (!tapMarkerCoord) return null;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: tapMarkerCoord },
        },
      ],
    };
  }, [tapMarkerCoord]);

  const sharePinGeoJSON = useMemo<FeatureCollection<Point> | null>(() => {
    if (!sharePin) return null;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: sharePin },
        },
      ],
    };
  }, [sharePin]);

  const getFeatureBounds = useCallback(
    (
      feature: Feature<Geometry, GeoJsonProperties>,
    ): { ne: [number, number]; sw: [number, number] } | null => {
      const geom = feature.geometry;

      let ring: number[][] | null = null;

      if (geom.type === "Polygon") {
        ring = geom.coordinates[0] ?? null;
      } else if (geom.type === "MultiPolygon") {
        ring = geom.coordinates[0]?.[0] ?? null;
      }

      if (!ring || ring.length === 0) {
        return null;
      }

      let minLng = Infinity;
      let maxLng = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;

      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }

      return {
        ne: [maxLng, maxLat],
        sw: [minLng, minLat],
      };
    },
    [],
  );

  const getBuildingFeatureId = useCallback(
    (feature: Feature<Geometry, GeoJsonProperties> | null): string | null => {
      if (!feature) return null;

      const rootId =
        typeof (feature as any).id === "string" ? (feature as any).id : null;

      const propId =
        typeof feature.properties?.["@id"] === "string"
          ? String(feature.properties?.["@id"])
          : null;

      return rootId ?? propId ?? null;
    },
    [],
  );

  const destinationMarker = useMemo<FeatureCollection<Point> | null>(
    () => (routingActive ? buildSelectedBuildingMarker(routeDestination) : null),
    [routingActive, routeDestination],
  );

  const selectedBuildingIsFavorite = useMemo(() => {
    if (!selectedBuilding) {
      return false;
    }

    const center = featureCenter(selectedBuilding);
    if (!center) {
      return false;
    }

    const name = String(selectedBuilding.properties?.name ?? "Unknown");
    const selectedRef = selectedBuilding.properties?.ref;

    if (selectedRef) {
      const matchedByRef = favorites.some((item) => {
        const favoriteRef = item.ref;
        return Boolean(favoriteRef) && favoriteRef === selectedRef;
      });
      if (matchedByRef) {
        return true;
      }
    }

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
  }, [selectedBuilding, favorites, featureCenter]);

  const searchPanelHeight = useSharedValue<number>(0);
  const windowHeight = Dimensions.get("window").height;

  const locationButtonStyle = useAnimatedStyle(() => {
    const buttonTop = 175;
    const sheetTop = searchPanelHeight.value;
    return {
      opacity: sheetTop < buttonTop + 44 ? 0 : 1,
      pointerEvents: sheetTop < buttonTop + 44 ? ("none" as const) : ("auto" as const),
    };
  }, []);

  const recenterSeqRef = useRef(0);

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
    [mapReady, windowHeight],
  );

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

      // Ignore building taps while the classroom finder is open so
      // tapping on the map doesn't place a red marker.
      if (classroomFinderVisible) return;

      // Handle building press from BuildingLayer
      const properties = feature.properties;
      if (properties && (properties.building || properties.amenity)) {
        featureJustSelectedRef.current = true;
        setTimeout(() => { featureJustSelectedRef.current = false; }, 200);
        setTapMarkerCoord(null);
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

      if (onBuildingPress) {
        onBuildingPress(feature);
      }
    },
    [classroomFinderVisible, featureCenter, handleCameraMove, onBuildingPress, selectBuilding, trackingMode],
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

  const handleMapLongPress = useCallback(
    (feature: Feature<Geometry, GeoJsonProperties>) => {
      const coords = (feature.geometry as any)?.coordinates;
      if (!Array.isArray(coords) || coords.length !== 2) return;
      const [lng, lat] = coords;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      setSharePin([lng, lat]);
      setSharePinNote("");
      setSharePinReceived(false);
      setTapMarkerCoord(null);
    },
    [],
  );

  const handleDeepLink = useCallback((rawUrl: string) => {
    const parsed = parseShareLink(rawUrl);
    if (!parsed) return;

    setSharePin(parsed.coord);
    setSharePinNote(parsed.note);
    setSharePinReceived(true);
    setTapMarkerCoord(null);

    if (mapReadyRef.current && cameraRef.current) {
      try {
        cameraRef.current.setCamera({
          centerCoordinate: parsed.coord,
          zoomLevel: 18,
          animationDuration: 800,
        });
      } catch (e) {
        console.warn("Deep link camera error:", e);
      }
    } else {
      pendingCenterRef.current = parsed.coord;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Linking.getInitialURL()
      .then((url) => {
        if (!cancelled && url) handleDeepLink(url);
      })
      .catch(() => {});
    const sub = Linking.addEventListener("url", (event) => {
      if (event?.url) handleDeepLink(event.url);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [handleDeepLink]);

  useEffect(() => {
    if (!mapReady) return;
    const pending = pendingCenterRef.current;
    if (!pending) return;
    pendingCenterRef.current = null;
    try {
      cameraRef.current?.setCamera({
        centerCoordinate: pending,
        zoomLevel: 18,
        animationDuration: 800,
      });
    } catch (e) {
      console.warn("Deferred deep link camera error:", e);
    }
  }, [mapReady]);

  const handleSharePin = useCallback(
    async (note: string) => {
      if (!sharePin) return;
      const [lng, lat] = sharePin;
      const params = `lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}` +
        (note ? `&n=${encodeURIComponent(note)}` : "");
      const url = `${SHARE_BASE_URL}?${params}`;
      try {
        // Send only the URL — receiving messengers will render a single
        // link bubble with their own preview, instead of fragmenting into
        // separate "text + url + link preview" messages.
        await Share.share({ message: url });
      } catch (e) {
        console.warn("Share failed:", e);
      }
    },
    [sharePin],
  );

  const handleDismissSharePin = useCallback(() => {
    setSharePin(null);
    setSharePinReceived(false);
  }, []);

  const handleMapPress = useCallback(
    async (feature: Feature<Geometry, GeoJsonProperties>) => {
      const map = mapRef.current;
      if (!map) return;

      // ShapeSource.onPress fires before MapView.onPress for the same tap.
      // Skip clearing when a building/amenity was just selected.
      if (featureJustSelectedRef.current) return;

      // Don't clear zone selection while the classroom finder is open —
      // taps on the bottom-sheet list can propagate through to the map.
      if (classroomFinderVisible) return;

      // If we reach here, ShapeSource.onPress did NOT select a building
      // (featureJustSelectedRef would have blocked us). Clear any existing
      // selection so the user can tap away to deselect.
      clearSelection();

      // Place a generic tap marker where the user tapped (only for non-building areas)
      const properties = feature.properties;
      if (!properties || (!properties.building && !properties.amenity)) {
        const coords = (feature.geometry as any)?.coordinates;
        if (Array.isArray(coords) && coords.length === 2) {
          setTapMarkerCoord([coords[0], coords[1]]);
        }
      }

      clearAmenitySelection();

      if (onMapPress) {
        onMapPress(feature);
      }
    },
    [classroomFinderVisible, clearAmenitySelection, clearSelection, onMapPress],
  );

  const buildingsWithBlueprints = BLUEPRINT_OSM_IDS;

  const handleOpenClassroomFinder = useCallback(
    (building: Feature<Geometry, GeoJsonProperties>) => {
      setClassroomFinderBuilding(building);
      setClassroomFinderVisible(true);
      setTapMarkerCoord(null);
      clearSelection();
    },
    [clearSelection],
  );

  const handleCloseClassroomFinder = useCallback(() => {
    setClassroomFinderVisible(false);
    setClassroomFinderBuilding(null);
    setTapMarkerCoord(null);
  }, []);

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
        onLongPress={handleMapLongPress}
        onDidFinishLoadingMap={() => {
          mapRef.current?.setSourceVisibility(false, "carto", "building");
          mapRef.current?.setSourceVisibility(false, "carto", "path");
          mapRef.current?.setSourceVisibility(false, "carto", "track");
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
          <ShapeSource id="selected-building-marker-source" shape={selectedBuildingMarker} hitbox={{ width: 0, height: 0 }}>
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
        {tapMarkerGeoJSON && !selectedBuilding && !classroomFinderVisible && (
          <ShapeSource id="tap-marker-source" shape={tapMarkerGeoJSON} hitbox={{ width: 0, height: 0 }}>
            <CircleLayer
              id="tap-marker"
              style={{
                circleRadius: 10,
                circleColor: "#EF4444",
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 3,
              }}
            />
          </ShapeSource>
        )}
        {sharePinGeoJSON && (
          <ShapeSource id="share-pin-source" shape={sharePinGeoJSON} hitbox={{ width: 0, height: 0 }}>
            <CircleLayer
              id="share-pin-halo"
              style={{
                circleRadius: 18,
                circleColor: "#F59E0B",
                circleOpacity: 0.25,
              }}
            />
            <CircleLayer
              id="share-pin"
              style={{
                circleRadius: 11,
                circleColor: "#F59E0B",
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 3,
              }}
            />
          </ShapeSource>
        )}
        {destinationMarker && (
          <ShapeSource id="destination-marker-source" shape={destinationMarker} hitbox={{ width: 0, height: 0 }}>
            <CircleLayer
              id="destination-marker"
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

      {classroomFinderVisible ? (
        <BlueprintViewer
          visible={classroomFinderVisible}
          osmId={getBuildingFeatureId(classroomFinderBuilding)}
          onClose={handleCloseClassroomFinder}
          bottomSheetPosition={searchPanelHeight}
        />
      ) : (
        <SearchPanel
          cameraMove={handleCameraMove}
          cameraFitRoute={handleCameraFitRoute}
          bottomSheetPosition={searchPanelHeight}
          onNavigate={handleNavigate}
          onOpenClassroomFinder={handleOpenClassroomFinder}
          buildingsWithBlueprints={buildingsWithBlueprints}
        />
      )}

      <Animated.View style={[styles.locationButtonContainer, locationButtonStyle]}>
        <UserLocationButton />
      </Animated.View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Map attributions"
        onPress={() => {
          Alert.alert(
            "Credits & Attributions",
            "Map data © OpenStreetMap contributors (ODbL).\n" +
              "Basemap tiles © CARTO.\n" +
              "Floor plans courtesy of Cal Poly Facilities Management & Development.\n\n" +
              "MustangMaps is an independent student project and is not affiliated with, endorsed by, or sponsored by California Polytechnic State University.",
            [
              {
                text: "OpenStreetMap",
                onPress: () =>
                  Linking.openURL("https://www.openstreetmap.org/copyright"),
              },
              {
                text: "CARTO",
                onPress: () => Linking.openURL("https://carto.com/attributions"),
              },
              {
                text: "Cal Poly Facilities",
                onPress: () =>
                  Linking.openURL(
                    "https://afd.calpoly.edu/facilities/spacefacility/space_data.asp",
                  ),
              },
              { text: "Close", style: "cancel" },
            ],
          );
        }}
        style={({ pressed }) => [
          styles.attributionButton,
          mapStyle === "dark" && styles.attributionButtonDark,
          pressed && { opacity: 0.7 },
        ]}
        hitSlop={8}
      >
        <Text
          style={[
            styles.attributionButtonText,
            mapStyle === "dark" && styles.attributionButtonTextDark,
          ]}
        >
          ⓘ
        </Text>
      </Pressable>

      <AmenityPopup
        visible={!!selectedAmenity}
        amenity={selectedAmenity}
        levels={amenityLevels}
        onClose={clearAmenitySelection}
        onNavigate={handleNavigate}
      />

      <DropPinCard
        visible={sharePin !== null}
        topInset={140}
        initialNote={sharePinNote}
        readOnly={sharePinReceived}
        onShare={handleSharePin}
        onDismiss={handleDismissSharePin}
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
  attributionButton: {
    position: "absolute",
    right: 16,
    top: 227,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    zIndex: 3,
  },
  attributionButtonDark: {
    backgroundColor: "#1C1F26",
    borderColor: "#3A4048",
  },
  attributionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  attributionButtonTextDark: {
    color: "#9CA3AF",
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