import { useState, useCallback } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { useAuth } from "@/providers/AuthProvider";
import { useDoctors } from "@/hooks/useDoctors";
import { useAppSettings } from "@/hooks/useAppSettings";
import { StarRating } from "@/components/StarRating";
import { doctorDisplayName, type DoctorWithProfile } from "@/lib/appointments-service";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, fonts, radius, spacing, typography } from "@/theme";

// Minuscules + suppression des accents pour une recherche tolérante.
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function AppointmentsHome() {
  const { role } = useAuth();
  const { doctors, loading, reload } = useDoctors();
  const { doctors_enabled } = useAppSettings();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeSpec, setActiveSpec] = useState<string>("all");
  const [sortBest, setSortBest] = useState(false);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  // Un médecin ne prend pas de RDV en tant que patient.
  if (role === "doctor") return <Redirect href="/(user)" />;

  if (loading && doctors.length === 0) return <SkeletonList variant="doctor" />;

  // Module désactivé par l'admin : accès aux médecins/consultations bloqué.
  if (!doctors_enabled) {
    return (
      <Screen>
        <ScreenHeader title="Trouver une médecin" />
        <EmptyState icon="medkit-outline" title="Service non disponible pour le moment" />
      </Screen>
    );
  }

  // Spécialités réellement présentes (pour les chips de filtre).
  const specialties = Array.from(new Set(doctors.map((d) => d.specialty))).sort();

  // Recherche (nom / spécialité / clinique) + filtre spécialité + tri optionnel.
  const q = norm(search.trim());
  let list = doctors
    .filter((d) => activeSpec === "all" || d.specialty === activeSpec)
    .filter((d) => {
      if (!q) return true;
      return (
        norm(doctorDisplayName(d.profile)).includes(q) ||
        norm(d.specialty).includes(q) ||
        norm(d.clinic_name ?? "").includes(q)
      );
    });
  if (sortBest) list = [...list].sort((a, b) => b.rating_avg - a.rating_avg);

  return (
    <Screen>
      <ScreenHeader
        title="Trouver une médecin"
        right={
          <Pressable onPress={() => router.push("/(user)/appointments/mine")} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Mes rendez-vous">
            <Ionicons name="calendar-outline" size={25} color={colors.text} />
          </Pressable>
        }
      />

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
          <>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher (nom, spécialité, clinique)…"
              autoCapitalize="none"
              style={styles.searchInput}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsBar}
              contentContainerStyle={styles.chips}
            >
              {["all", ...specialties].map((s) => {
                const active = activeSpec === s;
                return (
                  <Pressable key={s} onPress={() => setActiveSpec(s)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s === "all" ? "Toutes" : s}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.toolbar}>
              <Text style={styles.count}>{list.length} médecin{list.length > 1 ? "s" : ""}</Text>
              <Pressable onPress={() => setSortBest((v) => !v)} style={[styles.sortChip, sortBest && styles.sortChipActive]}>
                <Ionicons name="star" size={13} color={sortBest ? colors.white : colors.accent} />
                <Text style={[styles.sortText, sortBest && styles.sortTextActive]}>Mieux notés</Text>
              </Pressable>
            </View>

            {list.length === 0 ? (
              <EmptyState icon="search-outline" title="Aucun médecin trouvé" message="Essayez un autre nom ou une autre spécialité." />
            ) : (
              list.map((d) => (
                <DoctorRow key={d.id} doctor={d} onPress={() => router.push(`/(user)/appointments/${d.id}`)} />
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function DoctorRow({ doctor, onPress }: { doctor: DoctorWithProfile; onPress: () => void }) {
  const name = doctorDisplayName(doctor.profile);
  return (
    <Card onPress={onPress} accessibilityLabel={name} style={styles.row}>
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
          {doctor.rating_count > 0 ? (
            <StarRating value={doctor.rating_avg} count={doctor.rating_count} size={13} compact />
          ) : null}
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
  );
}

const AVATAR = 64;
const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg },
  iconBtn: { padding: spacing.xs },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  verified: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  verifiedText: { ...typography.body, color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontWeight: "700" },
  searchInput: { marginBottom: 0 },
  chipsBar: { flexGrow: 0, flexShrink: 0 },
  chips: { gap: spacing.xs, alignItems: "center", paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  count: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  sortChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border,
  },
  sortChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortText: { fontSize: 13, fontWeight: "700", color: colors.text },
  sortTextActive: { color: colors.white },
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
