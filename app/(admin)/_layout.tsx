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
            {/* Zone de contenu bornée + centrée sur grand écran (lisibilité),
                sans contrainte sur mobile (branche dédiée ci-dessous). */}
            <View style={styles.content}>
              <View style={styles.contentInner}>
                <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", animationDuration: 200 }} />
              </View>
            </View>
          </View>
        ) : (
          // Mobile : barre supérieure (dans chaque écran) + drawer coulissant en overlay.
          <View style={styles.flex}>
            <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", animationDuration: 200 }} />
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
  content: { flex: 1, alignItems: "center" },
  // Largeur de contenu bornée (centrée) pour éviter l'étirement sur écran large.
  contentInner: { flex: 1, width: "100%", maxWidth: 1180 },
});
