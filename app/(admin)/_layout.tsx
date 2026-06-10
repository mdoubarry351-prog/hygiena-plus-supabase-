import { Stack } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { RoleGuard } from "@/components/RoleGuard";
import { AdminSidebar } from "@/components/AdminSidebar";

// Seuil de bascule : ≥ 900px = desktop/tablette large → back-office à sidebar.
const DESKTOP_MIN_WIDTH = 900;

export default function AdminLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_MIN_WIDTH;

  return (
    <RoleGuard allow="admin">
      {isDesktop ? (
        // Desktop : menu latéral persistant + zone de contenu (les MÊMES écrans).
        <View style={styles.row}>
          <AdminSidebar />
          <View style={styles.content}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </View>
      ) : (
        // Mobile : hub + navigation Stack inchangés.
        <Stack screenOptions={{ headerShown: false }} />
      )}
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row" },
  content: { flex: 1 },
});
