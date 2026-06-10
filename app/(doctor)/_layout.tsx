import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { RoleGuard } from "@/components/RoleGuard";
import { colors } from "@/theme";

export default function DoctorLayout() {
  return (
    <RoleGuard allow="doctor">
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
            title: "Tableau de bord",
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="appointments"
          options={{
            title: "Rendez-vous",
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="availability"
          options={{
            title: "Disponibilité",
            tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Ma fiche",
            tabBarIcon: ({ color, size }) => <Ionicons name="medkit-outline" color={color} size={size} />,
          }}
        />
      </Tabs>
    </RoleGuard>
  );
}
