import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { useAuth } from "@/providers/AuthProvider";
import { colors, fonts, radius, spacing, typography } from "@/theme";

// Lien de téléchargement de l'app partagé via « Inviter un ami ».
// À REMPLACER par le lien store réel (App Store / Play Store) une fois publié.
const APP_DOWNLOAD_URL = "https://hygiena.plus";

export default function Profile() {
  const { profile, role, signOut } = useAuth();
  const router = useRouter();

  if (!profile) return <Loading />;

  function handleSignOut() {
    Alert.alert("Se déconnecter", "Voulez-vous vraiment vous déconnecter ?", [
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

  const initial = (profile.full_name ?? profile.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={typography.h2}>Mon profil</Text>

        <View style={styles.avatarBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          {profile.email ? <Text style={styles.email}>{profile.email}</Text> : null}
        </View>

        <Pressable onPress={() => router.push("/(user)/premium")}>
          <Card style={styles.statusCard}>
            <View style={styles.statusLeft}>
              <Ionicons
                name={profile.is_premium ? "star" : "star-outline"}
                size={22}
                color={profile.is_premium ? colors.accent : colors.textMuted}
              />
              <View>
                <Text style={styles.statusTitle}>
                  {profile.is_premium ? "Compte Premium" : "Compte gratuit"}
                </Text>
                <Text style={styles.statusSub}>
                  {profile.is_premium
                    ? "Messagerie médecins illimitée. Gérer mon abonnement."
                    : "Passez Premium pour écrire aux médecins."}
                </Text>
              </View>
            </View>
            {profile.is_premium ? (
              <Text style={styles.badge}>PREMIUM</Text>
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            )}
          </Card>
        </Pressable>

        {role === "doctor" && (
          <Pressable onPress={() => router.push("/(doctor)")}>
            <Card style={styles.proCard}>
              <View style={styles.proIcon}>
                <Ionicons name="medkit" size={22} color={colors.secondary} />
              </View>
              <View style={styles.proText}>
                <Text style={styles.proTitle}>Espace professionnel</Text>
                <Text style={styles.proSub}>
                  Tableau de bord, rendez-vous, disponibilité, fiche médecin
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Card>
          </Pressable>
        )}

        <Pressable onPress={() => router.push("/(user)/account")}>
          <Card style={styles.proCard}>
            <View style={styles.proIcon}>
              <Ionicons name="person-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.proText}>
              <Text style={styles.proTitle}>Modifier mes informations</Text>
              <Text style={styles.proSub}>Nom, téléphone, email, mot de passe</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </Pressable>

        <Pressable onPress={() => router.push("/(user)/lock")}>
          <Card style={styles.proCard}>
            <View style={styles.proIcon}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.proText}>
              <Text style={styles.proTitle}>Verrouillage & confidentialité</Text>
              <Text style={styles.proSub}>Code PIN, biométrie</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </Pressable>

        <Pressable onPress={() => router.push("/(user)/blocked")}>
          <Card style={styles.proCard}>
            <View style={styles.proIcon}>
              <Ionicons name="person-remove-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.proText}>
              <Text style={styles.proTitle}>Comptes bloqués</Text>
              <Text style={styles.proSub}>Gérer les personnes bloquées</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </Pressable>

        <Pressable onPress={inviteFriend}>
          <Card style={styles.proCard}>
            <View style={styles.proIcon}>
              <Ionicons name="share-social-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.proText}>
              <Text style={styles.proTitle}>Inviter un ami</Text>
              <Text style={styles.proSub}>Partagez le lien de téléchargement de l'app</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </Pressable>

        <Text style={[typography.h3, styles.sectionTitle]}>Aide & informations</Text>

        <Pressable onPress={() => router.push("/(user)/help")}>
          <Card style={styles.proCard}>
            <View style={styles.proIcon}>
              <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.proText}>
              <Text style={styles.proTitle}>Aide & FAQ</Text>
              <Text style={styles.proSub}>Questions fréquentes, nous contacter</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </Pressable>

        <Pressable onPress={() => router.push("/(user)/privacy")}>
          <Card style={styles.proCard}>
            <View style={styles.proIcon}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.proText}>
              <Text style={styles.proTitle}>Politique de confidentialité</Text>
              <Text style={styles.proSub}>Vos données et vos droits</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </Pressable>

        <Pressable onPress={() => router.push("/(user)/terms")}>
          <Card style={styles.proCard}>
            <View style={styles.proIcon}>
              <Ionicons name="document-text-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.proText}>
              <Text style={styles.proTitle}>Conditions d'utilisation</Text>
              <Text style={styles.proSub}>Règles d'usage de l'application</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </Pressable>

        <Button title="Se déconnecter" variant="outline" onPress={handleSignOut} />

        <DeleteAccountButton />
      </ScrollView>
    </Screen>
  );
}

const AVATAR = 84;
const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  avatarBlock: { alignItems: "center", gap: spacing.sm, marginVertical: spacing.sm },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 36, fontWeight: "700", fontFamily: fonts.titleBold, color: colors.primaryDark },
  email: { ...typography.caption },
  statusCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
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
