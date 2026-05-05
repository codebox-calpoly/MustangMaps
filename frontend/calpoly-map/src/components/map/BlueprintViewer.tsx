import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import type { SharedValue } from "react-native-reanimated";
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
  // Defer mounting the inner zoom ScrollViews until the bottom sheet has
  // finished its open animation. iOS decodes <Image> at the view's frame
  // size and caches that bitmap; if a page first mounts while the sheet is
  // mid-spring, the decode happens at a small intermediate frame and the
  // image stays blurry even after the sheet settles. Waiting for `locked`
  // ensures every page's first decode is at the final dimensions.
  const [locked, setLocked] = useState(false);

  // Ref to the outer paged ScrollView, used for programmatic page changes
  // from the prev/next buttons.
  const pagerRef = useRef<ScrollView | null>(null);

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

  // Size the floor-plan image to its native aspect ratio, fit inside the
  // available host area. The inner ScrollView's frame stays at host size
  // (so each page is exactly one swipe-page wide); the Image just sits
  // centered inside via `centerContent`.
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

  // Track whether the active page is currently zoomed past ~1. Used to
  // disable the outer pager's horizontal scroll so the user can't swipe to
  // the next page while panning around within a zoomed page. Hysteresis
  // threshold (1.1) avoids flapping at the boundary.
  const [isZoomed, setIsZoomed] = useState(false);

  // Reset zoom flag and pager scroll on building/sheet visibility change.
  // We don't reset on pageIdx changes — those are driven by the pager
  // itself and shouldn't re-fight scroll position.
  useEffect(() => {
    setIsZoomed(false);
  }, [osmId, activeIdx, visible]);

  const scrollPagerToPage = useCallback(
    (idx: number) => {
      if (size.width <= 0) return;
      pagerRef.current?.scrollTo({
        x: idx * size.width,
        y: 0,
        animated: true,
      });
    },
    [size.width],
  );

  // The scroll side effect must live OUTSIDE the setPageIdx updater. React
  // invokes state updaters twice in dev/StrictMode to verify purity, so a
  // scrollTo call inside the updater would advance the pager two pages
  // per button press while only incrementing pageIdx once.
  const goToPrevPage = useCallback(() => {
    if (pageIdx <= 0) return;
    const next = pageIdx - 1;
    setPageIdx(next);
    scrollPagerToPage(next);
  }, [pageIdx, scrollPagerToPage]);

  const goToNextPage = useCallback(() => {
    if (pageIdx >= pages.length - 1) return;
    const next = pageIdx + 1;
    setPageIdx(next);
    scrollPagerToPage(next);
  }, [pageIdx, pages.length, scrollPagerToPage]);

  // Outer pager — update pageIdx after the user finishes a horizontal
  // swipe between pages. Round-to-nearest in case the scroll lands a few
  // sub-pixels off due to deceleration.
  const handlePagerMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (size.width <= 0) return;
      const idx = Math.round(e.nativeEvent.contentOffset.x / size.width);
      const clamped = Math.max(0, Math.min(pages.length - 1, idx));
      setPageIdx((prev) => (prev === clamped ? prev : clamped));
    },
    [pages.length, size.width],
  );

  // Inner zoom ScrollView — onScroll fires for both pinch (zoomScale
  // changes) and pan (contentOffset changes). We only care about
  // zoomScale for the outer-pager-disable logic.
  const handleInnerScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // zoomScale is iOS-only on UIScrollView; default to 1 if absent.
      const zoom = (e.nativeEvent as NativeScrollEvent & { zoomScale?: number })
        .zoomScale ?? 1;
      const zoomed = zoom > 1.1;
      setIsZoomed((current) => (current === zoomed ? current : zoomed));
    },
    [],
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
            // Native iOS UIScrollView nesting:
            //   - Outer ScrollView is horizontal + pagingEnabled, holding
            //     one inner ScrollView per page. Page swipe handled by iOS.
            //   - Each inner ScrollView is a vanilla zoomable scroll view
            //     (maximumZoomScale=6). UIScrollView handles pinch focal
            //     point, pan-while-zoomed, momentum, and bounce natively
            //     (no third-party gesture library involved).
            //   - Outer scrollEnabled=!isZoomed prevents accidental page
            //     swipes while the user is panning inside a zoomed page;
            //     once they pinch back to scale~1, swipe re-enables.
            <ScrollView
              key={`${osmId}-${activeIdx}`}
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              scrollEnabled={!isZoomed}
              onMomentumScrollEnd={handlePagerMomentumEnd}
              style={{ width: size.width, height: size.height }}
              // Intentionally NO contentOffset prop. Setting it reactively
              // alongside our imperative scrollTo causes iOS pagingEnabled
              // to interpret the prop-driven setContentOffset(animated:NO)
              // as a mid-animation interruption with leftover velocity, and
              // snaps to the page *past* the target — making one button
              // press advance two pages. Initial position is 0, which
              // matches the pageIdx=0 reset on building/sheet changes.
            >
              {pages.map((source, i) => (
                <ScrollView
                  key={i}
                  style={{ width: size.width, height: size.height }}
                  contentContainerStyle={styles.innerContent}
                  maximumZoomScale={6}
                  minimumZoomScale={1}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  centerContent
                  pinchGestureEnabled
                  bouncesZoom
                  onScroll={i === pageIdx ? handleInnerScroll : undefined}
                  scrollEventThrottle={16}
                >
                  <Image
                    source={source}
                    style={{
                      width: fittedDims.width,
                      height: fittedDims.height,
                    }}
                  />
                </ScrollView>
              ))}
            </ScrollView>
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
  innerContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
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
