import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import {
  pregnancyService,
  pregnancyWeek,
  trimester,
  daysRemaining,
  pregnancyProgress,
} from "@/lib/pregnancy-service";
import { weekInfo } from "@/lib/pregnancy-data";
import { hapticSuccess } from "@/lib/haptics";
import type { Pregnancy } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

const TRIMESTER_LABEL: Record<1 | 2 | 3, string> = {
  1: "1ᵉʳ trimestre",
  2: "2ᵉ trimestre",
  3: "3ᵉ trimestre",
};

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function PregnancyScreen() {
  const [pregnancy, setPregnancy] = useState<Pregnancy | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPregnancy(await pregnancyService.getActivePregnancy());
    } catch {
      setPregnancy(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading />;

  return (
    <Screen>
      <ScreenHeader title="Suivi de grossesse" />
      {pregnancy ? (
        <Dashboard pregnancy={pregnancy} onEnded={load} />
      ) : (
        <StartForm onStarted={load} />
      )}
    </Screen>
  );
}

// ---------------- Démarrage (pas de grossesse active) ----------------
function StartForm({ onStarted }: { onStarted: () => void }) {
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleStart() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      Alert.alert("Date invalide", "Format attendu : AAAA-MM-JJ (ex. 2026-01-15).");
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    if (startDate > today) {
      Alert.alert("Date invalide", "La date des dernières règles ne peut pas être dans le futur.");
      return;
    }
    setSaving(true);
    try {
      await pregnancyService.startPregnancy(startDate);
      hapticSuccess();
      onStarted();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de démarrer le suivi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Card style={styles.introCard}>
        <View style={styles.introIcon}>
          <Ionicons name="heart" size={28} color={colors.primaryDark} />
        </View>
        <Text style={styles.introTitle}>Suis ta grossesse semaine après semaine</Text>
        <Text style={styles.introText}>
          Indique la date de tes dernières règles : nous estimons la semaine en cours, la date prévue
          d'accouchement et te partageons des infos bienveillantes chaque semaine.
        </Text>
      </Card>

      <Card style={styles.formCard}>
        <Input
          label="Date de tes dernières règles (AAAA-MM-JJ)"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="2026-01-15"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.hint}>La date prévue d'accouchement est estimée à 40 semaines (280 jours).</Text>
        <Button title="Démarrer le suivi" onPress={handleStart} loading={saving} />
      </Card>

      <MedicalDisclaimer text="Ces estimations sont indicatives et ne remplacent pas le suivi de votre sage-femme ou médecin." />
    </ScrollView>
  );
}

