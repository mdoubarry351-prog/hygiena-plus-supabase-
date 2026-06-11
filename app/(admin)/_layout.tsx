import { Stack } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { RoleGuard } from "@/components/RoleGuard";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminUIProvider, AdminDrawer } from "@/components/AdminDrawer";

// Seuil de bascule : ≥ 900px = desktop/tablette large → back-office à sidebar.
const DESKTOP_MIN_WIDTH = 900;

export default function AdminLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_MIN_WIDTH;

  return (
    <RoleGuard allow="admin">
      <AdminUIProvider>
        {isDesktop ? (
          // Desktop : menu latéral persistant + zone de contenu (les MÊMES écrans).
          <View style={styles.row}>
            <AdminSidebar />
            <View style={styles.content}>
              <Stack screenOptions={{ headerShown: false }} />
            </View>
          </View>
        ) : (
          // Mobile : barre supérieure (dans chaque écran) + drawer coulissant en overlay.
          <View style={styles.flex}>
            <Stack screenOptions={{ headerShown: false }} />
            <AdminDrawer />
          </View>
        )}
      </AdminUIProvider>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: "row" },
  content: { flex: 1 },
});
