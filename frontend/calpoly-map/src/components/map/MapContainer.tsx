import {useEffect, useRef} from 'react';
import maplibregl from 'maplibre-gl';
import { BuildingLayer } from './layers/BuildingLayer';

export function MapContainer({children}) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    useEffect(() => {
        if (!mapContainerRef.current) return;
        
        mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [-120.6596, 35.3050],
        zoom: 15,
        });

        return () => mapRef.current?.remove();
    }, []);

    return (
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }}>
          <BuildingLayer />
        </div>
    );
}