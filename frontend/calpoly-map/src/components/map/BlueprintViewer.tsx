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
  // Two-phase sizing:
  //   1. While `locked === false`, the gallery host is `flex: 1` and we accept
  //      every layout pass — this is needed because the BottomSheet animates
  //      from the bottom of the screen up to its 85% snap, and the *first*
  //      onLayout fires when the sheet is still partially closed, reporting
  //      a tiny intermediate height. We need to follow the sheet as it grows.
  //   2. After the animation settles (~500ms), we flip `locked === true` and
  //      hard-code the final pixel dimensions on the host. This stops Yoga
  //      sub-pixel rounding / sibling re-renders from refiring Gallery's
  //      internal `useAnimatedReaction(rootSize, () => reset(...))`, which is
  //      what was yanking pinch-zoom back to scale 1 mid-gesture.
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!visible) {
      sheetRef.current?.close();
      setActiveIdx(0);
      setPageIdx(0);
      setLocked(false);
      setSize({ width: 0, height: 0 });
      return;
    }
    // Give the bottom sheet's spring animation time to land at the 85% snap
    // before we freeze gallery dimensions.
    const timer = setTimeout(() => setLocked(true), 600);
    return () => clearTimeout(timer);
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

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      // Once locked we ignore further layout events — the host is now sized
      // explicitly and Gallery's reset-on-rootSize-change can't be triggered.
      if (locked) return;
      const { width, height } = e.nativeEvent.layout;
      if (width <= 0 || height <= 0) return;
      setSize({ width, height });
    },
    [locked],
  );

  const galleryHostStyle = useMemo(() => {
    const base = [styles.galleryHost, dark && styles.galleryHostDark];
    if (locked && size.width > 0 && size.height > 0) {
      return [...base, { flex: 0, width: size.width, height: size.height }];
    }
    return base;
  }, [dark, locked, size.width, size.height]);

  // Aspect ratio of the floor plan images. We assume all pages of a building
  // share the same aspect (true for Cal Poly's PDF template) and use the
  // first page's intrinsic dimensions. Default 0.9 (typical post-crop value)
  // protects against edge cases.
  const aspectRatio = useMemo(() => {
    if (!pages || pages.length === 0) return 0.9;
    const src = Image.resolveAssetSource(pages[0]);
    if (!src || !src.width || !src.height) return 0.9;
    return src.width / src.height;
  }, [pages]);

  // Size the *Gallery* (not just the image) to the image's exact aspect.
  // This eliminates the empty letterbox area inside Gallery's gesture
  // surface — without it, pinching in the empty space caused
  // usePinchCommons.ts:121 to compute an `origin` against the host (not
  // the visible image), which then produced a translation that yanked the
  // image to a totally different region. Math.floor pins to whole pixels
  // so Yoga doesn't sub-pixel oscillate.
  const fittedDims = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return { width: 0, height: 0 };
    const slotAspect = size.width / size.height;
    if (slotAspect > aspectRatio) {
      return {
        width: Math.floor(size.height * aspectRatio),
        height: Math.floor(size.height),
      };
    }
    return {
      width: Math.floor(size.width),
      height: Math.floor(size.width / aspectRatio),
    };
  }, [size.width, size.height, aspectRatio]);

  // Image fills the Gallery's slot exactly — no letterbox inside Gallery's
  // gesture surface, so pinch focal == image focal.
  const renderPage = useCallback(
    (item: any) => (
      <Image
        source={item}
        style={{ width: fittedDims.width, height: fittedDims.height }}
        resizeMethod="scale"
      />
    ),
    [fittedDims.width, fittedDims.height],
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
          {pages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, dark && styles.emptyTextDark]}>
                No floor plans available for this building.
              </Text>
            </View>
          ) : locked && fittedDims.width > 0 && fittedDims.height > 0 ? (
            // Gate Gallery mount on `locked`. iOS decodes <Image> at the view's
            // frame size and caches that bitmap. If pages 1-2 mount while the
            // bottom sheet is mid-animation (small frame), they decode at low
            // res and stay blurry even after the sheet settles. Waiting for
            // `locked` ensures every page's first decode is at final dims.
            <View
              style={{ width: fittedDims.width, height: fittedDims.height }}
            >
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
            </View>
          ) : null}
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
    alignItems: "center",
    justifyContent: "center",
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
