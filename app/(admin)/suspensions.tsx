import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/providers/AuthProvider";
import { adminService, type SuspensionRow } from "@/lib/admin-service";
import type { Profile } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

export default function AdminSuspensions() {
  const { session } = useAuth();
  const [suspensions, setSuspensions] = useState<SuspensionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Bloc "nouvelle suspension"
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [target, setTarget] = useState<Profile | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSuspensions(await adminService.getSuspensions());
    } catch {
      setSuspensions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runSearch() {
    if (!search.trim()) return;
    try {
      setResults(await adminService.getUsers(search));
    } catch {
      setResults([]);
    }
  }

  async function suspend() {
    if (!session?.user || !target) return;
    setSaving(true);
    try {
      await adminService.suspendUser(session.user.id, target.id, reason.trim() || null, null);
      setTarget(null); setReason(""); setSearch(""); setResults([]);
      await load();
      Alert.alert("Suspendu", "L'utilisateur a été suspendu.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
    } finally {
      setSaving(false);
    }
  }

  function lift(s: SuspensionRow) {
    if (!session?.user) return;
    Alert.alert("Réactiver l'utilisateur ?", "La suspension sera levée.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Réactiver",
        onPress: async () => {
          try {
            await adminService.liftSuspension(session.user.id, s.id);
            setSuspensions((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: false } : x)));
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
          }
        },
      },
    ]);
  }

  if (loading && suspensions.length === 0) return <Loading />;

  return (
    <Screen>
      <AdminHeader title="Suspensions" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card style={styles.newCard}>
          <Text style={typography.h3}>Nouvelle suspension</Text>
          {target ? (
            <>
              <View style={styles.targetRow}>
                <Text style={styles.targetName}>{target.full_name ?? target.email ?? "Utilisateur"}</Text>
                <Pressable onPress={() => setTarget(null)} hitSlop={8}><Ionicons name="close" size={18} color={colors.textMuted} /></Pressable>
              </View>
              <Input label="Motif" value={reason} onChangeText={setReason} placeholder="Motif de la suspension" />
              <Button title="Suspendre" onPress={suspend} loading={saving} />
            </>
          ) : (
            <>
              <Input
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher un utilisateur…"
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={runSearch}
                style={styles.searchInput}
              />
              {results.map((u) => (
                <Pressable key={u.id} onPress={() => { setTarget(u); setResults([]); }}>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultName}>{u.full_name ?? "Sans nom"}</Text>
                    <Text style={styles.resultEmail}>{u.email ?? "—"}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </Card>

        <Text style={[typography.h3, styles.listTitle]}>Suspensions</Text>
        {suspensions.length === 0 ? (
          <EmptyState icon="hand-left-outline" title="Aucune suspension" />
        ) : (
          suspensions.map((s) => (
            <Card key={s.id} style={styles.card}>
              <View style={styles.head}>
                <View style={styles.info}>
                  <Text style={styles.name}>{s.user?.full_name ?? s.user?.email ?? "Utilisateur"}</Text>
                  {s.reason ? <Text style={styles.meta}>{s.reason}</Text> : null}
                  <Text style={styles.meta}>Depuis le {new Date(s.starts_at).toLocaleDateString("fr-FR")}</Text>
                </View>
                <Text style={[styles.badge, s.is_active ? styles.badgeActive : styles.badgeInactive]}>
                  {s.is_active ? "Active" : "Levée"}
                </Text>
              </View>
              {s.is_active && (
                <Pressable onPress={() => lift(s)} style={styles.liftBtn}>
                  <Ionicons name="refresh" size={16} color={colors.primary} />
                  <Text style={styles.liftText}>Réactiver l'utilisateur</Text>
                </Pressable>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  newCard: { gap: spacing.sm },
  searchInput: { marginBottom: 0 },
  resultRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  resultName: { ...typography.body, fontWeight: "600" },
  resultEmail: { ...typography.caption, color: colors.textMuted },
  targetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  targetName: { ...typography.body, fontWeight: "700" },
  listTitle: { marginTop: spacing.sm },
  empty: { alignItems: "center" },
  muted: { color: colors.textMuted },
  card: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  info: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: "600" },
  meta: { ...typography.caption, color: colors.textMuted },
  badge: { ...typography.caption, color: colors.white, fontWeight: "700", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  badgeActive: { backgroundColor: colors.danger },
  badgeInactive: { backgroundColor: colors.textMuted },
  liftBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  liftText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});
