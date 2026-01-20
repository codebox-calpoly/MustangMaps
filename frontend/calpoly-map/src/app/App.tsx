import React, { useRef, useState } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MapContainer } from '../components/map/MapContainer';
import { BuildingLayer } from '../components/map/layers/BuildingLayer';

export default function App() {
  const [selected, setSelected] = useState<SelectedBuilding | null>(null);

  const suppressNextMapPress = useRef(false);

  const onSelectBuilding = (b: SelectedBuilding) => {
    suppressNextMapPress.current = true;
    setTimeout(() => (suppressNextMapPress.current = false), 0);
    setSelected(b);
  };

  const onMapPress = (_e: OnPressEvent) => {
    if (suppressNextMapPress.current) return;
    setSelected(null);
  };

  const name = selected?.properties?.name ?? "Building";
  const ref = selected?.properties?.ref;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <MapContainer>
          <BuildingLayer />
        </MapContainer> 
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  popup: {
    maxWidth: 240,
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  title: { fontWeight: "700", fontSize: 14, marginBottom: 3, color: "#111827" },
  body: { fontSize: 12, color: "#374151" },
});

