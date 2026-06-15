import { useState, useCallback } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Divider } from "@/components/Divider";
import { Loading } from "@/components/Loading";
import { CycleRing } from "@/components/CycleRing";
import { OfflineBanner } from "@/components/OfflineBanner";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { useCycles } from "@/hooks/useCycles";
import { currentPhase, getDailyTip, PHASE_LABEL } from "@/lib/cycle-tips";
import { useAppSettings, showServiceUnavailable } from "@/hooks/useAppSettings";
import { useAuth } from "@/providers/AuthProvider";
import { notificationsService } from "@/lib/notifications-service";
import { colors, fonts, radius, spacing, typography } from "@/theme";

const logo = require("../../assets/logo/hygiena-icon-1024.png");

function formatShort(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function daysUntil(d: Date | null | undefined): number | null {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// Salutation selon l'heure : « Bonsoir » à partir de 18h (et avant 5h), « Bonjour » sinon.
function greeting(): { word: string; emoji: string } {
  const h = new Date().getHours();
  const evening = h >= 18 || h < 5;
  return evening ? { word: "Bonsoir", emoji: "🌙" } : { word: "Bonjour", emoji: "🌿" };
}

// Date du jour en format long FR, capitalisée (ex. « Jeudi 13 juin »).
function todayLongLabel(): string {
  const s = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CycleHome() {
  const { profile, session, role } = useAuth();
  const { cycles, prediction, loading, reload, offline, cachedAt } = useCycles();
  const { marketplace_enabled, doctors_enabled, premium_enabled } = useAppSettings();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!session?.user) return;
    try {
      setUnread(await notificationsService.getUnreadCount(session.user.id));
    } catch {
      // Compteur non bloquant.
    }
  }, [session?.user]);

  // Les cycles se rechargent déjà au focus via useCycles ; ici on ne (re)charge
  // que le compteur de notifications non lues.
  useFocusEffect(useCallback(() => { loadUnread(); }, [loadUnread]));

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([reload(), loadUnread()]);
    setRefreshing(false);
  }

  if (loading && cycles.length === 0) return <Loading />;

  const isDoctor = role === "doctor";
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const greet = greeting();
  const todayLabel = todayLongLabel();
  const day = prediction?.currentDay;
  const avg = prediction?.averageCycleLength;
  const hasData = !!prediction?.hasEnoughData;

  const fertileStart = prediction?.fertileWindowStart ?? null;
  const fertileEnd = prediction?.fertileWindowEnd ?? null;
  const periodIn = daysUntil(prediction?.nextPeriodStart);

  // Bornes des phases en JOUR-DE-CYCLE (dérivées des données déjà chargées).
  // Règles : durée réelle (averagePeriodLength, repli 5). Ovulation ≈ N-14
  // (phase lutéale de 14 j). Fenêtre fertile : ovulation -5 → +1.
  const ringN = avg ?? 28;
  const periodLen = prediction?.averagePeriodLength ?? 5;
  const ovulationDay = Math.max(periodLen + 1, ringN - 14);
  const fertileStartDay = Math.max(periodLen + 1, ovulationDay - 5);
  const fertileEndDay = Math.min(ringN, ovulationDay + 1);

  // Phase courante (même logique que l'anneau) + conseil du jour déterministe.
  const phase = hasData ? currentPhase({ day, periodLen, fertileStartDay, fertileEndDay, ovulationDay }) : null;
  const dailyTip = phase ? getDailyTip(phase) : null;

  // Niveau de confiance dérivé du nombre de cycles enregistrés (présentation).
  const conf = cycles.length >= 4
    ? { label: "élevée", color: colors.success }
    : cycles.length >= 2
      ? { label: "moyenne", color: colors.secondary }
      : { label: "faible", color: colors.accent };

  // Cartes d'accès rapide (Consultations masquée pour un médecin).
  const quick: { emoji: string; title: string; sub: string; href: Href; module?: "marketplace" | "doctors" }[] = [
    { emoji: "🩸", title: "Mon cycle", sub: "Suivi menstruel", href: "/(user)/cycle/calendar" },
    ...(!isDoctor ? [{ emoji: "🌼", title: "Consultations", sub: "Médecins vérifiées", href: "/(user)/appointments" as Href, module: "doctors" as const }] : []),
    { emoji: "🛍️", title: "Boutique", sub: "Produits santé", href: "/(user)/marketplace", module: "marketplace" },
    { emoji: "💬", title: "Forum", sub: "Communauté", href: "/(user)/community" },
    { emoji: "📚", title: "Conseils & infos", sub: "Articles santé", href: "/(user)/library" },
  ];

  // Bloque la navigation vers un module désactivé par l'admin (message au tap).
  function openQuick(q: (typeof quick)[number]) {
    if (q.module === "marketplace" && !marketplace_enabled) return showServiceUnavailable();
    if (q.module === "doctors" && !doctors_enabled) return showServiceUnavailable();
    router.push(q.href);
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* 1 · En-tête */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Image source={logo} style={styles.avatarImg} resizeMode="contain" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.hello} numberOfLines={1}>{greet.word}, {firstName || "toi"} {greet.emoji}</Text>
            <Text style={styles.headerDate} numberOfLines={1}>{todayLabel}</Text>
          </View>
          <Pressable onPress={() => router.push("/(user)/notifications")} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            {unread > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text></View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push("/(user)/profile")} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Mon profil">
            <Ionicons name="heart-outline" size={24} color={colors.primary} />
          </Pressable>
        </View>

        {offline ? <OfflineBanner cachedAt={cachedAt} /> : null}

        {/* 1 · Anneau du cycle segmenté par phase — remonté en tête (élément central, visible sans scroller) */}
        <Card style={styles.ringCard}>
          <CycleRing
            cycleLength={ringN}
            currentDay={day ?? null}
            periodLength={periodLen}
            fertileStartDay={fertileStartDay}
            fertileEndDay={fertileEndDay}
            ovulationDay={ovulationDay}
          />
        </Card>

        {/* 2 · Grand bouton d'action */}
        <Pressable onPress={() => router.push("/(user)/cycle/log")} style={styles.cta}>
          <View style={styles.ctaIcon}><Ionicons name="add" size={22} color={colors.white} /></View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle}>Enregistrer aujourd'hui</Text>
            <Text style={styles.ctaSub}>Flux, douleurs, humeurs et symptômes</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </Pressable>

        {/* 3 · Prédictions consolidées (confiance + 3 lignes), ou amorce si pas de données */}
        {hasData ? (
          <Card style={styles.predBlock}>
            <View style={styles.confRow}>
              <View style={[styles.confDot, { backgroundColor: conf.color }]} />
              <Text style={styles.confText}>Confiance {conf.label} — Fiabilité des prévisions</Text>
            </View>
            <Divider />
            <PredRow
              label="Prochaines règles"
              value={formatShort(prediction?.nextPeriodStart)}
              extra={periodIn != null && periodIn >= 0 ? `dans ${periodIn} jour${periodIn > 1 ? "s" : ""}` : undefined}
            />
            <PredRow label="Ovulation estimée" value={formatShort(prediction?.nextOvulation)} />
            <PredRow label="Fenêtre fertile" value={`${formatShort(fertileStart)} → ${formatShort(fertileEnd)}`} />
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="sparkles-outline" size={20} color={colors.primaryDark} />
            </View>
            <Text style={styles.emptyText}>
              Commence par enregistrer tes règles pour voir tes prédictions et ton cycle.
            </Text>
          </Card>
        )}

        {/* Rappel : les prédictions sont indicatives, pas un avis médical (sous les prédictions). */}
        {hasData ? (
          <MedicalDisclaimer text="Les prédictions sont des estimations indicatives et ne constituent pas un avis médical." />
        ) : null}

        {/* 4 · Conseil du jour (remonté, avant Accès rapide ; masqué si phase inconnue) */}
        {dailyTip && phase ? (
          <Card style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Ionicons name="bulb-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.tipBody}>
              <Text style={styles.tipTitle}>Conseil du jour · {PHASE_LABEL[phase]}</Text>
              <Text style={styles.tipText}>{dailyTip}</Text>
              <MedicalDisclaimer text="Conseils bien-être, pas un avis médical." compact />
            </View>
          </Card>
        ) : null}

        {/* 5 · Accès rapide */}
        <Text style={[typography.h3, styles.sectionTitle]}>Accès rapide</Text>

        {/* 6 · Grille 2×2 */}
        <View style={styles.grid}>
          {quick.map((q) => (
            <View key={q.title} style={styles.quickWrap}>
              <Card onPress={() => openQuick(q)} haptic accessibilityLabel={q.title} style={styles.quickCard}>
                <View style={styles.quickIcon}><Text style={styles.quickEmoji}>{q.emoji}</Text></View>
                <Text style={styles.quickTitle}>{q.title}</Text>
                <Text style={styles.quickSub}>{q.sub}</Text>
              </Card>
            </View>
          ))}
        </View>

        {/* 7 · Promotion Premium (masquée si déjà premium) */}
        {profile?.is_premium ? (
          <View style={styles.premiumActive}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primaryDark} />
            <Text style={styles.premiumActiveText}>Premium actif</Text>
          </View>
        ) : (
          <Pressable onPress={() => { if (!premium_enabled) return showServiceUnavailable(); router.push("/(user)/premium"); }}>
            <Card style={styles.premiumCard}>
              <View style={styles.premiumIcon}>
                <Ionicons name="sparkles" size={20} color={colors.accent} />
              </View>
              <View style={styles.premiumText}>
                <Text style={styles.premiumTitle}>Passer au mode premium</Text>
                <Text style={styles.premiumSub}>
                  Messagerie illimitée avec les médecins • Conseils à tout moment • Suivi prioritaire
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
            </Card>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

// Ligne de prédiction : libellé à gauche, valeur (+ extra) à droite.
function PredRow({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <View style={styles.predRow2}>
      <Text style={styles.predRowLabel}>{label}</Text>
      <View style={styles.predRowRight}>
        <Text style={styles.predRowValue}>{value}</Text>
        {extra ? <Text style={styles.predRowExtra}>{extra}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },

  // En-tête
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 30, height: 30 },
  headerText: { flex: 1, gap: 1 },
  hello: { ...typography.h2, fontSize: 20 },
  headerDate: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
  iconBtn: { padding: spacing.xs },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: colors.white, fontSize: 11, fontFamily: fonts.bodyBold },

  // CTA
  cta: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, shadowColor: colors.primaryDark, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  ctaIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  ctaText: { flex: 1, gap: 2 },
  ctaTitle: { color: colors.white, fontSize: 16, fontFamily: fonts.bodyBold, fontWeight: "700" },
  ctaSub: { ...typography.caption, color: colors.white, opacity: 0.9, fontFamily: fonts.body },

  // Promotion premium
  premiumCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  premiumIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  premiumText: { flex: 1, gap: 2 },
  premiumTitle: { ...typography.name, color: colors.primaryDark },
  premiumSub: { ...typography.caption, color: colors.textMuted },
  premiumActive: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  premiumActiveText: { ...typography.caption, color: colors.primaryDark, fontFamily: fonts.bodySemiBold },

  // Conseil du jour
  tipCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tipIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  tipBody: { flex: 1, gap: 2 },
  tipTitle: { ...typography.name, color: colors.primaryDark },
  tipText: { ...typography.caption, color: colors.primaryDark, lineHeight: 18 },

  // Accès rapide
  sectionTitle: { marginTop: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quickWrap: { width: "48%" },
  quickCard: { gap: spacing.xs },
  quickIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  quickEmoji: { fontSize: 22 },
  quickTitle: { ...typography.body, fontFamily: fonts.bodySemiBold, fontWeight: "700" },
  quickSub: { ...typography.caption, color: colors.textMuted },

  // Anneau
  ringCard: { alignItems: "center", paddingVertical: spacing.lg },

  // Bloc prédictions consolidé
  predBlock: { gap: spacing.sm },
  confRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  confDot: { width: 10, height: 10, borderRadius: 5 },
  confText: { ...typography.caption, color: colors.text, fontFamily: fonts.bodyMedium },
  predDivider: { height: 1, backgroundColor: colors.border },
  predRow2: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  predRowLabel: { ...typography.caption, color: colors.textMuted, fontFamily: fonts.bodySemiBold },
  predRowRight: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs, flexShrink: 1 },
  predRowValue: { ...typography.body, fontFamily: fonts.bodyBold, fontWeight: "700", color: colors.text, textTransform: "capitalize" },
  predRowExtra: { ...typography.caption, color: colors.primary, fontFamily: fonts.bodySemiBold },

  // Amorce (nouvelle utilisatrice, pas de données)
  emptyCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface },
  emptyIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  emptyText: { ...typography.body, color: colors.text, flex: 1, lineHeight: 21 },
});
