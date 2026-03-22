import React, { useCallback, useMemo } from "react";
import type { FeatureCollection, GeoJsonProperties, Point } from "geojson";
import {
  Images,
  ShapeSource,
  SymbolLayer,
} from "@maplibre/maplibre-react-native";
import { useSavedPlaces } from "../../../context/SavedPlacesContext";
import { useMapContext } from "../../../context/MapContext";
import geoData from "../../features/search/test.json";

const FAVORITE_ICONS: Record<string, any> = {
  "favorite-star": require("../../../../assets/icons/favorites.png"),
};

// Stable empty collection so the native ShapeSource doesn't churn on mode switches.
const EMPTY_FC: FeatureCollection<Point, GeoJsonProperties> = {
  type: "FeatureCollection",
  features: [],
};

export function FavoritesLayer({
  onBuildingPress,
}: {
  onBuildingPress?: (feature: any) => void;
}) {
  const { favorites } = useSavedPlaces();
  const { mapMode } = useMapContext();

  const favoritePoints = useMemo<FeatureCollection<
    Point,
    GeoJsonProperties
  >>(() => {
    if (mapMode !== "buildings") return EMPTY_FC;

    const features = favorites
      .filter((place) => place.id !== "my-location")
      .map((place) => ({
        type: "Feature" as const,
        properties: {
          id: place.id,
          name: place.name,
          building: "saved_favorite",
          ref: place.ref,
        },
        geometry: {
          type: "Point" as const,
          coordinates: place.coordinate,
        },
      }));

    return {
      type: "FeatureCollection",
      features,
    };
  }, [favorites, mapMode]);

  const handlePress = useCallback(
    (event: any) => {
      if (!event.features || event.features.length === 0) return;
      const tapped = event.features[0];
      const tappedRef = String(tapped?.properties?.ref ?? "");
      const tappedName = String(tapped?.properties?.name ?? "");

      const matchedFeature = geoData.features.find((feature: any) => {
        const featureRef = String(feature?.properties?.ref ?? "");
        const featureName = String(feature?.properties?.name ?? "");
        if (tappedRef.length > 0 && featureRef.length > 0) {
          return tappedRef === featureRef;
        }
        return tappedName.length > 0 && tappedName === featureName;
      });

      onBuildingPress?.(matchedFeature ?? tapped);
      return true;
    },
    [onBuildingPress],
  );

  return (
    <>
      <Images images={FAVORITE_ICONS} />
      <ShapeSource
        id="favorites-source"
        shape={favoritePoints}
        onPress={handlePress}
        hitbox={{ width: 1, height: 1 }}
      >
        <SymbolLayer
          id="favorites-marker-icon"
          style={{
            iconImage: "favorite-star",
            iconSize: [
              "interpolate",
              ["linear"],
              ["zoom"],
              13, 0.2,   // At zoom 13, 20% size
              15, 0.3,   // At zoom 15, 30% size
              17, 0.4,   // At zoom 17, 40% size
              19, 0.5,
            ] as any,
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
            iconAnchor: "center",
          }}
        />
      </ShapeSource>
    </>
  );
}
