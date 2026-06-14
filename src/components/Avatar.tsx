import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppImage } from "@/components/AppImage";
import { colors } from "@/theme";

// Avatar communauté : vraie photo de profil si disponible (et auteur non
// anonyme), sinon pastille avec icône. Taille paramétrable (diamètre en px).
export function Avatar({
  url,
  isAnonymous,
  size = 38,
}: {
  url?: string | null;
  isAnonymous?: boolean;
  size?: number;
}) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (!isAnonymous && url) {
    return <AppImage source={url} style={[dim, styles.photo]} accessibilityLabel="Photo de profil" />;
  }
  return (
    <View style={[dim, styles.fallback]}>
      <Ionicons name={isAnonymous ? "person-outline" : "person"} size={Math.round(size * 0.48)} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { backgroundColor: colors.surface },
  fallback: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
});
