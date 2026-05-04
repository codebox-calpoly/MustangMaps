import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import type { SharedValue } from "react-native-reanimated";
import { Gallery } from "react-native-zoom-toolkit";
import { useMapContext } from "../../context/MapContext";
import { BLUEPRINTS } from "../../config/blueprints.generated";

interface BlueprintViewerProps {
  visible: boolean;
  osmId: string | null;
  onClose: () => void;
  bottomSheetPosition: SharedValue<number>;
}

export function BlueprintViewer({
  visible,
  osmId,
  onClose,
  bottomSheetPosition,
}: BlueprintViewerProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const { mapStyle } = useMapContext();
  const dark = mapStyle === "dark";

  const snapPoints = useMemo(() => ["50%", "85%"], []);

  const [activeIdx, setActiveIdx] = useState(0);
  const [pageIdx, setPageIdx] = useState(0);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  // Once Gallery is measured we lock its host's dimensions. Otherwise any
  // sibling re-render (page index changing, sheet settling, sub-pixel Yoga
  // rounding) refires the host's onLayout, which propagates to Gallery's
  // useAnimatedReaction(rootSize, () => reset(...)) and yanks scale back to 1
  // mid-pinch.
  const measuredRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      sheetRef.current?.close();
      setActiveIdx(0);
      setPageIdx(0);
      measuredRef.current = false;
      setSize({ width: 0, height: 0 });
    }
  }, [visible]);

  // Reset page + building index whenever the building changes.
  useEffect(() => {
    setActiveIdx(0);
    setPageIdx(0);
  }, [osmId]);

  const buildings = osmId ? BLUEPRINTS[osmId] : undefined;
  const active = buildings?.[activeIdx];
  // Memoised so Gallery's `data` prop has a stable reference between renders;
  // the Reanimated worklets inside Gallery interrupt mid-gesture if data
  // arrays are reallocated each render.
  const pages = useMemo(() => active?.pages ?? [], [active?.pages]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (measuredRef.current || width <= 0 || height <= 0) return;
    measuredRef.current = true;
    setSize({ width, height });
  }, []);

  // Fixed dimensions once measured — kills the reset-on-relayout loop in
  // GalleryGestureHandler. flex: 1 (the default in styles.galleryHost) lets
  // the very first layout pass measure us; after that we never rely on flex
  // again.
  const galleryHostStyle = useMemo(
    () =>
      size.width > 0 && size.height > 0
        ? [
            styles.galleryHost,
            dark && styles.galleryHostDark,
            { flex: 0, width: size.width, height: size.height },
          ]
        : [styles.galleryHost, dark && styles.galleryHostDark],
    [dark, size.width, size.height],
  );

  // Render the image at its natural aspect, sized to fit inside the slot,
  // and let Gallery's internal `justifyContent: center` wrapper position it.
  // Returning a wrapper View here would make Gallery measure the wrapper
  // (= slot bounds) for gesture math, breaking pinch focus on letterboxed
  // images.
  const renderPage = useCallback(
    (item: any) => {
      const src = Image.resolveAssetSource(item);
      const ratio =
        src && src.width && src.height ? src.width / src.height : 1;
      const slotRatio = size.width / Math.max(1, size.height);
      let w: number;
      let h: number;
      if (ratio > slotRatio) {
        w = size.width;
        h = size.width / ratio;
      } else {
        h = size.height;
        w = size.height * ratio;
      }
      return (
        <Image
          source={item}
          style={{ width: w, height: h }}
          resizeMethod="scale"
        />
      );
    },
    [size.width, size.height],
  );

  const keyForPage = useCallback((_item: any, i: number) => `page-${i}`, []);

  if (!visible) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      animatedPosition={bottomSheetPosition}
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={dark ? { backgroundColor: "#1C1F26" } : undefined}
      handleIndicatorStyle={dark ? { backgroundColor: "#6B7280" } : undefined}
    >
      <View style={[styles.container, dark && styles.containerDark]}>
        <View style={[styles.header, dark && styles.headerDark]}>
          <View style={styles.headerRow}>
            <View style={styles.titleCol}>
              <Text
                style={[styles.title, dark && styles.titleDark]}
                numberOfLines={2}
              >
                {active?.name ?? "Floor Plans"}
              </Text>
              <Text style={[styles.subtitle, dark && styles.subtitleDark]}>
                {active
                  ? `Building ${active.ref} · Page ${pageIdx + 1} of ${pages.length}`
                  : "No blueprints available"}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close blueprint viewer"
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                dark && styles.closeButtonDark,
                pressed && styles.closeButtonPressed,
              ]}
            >
              <Text
                style={[styles.closeButtonText, dark && styles.closeButtonTextDark]}
              >
                ✕
              </Text>
            </Pressable>
          </View>

          {buildings && buildings.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabRow}
            >
              {buildings.map((b, i) => {
                const isActive = i === activeIdx;
                return (
                  <Pressable
                    key={b.ref}
                    onPress={() => {
                      setActiveIdx(i);
                      setPageIdx(0);
                    }}
                    style={({ pressed }) => [
                      styles.tab,
                      dark && styles.tabDark,
                      isActive && styles.tabActive,
                      isActive && dark && styles.tabActiveDark,
                      pressed && styles.tabPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        dark && styles.tabTextDark,
                        isActive && styles.tabTextActive,
                      ]}
                    >
                      {b.ref} · {b.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        <View style={galleryHostStyle} onLayout={handleLayout}>
          {pages.length > 0 && size.width > 0 && size.height > 0 ? (
            <Gallery
              key={`${osmId}-${activeIdx}`}
              data={pages}
              keyExtractor={keyForPage}
              maxScale={6}
              windowSize={3}
              pinchMode="free"
              scaleMode="clamp"
              allowPinchPanning
              tapOnEdgeToItem={false}
              onIndexChange={setPageIdx}
              renderItem={renderPage}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, dark && styles.emptyTextDark]}>
                No floor plans available for this building.
              </Text>
            </View>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  containerDark: {
    backgroundColor: "#1C1F26",
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerDark: {
    backgroundColor: "#1C1F26",
    borderBottomColor: "#3A4048",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  titleDark: {
    color: "#F9FAFB",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#6B7280",
  },
  subtitleDark: {
    color: "#9CA3AF",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  closeButtonDark: {
    backgroundColor: "#2A2F38",
    borderColor: "#3A4048",
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  closeButtonTextDark: {
    color: "#9CA3AF",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 10,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
  },
  tabDark: {
    backgroundColor: "#2A2F38",
    borderColor: "#3A4048",
  },
  tabActive: {
    backgroundColor: "#154734",
    borderColor: "#154734",
  },
  tabActiveDark: {
    backgroundColor: "#BD8B13",
    borderColor: "#BD8B13",
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  tabTextDark: {
    color: "#F9FAFB",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  galleryHost: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  galleryHostDark: {
    backgroundColor: "#111827",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    color: "#6B7280",
    textAlign: "center",
  },
  emptyTextDark: {
    color: "#9CA3AF",
  },
});
