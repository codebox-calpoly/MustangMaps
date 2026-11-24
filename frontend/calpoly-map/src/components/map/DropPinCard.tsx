import React, { useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMapContext } from "../../context/MapContext";

interface DropPinCardProps {
  visible: boolean;
  onShare: (note: string) => void;
  onDismiss: () => void;
  onRoute: () => void;
  topInset: number;
  initialNote?: string;
  readOnly?: boolean;
}

export function DropPinCard({
  visible,
  onShare,
  onDismiss,
  onRoute,
  topInset,
  initialNote = "",
  readOnly = false,
}: DropPinCardProps) {
  const [note, setNote] = useState(initialNote);
  const { mapStyle } = useMapContext();
  const dark = mapStyle === "dark";

  React.useEffect(() => {
    if (visible) setNote(initialNote);
    else setNote("");
  }, [visible, initialNote]);

  if (!visible) return null;

  const handleShare = () => {
    Keyboard.dismiss();
    onShare(note.trim());
  };

  const handleDismiss = () => {
    Keyboard.dismiss();
    onDismiss();
  };

  const handleRoute = () => {
    Keyboard.dismiss();
    onRoute();
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { top: topInset + 12 }]}
    >
      <View style={[styles.card, dark && styles.cardDark]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, dark && styles.titleDark]}>
            {readOnly ? "📍 Shared pin" : "📍 Pin dropped"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={readOnly ? "Dismiss shared pin" : "Dismiss dropped pin"}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={handleDismiss}
            style={({ pressed }) => [
              styles.closeButton,
              dark && styles.closeButtonDark,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={[styles.closeButtonText, dark && styles.closeButtonTextDark]}>✕</Text>
          </Pressable>
        </View>

        {readOnly ? (
          <>
            {note ? (
              <Text style={[styles.readNote, dark && styles.readNoteDark]}>
                {note}
              </Text>
            ) : (
              <Text style={[styles.readPlaceholder, dark && styles.readPlaceholderDark]}>
                No note attached
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get directions to pin"
              onPress={handleRoute}
              style={({ pressed }) => [
                styles.primaryButton,
                dark && styles.primaryButtonDark,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.primaryButtonText}>Directions</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={dark ? "#6B7280" : "#9CA3AF"}
              maxLength={60}
              returnKeyType="send"
              onSubmitEditing={handleShare}
              keyboardAppearance={dark ? "dark" : "light"}
              style={[styles.input, dark && styles.inputDark]}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share dropped pin"
              onPress={handleShare}
              style={({ pressed }) => [
                styles.primaryButton,
                dark && styles.primaryButtonDark,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.primaryButtonText}>Share Pin</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get directions to pin"
              onPress={handleRoute}
              style={({ pressed }) => [
                styles.secondaryButton,
                dark && styles.secondaryButtonDark,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.secondaryButtonText, dark && styles.secondaryButtonTextDark]}>
                Directions
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  card: {
    width: "92%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardDark: {
    backgroundColor: "#1C1F26",
    borderColor: "#3A4048",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  titleDark: {
    color: "#F9FAFB",
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonDark: {
    backgroundColor: "#2A2F38",
  },
  closeButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  closeButtonTextDark: {
    color: "#9CA3AF",
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    color: "#111827",
    fontSize: 15,
    marginBottom: 10,
  },
  inputDark: {
    backgroundColor: "#2A2F38",
    borderColor: "#3A4048",
    color: "#F9FAFB",
  },
  primaryButton: {
    backgroundColor: "#154734",
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonDark: {
    backgroundColor: "#BD8B13",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#154734",
  },
  secondaryButtonDark: {
    borderColor: "#BD8B13",
  },
  secondaryButtonText: {
    color: "#154734",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButtonTextDark: {
    color: "#BD8B13",
  },
  readNote: {
    paddingVertical: 4,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 22,
  },
  readNoteDark: {
    color: "#F9FAFB",
  },
  readPlaceholder: {
    paddingVertical: 4,
    fontSize: 14,
    fontStyle: "italic",
    color: "#6B7280",
  },
  readPlaceholderDark: {
    color: "#9CA3AF",
  },
});
