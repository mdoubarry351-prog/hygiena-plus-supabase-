import { useEffect, useState, useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/providers/ToastProvider";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import type { Profile } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

export default function AdminAdmins() {
  const { session } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const selfId = session?.user?.id ?? null;
  const label = (u: Profile) => u.full_name ?? u.email ?? "cet utilisateur";

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      setAdmins(await adminService.getAdmins());
    } catch {
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  // Recherche (nom/email) des utilisateurs NON-admin à promouvoir — debounce.
  useEffect(() => {
    const q = search.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const found = await adminService.getUsers(q);
        setResults(found.filter((u) => u.role !== "admin"));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function promote(u: Profile) {
    if (!session?.user) return;
    const ok = await confirm({
      title: "Promouvoir administrateur ?",
      message: `${label(u)} obtiendra tous les droits d'administration de l'application.`,
      confirmLabel: "Promouvoir",
    });
    if (!ok) return;
    try {
      await adminService.updateUserRole(session.user.id, u.id, "admin");
      setResults((prev) => prev.filter((x) => x.id !== u.id));
      setSearch("");
      await loadAdmins();
      toast.success(`${label(u)} est désormais administrateur.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Promotion échouée");
    }
  }

  async function demote(u: Profile) {
    if (!session?.user || u.id === selfId) return;
    const ok = await confirm({
      title: "Retirer le rôle admin ?",
      message: `${label(u)} redeviendra un utilisateur standard et perdra l'accès à l'administration.`,
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminService.updateUserRole(session.user.id, u.id, "user");
      setAdmins((prev) => prev.filter((x) => x.id !== u.id));
      toast.success(`${label(u)} n'est plus administrateur.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retrait échoué");
    }
  }

  if (loading && admins.length === 0) {
    return (
      <Screen>
        <AdminHeader title="Administrateurs" />
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <AdminHeader title="Administrateurs" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Ajouter un administrateur */}
        <Card style={styles.card}>
          <Text style={typography.h3}>Ajouter un administrateur</Text>
          <Text style={styles.hint}>Recherchez un utilisateur par nom ou email, puis promouvez-le.</Text>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher (nom ou email)…"
            autoCapitalize="none"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.trim() ? (
            searching ? (
              <Text style={styles.hint}>Recherche…</Text>
            ) : results.length === 0 ? (
              <Text style={styles.hint}>Aucun utilisateur non-admin trouvé.</Text>
            ) : (
              results.map((u) => (
                <View key={u.id} style={styles.resultRow}>
                  <Avatar name={u.full_name ?? u.email ?? "?"} size={40} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.name} numberOfLines={1}>{u.full_name ?? "Sans nom"}</Text>
                    <Text style={styles.email} numberOfLines={1}>{u.email ?? "—"}</Text>
                  </View>
                  <Pressable style={[styles.actionBtn, styles.promoteBtn]} onPress={() => promote(u)}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                    <Text style={styles.promoteText}>Promouvoir</Text>
                  </Pressable>
                </View>
              ))
            )
          ) : null}
        </Card>

        {/* Liste des administrateurs */}
        <Text style={styles.sectionTitle}>Administrateurs actuels ({admins.length})</Text>
        {admins.length === 0 ? (
          <EmptyState icon="shield-outline" title="Aucun administrateur" />
        ) : (
          admins.map((u) => {
            const isSelf = u.id === selfId;
            return (
              <Card key={u.id} style={styles.row}>
                <Avatar name={u.full_name ?? u.email ?? "?"} size={40} />
                <View style={styles.rowInfo}>
                  <Text style={styles.name} numberOfLines={1}>{u.full_name ?? "Sans nom"}</Text>
                  <Text style={styles.email} numberOfLines={1}>{u.email ?? "—"}</Text>
                </View>
                {isSelf ? (
                  <Badge label="Vous" tone="info" soft />
                ) : (
                  <Pressable style={[styles.actionBtn, styles.demoteBtn]} onPress={() => demote(u)}>
                    <Ionicons name="remove-circle-outline" size={16} color={colors.danger} />
                    <Text style={styles.demoteText}>Retirer</Text>
                  </Pressable>
                )}
              </Card>
            );
          })
        )}
        <Text style={styles.footnote}>Vous ne pouvez pas retirer votre propre rôle administrateur.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  card: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
  searchInput: { marginBottom: 0 },
  sectionTitle: { ...typography.h3, marginTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.xs },
  rowInfo: { flex: 1, gap: 2 },
  name: { ...typography.name },
  email: { ...typography.caption, color: colors.textMuted },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1.5 },
  promoteBtn: { borderColor: colors.primary },
  promoteText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  demoteBtn: { borderColor: colors.danger },
  demoteText: { ...typography.caption, color: colors.danger, fontWeight: "700" },
  footnote: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.sm },
});
