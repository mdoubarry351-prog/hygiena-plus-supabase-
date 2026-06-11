import { useState, useCallback } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { useAuth } from "@/providers/AuthProvider";
import { useDoctors } from "@/hooks/useDoctors";
import { doctorDisplayName, type DoctorWithProfile } from "@/lib/appointments-service";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, fonts, radius, spacing, typography } from "@/theme";

export default function AppointmentsHome() {
  const { role } = useAuth();
  const { doctors, loading, reload } = useDoctors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  // Un médecin ne prend pas de RDV en tant que patient.
  if (role === "doctor") return <Redirect href="/(user)" />;

  if (loading && doctors.length === 0) return <Loading />;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={typography.h2}>Trouver une médecin</Text>
        <Pressable onPress={() => router.push("/(user)/appointments/mine")} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="calendar-outline" size={25} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Card style={styles.verified}>
          <Text style={styles.verifiedText}>✅ Toutes nos médecins sont vérifiées</Text>
        </Card>
        {doctors.length === 0 ? (
          <EmptyState
            icon="medkit-outline"
            title="Aucun médecin disponible"
            message="Revenez plus tard, de nouveaux praticiens arrivent bientôt."
          />
        ) : (
          doctors.map((d) => (
            <DoctorRow
              key={d.id}
              doctor={d}
              onPress={() => router.push(`/(user)/appointments/${d.id}`)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function DoctorRow({ doctor, onPress }: { doctor: DoctorWithProfile; onPress: () => void }) {
  const name = doctorDisplayName(doctor.profile);
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.row}>
        {doctor.profile?.avatar_url ? (
          <Image source={{ uri: doctor.profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="medkit-outline" size={26} color={colors.primary} />
          </View>
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.specialty} numberOfLines={1}>{doctor.specialty}</Text>
          <View style={styles.rowFoot}>
            {doctor.consultation_fee != null ? (
              <Text style={styles.fee}>{formatPrice(doctor.consultation_fee)}</Text>
            ) : (
              <Text style={styles.feeFree}>Tarif sur place</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
}

const AVATAR = 64;
const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg },
  iconBtn: { padding: spacing.xs },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  verified: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  verifiedText: { ...typography.body, color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontWeight: "700" },
  empty: { alignItems: "center", gap: spacing.sm },
  muted: { color: colors.textMuted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: radius.pill, backgroundColor: colors.primaryLight },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 2 },
  name: { ...typography.name },
  specialty: { ...typography.caption, color: colors.secondary, fontWeight: "600" },
  rowFoot: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  fee: { ...typography.body, fontWeight: "700", color: colors.primary },
  feeFree: { ...typography.caption, color: colors.textMuted },
});
