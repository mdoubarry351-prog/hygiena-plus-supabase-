import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppImage } from "@/components/AppImage";
import { colors, typography } from "@/theme";

type Size = "sm" | "md" | "lg";
const SIZES: Record<Size, number> = { sm: 38, md: 48, lg: 64 };

// Avatar partagé : photo (AppImage, coins ronds + cache) si `uri`, sinon pastille
// avec l'initiale du nom, sinon une icône. Mêmes couleurs que l'existant.
export function Avatar({
  uri,
  name,
  size = "md",
  icon = "person",
  style,
}: {
  uri?: string | null;
  name?: string | null;
  size?: Size | number;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const dim = typeof size === "number" ? size : SIZES[size];
  const round = { width: dim, height: dim, borderRadius: dim / 2 };
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || "";

  return (
    <View style={[round, styles.base, style]}>
      {uri ? (
        <AppImage source={uri} style={styles.fill} />
      ) : initial ? (
        <Text style={[styles.initial, { fontSize: Math.round(dim * 0.42) }]}>{initial}</Text>
      ) : (
        <Ionicons name={icon} size={Math.round(dim * 0.5)} color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
  initial: { ...typography.name, color: colors.primaryDark },
});
