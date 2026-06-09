import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing } from "@/theme";

type Variant = "primary" | "secondary" | "outline" | "danger";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ title, onPress, variant = "primary", loading, disabled }: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? colors.primary : colors.white} />
      ) : (
        <Text style={[styles.text, variant === "outline" && styles.textOutline]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  danger: { backgroundColor: colors.danger },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  text: { color: colors.white, fontSize: 16, fontWeight: "600" },
  textOutline: { color: colors.primary },
});
