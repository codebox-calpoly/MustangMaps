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
import {
  runOnJS,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { ResumableZoom } from "react-native-zoom-toolkit";
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
  // Defer mounting ResumableZoom until the bottom sheet has finished its
  // open animation. iOS decodes <Image> at the view's frame size and caches
  // that bitmap; if a page first mounts while the sheet is mid-spring, the
  // decode happens at a small intermediate frame and the image stays blurry
  // even after the sheet settles. Waiting for `locked` ensures every page's
  // first decode is at the final dimensions.
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
  const pages = useMemo(() => active?.pages ?? [], [active?.pages]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
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

  // Size the slot exactly to the image's aspect so the ResumableZoom child
  // and the rendered Image have identical dimensions. That keeps the pinch
  // focal point math (origin computed from `e.focalX/Y` against the
  // un-transformed child) aligned with the image the user is touching.
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

  // Tracks ResumableZoom scale on the UI thread + a JS-thread mirror used
  // to actually disable the outer fling gesture when the user is zoomed in.
  // `isZoomedShared` debounces the state crossing on the UI thread so we
  // only runOnJS when the boolean flips, not every frame.
  const scaleShared = useSharedValue(1);
  const isZoomedShared = useSharedValue(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // Reset zoom-tracking state whenever the source page/building/sheet
  // changes — ResumableZoom's `key` makes it remount at scale=1, but the
  // shared value + React state lag until the first onUpdate fires. Without
  // this, a stale `isZoomed=true` after a page change can suppress the
  // first swipe attempt on the new page.
  useEffect(() => {
    scaleShared.value = 1;
    isZoomedShared.value = false;
    setIsZoomed(false);
  }, [osmId, activeIdx, pageIdx, visible, scaleShared, isZoomedShared]);

  const goToPrevPage = useCallback(() => {
    setPageIdx((idx) => Math.max(0, idx - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageIdx((idx) => Math.min(pages.length - 1, idx + 1));
  }, [pages.length]);

  // Quick horizontal flicks change page — but only at scale ≤ ~1. When
  // zoomed in, the fling is *actually disabled* (not just ignored) so it
  // can't claim the gesture and cancel ResumableZoom's intra-page pan.
  const flingLeft = useMemo(
    () =>
      Gesture.Fling()
        .direction(Directions.LEFT)
        .enabled(!isZoomed)
        .onEnd(() => {
          "worklet";
          runOnJS(goToNextPage)();
        }),
    [goToNextPage, isZoomed],
  );

  const flingRight = useMemo(
    () =>
      Gesture.Fling()
        .direction(Directions.RIGHT)
        .enabled(!isZoomed)
        .onEnd(() => {
          "worklet";
          runOnJS(goToPrevPage)();
        }),
    [goToPrevPage, isZoomed],
  );

  const composedFling = useMemo(
    () => Gesture.Race(flingLeft, flingRight),
    [flingLeft, flingRight],
  );

  // ResumableZoom's onUpdate is invoked from a useDerivedValue (worklet
  // context). Only runOnJS when isZoomed actually flips — otherwise we'd
  // spam setIsZoomed every frame of every gesture.
  const onZoomUpdate = useCallback(
    (state: { scale: number }) => {
      "worklet";
      scaleShared.value = state.scale;
      const shouldBeZoomed = state.scale > 1.1;
      if (isZoomedShared.value !== shouldBeZoomed) {
        isZoomedShared.value = shouldBeZoomed;
        runOnJS(setIsZoomed)(shouldBeZoomed);
      }
    },
    [scaleShared, isZoomedShared],
  );

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
              {active ? (
                <View style={styles.subtitleRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Previous page"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={goToPrevPage}
                    disabled={pageIdx === 0}
                    style={({ pressed }) => [
                      styles.pageNavButton,
                      dark && styles.pageNavButtonDark,
                      pageIdx === 0 && styles.pageNavButtonDisabled,
                      pressed && styles.pageNavButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pageNavButtonText,
                        dark && styles.pageNavButtonTextDark,
                        pageIdx === 0 && styles.pageNavButtonTextDisabled,
                      ]}
                    >
                      ‹
                    </Text>
                  </Pressable>
                  <Text
                    style={[styles.subtitle, dark && styles.subtitleDark]}
                  >
                    {`Building ${active.ref} · Page ${pageIdx + 1} of ${pages.length}`}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Next page"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={goToNextPage}
                    disabled={pageIdx >= pages.length - 1}
                    style={({ pressed }) => [
                      styles.pageNavButton,
                      dark && styles.pageNavButtonDark,
                      pageIdx >= pages.length - 1 &&
                        styles.pageNavButtonDisabled,
                      pressed && styles.pageNavButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pageNavButtonText,
                        dark && styles.pageNavButtonTextDark,
                        pageIdx >= pages.length - 1 &&
                          styles.pageNavButtonTextDisabled,
                      ]}
                    >
                      ›
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[styles.subtitle, dark && styles.subtitleDark]}>
                  No blueprints available
                </Text>
              )}
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
            // Outer fling gesture handles page navigation; the inner
            // ResumableZoom owns pinch/pan/double-tap for the current page
            // only. The fling worklet ignores swipes when scaleShared > 1,
            // so zoomed pans inside the image don't accidentally change page.
            <GestureDetector gesture={composedFling}>
              <View
                style={{ width: fittedDims.width, height: fittedDims.height }}
              >
                <ResumableZoom
                  key={`${osmId}-${activeIdx}-${pageIdx}`}
                  maxScale={6}
                  minScale={1}
                  // pinchMode="free": don't clamp translation mid-pinch.
                  //   With clamp, when scale crosses 1 going down, bounds
                  //   collapse to (0,0) and the image jerks to centered.
                  //   "free" lets translation flow with pinchTransform's
                  //   focal-preserving math; onPinchEnd then clamps and
                  //   animates back to bounds smoothly.
                  // scaleMode="clamp": no over-zoom-out. With "bounce",
                  //   rare aggressive pinches dip scale below 1, and the
                  //   release-time clamp animates *both* scale and
                  //   translation back to (1, centered) — the user feels
                  //   that as "snapped all the way out and moved." Clamp
                  //   keeps scale ≥ 1 mid-pinch, eliminating that combined
                  //   animation. A residual translation-only animation
                  //   still happens at exact scale=1 (library forces
                  //   centering), but it's visually smaller.
                  // allowPinchPanning={false}: the focal point's natural
                  //   screen-space drift during a 2-finger pinch was being
                  //   added to translation, which felt like the image
                  //   "moves to somewhere else" while zooming in. Disable
                  //   so pinch is purely scale-around-focal.
                  pinchMode="free"
                  scaleMode="clamp"
                  panMode="clamp"
                  allowPinchPanning={false}
                  onUpdate={onZoomUpdate}
                >
                  <Image
                    source={pages[pageIdx]}
                    style={{
                      width: fittedDims.width,
                      height: fittedDims.height,
                    }}
                  />
                </ResumableZoom>
              </View>
            </GestureDetector>
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
  subtitleRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pageNavButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  pageNavButtonDark: {
    backgroundColor: "#2A2F38",
    borderColor: "#3A4048",
  },
  pageNavButtonDisabled: {
    opacity: 0.4,
  },
  pageNavButtonPressed: {
    opacity: 0.7,
  },
  pageNavButtonText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "700",
    color: "#374151",
  },
  pageNavButtonTextDark: {
    color: "#E5E7EB",
  },
  pageNavButtonTextDisabled: {
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
