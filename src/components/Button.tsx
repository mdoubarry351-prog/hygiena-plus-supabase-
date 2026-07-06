import { NATIVE_ANIM } from "@/lib/anim";
import { useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/theme";
import { hapticLight } from "@/lib/haptics";
import { webPointer } from "@/lib/web-style";

type Variant = "primary" | "secondary" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
};

const RIPPLE_COLOR = "rgba(255,255,255,0.18)";
const RIPPLE_OUTLINE = "rgba(16,185,129,0.12)";

export function Button({ title, onPress, variant = "primary", size = "md", icon, loading, disabled }: Props) {
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  function animate(to: number) {
    Animated.spring(scale, { toValue: to, useNativeDriver: NATIVE_ANIM, speed: 40, bounciness: 4 }).start();
  }

  const isOutline = variant === "outline";
  const tint = isOutline ? colors.primary : colors.white;
  const iconSize = size === "sm" ? 16 : size === "lg" ? 20 : 18;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
        android_ripple={{ color: isOutline ? RIPPLE_OUTLINE : RIPPLE_COLOR }}
        onPressIn={() => {
          if (isDisabled) return;
          // Haptique léger pour les actions plein-écran (primary/danger).
          if (variant === "primary" || variant === "danger") hapticLight();
          animate(0.97);
        }}
        onPressOut={() => animate(1)}
        style={[
          styles.base,
          styles[`size_${size}`],
          styles[variant],
          !isOutline && !isDisabled && shadows.sm,
          isDisabled && styles.disabled,
          !isDisabled && webPointer,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={tint} />
        ) : (
          <View style={styles.content}>
            {icon ? <Ionicons name={icon} size={iconSize} color={tint} style={styles.icon} /> : null}
            <Text style={[styles.text, styles[`text_${size}`], isOutline && styles.textOutline]} maxFontSizeMultiplier={1.6} numberOfLines={1}>
              {title}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
  },
  size_sm: { height: 44 },
  size_md: { height: 52 },
  size_lg: { height: 56 },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  icon: { marginRight: 0 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  danger: { backgroundColor: colors.danger },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  text: { color: colors.white, fontWeight: "600", fontFamily: fonts.bodySemiBold },
  text_sm: { fontSize: 14 },
  text_md: { fontSize: 16 },
  text_lg: { fontSize: 17 },
  textOutline: { color: colors.primary },
});
