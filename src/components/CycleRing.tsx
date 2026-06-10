import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, fonts, phase as PHASE_COLOR, radius, spacing, typography } from "@/theme";

type Phase = "period" | "fertile" | "ovulation" | "luteal";

type Props = {
  cycleLength: number; // N jours
  currentDay: number | null; // 1..N (null = pas de données)
  periodLength: number; // durée des règles (jours)
  fertileStartDay: number;
  fertileEndDay: number;
  ovulationDay: number;
  size?: number;
};

// Point sur le cercle pour une fraction (0 = haut, sens horaire).
function polar(cx: number, cy: number, r: number, frac: number) {
  const angle = (frac * 360 - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

// Tracé d'un arc entre deux fractions (sens horaire).
function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = end - start > 0.5 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function CycleRing({
  cycleLength,
  currentDay,
  periodLength,
  fertileStartDay,
  fertileEndDay,
  ovulationDay,
  size = 208,
}: Props) {
  const N = Math.max(1, cycleLength);
  const stroke = 16;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;

  // Phase courante (l'ovulation prime sur la fenêtre fertile qui la contient).
  const phase: Phase =
    currentDay == null ? "luteal"
    : currentDay <= periodLength ? "period"
    : currentDay === ovulationDay ? "ovulation"
    : currentDay >= fertileStartDay && currentDay <= fertileEndDay ? "fertile"
    : "luteal";

  const dayStart = (d: number) => (d - 1) / N;
  const dayEnd = (d: number) => d / N;

  // Marqueur positionné au milieu de la case du jour courant.
  const markerFrac = currentDay != null ? (currentDay - 0.5) / N : null;
  const marker = markerFrac != null ? polar(cx, cy, r, markerFrac) : null;
  const markerColor = phase === "luteal" ? colors.textMuted : PHASE_COLOR[phase];

  const PILL: Record<Phase, { label: string; bg: string; fg: string }> = {
    period: { label: "Règles en cours", bg: PHASE_COLOR.periodSoft, fg: PHASE_COLOR.period },
    fertile: { label: "Fenêtre fertile", bg: PHASE_COLOR.fertileSoft, fg: colors.primaryDark },
    ovulation: { label: "Ovulation", bg: PHASE_COLOR.ovulationSoft, fg: PHASE_COLOR.ovulation },
    luteal: { label: "Phase lutéale", bg: colors.surface, fg: colors.textMuted },
  };
  const pill = PILL[phase];

  return (
    <View style={styles.wrap}>
      {currentDay != null ? (
        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <View style={[styles.pillDot, { backgroundColor: pill.fg }]} />
          <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
        </View>
      ) : null}

      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Piste neutre */}
          <Circle cx={cx} cy={cy} r={r} stroke={PHASE_COLOR.neutral} strokeWidth={stroke} fill="none" />
          {/* Règles */}
          {periodLength > 0 && (
            <Path d={arcPath(cx, cy, r, 0, dayEnd(periodLength))} stroke={PHASE_COLOR.period} strokeWidth={stroke} fill="none" strokeLinecap="round" />
          )}
          {/* Fenêtre fertile */}
          {fertileEndDay >= fertileStartDay && (
            <Path d={arcPath(cx, cy, r, dayStart(fertileStartDay), dayEnd(fertileEndDay))} stroke={PHASE_COLOR.fertile} strokeWidth={stroke} fill="none" strokeLinecap="round" />
          )}
          {/* Ovulation (par-dessus la fenêtre fertile) */}
          <Path d={arcPath(cx, cy, r, dayStart(ovulationDay), dayEnd(ovulationDay))} stroke={PHASE_COLOR.ovulation} strokeWidth={stroke} fill="none" strokeLinecap="round" />
          {/* Marqueur du jour courant */}
          {marker && (
            <Circle cx={marker.x} cy={marker.y} r={9} fill={colors.white} stroke={markerColor} strokeWidth={4} />
          )}
        </Svg>

        <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
          {currentDay != null ? (
            <>
              <Text style={styles.jour}>JOUR</Text>
              <Text style={styles.day}>{currentDay}</Text>
              <Text style={styles.sub}>sur {N} jours</Text>
            </>
          ) : (
            <Text style={styles.empty}>Enregistrez{"\n"}vos règles</Text>
          )}
        </View>
      </View>

      <View style={styles.legend}>
        <LegendItem color={PHASE_COLOR.period} label="Règles" />
        <LegendItem color={PHASE_COLOR.fertile} label="Fenêtre fertile" />
        <LegendItem color={PHASE_COLOR.ovulation} label="Ovulation" />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.md },
  pill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { ...typography.caption, fontFamily: fonts.bodySemiBold },
  center: { position: "absolute", top: 0, left: 0, alignItems: "center", justifyContent: "center" },
  jour: { ...typography.caption, color: colors.textMuted, letterSpacing: 2, fontSize: 11 },
  day: { fontFamily: fonts.titleBold, fontSize: 52, color: colors.text, lineHeight: 56 },
  sub: { ...typography.caption, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { ...typography.caption, color: colors.textMuted },
});
