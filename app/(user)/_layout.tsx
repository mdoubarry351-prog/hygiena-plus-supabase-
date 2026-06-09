import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { RoleGuard } from "@/components/RoleGuard";
import { CartProvider } from "@/providers/CartProvider";
import { colors } from "@/theme";

export default function UserLayout() {
  return (
    <RoleGuard allow="user">
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
        </Tabs>
      </CartProvider>
    </RoleGuard>
  );
}
