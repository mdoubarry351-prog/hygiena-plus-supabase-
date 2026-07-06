import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useConfirm } from "@/components/ConfirmDialog";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { communityService } from "@/lib/community-service";
import { colors, radius, spacing, typography } from "@/theme";

export default function BlockedUsers() {
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setList(await communityService.getBlockedUsers());
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function unblock(id: string, name: string) {
    if (
      await confirm({
        title: "Débloquer ?",
        message: `${name} réapparaîtra dans le fil de la communauté.`,
        confirmLabel: "Débloquer",
        cancelLabel: "Annuler",
      })
    ) {
      setList((prev) => prev.filter((u) => u.id !== id));
      try {
        await communityService.unblockUser(id);
      } catch {
        await load();
      }
    }
  }

  if (loading && list.length === 0) return <Loading />;

  return (
    <Screen>
      <ScreenHeader title="Comptes bloqués" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {list.length === 0 ? (
          <EmptyState
            icon="person-remove-outline"
            title="Aucun compte bloqué"
            message="Les personnes que vous bloquez dans la communauté apparaîtront ici."
          />
        ) : (
          list.map((u) => (
            <Card key={u.id} style={styles.row}>
              <Avatar name={u.name} size={40} />
              <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
              <Pressable onPress={() => unblock(u.id, u.name)} style={styles.unblockBtn}>
                <Text style={styles.unblockText}>Débloquer</Text>
              </Pressable>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: colors.primaryDark },
  name: { ...typography.name, flex: 1 },
  unblockBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  unblockText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});
