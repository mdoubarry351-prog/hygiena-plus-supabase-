import { Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { Avatar } from "@/components/Avatar";
import { FadeInView } from "@/components/FadeInView";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { useAuth } from "@/providers/AuthProvider";
import { APP_DOWNLOAD_URL } from "@/lib/app-config";
import { colors, fonts, radius, shadows, spacing, typography } from "@/theme";

const STEP = 55; // pas de l'apparition échelonnée (cohérent Vagues 1-5)

// Ligne de menu réutilisable : pastille d'icône + libellé/sous-libellé + chevron.
// Card onPress → effet de pression (scale + ombre) + haptique léger.
function MenuRow({ icon, title, sub, onPress, tint = colors.primary }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; onPress: () => void; tint?: string }) {
  return (
    <Card onPress={onPress} haptic accessibilityLabel={title} style={styles.proCard}>
      <View style={styles.proIcon}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <View style={styles.proText}>
        <Text style={styles.proTitle}>{title}</Text>
        <Text style={styles.proSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Card>
  );
}

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

  async function inviteFriend() {
    try {
      await Share.share({
        message: `Découvre Hygiena+, l'app de santé féminine 🌸. Télécharge-la ici : ${APP_DOWNLOAD_URL}`,
      });
    } catch {
      // partage annulé : rien à faire
    }
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
            <MenuRow icon="medkit" tint={colors.secondary} title="Espace professionnel" sub="Tableau de bord, rendez-vous, disponibilité, fiche médecin" onPress={() => router.push("/(doctor)")} />
          ) : null}
          <MenuRow icon="person-outline" title="Modifier mes informations" sub="Nom, téléphone, email, mot de passe" onPress={() => router.push("/(user)/account")} />
          <MenuRow icon="heart-circle-outline" title="Informations de santé" sub="Âge, mesures, groupe sanguin, allergies — privé" onPress={() => router.push("/(user)/health")} />
          <MenuRow icon="notifications-outline" title="Préférences de notifications" sub="Choisir les notifications à recevoir" onPress={() => router.push("/(user)/notification-settings")} />
          <MenuRow icon="lock-closed-outline" title="Verrouillage & confidentialité" sub="Code PIN, biométrie" onPress={() => router.push("/(user)/lock")} />
          <MenuRow icon="person-remove-outline" title="Comptes bloqués" sub="Gérer les personnes bloquées" onPress={() => router.push("/(user)/blocked")} />
          <MenuRow icon="share-social-outline" title="Inviter un ami" sub="Partage le lien de téléchargement de l'app" onPress={inviteFriend} />
        </FadeInView>

        {/* Aide & informations */}
        <FadeInView fill={false} delay={STEP * 3} style={styles.group}>
          <Text style={[typography.h3, styles.sectionTitle]}>Aide & informations</Text>
          <MenuRow icon="help-circle-outline" title="Aide & FAQ" sub="Questions fréquentes, nous contacter" onPress={() => router.push("/(user)/help")} />
          <MenuRow icon="shield-checkmark-outline" title="Politique de confidentialité" sub="Tes données et tes droits" onPress={() => router.push("/(user)/privacy")} />
          <MenuRow icon="document-text-outline" title="Conditions d'utilisation" sub="Règles d'usage de l'application" onPress={() => router.push("/(user)/terms")} />

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
  formCard: { gap: spacing.sm },
  sectionTitle: { marginTop: spacing.sm },
  proCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  proIcon: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  proText: { flex: 1, gap: 2 },
  proTitle: { ...typography.name },
  proSub: { ...typography.caption, color: colors.textMuted },
});
