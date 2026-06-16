import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { FadeInView } from "@/components/FadeInView";
import { TrustRow } from "@/components/TrustRow";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useAppSettings } from "@/hooks/useAppSettings";
import { hapticSuccess } from "@/lib/haptics";
import { authService } from "@/lib/auth-service";
import { premiumService } from "@/lib/premium-service";
import { formatPrice } from "@/lib/marketplace-service";
import type { SubscriptionPayment } from "@/lib/database.types";
import { colors, fonts, radius, spacing, typography } from "@/theme";

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function formatPaidAt(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const fmt = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${fmt(start)} → ${fmt(end)}`;
}

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { icon: "chatbubbles-outline", title: "Messagerie illimitée", sub: "Échange des conseils avec les médecins vérifiées." },
  { icon: "shield-checkmark-outline", title: "Suivi prioritaire", sub: "Tes prédictions et rappels mis en avant." },
  { icon: "heart-outline", title: "Soutien bien-être", sub: "Plus de contenus et d'accompagnement." },
];

export default function Premium() {
  const { profile, session, refreshProfile } = useAuth();
  const { premium_enabled, premium_price, premium_duration_days } = useAppSettings();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [paymentsError, setPaymentsError] = useState(false);
  const isPremium = !!profile?.is_premium;

  const loadPayments = useCallback(async () => {
    if (!session?.user) return;
    setLoadingPayments(true);
    setPaymentsError(false);
    try {
      setPayments(await premiumService.getSubscriptionPayments(session.user.id));
    } catch {
      setPaymentsError(true);
    } finally {
      setLoadingPayments(false);
    }
  }, [session?.user]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  async function setPremium(next: boolean) {
    if (!session?.user) return;
    setSaving(true);
    try {
      await authService.updateProfile(session.user.id, { is_premium: next });
      await refreshProfile();
      if (next) {
        hapticSuccess();
        // Paiement SIMULÉ : on consigne aussi un paiement d'abonnement.
        const today = new Date();
        try {
          await premiumService.recordSubscriptionPayment({
            userId: session.user.id,
            amount: premium_price,
            method: "Mobile Money (simulé)",
            plan: "Premium",
            periodStart: toISODate(today),
            periodEnd: toISODate(addDays(today, premium_duration_days)),
          });
          await loadPayments();
        } catch {
          // l'échec d'enregistrement du paiement ne bloque pas l'abonnement
        }
      }
      toast.success(next ? "Bienvenue en Premium 🌿" : "Premium désactivé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action échouée");
    } finally {
      setSaving(false);
    }
  }

  // Module désactivé par l'admin : premium indisponible.
  if (!premium_enabled) {
    return (
      <Screen>
        <ScreenHeader />
        <EmptyState icon="sparkles-outline" title="Service non disponible pour le moment" />
      </Screen>
    );
  }

  return (
    <Screen>
      <FadeInView>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.crown}>
            <Ionicons name="star" size={34} color={colors.white} />
          </View>
          <Text style={styles.title}>Hygiena+ Premium</Text>
          <Text style={styles.sub}>
            {isPremium ? "Ton abonnement est actif." : "Débloque la messagerie avec les médecins."}
          </Text>
          {isPremium ? (
            <View style={styles.activePill}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primaryDark} />
              <Text style={styles.activeText}>Abonnement actif</Text>
            </View>
          ) : null}
        </View>

        {/* Plan : prix + durée (clairs et élégants) — masqué si déjà abonnée. */}
        {!isPremium ? (
          <Card style={styles.planCard}>
            <Text style={styles.planLabel}>Abonnement Premium</Text>
            <View style={styles.planPriceRow}>
              <Text style={styles.planPrice}>{formatPrice(premium_price)}</Text>
              <Text style={styles.planPeriod}> / {premium_duration_days} jours</Text>
            </View>
            <Text style={styles.planNote}>Sans engagement · paiement simulé, aucun débit réel.</Text>
          </Card>
        ) : null}

        {BENEFITS.map((b) => (
          <Card key={b.title} style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Ionicons name={b.icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitSub}>{b.sub}</Text>
            </View>
          </Card>
        ))}

        <Text style={styles.note}>Paiement simulé — démonstration, aucun débit réel.</Text>

        {!isPremium ? <TrustRow signals={["privacy", "confidential", "noCommitment"]} /> : null}

        {isPremium ? (
          <Button title="Se désabonner" variant="outline" onPress={() => setPremium(false)} loading={saving} />
        ) : (
          <Button title={`S'abonner (simulé) · ${formatPrice(premium_price)}`} onPress={() => setPremium(true)} loading={saving} />
        )}

        {/* Historique des paiements */}
        <Text style={[typography.h3, styles.historyTitle]}>Historique des paiements</Text>
        {loadingPayments ? (
          <SkeletonList variant="order" count={2} />
        ) : paymentsError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Historique indisponible"
            message="Impossible de charger tes paiements. Vérifie ta connexion."
            actionLabel="Réessayer"
            onAction={loadPayments}
          />
        ) : payments.length === 0 ? (
          <EmptyState icon="card-outline" title="Aucun paiement pour le moment." />
        ) : (
          payments.map((p) => {
            const period = formatPeriod(p.period_start, p.period_end);
            return (
              <Card key={p.id} style={styles.payCard}>
                <View style={styles.payTop}>
                  <Text style={styles.payAmount}>{formatPrice(p.amount)}</Text>
                  <Text style={styles.payDate}>{formatPaidAt(p.paid_at)}</Text>
                </View>
                <View style={styles.payMeta}>
                  {p.plan ? <Text style={styles.payPlan}>{p.plan}</Text> : null}
                  {p.method ? <Text style={styles.payMethod}>{p.method}</Text> : null}
                </View>
                {period ? <Text style={styles.payPeriod}>Période : {period}</Text> : null}
              </Card>
            );
          })
        )}
      </ScrollView>
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  back: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -spacing.xs },
  backText: { ...typography.body, color: colors.text },
  hero: { alignItems: "center", gap: spacing.xs, marginVertical: spacing.sm },
  crown: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.primaryDark, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  title: { ...typography.h2, marginTop: spacing.sm },
  sub: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  activePill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, marginTop: spacing.xs },
  activeText: { ...typography.caption, color: colors.primaryDark, fontFamily: fonts.bodySemiBold },
  planCard: { alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryLight, borderColor: colors.primary },
  planLabel: { ...typography.caption, color: colors.primaryDark, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  planPriceRow: { flexDirection: "row", alignItems: "baseline" },
  planPrice: { ...typography.h1, color: colors.primaryDark },
  planPeriod: { ...typography.body, color: colors.primaryDark, fontWeight: "600" },
  planNote: { ...typography.caption, color: colors.primaryDark, opacity: 0.8 },
  benefit: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  benefitIcon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  benefitText: { flex: 1, gap: 2 },
  benefitTitle: { ...typography.name },
  benefitSub: { ...typography.caption, color: colors.textMuted },
  note: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  historyTitle: { marginTop: spacing.md },
  payCard: { gap: spacing.xs },
  payTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  payAmount: { ...typography.name, color: colors.primaryDark },
  payDate: { ...typography.caption, color: colors.textMuted },
  payMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  payPlan: { ...typography.caption, color: colors.white, backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.pill, overflow: "hidden", fontWeight: "700" },
  payMethod: { ...typography.caption, color: colors.textMuted },
  payPeriod: { ...typography.caption, color: colors.textMuted },
});
