export function addGeoJSONLayer(map: maplibregl.Map, sourceId: string, data: GeoJSON.FeatureCollection, layerConfig: maplibregl.LayerSpecification) {
    if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
            type: 'geojson',
            data: data,
        });
    }

    if (!map.getLayer(layerConfig.id)) {
        map.addLayer(layerConfig);
    }
}