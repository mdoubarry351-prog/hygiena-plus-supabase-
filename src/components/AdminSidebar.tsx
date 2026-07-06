import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminBadges, badgeForSeg } from "@/hooks/useAdminBadges";
import { ADMIN_TABS, isActiveSeg, isTabActive, tabSegments } from "@/lib/admin-nav";
import { colors, fonts, radius, spacing, typography } from "@/theme";

// Menu latéral affiché en grand écran (desktop/tablette large) — 8 onglets.
export function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();
  const confirm = useConfirm();
  const badges = useAdminBadges();

  async function handleSignOut() {
    if (await confirm({ title: "Se déconnecter", message: "Voulez-vous vraiment vous déconnecter ?", confirmLabel: "Se déconnecter", danger: true })) {
      signOut();
    }
  }

  return (
    <View style={styles.sidebar}>
      <Text style={styles.brand}>
        Hygiena<Text style={styles.plus}>+</Text>
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.nav}>
        {ADMIN_TABS.map((tab) => {
          const active = isTabActive(pathname, tab);
          const count = tabSegments(tab).reduce((s, seg) => s + badgeForSeg(seg, badges), 0);
          return (
            <View key={tab.seg}>
              <Pressable onPress={() => router.push(tab.href)} style={[styles.item, active && styles.itemActive]}>
                <Ionicons name={tab.icon} size={20} color={active ? colors.primaryDark : colors.textMuted} />
                <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>{tab.label}</Text>
                {count > 0 ? (
                  <View style={styles.badge}><Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text></View>
                ) : null}
              </Pressable>

              {active && tab.subs ? (
                <View style={styles.subList}>
                  {tab.subs.map((sub) => {
                    const subActive = isActiveSeg(pathname, sub.seg);
                    const subCount = badgeForSeg(sub.seg, badges);
                    return (
                      <Pressable key={sub.seg} onPress={() => router.push(sub.href)} style={[styles.subItem, subActive && styles.subItemActive]}>
                        <Text style={[styles.subText, subActive && styles.subTextActive]} numberOfLines={1}>{sub.label}</Text>
                        {subCount > 0 ? (
                          <View style={styles.badge}><Text style={styles.badgeText}>{subCount > 99 ? "99+" : subCount}</Text></View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
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
  nav: { gap: spacing.xs, paddingBottom: spacing.lg },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  itemActive: { backgroundColor: colors.primaryLight },
  itemText: { ...typography.body, color: colors.text, fontWeight: "500", flex: 1 },
  itemTextActive: { color: colors.primaryDark, fontWeight: "700" },
  subList: { gap: 2, paddingLeft: spacing.lg, marginTop: 2, marginBottom: spacing.xs },
  subItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  subItemActive: { backgroundColor: colors.surface },
  subText: { ...typography.caption, color: colors.textMuted, fontWeight: "600", flex: 1 },
  subTextActive: { color: colors.primaryDark, fontWeight: "700" },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  badgeText: { color: colors.white, fontSize: 11, fontFamily: fonts.bodyBold, fontWeight: "700" },
  signOut: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  signOutText: { ...typography.body, color: colors.danger, fontWeight: "600" },
});
