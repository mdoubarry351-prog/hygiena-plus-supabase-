import { useState, useCallback } from "react";
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Divider } from "@/components/Divider";
import { Loading } from "@/components/Loading";
import { CycleRing } from "@/components/CycleRing";
import { FadeInView } from "@/components/FadeInView";
import { PressableScale } from "@/components/PressableScale";
import { OfflineBanner } from "@/components/OfflineBanner";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { useCycles } from "@/hooks/useCycles";
import { currentPhase, getDailyTip, PHASE_LABEL } from "@/lib/cycle-tips";
import { useAppSettings, SERVICE_UNAVAILABLE_MSG } from "@/hooks/useAppSettings";
import { useToast } from "@/providers/ToastProvider";
import { useAuth } from "@/providers/AuthProvider";
import { notificationsService } from "@/lib/notifications-service";
import { SHOW_ARTICLES } from "@/lib/app-config";
import { appointmentsService, doctorDisplayName, formatAppointmentTime, type AppointmentWithDoctor } from "@/lib/appointments-service";
import { marketplaceService, formatPrice } from "@/lib/marketplace-service";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, formatOrderDate, orderItemCount } from "@/lib/order-display";
import type { AppointmentStatus, MarketplaceOrder } from "@/lib/database.types";
import { colors, fonts, phase as PHASE_COLOR, radius, shadows, spacing, typography } from "@/theme";

const logo = require("../../assets/logo/hygiena-icon-drop.png");

// Pas de décalage entre blocs pour l'apparition échelonnée (stagger sobre).
const STEP = 60;

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

// Clé date locale « YYYY-MM-DD » du jour (comparaison lexicale aux RDV).
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Libellés/teintes de statut RDV (présentation, alignés sur « Mes rendez-vous »).
// Seuls pending/confirmed apparaissent ici (on ne montre que les RDV à venir).
const APPT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "En attente", confirmed: "Confirmé", cancelled: "Annulé", completed: "Terminé",
};
const APPT_STATUS_COLOR: Record<AppointmentStatus, string> = {
  pending: colors.accent, confirmed: colors.secondary, cancelled: colors.danger, completed: colors.success,
};

