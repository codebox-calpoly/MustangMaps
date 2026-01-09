import React from 'react';
import { MapView, Camera, setAccessToken } from '@maplibre/maplibre-react-native';
import { StyleSheet } from 'react-native';
import { AmenitiesLayer } from './layers/AmenitiesLayer';

// Disable telemetry
setAccessToken(null);

export function MapContainer({children}: {children?: React.ReactNode}) {
    return (
        <MapView
            style={styles.map}
            mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            logoEnabled={false}
        >
            <Camera
                centerCoordinate={[-120.6596, 35.3050]}
                zoomLevel={15}
            />
            <AmenitiesLayer />
            {children}
        </MapView>
    );
}

const styles = StyleSheet.create({
    map: {
        flex: 1,
    },
});