// ---------------- Tableau de bord (grossesse active) ----------------
function Dashboard({ pregnancy, onEnded }: { pregnancy: Pregnancy; onEnded: () => void }) {
  const currentWeek = pregnancyWeek(pregnancy.start_date);
  const [viewedWeek, setViewedWeek] = useState(currentWeek);
  const [ending, setEnding] = useState(false);

  const info = weekInfo(viewedWeek);
  const tri = trimester(currentWeek);
  const remaining = daysRemaining(pregnancy.due_date);
  const progress = pregnancyProgress(pregnancy.start_date);
  const isCurrent = viewedWeek === currentWeek;

  function confirmEnd() {
    Alert.alert(
      "Terminer le suivi ?",
      "Votre suivi de grossesse sera clôturé. Vous pourrez en démarrer un nouveau plus tard.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Terminer",
          style: "destructive",
          onPress: async () => {
            setEnding(true);
            try {
              await pregnancyService.endPregnancy(pregnancy.id);
              onEnded();
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
            } finally {
              setEnding(false);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {/* Semaine courante + trimestre */}
      <Card style={styles.heroCard}>
        <Text style={styles.heroWeekLabel}>SEMAINE</Text>
        <Text style={styles.heroWeek}>{currentWeek}</Text>
        <Text style={styles.heroTri}>{TRIMESTER_LABEL[tri]}</Text>

        {/* Barre de progression */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.progressText}>{Math.round(progress * 100)} %</Text>
          <Text style={styles.progressText}>
            {remaining > 0 ? `${remaining} jour${remaining > 1 ? "s" : ""} restants` : "Terme atteint"}
          </Text>
        </View>
        <Text style={styles.dueDate}>Date prévue : {formatLongDate(pregnancy.due_date)}</Text>
      </Card>

      {/* Navigation entre semaines */}
      <View style={styles.weekNav}>
        <Pressable
          onPress={() => setViewedWeek((w) => Math.max(4, w - 1))}
          disabled={viewedWeek <= 4}
          hitSlop={10}
          style={[styles.navBtn, viewedWeek <= 4 && styles.navBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Semaine précédente"
        >
          <Ionicons name="chevron-back" size={20} color={viewedWeek <= 4 ? colors.textMuted : colors.primaryDark} />
        </Pressable>
        <Text style={styles.weekNavLabel}>Semaine {viewedWeek}{isCurrent ? " · en cours" : ""}</Text>
        <Pressable
          onPress={() => setViewedWeek((w) => Math.min(40, w + 1))}
          disabled={viewedWeek >= 40}
          hitSlop={10}
          style={[styles.navBtn, viewedWeek >= 40 && styles.navBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Semaine suivante"
        >
          <Ionicons name="chevron-forward" size={20} color={viewedWeek >= 40 ? colors.textMuted : colors.primaryDark} />
        </Pressable>
      </View>
      {!isCurrent ? (
        <Pressable onPress={() => setViewedWeek(currentWeek)} style={styles.backToCurrent}>
          <Ionicons name="refresh" size={14} color={colors.primary} />
          <Text style={styles.backToCurrentText}>Revenir à ma semaine</Text>
        </Pressable>
      ) : null}

      {/* Taille du bébé (comparaison fruit) */}
      <Card style={styles.fruitCard}>
        <Ionicons name="nutrition-outline" size={22} color={colors.primaryDark} />
        <View style={styles.fruitText}>
          <Text style={styles.cardLabel}>Cette semaine, bébé a la taille de</Text>
          <Text style={styles.fruitValue}>{info.fruit}</Text>
        </View>
      </Card>

      {/* Développement */}
      <Card style={styles.infoCard}>
        <Text style={styles.cardTitle}>Développement de bébé</Text>
        <Text style={styles.cardBody}>{info.development}</Text>
      </Card>

      {/* Conseil de la semaine */}
      <Card style={styles.tipCard}>
        <View style={styles.tipHead}>
          <Ionicons name="bulb-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.cardTitle}>Conseil de la semaine</Text>
        </View>
        <Text style={styles.cardBody}>{info.tip}</Text>
      </Card>

      <MedicalDisclaimer text="Ces informations sont générales et ne remplacent pas le suivi de votre sage-femme ou médecin." />

      <Pressable onPress={confirmEnd} disabled={ending} style={styles.endBtn} accessibilityRole="button" accessibilityLabel="Terminer le suivi">
        <Text style={styles.endBtnText}>Terminer le suivi</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },

  // Démarrage
  introCard: { alignItems: "center", gap: spacing.sm },
  introIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  introTitle: { ...typography.h3, textAlign: "center" },
  introText: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 22 },
  formCard: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs },

  // Hero
  heroCard: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.lg, backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
  heroWeekLabel: { ...typography.caption, color: colors.primaryDark, fontWeight: "700", letterSpacing: 1 },
  heroWeek: { fontSize: 56, fontWeight: "700", color: colors.primaryDark, lineHeight: 60 },
  heroTri: { ...typography.name, color: colors.primaryDark },
  progressTrack: { alignSelf: "stretch", height: 8, borderRadius: radius.pill, backgroundColor: colors.white, marginTop: spacing.sm, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.primary },
  progressMeta: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  progressText: { ...typography.caption, color: colors.primaryDark, fontWeight: "600" },
  dueDate: { ...typography.caption, color: colors.primaryDark, marginTop: spacing.xs },

  // Navigation semaines
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  navBtnDisabled: { opacity: 0.4 },
  weekNavLabel: { ...typography.name, color: colors.text },
  backToCurrent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, marginTop: -spacing.xs },
  backToCurrentText: { ...typography.caption, color: colors.primary, fontWeight: "700" },

  // Cartes contenu
  fruitCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  fruitText: { flex: 1 },
  cardLabel: { ...typography.caption, color: colors.textMuted },
  fruitValue: { ...typography.h3, color: colors.primaryDark },
  infoCard: { gap: spacing.xs },
  tipCard: { gap: spacing.xs, backgroundColor: colors.surface },
  tipHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  cardTitle: { ...typography.name },
  cardBody: { ...typography.body, color: colors.text, lineHeight: 22 },

  // Terminer
  endBtn: { alignSelf: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  endBtnText: { ...typography.caption, color: colors.textMuted, fontWeight: "700", textDecorationLine: "underline" },
});
