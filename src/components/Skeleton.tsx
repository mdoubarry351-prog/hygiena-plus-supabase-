import { NATIVE_ANIM } from "@/lib/anim";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, type DimensionValue } from "react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { colors, radius, spacing } from "@/theme";

// Bloc fantôme avec animation SHIMMER : une bande lumineuse (couleur `card`)
// balaie horizontalement le bloc (base `border`), clippée par overflow:hidden.
// Animated RN (translateX, useNativeDriver) → compatible Expo Go.
// API inchangée (width/height/radius/style).
export function Skeleton({
  width = "100%",
  height = 12,
  radius: r = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
}) {
  // Largeur mesurée en px (les largeurs en % ne donnent pas la plage de translation).
  const [w, setW] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE_ANIM })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const band = Math.max(1, w * 0.5);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-band, w] });

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[styles.base, { width, height, borderRadius: r }, style]}
    >
      {w > 0 ? <Animated.View style={[styles.sheen, { width: band, transform: [{ translateX }] }]} /> : null}
    </View>
  );
}

// Quelques lignes de texte fantômes (la dernière plus courte).
export function SkeletonLines({ lines = 2, lineHeight = 10 }: { lines?: number; lineHeight?: number }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={lineHeight} width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </View>
  );
}

type Variant = "post" | "product" | "order" | "doctor" | "notification";

// Une carte fantôme représentative d'un type de contenu.
function GhostCard({ variant }: { variant: Variant }) {
  switch (variant) {
    case "product":
    case "doctor":
      return (
        <Card style={styles.row}>
          <Skeleton width={variant === "product" ? 96 : 56} height={variant === "product" ? 96 : 56} radius={radius.md} />
          <View style={styles.rowBody}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="40%" height={10} />
            <Skeleton width="30%" height={12} />
          </View>
        </Card>
      );
    case "order":
      return (
        <Card style={styles.block}>
          <View style={styles.between}>
            <Skeleton width="45%" height={12} />
            <Skeleton width={70} height={18} radius={radius.pill} />
          </View>
          <Skeleton width="100%" height={20} radius={radius.pill} />
          <View style={styles.between}>
            <Skeleton width="30%" height={12} />
            <Skeleton width="25%" height={14} />
          </View>
        </Card>
      );
    case "notification":
      return (
        <Card style={styles.row}>
          <Skeleton width={36} height={36} radius={18} />
          <View style={styles.rowBody}>
            <Skeleton width="80%" height={12} />
            <Skeleton width="55%" height={10} />
          </View>
        </Card>
      );
    case "post":
    default:
      return (
        <Card style={styles.block}>
          <View style={styles.row}>
            <Skeleton width={38} height={38} radius={19} />
            <View style={styles.rowBody}>
              <Skeleton width="50%" height={12} />
              <Skeleton width="30%" height={10} />
            </View>
          </View>
          <SkeletonLines lines={3} />
          <View style={styles.between}>
            <Skeleton width={48} height={16} />
            <Skeleton width={48} height={16} />
            <Skeleton width={24} height={16} />
          </View>
        </Card>
      );
  }
}

// Écran de chargement initial : liste de cartes fantômes (remplace le spinner).
export function SkeletonList({ variant, count = 5 }: { variant: Variant; count?: number }) {
  return (
    <Screen>
      <View style={styles.list}>
        {Array.from({ length: count }).map((_, i) => (
          <GhostCard key={i} variant={variant} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.border, overflow: "hidden" },
  sheen: { position: "absolute", top: 0, bottom: 0, backgroundColor: colors.card, opacity: 0.55 },
  list: { paddingTop: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowBody: { flex: 1, gap: spacing.xs },
  block: { gap: spacing.sm },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
