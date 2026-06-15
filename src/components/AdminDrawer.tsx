import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { Alert, Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminBadges, badgeForSeg } from "@/hooks/useAdminBadges";
import { ADMIN_TABS, isActiveSeg, isTabActive, tabSegments } from "@/lib/admin-nav";
import { colors, fonts, radius, spacing, typography } from "@/theme";

// =====================================================
// Contexte d'UI admin : état du menu latéral (drawer).
// =====================================================
type AdminUI = { drawerOpen: boolean; openDrawer: () => void; closeDrawer: () => void };
const AdminUIContext = createContext<AdminUI | undefined>(undefined);

export function AdminUIProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setOpen] = useState(false);
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  return (
    <AdminUIContext.Provider value={{ drawerOpen, openDrawer, closeDrawer }}>
      {children}
    </AdminUIContext.Provider>
  );
}

export function useAdminUI(): AdminUI {
  return useContext(AdminUIContext) ?? { drawerOpen: false, openDrawer: () => {}, closeDrawer: () => {} };
}

const PANEL_WIDTH = Math.min(300, Dimensions.get("window").width * 0.85);

// Menu latéral coulissant (mobile). Overlay sombre + panneau animé.
export function AdminDrawer() {
  const { drawerOpen, closeDrawer } = useAdminUI();
  const router = useRouter();
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const badges = useAdminBadges();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: drawerOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
    // Rafraîchit les compteurs à chaque ouverture du menu.
    // (badges.reload est stable ; on ne dépend que de l'état d'ouverture.)
    if (drawerOpen) badges.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-PANEL_WIDTH, 0] });
  const overlayOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  function go(href: Href) {
    closeDrawer();
    router.push(href);
  }

  function handleSignOut() {
    closeDrawer();
    Alert.alert("Se déconnecter", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => signOut() },
    ]);
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={drawerOpen ? "auto" : "none"}>
      {/* Voile sombre cliquable pour fermer */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>

      {/* Panneau */}
      <Animated.View style={[styles.panel, { width: PANEL_WIDTH, transform: [{ translateX }] }]}>
        <SafeAreaView edges={["top", "bottom", "left"]} style={styles.panelSafe}>
          {/* En-tête marque */}
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>
              Hygiena<Text style={styles.plus}>+</Text>
            </Text>
            <Text style={styles.brandSub}>Administration</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.nav}>
            {ADMIN_TABS.map((tab) => {
              const active = isTabActive(pathname, tab);
              const count = tabSegments(tab).reduce((s, seg) => s + badgeForSeg(seg, badges), 0);
              return (
                <View key={tab.seg}>
                  <Pressable onPress={() => go(tab.href)} style={[styles.item, active && styles.itemActive]}>
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
                          <Pressable key={sub.seg} onPress={() => go(sub.href)} style={[styles.subItem, subActive && styles.subItemActive]}>
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

          {/* Pied : profil + déconnexion */}
          <View style={styles.footer}>
            <Avatar name={profile?.full_name ?? "Admin"} size={40} />
            <View style={styles.footerInfo}>
              <Text style={styles.footerName} numberOfLines={1}>{profile?.full_name ?? "Admin"}</Text>
              <Text style={styles.footerRole}>Administrateur</Text>
            </View>
            <Pressable onPress={handleSignOut} hitSlop={8} style={styles.signOut}>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  panel: {
    position: "absolute", top: 0, bottom: 0, left: 0,
    backgroundColor: colors.card, borderRightWidth: 1, borderRightColor: colors.border,
    shadowColor: colors.text, shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 4, height: 0 }, elevation: 12,
  },
  panelSafe: { flex: 1, paddingHorizontal: spacing.md },
  brandBlock: { paddingTop: spacing.md, paddingBottom: spacing.md, paddingHorizontal: spacing.sm, gap: 2 },
  brand: { fontSize: 24, fontFamily: fonts.titleBold, fontWeight: "700", color: colors.primaryDark },
  plus: { color: colors.accent },
  brandSub: { ...typography.caption, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.5 },
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
  footer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.name, color: colors.primaryDark },
  footerInfo: { flex: 1 },
  footerName: { ...typography.name },
  footerRole: { ...typography.caption, color: colors.textMuted },
  signOut: { padding: spacing.xs },
});
