import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/AuthProvider";
import { colors, radius, spacing, typography } from "@/theme";

type Item = { seg: string; label: string; href: Href };
type Group = { title: string; items: Item[] };

// Les 10 sections existantes regroupées dans l'esprit de la maquette.
const GROUPS: Group[] = [
  {
    title: "Pilotage",
    items: [
      { seg: "dashboard", label: "Tableau de bord", href: "/(admin)/dashboard" },
      { seg: "stats", label: "Statistiques", href: "/(admin)/stats" },
    ],
  },
  {
    title: "Personnes",
    items: [
      { seg: "users", label: "Utilisateurs", href: "/(admin)/users" },
      { seg: "doctors", label: "Médecins", href: "/(admin)/doctors" },
    ],
  },
  {
    title: "Activité",
    items: [
      { seg: "products", label: "Produits", href: "/(admin)/products" },
      { seg: "orders", label: "Commandes", href: "/(admin)/orders" },
      { seg: "community", label: "Communauté", href: "/(admin)/community" },
    ],
  },
  {
    title: "Modération & système",
    items: [
      { seg: "reports", label: "Signalements", href: "/(admin)/reports" },
      { seg: "suspensions", label: "Suspensions", href: "/(admin)/suspensions" },
      { seg: "settings", label: "Paramètres", href: "/(admin)/settings" },
    ],
  },
];

// Menu latéral affiché en grand écran (desktop/tablette large).
export function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();

  function handleSignOut() {
    Alert.alert("Se déconnecter", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => signOut() },
    ]);
  }

  return (
    <View style={styles.sidebar}>
      <Text style={styles.brand}>
        Hygiena<Text style={styles.plus}>+</Text>
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.nav}>
        {GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
            {group.items.map((item) => {
              const active = pathname === `/${item.seg}` || pathname.endsWith(`/${item.seg}`);
              return (
                <Pressable
                  key={item.seg}
                  onPress={() => router.push(item.href)}
                  style={[styles.item, active && styles.itemActive]}
                >
                  <Text style={[styles.itemText, active && styles.itemTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Pressable onPress={handleSignOut} style={styles.signOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Se déconnecter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 260, backgroundColor: colors.card, borderRightWidth: 1, borderRightColor: colors.border,
    paddingTop: spacing.xl, paddingBottom: spacing.lg, paddingHorizontal: spacing.md,
  },
  brand: { fontSize: 24, fontWeight: "700", color: colors.primaryDark, paddingHorizontal: spacing.sm, marginBottom: spacing.lg },
  plus: { color: colors.accent },
  nav: { gap: spacing.lg, paddingBottom: spacing.lg },
  group: { gap: spacing.xs },
  groupTitle: { ...typography.caption, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.5, paddingHorizontal: spacing.sm, marginBottom: spacing.xs },
  item: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  itemActive: { backgroundColor: colors.primaryLight },
  itemText: { ...typography.body, color: colors.text, fontWeight: "500" },
  itemTextActive: { color: colors.primaryDark, fontWeight: "700" },
  signOut: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  signOutText: { ...typography.body, color: colors.danger, fontWeight: "600" },
});
