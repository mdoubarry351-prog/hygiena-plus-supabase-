import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { Avatar } from "@/components/Avatar";
import { FadeInView } from "@/components/FadeInView";
import { MenuRow } from "@/components/MenuRow";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { useAuth } from "@/providers/AuthProvider";
import { PREMIUM_ENABLED } from "@/lib/app-config";
import { colors, fonts, radius, shadows, spacing, typography } from "@/theme";

const STEP = 55; // pas de l'apparition échelonnée (cohérent Vagues 1-5)

export default function Profile() {
  const { profile, role, signOut } = useAuth();
  const router = useRouter();

  if (!profile) return <Loading />;

  function handleSignOut() {
    Alert.alert("Se déconnecter", "Veux-tu vraiment te déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Déconnexion échouée");
          }
        },
      },
    ]);
  }

  const fullName =
    profile.full_name?.trim() ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();

  return (
    <Screen>
      <View style={styles.fill}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* En-tête : avatar + identité + statut Premium */}
        <FadeInView fill={false} delay={0} style={styles.group}>
          <Text style={typography.h2}>Mon profil</Text>

          <View style={styles.avatarBlock}>
            <View style={styles.avatarRing}>
              <Avatar name={fullName || profile.email} size={AVATAR} />
            </View>
            {fullName ? <Text style={styles.fullName}>{fullName}</Text> : null}
            {profile.email ? (
              <View style={styles.contactLine}>
                <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
                <Text style={styles.contactText}>{profile.email}</Text>
              </View>
            ) : null}
            {profile.phone ? (
              <View style={styles.contactLine}>
                <Ionicons name="call-outline" size={14} color={colors.textMuted} />
                <Text style={styles.contactText}>{profile.phone}</Text>
              </View>
            ) : null}
          </View>

          {PREMIUM_ENABLED ? (
            <Card onPress={() => router.push("/(user)/premium")} haptic accessibilityLabel="Mon abonnement" style={[styles.statusCard, profile.is_premium && styles.statusCardPremium]}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusIcon, profile.is_premium && styles.statusIconPremium]}>
                  <Ionicons name={profile.is_premium ? "star" : "star-outline"} size={20} color={profile.is_premium ? colors.accent : colors.textMuted} />
                </View>
                <View style={styles.statusTextWrap}>
                  <Text style={styles.statusTitle}>
                    {profile.is_premium ? "Compte Premium" : "Compte gratuit"}
                  </Text>
                  <Text style={styles.statusSub}>
                    {profile.is_premium
                      ? "Messagerie médecins illimitée. Gérer mon abonnement."
                      : "Passe Premium pour écrire aux médecins."}
                  </Text>
                </View>
              </View>
              {profile.is_premium ? (
                <Text style={styles.badge}>PREMIUM</Text>
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              )}
            </Card>
          ) : null}
        </FadeInView>

        {/* Mes activités */}
        <FadeInView fill={false} delay={STEP} style={styles.group}>
          <Text style={[typography.h3, styles.sectionTitle]}>Mes activités</Text>
          <MenuRow icon="calendar-number-outline" title="Mon cycle · Historique" sub="Tous mes cycles enregistrés" onPress={() => router.push("/(user)/cycle/history")} />
          <MenuRow icon="bar-chart-outline" title="Statistiques du cycle" sub="Durées, symptômes, humeur, douleur" onPress={() => router.push("/(user)/cycle/stats")} />
          <MenuRow icon="medkit-outline" title="Mes rendez-vous" sub="Consultations passées et à venir" onPress={() => router.push("/(user)/appointments/mine")} />
          <MenuRow icon="receipt-outline" title="Mes commandes" sub="Suivi de mes achats boutique" onPress={() => router.push("/(user)/marketplace/orders")} />
          <MenuRow icon="chatbubbles-outline" title="Mon activité communautaire" sub="Mes publications, commentaires et réactions" onPress={() => router.push("/(user)/community/activity")} />
        </FadeInView>

        {/* Mon compte */}
        <FadeInView fill={false} delay={STEP * 2} style={styles.group}>
          <Text style={[typography.h3, styles.sectionTitle]}>Mon compte</Text>
          {role === "doctor" ? (
            <MenuRow icon="medkit" tint={colors.secondary} title="Espace professionnel" sub="Tableau de bord, rendez-vous, disponibilité, fiche médecin" onPress={() => router.push("/doctor")} />
          ) : null}
          <MenuRow icon="person-outline" title="Modifier mes informations" sub="Nom, téléphone, email, mot de passe" onPress={() => router.push("/(user)/account")} />
          <MenuRow icon="heart-circle-outline" title="Informations de santé" sub="Âge, mesures, groupe sanguin, allergies — privé" onPress={() => router.push("/(user)/health")} />
          <MenuRow icon="settings-outline" title="Réglages" sub="Notifications, verrouillage, comptes bloqués" onPress={() => router.push("/(user)/settings")} />
          <MenuRow icon="help-circle-outline" title="Aide & à propos" sub="FAQ, confidentialité, conditions, inviter un ami" onPress={() => router.push("/(user)/about")} />
        </FadeInView>

        {/* Déconnexion & zone de danger */}
        <FadeInView fill={false} delay={STEP * 3} style={styles.group}>
          <Button title="Se déconnecter" variant="outline" onPress={handleSignOut} />
          <DeleteAccountButton />
        </FadeInView>
      </ScrollView>
      </View>
    </Screen>
  );
}

const AVATAR = 84;
const styles = StyleSheet.create({
  fill: { flex: 1 },
  group: { gap: spacing.md },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  avatarBlock: { alignItems: "center", gap: spacing.xs, marginVertical: spacing.sm },
  // Halo doux autour de l'avatar (anneau clair + ombre tokenisée).
  avatarRing: { padding: 4, borderRadius: (AVATAR + 8) / 2, backgroundColor: colors.card, ...shadows.sm },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 36, fontWeight: "700", fontFamily: fonts.titleBold, color: colors.primaryDark },
  fullName: { ...typography.h3, marginTop: spacing.xs },
  contactLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  contactText: { ...typography.caption, color: colors.textMuted },
  email: { ...typography.caption },
  statusCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  statusCardPremium: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  statusIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  statusIconPremium: { backgroundColor: colors.white },
  statusTextWrap: { flex: 1 },
  statusTitle: { ...typography.name },
  statusSub: { ...typography.caption, marginTop: 2, flexShrink: 1 },
  badge: {
    ...typography.caption,
    color: colors.white,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
    fontWeight: "700",
  },
  sectionTitle: { marginTop: spacing.sm },
});
