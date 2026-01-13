import React from 'react';
import { MapView, Camera, setAccessToken } from '@maplibre/maplibre-react-native';
import { StyleSheet } from 'react-native';

// Disable telemetry
setAccessToken(null);

// where map starts (center)
const CENTER: [number, number] = [-120.6596, 35.3010];

// bounds for map
const BOUNDS = {
  sw: [-120.6756, 35.2949] as [number, number],
  ne: [-120.6438, 35.3162] as [number, number],
};

export function MapContainer({children}: {children?: React.ReactNode}) {
    return (
        <MapView
            style={styles.map}
            mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            logoEnabled={false}
            scrollEnabled
            zoomEnabled
        >
            <Camera
                defaultSettings={{
                    centerCoordinate: CENTER,
                    zoomLevel: 15
                    }}
                maxBounds={BOUNDS}
            />
            {children}
        </MapView>
    );
}

const styles = StyleSheet.create({
    map: {
        flex: 1,
    },
});
