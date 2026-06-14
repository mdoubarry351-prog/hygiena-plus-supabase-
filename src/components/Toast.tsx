import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, durations, radius, shadows, spacing, typography } from "@/theme";

export type ToastType = "success" | "error" | "info";

const META: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { icon: "checkmark-circle", color: colors.success },
  error: { icon: "alert-circle", color: colors.danger },
  info: { icon: "information-circle", color: colors.primary },
};

const VISIBLE_MS = 2500;

// Bannière animée (slide + fade), auto-dismiss, tap pour fermer.
export function ToastBanner({ type, message, onHide }: { type: ToastType; message: string; onHide: () => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-16)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hidden = useRef(false);
  const meta = META[type];

  function hide() {
    if (hidden.current) return;
    hidden.current = true;
    Animated.parallel([
      Animated.timing(translateY, { toValue: -16, duration: durations.fast, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: durations.fast, useNativeDriver: true }),
    ]).start(() => onHide());
  }

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: durations.normal, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { top: insets.top + spacing.xs }]}>
      <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
        <Pressable onPress={hide} style={styles.inner} accessibilityRole="button" accessibilityLabel={message}>
          <View style={[styles.iconWrap, { backgroundColor: `${meta.color}1A` }]}>
            <Ionicons name={meta.icon} size={20} color={meta.color} />
          </View>
          <Text style={styles.text} numberOfLines={3}>{message}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: spacing.md, right: spacing.md, zIndex: 1000, alignItems: "center" },
  toast: {
    alignSelf: "stretch",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  inner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  text: { ...typography.body, color: colors.text, fontWeight: "600", flex: 1 },
});
