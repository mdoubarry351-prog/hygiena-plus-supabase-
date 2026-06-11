import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { Alert, Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, usePathname, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/AuthProvider";
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

// =====================================================
// Navigation groupée (mappée sur les écrans existants).
// =====================================================
type NavItem = { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href; seg: string };
type NavGroup = { title: string | null; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    title: null,
    items: [{ label: "Dashboard", icon: "grid-outline", href: "/(admin)/dashboard", seg: "dashboard" }],
  },
  {
    title: "Comptes",
    items: [
      { label: "Utilisateurs", icon: "people-outline", href: "/(admin)/users", seg: "users" },
      { label: "Médecins", icon: "medkit-outline", href: "/(admin)/doctors", seg: "doctors" },
      { label: "Gestion des comptes", icon: "id-card-outline", href: "/(admin)/accounts", seg: "accounts" },
    ],
  },
  {
    title: "Services",
    items: [
      { label: "Téléconsultation", icon: "videocam-outline", href: "/(admin)/doctors", seg: "doctors" },
      { label: "Signalements", icon: "flag-outline", href: "/(admin)/reports", seg: "reports" },
      { label: "Abonnements Premium", icon: "star-outline", href: "/(admin)/settings", seg: "settings" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { label: "Produits", icon: "bag-handle-outline", href: "/(admin)/products", seg: "products" },
      { label: "Commandes", icon: "receipt-outline", href: "/(admin)/orders", seg: "orders" },
      { label: "Boutique", icon: "storefront-outline", href: "/(admin)/settings", seg: "settings" },
    ],
  },
  {
    title: "Communauté",
    items: [{ label: "Modération", icon: "chatbubbles-outline", href: "/(admin)/community", seg: "community" }],
  },
  {
    title: "Système",
    items: [
      { label: "Statistiques", icon: "bar-chart-outline", href: "/(admin)/stats", seg: "stats" },
      { label: "Gestion des services", icon: "settings-outline", href: "/(admin)/settings", seg: "settings" },
      { label: "Suspensions", icon: "hand-left-outline", href: "/(admin)/suspensions", seg: "suspensions" },
    ],
  },
];

const PANEL_WIDTH = Math.min(300, Dimensions.get("window").width * 0.85);

// Menu latéral coulissant (mobile). Overlay sombre + panneau animé.
export function AdminDrawer() {
  const { drawerOpen, closeDrawer } = useAdminUI();
  const router = useRouter();
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: drawerOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
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

  const initial = (profile?.full_name ?? "Admin").trim().charAt(0).toUpperCase();

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
            {GROUPS.map((group, gi) => (
              <View key={group.title ?? `g${gi}`} style={styles.group}>
                {group.title ? <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text> : null}
                {group.items.map((item, ii) => {
                  const active = pathname === `/${item.seg}` || pathname.endsWith(`/${item.seg}`);
                  return (
                    <Pressable
                      key={`${item.seg}-${ii}`}
                      onPress={() => go(item.href)}
                      style={[styles.item, active && styles.itemActive]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={active ? colors.primaryDark : colors.textMuted}
                      />
                      <Text style={[styles.itemText, active && styles.itemTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {/* Pied : profil + déconnexion */}
          <View style={styles.footer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
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
  nav: { gap: spacing.lg, paddingBottom: spacing.lg },
  group: { gap: 2 },
  groupTitle: { ...typography.caption, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.5, paddingHorizontal: spacing.sm, marginBottom: spacing.xs },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  itemActive: { backgroundColor: colors.primaryLight },
  itemText: { ...typography.body, color: colors.text, fontWeight: "500" },
  itemTextActive: { color: colors.primaryDark, fontWeight: "700" },
  footer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.name, color: colors.primaryDark },
  footerInfo: { flex: 1 },
  footerName: { ...typography.name },
  footerRole: { ...typography.caption, color: colors.textMuted },
  signOut: { padding: spacing.xs },
});
