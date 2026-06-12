import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminUI } from "@/components/AdminDrawer";
import { colors, fonts, radius, spacing, typography } from "@/theme";

function todayLabel(): string {
  const s = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * En-tête des écrans admin :
 * - Barre supérieure persistante (mobile) : ☰ ouvre le drawer, « Hygiena+ Admin »
 *   + date du jour, cloche (décorative), avatar admin.
 * - En desktop, la sidebar gère la navigation → on n'affiche que le titre de page.
 * - Titre de page (+ zone d'action `right` optionnelle) sous la barre.
 */
export function AdminHeader({ title, right }: { title: string; right?: ReactNode }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const { openDrawer } = useAdminUI();
  const { profile } = useAuth();
  const initial = (profile?.full_name ?? "Admin").trim().charAt(0).toUpperCase();

  return (
    <View>
      {!isDesktop && (
        <View style={styles.appBar}>
          <Pressable onPress={openDrawer} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Ouvrir le menu">
            <Ionicons name="menu" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.brandBlock}>
            <Text style={styles.brand} numberOfLines={1}>
              Hygiena<Text style={styles.plus}>+</Text> Admin
            </Text>
            <Text style={styles.date} numberOfLines={1}>{todayLabel()}</Text>
          </View>
          <Pressable hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>
      )}

      <View style={[styles.titleRow, isDesktop && styles.titleRowDesktop]}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {right ? <View>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm },
  iconBtn: { padding: spacing.xs },
  brandBlock: { flex: 1 },
  brand: { fontSize: 17, fontFamily: fonts.titleBold, fontWeight: "700", color: colors.text },
  plus: { color: colors.accent },
  date: { ...typography.caption, color: colors.textMuted },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.name, color: colors.primaryDark },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingTop: spacing.md },
  titleRowDesktop: { paddingTop: spacing.lg },
  title: { ...typography.h2, flex: 1 },
});
