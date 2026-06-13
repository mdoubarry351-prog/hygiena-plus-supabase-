import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminBadges, badgeForSeg } from "@/hooks/useAdminBadges";
import { colors, fonts, radius, spacing, typography } from "@/theme";

type Item = { seg: string; label: string; href: Href };
type Group = { title: string; items: Item[] };

// Sections regroupées (alignées sur le drawer mobile).
const GROUPS: Group[] = [
  {
    title: "Pilotage",
    items: [
      { seg: "dashboard", label: "Dashboard", href: "/(admin)/dashboard" },
    ],
  },
  {
    title: "Comptes",
    items: [
      { seg: "users", label: "Utilisateurs", href: "/(admin)/users" },
      { seg: "doctors", label: "Médecins", href: "/(admin)/doctors" },
      { seg: "accounts", label: "Gestion des comptes", href: "/(admin)/accounts" },
    ],
  },
  {
    title: "Services",
    items: [
      { seg: "reports", label: "Signalements", href: "/(admin)/reports" },
      { seg: "settings", label: "Gestion des services", href: "/(admin)/settings" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { seg: "products", label: "Produits", href: "/(admin)/products" },
      { seg: "orders", label: "Commandes", href: "/(admin)/orders" },
      { seg: "reviews", label: "Avis", href: "/(admin)/reviews" },
      { seg: "store-settings", label: "Boutique", href: "/(admin)/store-settings" },
    ],
  },
  {
    title: "Communauté",
    items: [
      { seg: "community", label: "Modération", href: "/(admin)/community" },
      { seg: "banned-words", label: "Mots interdits", href: "/(admin)/banned-words" },
      { seg: "articles", label: "Articles", href: "/(admin)/articles" },
      { seg: "broadcast", label: "Diffusion", href: "/(admin)/broadcast" },
    ],
  },
  {
    title: "Système",
    items: [
      { seg: "stats", label: "Statistiques", href: "/(admin)/stats" },
      { seg: "suspensions", label: "Suspensions", href: "/(admin)/suspensions" },
      { seg: "logs", label: "Journal d'audit", href: "/(admin)/logs" },
    ],
  },
];

// Menu latéral affiché en grand écran (desktop/tablette large).
export function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();
  const badges = useAdminBadges();

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
              const count = badgeForSeg(item.seg, badges);
              return (
                <Pressable
                  key={item.seg}
                  onPress={() => router.push(item.href)}
                  style={[styles.item, active && styles.itemActive]}
                >
                  <Text style={[styles.itemText, active && styles.itemTextActive]}>{item.label}</Text>
                  {count > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
                    </View>
                  ) : null}
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
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  itemActive: { backgroundColor: colors.primaryLight },
  itemText: { ...typography.body, color: colors.text, fontWeight: "500", flex: 1 },
  itemTextActive: { color: colors.primaryDark, fontWeight: "700" },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  badgeText: { color: colors.white, fontSize: 11, fontFamily: fonts.bodyBold, fontWeight: "700" },
  signOut: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  signOutText: { ...typography.body, color: colors.danger, fontWeight: "600" },
});
