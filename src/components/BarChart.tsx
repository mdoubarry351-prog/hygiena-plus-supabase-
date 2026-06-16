import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useEffect, useRef } from "react";
import { colors, radius, spacing, typography } from "@/theme";

// Léger échelonné entre barres (ms).
const BAR_STEP = 45;

// Barre qui CROÎT depuis 0 jusqu'à sa taille au montage (scaleY/scaleX depuis la
// base), easing sortant. Re-anime si `animKey` (la valeur) change.
// Animated RN (scale, useNativeDriver) → compatible Expo Go.
function AnimatedBar({
  style,
  animKey,
  index = 0,
  horizontal = false,
}: {
  style: StyleProp<ViewStyle>;
  animKey: number;
  index?: number;
  horizontal?: boolean;
}) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    p.setValue(0);
    Animated.timing(p, { toValue: 1, duration: 520, delay: index * BAR_STEP, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [p, animKey, index]);
  return (
    <Animated.View
      style={[style, horizontal ? styles.originLeft : styles.originBottom, { transform: [horizontal ? { scaleX: p } : { scaleY: p }] }]}
    />
  );
}

type BarChartProps = {
  labels: string[];
  values: number[];
  tint: string;
  // Repère de moyenne (ligne pointillée pleine largeur) — optionnel.
  average?: number | null;
  // Suffixe d'unité après chaque valeur (ex. " j").
  unitSuffix?: string;
  // Hauteur du graphe (px).
  height?: number;
};

// Histogramme minimaliste (barres en Views, aucune lib de charts).
// Sans `average` : rendu historique identique (utilisé par l'admin).
// Avec `average` : ajoute une ligne de moyenne alignée sur la base des barres.
export function BarChart({ labels, values, tint, average = null, unitSuffix = "", height = 160 }: BarChartProps) {
  const max = Math.max(1, ...values, average ?? 0);

  if (average == null) {
    return (
      <View style={[styles.chart, { height }]}>
        {values.map((v, i) => (
          <View key={i} style={styles.barCol}>
            <Text style={styles.barValue}>{v}{unitSuffix}</Text>
            <View style={styles.barTrack}>
              <AnimatedBar index={i} animKey={v} style={[styles.barFill, { height: `${(v / max) * 100}%`, backgroundColor: tint }]} />
            </View>
            <Text style={styles.barLabel}>{labels[i]}</Text>
          </View>
        ))}
      </View>
    );
  }

  // Variante avec repère de moyenne : zone de tracé à base commune + libellés dessous.
  const usable = height - 18; // marge haute pour la valeur au-dessus des barres
  return (
    <View>
      <View style={[styles.plot, { height }]}>
        <View pointerEvents="none" style={[styles.avgWrap, { bottom: (average / max) * usable }]}>
          <View style={[styles.avgLine, { borderColor: tint }]} />
          <Text style={[styles.avgTag, { color: tint }]}>moy {Math.round(average)}{unitSuffix}</Text>
        </View>
        {values.map((v, i) => (
          <View key={i} style={styles.plotCol}>
            <Text style={styles.barValue}>{v}{unitSuffix}</Text>
            <AnimatedBar index={i} animKey={v} style={[styles.plotBar, { height: (v / max) * usable, backgroundColor: tint }]} />
          </View>
        ))}
      </View>
      <View style={styles.labelRow}>
        {labels.map((l, i) => <Text key={i} style={styles.barLabelFlex}>{l}</Text>)}
      </View>
    </View>
  );
}

// Barres horizontales pour données catégorielles (symptômes, humeur…).
export function HBarChart({ items, tint }: { items: { label: string; value: number }[]; tint: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <View style={styles.hChart}>
      {items.map((it, i) => (
        <View key={i} style={styles.hRow}>
          <Text style={styles.hLabel} numberOfLines={1}>{it.label}</Text>
          <View style={styles.hTrack}>
            <AnimatedBar horizontal index={i} animKey={it.value} style={[styles.hFill, { width: `${(it.value / max) * 100}%`, backgroundColor: tint }]} />
          </View>
          <Text style={styles.hValue}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Origines de transformation pour la croissance des barres (depuis la base).
  originBottom: { transformOrigin: "bottom" },
  originLeft: { transformOrigin: "left" },
  // — Barres verticales (rendu historique, partagé avec l'admin) —
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 160, gap: spacing.xs },
  barCol: { flex: 1, alignItems: "center", gap: spacing.xs },
  barValue: { ...typography.caption, color: colors.text, fontWeight: "600" },
  barTrack: { width: "70%", flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: radius.sm, minHeight: 3 },
  barLabel: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },

  // — Variante avec ligne de moyenne —
  plot: { position: "relative", flexDirection: "row", alignItems: "flex-end", gap: spacing.xs },
  plotCol: { flex: 1, alignItems: "center", gap: 2, justifyContent: "flex-end" },
  plotBar: { width: "70%", borderRadius: radius.sm, minHeight: 3 },
  avgWrap: { position: "absolute", left: 0, right: 0, height: 0, justifyContent: "center" },
  avgLine: { borderBottomWidth: 1.5, borderStyle: "dashed", opacity: 0.7 },
  avgTag: { ...typography.caption, fontSize: 10, fontWeight: "700", position: "absolute", right: 0, top: -14 },
  labelRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  barLabelFlex: { flex: 1, textAlign: "center", ...typography.caption, color: colors.textMuted },

  // — Barres horizontales —
  hChart: { gap: spacing.sm },
  hRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  hLabel: { ...typography.caption, color: colors.text, width: 96 },
  hTrack: { flex: 1, height: 14, backgroundColor: colors.surface, borderRadius: radius.sm, overflow: "hidden" },
  hFill: { height: "100%", borderRadius: radius.sm, minWidth: 3 },
  hValue: { ...typography.caption, color: colors.primaryDark, fontWeight: "700", width: 24, textAlign: "right" },
});