// Date de RDV compacte (« Lundi 15 juin »), midi forcé contre les décalages TZ.
function apptShort(dateISO: string): string {
  const s = new Date(`${dateISO}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CycleHome() {
  const { profile, session, role } = useAuth();
  const { cycles, prediction, loading, reload, offline, cachedAt } = useCycles();
  const { marketplace_enabled, doctors_enabled } = useAppSettings();
  const toast = useToast();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const [nextAppt, setNextAppt] = useState<AppointmentWithDoctor | null>(null);
  const [currentOrder, setCurrentOrder] = useState<MarketplaceOrder | null>(null);

  const loadUnread = useCallback(async () => {
    if (!session?.user) return;
    try {
      setUnread(await notificationsService.getUnreadCount(session.user.id));
    } catch {
      // Compteur non bloquant.
    }
  }, [session?.user]);

  // Cartes contextuelles (prochain RDV à venir + commande en cours) : lectures
  // légères, en parallèle, NON bloquantes pour l'anneau. Bornées aux modules
  // activés par l'admin. Chaque source est isolée (un échec n'affecte pas l'autre).
  const loadContext = useCallback(async () => {
    if (!session?.user) return;
    const uid = session.user.id;
    const key = todayKey();
    const [appts, orders] = await Promise.all([
      doctors_enabled ? appointmentsService.getAppointments(uid).catch(() => []) : Promise.resolve([]),
      marketplace_enabled ? marketplaceService.getOrders(uid).catch(() => []) : Promise.resolve([]),
    ]);
    const upcoming = appts
      .filter((a) => (a.status === "pending" || a.status === "confirmed") && a.appointment_date >= key)
      .sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time));
    setNextAppt(upcoming[0] ?? null);
    setCurrentOrder(orders.find((o) => o.status !== "completed" && o.status !== "cancelled") ?? null);
  }, [session?.user, doctors_enabled, marketplace_enabled]);

  // Les cycles se rechargent déjà au focus via useCycles ; ici on (re)charge le
  // compteur de notifications et les cartes contextuelles (sans bloquer l'anneau).
  useFocusEffect(useCallback(() => { loadUnread(); loadContext(); }, [loadUnread, loadContext]));

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([reload(), loadUnread(), loadContext()]);
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
  // Raccourcis « Mes espaces » — icônes au trait dans des pastilles pastel
  // (design Coton doux : chaque espace a sa teinte propre, finis les emojis).
  const quick: { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string; title: string; sub: string; href: Href; module?: "marketplace" | "doctors" }[] = [
    { icon: "water", bg: colors.dangerSoft, fg: colors.danger, title: "Mon cycle", sub: "Suivi menstruel", href: "/(user)/cycle/calendar" },
    ...(!isDoctor ? [{ icon: "pulse" as const, bg: colors.successSoft, fg: colors.secondary, title: "Consultations", sub: "Gynéco & thérapie", href: "/(user)/appointments/hub" as Href, module: "doctors" as const }] : []),
    { icon: "bag-handle", bg: colors.warningSoft, fg: colors.accent, title: "Boutique", sub: "Produits santé", href: "/(user)/marketplace", module: "marketplace" },
    { icon: "chatbubbles", bg: colors.primaryLight, fg: colors.primary, title: "Forum", sub: "Communauté", href: "/(user)/community" },
    // « Conseils & infos » masqué de l'accueil (réversible via SHOW_ARTICLES).
    // La bibliothèque /(user)/library et l'admin Articles restent accessibles.
    ...(SHOW_ARTICLES ? [{ icon: "book" as const, bg: colors.neutralSoft, fg: colors.textMuted, title: "Conseils & infos", sub: "Articles santé", href: "/(user)/library" as Href }] : []),
  ];

  // Bloque la navigation vers un module désactivé par l'admin (message au tap).
  function openQuick(q: (typeof quick)[number]) {
    if (q.module === "marketplace" && !marketplace_enabled) return toast.info(SERVICE_UNAVAILABLE_MSG);
    if (q.module === "doctors" && !doctors_enabled) return toast.info(SERVICE_UNAVAILABLE_MSG);
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
        <FadeInView fill={false} delay={0}>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Image source={logo} style={styles.avatarImg} resizeMode="contain" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.hello} numberOfLines={1}>{greet.word}, {firstName || "toi"} {greet.emoji}</Text>
              <Text style={styles.headerDate} numberOfLines={1}>{todayLabel}</Text>
            </View>
            <PressableScale onPress={() => router.push("/(user)/notifications")} haptic hitSlop={8} scaleTo={0.86} style={styles.iconBtn} accessibilityLabel={unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"}>
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              {unread > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text></View>
              )}
            </PressableScale>
            <PressableScale onPress={() => router.push("/(user)/profile")} haptic hitSlop={8} scaleTo={0.86} style={styles.iconBtn} accessibilityLabel="Mon profil">
              <Ionicons name="heart-outline" size={24} color={colors.primary} />
            </PressableScale>
          </View>
        </FadeInView>

        {offline ? <OfflineBanner cachedAt={cachedAt} /> : null}

        {/* 2 · Anneau du cycle — hero (visible sans scroller) */}
        <FadeInView fill={false} delay={STEP}>
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
        </FadeInView>

        {/* 3 · CTA Enregistrer aujourd'hui */}
        <FadeInView fill={false} delay={STEP * 2}>
          <PressableScale
            onPress={() => router.push("/(user)/cycle/log")}
            haptic
            style={styles.cta}
            pressedStyle={styles.ctaPressed}
            accessibilityLabel="Enregistrer aujourd'hui"
          >
            <View style={styles.ctaIcon}><Ionicons name="add" size={22} color={colors.white} /></View>
            <View style={styles.ctaText}>
              <Text style={styles.ctaTitle}>Enregistrer aujourd'hui</Text>
              <Text style={styles.ctaSub}>Flux, douleurs, humeurs et symptômes</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </PressableScale>
        </FadeInView>

        {/* 3.5 · Cartes contextuelles (affichées seulement si pertinentes) */}
        {nextAppt || currentOrder ? (
          <FadeInView fill={false} delay={STEP * 3}>
            <View style={styles.contextStack}>
              {nextAppt ? (
                <Card onPress={() => router.push("/(user)/appointments/mine")} haptic accessibilityLabel="Voir mes rendez-vous" style={styles.ctxCard}>
                  <View style={[styles.ctxIcon, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="calendar" size={20} color={colors.primaryDark} />
                  </View>
                  <View style={styles.ctxBody}>
                    <Text style={styles.ctxTitle}>Prochain rendez-vous</Text>
                    <Text style={styles.ctxLine} numberOfLines={1}>
                      {doctorDisplayName(nextAppt.doctor?.profile ?? null)}{nextAppt.doctor?.specialty ? ` · ${nextAppt.doctor.specialty}` : ""}
                    </Text>
                    <View style={styles.ctxMetaRow}>
                      <Text style={styles.ctxMeta} numberOfLines={1}>{apptShort(nextAppt.appointment_date)} · {formatAppointmentTime(nextAppt.appointment_time)}</Text>
                      <View style={[styles.ctxBadge, { backgroundColor: APPT_STATUS_COLOR[nextAppt.status] + "1A" }]}>
                        <Text style={[styles.ctxBadgeText, { color: APPT_STATUS_COLOR[nextAppt.status] }]}>{APPT_STATUS_LABEL[nextAppt.status]}</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Card>
              ) : null}
              {currentOrder ? (
                <Card onPress={() => router.push("/(user)/marketplace/orders")} haptic accessibilityLabel="Voir mes commandes" style={styles.ctxCard}>
                  <View style={[styles.ctxIcon, { backgroundColor: colors.surface }]}>
                    <Ionicons name="cube-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.ctxBody}>
                    <Text style={styles.ctxTitle}>Commande en cours</Text>
                    <Text style={styles.ctxLine} numberOfLines={1}>
                      {orderItemCount(currentOrder.items)} article{orderItemCount(currentOrder.items) > 1 ? "s" : ""} · {formatPrice(currentOrder.total_amount)}
                    </Text>
                    <View style={styles.ctxMetaRow}>
                      <Text style={styles.ctxMeta} numberOfLines={1}>{formatOrderDate(currentOrder.created_at)}</Text>
                      <View style={[styles.ctxBadge, { backgroundColor: ORDER_STATUS_COLORS[currentOrder.status] + "1A" }]}>
                        <Text style={[styles.ctxBadgeText, { color: ORDER_STATUS_COLORS[currentOrder.status] }]}>{ORDER_STATUS_LABELS[currentOrder.status]}</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Card>
              ) : null}
            </View>
          </FadeInView>
        ) : null}

        {/* 4 · Prédictions consolidées (+ rappel), ou amorce si pas de données */}
        <FadeInView fill={false} delay={STEP * 4}>
          {hasData ? (
            <>
              <Card style={styles.predBlock}>
                <View style={styles.confRow}>
                  <View style={[styles.confDot, { backgroundColor: conf.color }]} />
                  <Text style={styles.confText}>Confiance {conf.label} — Fiabilité des prévisions</Text>
                </View>
                <Divider />
                <PredRow
                  icon="water-outline"
                  tint={PHASE_COLOR.period}
                  label="Prochaines règles"
                  value={formatShort(prediction?.nextPeriodStart)}
                  extra={periodIn != null && periodIn >= 0 ? `dans ${periodIn} jour${periodIn > 1 ? "s" : ""}` : undefined}
                />
                <PredRow icon="ellipse-outline" tint={PHASE_COLOR.ovulation} label="Ovulation estimée" value={formatShort(prediction?.nextOvulation)} />
                <PredRow icon="leaf-outline" tint={PHASE_COLOR.fertile} label="Fenêtre fertile" value={`${formatShort(fertileStart)} → ${formatShort(fertileEnd)}`} />
              </Card>
              <View style={styles.afterCard}>
                <MedicalDisclaimer text="Les prédictions sont des estimations indicatives et ne constituent pas un avis médical." />
              </View>
            </>
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
        </FadeInView>

        {/* 5 · Conseil du jour (masqué si phase inconnue) */}
        {dailyTip && phase ? (
          <FadeInView fill={false} delay={STEP * 5}>
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
          </FadeInView>
        ) : null}

        {/* 6 · Accès rapide */}
        <FadeInView fill={false} delay={STEP * 6}>
          <Text style={[typography.h3, styles.sectionTitle]}>Mes espaces</Text>
          <View style={styles.grid}>
            {quick.map((q) => (
              <View key={q.title} style={styles.quickWrap}>
                <Card onPress={() => openQuick(q)} haptic accessibilityLabel={q.title} style={styles.quickCard}>
                  <View style={[styles.quickIcon, { backgroundColor: q.bg }]}><Ionicons name={q.icon} size={21} color={q.fg} /></View>
                  <Text style={styles.quickTitle}>{q.title}</Text>
                  <Text style={styles.quickSub}>{q.sub}</Text>
                </Card>
              </View>
            ))}
          </View>
        </FadeInView>
      </ScrollView>
    </Screen>
  );
}

// Ligne de prédiction : pastille colorée + libellé discret à gauche, valeur
// forte (+ délai en accent) à droite. Alignement vertical centré.
function PredRow({ icon, tint, label, value, extra }: { icon: keyof typeof Ionicons.glyphMap; tint: string; label: string; value: string; extra?: string }) {
  return (
    <View style={styles.predRow2}>
      <View style={styles.predRowLeft}>
        <View style={[styles.predIcon, { backgroundColor: tint + "1A" }]}>
          <Ionicons name={icon} size={14} color={tint} />
        </View>
        <Text style={styles.predRowLabel} numberOfLines={1}>{label}</Text>
      </View>
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
  // État pressé : on creuse le halo coloré (même teinte primaryDark).
  ctaPressed: { shadowOpacity: 0.34, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
  ctaIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  ctaText: { flex: 1, gap: 2 },
  ctaTitle: { color: colors.white, fontSize: 16, fontFamily: fonts.bodyBold, fontWeight: "700" },
  ctaSub: { ...typography.caption, color: colors.white, opacity: 0.9, fontFamily: fonts.body },


  // Cartes contextuelles (prochain RDV, commande en cours)
  contextStack: { gap: spacing.sm },
  ctxCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  ctxIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  ctxBody: { flex: 1, gap: 2 },
  ctxTitle: { ...typography.name, color: colors.text },
  ctxLine: { ...typography.caption, color: colors.textMuted },
  ctxMetaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2, flexWrap: "wrap" },
  ctxMeta: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
  ctxBadge: { paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.pill },
  ctxBadgeText: { ...typography.caption, fontSize: 11, fontFamily: fonts.bodySemiBold },

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
  quickTitle: { ...typography.body, fontFamily: fonts.bodySemiBold, fontWeight: "700" },
  quickSub: { ...typography.caption, color: colors.textMuted },

  // Anneau — hero (ombre douce md, plus d'air)
  ringCard: { alignItems: "center", paddingVertical: spacing.xl, ...shadows.md },

  // Bloc prédictions consolidé
  predBlock: { gap: spacing.sm },
  afterCard: { marginTop: spacing.md },
  confRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  confDot: { width: 10, height: 10, borderRadius: 5 },
  confText: { ...typography.caption, color: colors.text, fontFamily: fonts.bodyMedium },
  predRow2: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingVertical: 3 },
  predRowLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  predIcon: { width: 26, height: 26, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  predRowLabel: { ...typography.caption, color: colors.textMuted, fontFamily: fonts.bodySemiBold, flexShrink: 1 },
  predRowRight: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs, flexShrink: 0 },
  predRowValue: { ...typography.body, fontFamily: fonts.bodyBold, fontWeight: "700", color: colors.text, textTransform: "capitalize" },
  predRowExtra: { ...typography.caption, color: colors.primary, fontFamily: fonts.bodySemiBold },

  // Amorce (nouvelle utilisatrice, pas de données)
  emptyCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface },
  emptyIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  emptyText: { ...typography.body, color: colors.text, flex: 1, lineHeight: 21 },
});
