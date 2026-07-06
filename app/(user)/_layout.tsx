import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { RoleGuard } from "@/components/RoleGuard";
import { CartProvider } from "@/providers/CartProvider";
import { colors, fonts } from "@/theme";

// Icône d'onglet = Ionicons au trait (design « Coton doux » — finis les emojis).
// Variante pleine quand l'onglet est actif, contour sinon.
function tabIcon(active: keyof typeof Ionicons.glyphMap, inactive: keyof typeof Ionicons.glyphMap) {
  return function TabIcon({ focused, color }: { focused: boolean; color: string }) {
    return <Ionicons name={focused ? active : inactive} size={23} color={color} />;
  };
}

export default function UserLayout() {
  return (
    <RoleGuard allow={["user", "doctor"]}>
      <CartProvider>
        <Tabs
          // Le retour suit l'ordre de visite des écrans (pas-à-pas) au lieu de
          // sauter au 1er onglet (Accueil). Défaut bottom-tabs = "firstRoute".
          backBehavior="history"
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: { borderTopColor: colors.border, height: 88, paddingTop: 8 },
            tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.bodyMedium },
          }}
        >
          {/* 5 onglets : Aujourd'hui · Cycle · Boutique · Forum · Profil */}
          <Tabs.Screen name="index" options={{ title: "Aujourd'hui", tabBarIcon: tabIcon("home", "home-outline") }} />
          <Tabs.Screen name="cycle/calendar" options={{ title: "Cycle", tabBarIcon: tabIcon("water", "water-outline") }} />
          <Tabs.Screen name="marketplace/index" options={{ title: "Boutique", tabBarIcon: tabIcon("bag-handle", "bag-handle-outline") }} />
          <Tabs.Screen name="community/index" options={{ title: "Forum", tabBarIcon: tabIcon("chatbubbles", "chatbubbles-outline") }} />
          <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: tabIcon("person", "person-outline") }} />

          {/* Consultations retirées de la barre — accès via la carte « Consultations » de l'accueil.
              (La restriction médecin reste assurée par le garde in-screen + la carte masquée pour un doctor.) */}
          <Tabs.Screen name="appointments/hub" options={{ href: null }} />
          <Tabs.Screen name="appointments/index" options={{ href: null }} />

          {/* Écrans accessibles mais cachés de la barre d'onglets */}
          <Tabs.Screen name="cycle/log" options={{ href: null }} />
          <Tabs.Screen name="cycle/summary" options={{ href: null }} />
          <Tabs.Screen name="cycle/history" options={{ href: null }} />
          <Tabs.Screen name="cycle/stats" options={{ href: null }} />
          <Tabs.Screen name="cycle/learn" options={{ href: null }} />
          <Tabs.Screen name="health" options={{ href: null }} />
          <Tabs.Screen name="marketplace/[id]" options={{ href: null }} />
          <Tabs.Screen name="marketplace/cart" options={{ href: null }} />
          <Tabs.Screen name="marketplace/checkout" options={{ href: null }} />
          <Tabs.Screen name="marketplace/orders" options={{ href: null }} />
          <Tabs.Screen name="marketplace/order" options={{ href: null }} />
          <Tabs.Screen name="marketplace/favorites" options={{ href: null }} />
          <Tabs.Screen name="community/new" options={{ href: null }} />
          <Tabs.Screen name="community/[id]" options={{ href: null }} />
          <Tabs.Screen name="community/saved" options={{ href: null }} />
          <Tabs.Screen name="community/activity" options={{ href: null }} />
          <Tabs.Screen name="community/rules" options={{ href: null }} />
          <Tabs.Screen name="community/profile/[userId]" options={{ href: null }} />
          <Tabs.Screen name="appointments/[id]" options={{ href: null }} />
          <Tabs.Screen name="appointments/mine" options={{ href: null }} />
          <Tabs.Screen name="appointments/conversations" options={{ href: null }} />
          <Tabs.Screen name="appointments/call" options={{ href: null }} />
          <Tabs.Screen name="appointments/receipt" options={{ href: null }} />
          <Tabs.Screen name="appointments/chat" options={{ href: null }} />
          <Tabs.Screen name="account" options={{ href: null }} />
          <Tabs.Screen name="settings" options={{ href: null }} />
          <Tabs.Screen name="about" options={{ href: null }} />
          <Tabs.Screen name="lock" options={{ href: null }} />
          <Tabs.Screen name="blocked" options={{ href: null }} />
          <Tabs.Screen name="help" options={{ href: null }} />
          <Tabs.Screen name="privacy" options={{ href: null }} />
          <Tabs.Screen name="terms" options={{ href: null }} />
          <Tabs.Screen name="notifications" options={{ href: null }} />
          <Tabs.Screen name="notification-settings" options={{ href: null }} />
        </Tabs>
      </CartProvider>
    </RoleGuard>
  );
}

