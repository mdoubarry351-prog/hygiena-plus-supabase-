import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "@/theme";

type Variant = "solid" | "soft";
type Inactive = "surface" | "transparent";
type Size = "sm" | "md" | "lg";

// Paddings : sm = 14/6 (barres de filtres) ; md = md/xs (filtres compacts) ;
// lg = md/sm (grilles de sélection type symptômes / groupe sanguin).
const SIZES: Record<Size, { ph: number; pv: number }> = {
  sm: { ph: 14, pv: 6 },
  md: { ph: spacing.md, pv: spacing.xs },
  lg: { ph: spacing.md, pv: spacing.sm },
};

// Pastille de filtre/sélection tokenisée.
// - variant 'solid' (défaut) : actif = fond primary plein + texte blanc.
// - variant 'soft' : actif = fond primaryLight + bordure primary + texte primaryDark.
// - inactiveBackground : 'surface' (défaut) ou 'transparent'.
// - size : 'sm' (défaut) | 'md' | 'lg'. Fonctionne en wrap ET en barre horizontale.
export function Chip({
  label,
  active = false,
  onPress,
  icon,
  variant = "solid",
  inactiveBackground = "surface",
  size = "sm",
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: Variant;
  inactiveBackground?: Inactive;
  size?: Size;
  style?: StyleProp<ViewStyle>;
}) {
  const pad = SIZES[size];
  const activeBg = variant === "soft" ? colors.primaryLight : colors.primary;
  const inactiveBg = inactiveBackground === "surface" ? colors.surface : "transparent";
  const activeText = variant === "soft" ? colors.primaryDark : colors.white;
  const activeWeight = variant === "soft" ? "600" : "700";
  const inactiveWeight = variant === "soft" ? "400" : "700";
  const iconColor = active ? (variant === "soft" ? colors.primaryDark : colors.white) : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        {
          paddingHorizontal: pad.ph,
          paddingVertical: pad.pv,
          backgroundColor: active ? activeBg : inactiveBg,
          borderColor: active ? colors.primary : colors.border,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={iconColor} /> : null}
      <Text
        style={[styles.text, { color: active ? activeText : colors.text, fontWeight: active ? activeWeight : inactiveWeight }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5 },
  text: { ...typography.caption, fontSize: 13 },
});
