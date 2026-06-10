import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Redirect, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { useAuth } from "@/providers/AuthProvider";
import { colors, radius, spacing, typography } from "@/theme";

type Section = {
  href: Href;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
};

const SECTIONS: Section[] = [
  { href: "/(admin)/dashboard", title: "Tableau de bord", subtitle: "Vue d'ensemble", icon: "speedometer-outline", tint: colors.primary },
  { href: "/(admin)/stats", title: "Statistiques", subtitle: "Évolution & graphiques", icon: "bar-chart-outline", tint: colors.secondary },
  { href: "/(admin)/users", title: "Utilisateurs", subtitle: "Profils, rôles", icon: "people-outline", tint: colors.primary },
  { href: "/(admin)/doctors", title: "Médecins", subtitle: "Valider / refuser", icon: "medkit-outline", tint: colors.secondary },
  { href: "/(admin)/products", title: "Marketplace", subtitle: "Produits", icon: "bag-handle-outline", tint: colors.accent },
  { href: "/(admin)/orders", title: "Commandes", subtitle: "Suivi & statuts", icon: "receipt-outline", tint: colors.primary },
  { href: "/(admin)/community", title: "Communauté", subtitle: "Modération des publications", icon: "chatbubbles-outline", tint: colors.secondary },
  { href: "/(admin)/reports", title: "Signalements", subtitle: "Traiter les signalements", icon: "flag-outline", tint: colors.danger },
  { href: "/(admin)/suspensions", title: "Suspensions", subtitle: "Suspendre / réactiver", icon: "hand-left-outline", tint: colors.danger },
  { href: "/(admin)/settings", title: "Paramètres", subtitle: "Modules de l'application", icon: "settings-outline", tint: colors.textMuted },
];

export default function AdminHub() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Desktop : la sidebar gère la navigation → on affiche directement le tableau
  // de bord dans la zone de contenu (le hub mobile reste pour les petits écrans).
  if (width >= 900) return <Redirect href="/(admin)/dashboard" />;

  function handleSignOut() {
    Alert.alert("Se déconnecter", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => signOut() },
    ]);
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.titleBlock}>
          <Text style={typography.h2}>Administration</Text>
          <Text style={styles.sub}>{profile?.full_name ?? "Admin"}</Text>
        </View>
        <Pressable onPress={handleSignOut} hitSlop={10} style={styles.signOut}>
          <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {SECTIONS.map((s) => (
          <Pressable key={s.title} onPress={() => router.push(s.href)}>
            <Card style={styles.row}>
              <View style={[styles.icon, { backgroundColor: s.tint + "22" }]}>
                <Ionicons name={s.icon} size={22} color={s.tint} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{s.title}</Text>
                <Text style={styles.rowSub}>{s.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg },
  titleBlock: { gap: 2 },
  sub: { ...typography.caption, color: colors.textMuted },
  signOut: { padding: spacing.xs },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, fontWeight: "600" },
  rowSub: { ...typography.caption, color: colors.textMuted },
});
