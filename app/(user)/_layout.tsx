import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { RoleGuard } from "@/components/RoleGuard";
import { CartProvider } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import { colors } from "@/theme";

export default function UserLayout() {
  const { role } = useAuth();
  // Le médecin ne prend pas de RDV en tant que patient : on masque l'onglet
  // « Rendez-vous » (prise de RDV patient) de sa barre d'onglets.
  const isDoctor = role === "doctor";

  return (
    <RoleGuard allow={["user", "doctor"]}>
      <CartProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: { borderTopColor: colors.border, height: 88, paddingTop: 8 },
            tabBarLabelStyle: { fontSize: 11 },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Cycle",
              tabBarIcon: ({ color, size }) => <Ionicons name="ellipse-outline" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="cycle/calendar"
            options={{
              title: "Calendrier",
              tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="marketplace/index"
            options={{
              title: "Boutique",
              tabBarIcon: ({ color, size }) => <Ionicons name="bag-outline" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="community/index"
            options={{
              title: "Communauté",
              tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="appointments/index"
            options={{
              title: "Rendez-vous",
              // Masqué pour les médecins (ils reçoivent des RDV via l'espace pro).
              href: isDoctor ? null : undefined,
              tabBarIcon: ({ color, size }) => <Ionicons name="medkit-outline" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: "Profil",
              tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
            }}
          />
          {/* Écrans accessibles mais cachés de la barre d'onglets */}
          <Tabs.Screen name="cycle/log" options={{ href: null }} />
          <Tabs.Screen name="marketplace/[id]" options={{ href: null }} />
          <Tabs.Screen name="marketplace/cart" options={{ href: null }} />
          <Tabs.Screen name="marketplace/checkout" options={{ href: null }} />
          <Tabs.Screen name="marketplace/orders" options={{ href: null }} />
          <Tabs.Screen name="community/new" options={{ href: null }} />
          <Tabs.Screen name="community/[id]" options={{ href: null }} />
          <Tabs.Screen name="appointments/[id]" options={{ href: null }} />
          <Tabs.Screen name="appointments/mine" options={{ href: null }} />
          <Tabs.Screen name="notifications" options={{ href: null }} />
        </Tabs>
      </CartProvider>
    </RoleGuard>
  );
}
