import { useState, useCallback, useRef } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Redirect, useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SkeletonList } from "@/components/Skeleton";
import { AppImage } from "@/components/AppImage";
import { SegmentedControl } from "@/components/SegmentedControl";
import { VerifiedDoctorBadge } from "@/components/CommunityBadges";
import { TrustRow } from "@/components/TrustRow";
import { FadeInView } from "@/components/FadeInView";
import { DOCTOR_MESSAGING_ENABLED } from "@/lib/app-config";
import { PressableScale } from "@/components/PressableScale";
import { useAuth } from "@/providers/AuthProvider";
import { useDoctors } from "@/hooks/useDoctors";
import { useAppSettings, showServiceUnavailable } from "@/hooks/useAppSettings";
import { StarRating } from "@/components/StarRating";
import { appointmentsService, doctorDisplayName, hasAnyAvailability, type DoctorWithProfile } from "@/lib/appointments-service";
import { practitionerTypeOf, PRACTITIONER_LABELS } from "@/lib/practitioner";
import { hapticLight } from "@/lib/haptics";
import { formatPrice } from "@/lib/marketplace-service";
import { colors, fonts, radius, spacing, typography } from "@/theme";

const STEP = 55; // pas de l'apparition échelonnée (cohérent Vagues 1-4)

// Minuscules + suppression des accents pour une recherche tolérante.
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function AppointmentsHome() {
  const { role, profile, session } = useAuth();
  // Type de praticien (depuis le hub) : défaut gynécologie → préserve l'existant.
  const params = useLocalSearchParams<{ type?: string }>();
  const ptype = practitionerTypeOf(params.type);
  const L = PRACTITIONER_LABELS[ptype];
  const isTherapy = ptype === "therapy";
  const headerTitle = isTherapy ? "Trouver un·e thérapeute" : "Trouver une médecin";

  const { doctors, loading, error, reload } = useDoctors(ptype);
  const { doctors_enabled, premium_enabled } = useAppSettings();
  const router = useRouter();

  // Défilement vers la liste depuis les boutons de l'intro thérapie.
  const scrollRef = useRef<ScrollView>(null);
  const listY = useRef(0);
  const onListLayout = (e: LayoutChangeEvent) => { listY.current = e.nativeEvent.layout.y; };
  const scrollToList = () => scrollRef.current?.scrollTo({ y: Math.max(0, listY.current - 12), animated: true });

  // Contacter = salle de consultation in-app. Messagerie liée à une consultation :
  // on n'ouvre la salle que si un RDV existe avec ce praticien ; sinon on invite à
  // réserver (au lieu d'ouvrir un chat dont l'envoi échouerait via la RLS).
  const contactDoctor = useCallback(async (d: DoctorWithProfile) => {
    if (!session?.user) return;
    hapticLight();
    const docName = doctorDisplayName(d.profile);
    try {
      const appt = await appointmentsService.findAppointmentForRoom(d.id, session.user.id);
      if (appt) {
        router.push({ pathname: "/(user)/appointments/chat", params: { doctorId: d.id, doctorName: docName, appointmentId: appt.id, appointmentAt: `${appt.appointment_date}T${appt.appointment_time}:00` } });
      } else {
        Alert.alert(
          "Réservez d'abord une consultation",
          `Pour échanger avec ${docName}, réservez une consultation. La messagerie s'ouvre une fois le rendez-vous pris.`,
          [
            { text: "Plus tard", style: "cancel" },
            { text: "Réserver", onPress: () => router.push(`/(user)/appointments/${d.id}`) },
          ]
        );
      }
    } catch {
      // En cas de doute, on ouvre la salle (la RLS protège l'envoi + message clair).
      router.push({ pathname: "/(user)/appointments/chat", params: { doctorId: d.id, doctorName: docName } });
    }
  }, [router, session?.user]);
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

  // Échec réseau SANS aucune donnée : vrai état d'erreur (≠ « aucun médecin »).
  if (error && doctors.length === 0) {
    return (
      <Screen>
        <ScreenHeader title={headerTitle} />
        <EmptyState
          icon="cloud-offline-outline"
          title="Connexion impossible"
          message="Vérifie ta connexion, puis réessaie."
          actionLabel="Réessayer"
          onAction={reload}
        />
      </Screen>
    );
  }

  // Module désactivé par l'admin : accès aux médecins/consultations bloqué.
  if (!doctors_enabled) {
    return (
      <Screen>
        <ScreenHeader title={headerTitle} />
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
        title={headerTitle}
        right={
          <PressableScale onPress={() => router.push("/(user)/appointments/mine")} haptic hitSlop={10} scaleTo={0.86} style={styles.iconBtn} accessibilityLabel="Mes rendez-vous">
            <Ionicons name="calendar-outline" size={25} color={colors.text} />
          </PressableScale>
        }
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Données déjà chargées mais le rafraîchissement a échoué → hors-ligne. */}
        {error ? <OfflineBanner cachedAt={null} /> : null}

        {/* Thérapie : intro rassurante + confidentialité ; gynéco : signaux existants. */}
        {isTherapy ? (
          <TherapyIntro onBook={scrollToList} onDiscover={scrollToList} />
        ) : (
          <TrustRow signals={["verified", "confidential"]} />
        )}

        <View style={styles.listWrap} onLayout={onListLayout}>
          {doctors.length === 0 ? (
            <EmptyState
              icon="medkit-outline"
              title={`Aucun·e ${L.noun} disponible`}
              message="Reviens plus tard, de nouveaux praticiens arrivent bientôt."
            />
          ) : (
            <>
              <Input
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher (nom, spécialité…)"
                autoCapitalize="none"
                style={styles.searchInput}
              />

              <SegmentedControl
                items={["all", ...specialties].map((s) => ({ key: s, label: s === "all" ? "Toutes" : s }))}
                value={activeSpec}
                onChange={setActiveSpec}
              />

              <View style={styles.toolbar}>
                <Text style={styles.count}>{list.length} {L.noun}{list.length > 1 ? "s" : ""}</Text>
                <Pressable onPress={() => { hapticLight(); setSortBest((v) => !v); }} style={({ pressed }) => [styles.sortChip, sortBest && styles.sortChipActive, pressed && styles.chipPressed]} accessibilityRole="button" accessibilityLabel="Trier par mieux notés">
                  <Ionicons name="star" size={13} color={sortBest ? colors.white : colors.accent} />
                  <Text style={[styles.sortText, sortBest && styles.sortTextActive]}>Mieux notés</Text>
                </Pressable>
              </View>

              {list.length === 0 ? (
                <EmptyState icon="search-outline" title={`Aucun·e ${L.noun} trouvé·e`} message="Essaie un autre nom ou une autre spécialité." />
              ) : (
                list.map((d, i) => (
                  <FadeInView key={d.id} fill={false} delay={Math.min(i, 6) * STEP}>
                    <DoctorRow
                      doctor={d}
                      ctaLabel={L.bookCta}
                      verifiedLabel={L.verifiedLabel}
                      onPress={() => router.push(`/(user)/appointments/${d.id}`)}
                      onContact={() => contactDoctor(d)}
                    />
                  </FadeInView>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

// Intro thérapie : présentation rassurante + confidentialité + accès à la liste.
function TherapyIntro({ onBook, onDiscover }: { onBook: () => void; onDiscover: () => void }) {
  return (
    <View style={styles.heroWrap}>
      <Card style={styles.heroCard}>
        <View style={styles.heroHead}>
          <Text style={styles.heroEmoji}>🧠</Text>
          <Text style={styles.heroTitle}>Thérapie & santé mentale</Text>
        </View>
        <Text style={styles.heroIntro}>
          Un espace bienveillant pour prendre soin de ton bien-être mental. Échange avec un·e thérapeute vérifié·e, en ligne ou en présentiel, à ton rythme.
        </Text>
        <View style={styles.heroConfid}>
          <Ionicons name="lock-closed" size={15} color={colors.primaryDark} />
          <Text style={styles.heroConfidText}>Tes échanges et tes séances restent strictement confidentiels.</Text>
        </View>
      </Card>
      <View style={styles.heroActions}>
        <Button title="Réserver une séance" onPress={onBook} />
        <Button title="Découvrir les thérapeutes" variant="outline" onPress={onDiscover} />
      </View>
    </View>
  );
}

function DoctorRow({ doctor, onPress, onContact, ctaLabel, verifiedLabel }: { doctor: DoctorWithProfile; onPress: () => void; onContact: () => void; ctaLabel: string; verifiedLabel: string }) {
  const name = doctorDisplayName(doctor.profile);
  const available = hasAnyAvailability(doctor.availability);
  return (
    <Card onPress={onPress} haptic accessibilityLabel={name} style={styles.row}>
      <View style={styles.rowTop}>
        {doctor.profile?.avatar_url ? (
          <AppImage source={doctor.profile.avatar_url} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="medkit-outline" size={26} color={colors.primary} />
          </View>
        )}
        <View style={styles.rowInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {doctor.is_validated ? <VerifiedDoctorBadge label={verifiedLabel} /> : null}
          </View>
          <Text style={styles.specialty} numberOfLines={1}>{doctor.specialty}</Text>
          {doctor.bio ? <Text style={styles.bio} numberOfLines={1}>{doctor.bio}</Text> : null}
          {doctor.rating_count > 0 ? (
            <StarRating value={doctor.rating_avg} count={doctor.rating_count} size={13} compact />
          ) : null}
          <View style={styles.rowFoot}>
            {doctor.consultation_fee != null ? (
              <Text style={styles.fee}>{formatPrice(doctor.consultation_fee)}</Text>
            ) : (
              <Text style={styles.feeFree}>Tarif sur place</Text>
            )}
            <View style={[styles.availPill, !available && styles.availPillOff]}>
              <View style={[styles.availDot, { backgroundColor: available ? colors.success : colors.textMuted }]} />
              <Text style={styles.availText}>{available ? "Disponible" : "Bientôt"}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.cardActions}>
        <Pressable onPress={() => { hapticLight(); onPress(); }} style={({ pressed }) => [styles.cardBtn, styles.cardBtnPrimary, pressed && styles.cardBtnPressed]} accessibilityRole="button" accessibilityLabel={`${ctaLabel} avec ${name}`}>
          <Ionicons name="calendar" size={16} color={colors.white} />
          <Text style={styles.cardBtnPrimaryText}>{ctaLabel}</Text>
        </Pressable>
        {DOCTOR_MESSAGING_ENABLED ? (
          <Pressable onPress={onContact} style={({ pressed }) => [styles.cardBtn, styles.cardBtnOutline, pressed && styles.cardBtnPressed]} accessibilityRole="button" accessibilityLabel={`Contacter ${name}`}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
            <Text style={styles.cardBtnOutlineText}>Contacter</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const AVATAR = 64;
const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.lg },
  iconBtn: { padding: spacing.xs },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  listWrap: { gap: spacing.md },
  // Intro thérapie
  heroWrap: { gap: spacing.md },
  heroCard: { gap: spacing.sm, backgroundColor: colors.primaryLight, borderColor: colors.primary },
  heroHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heroEmoji: { fontSize: 26 },
  heroTitle: { ...typography.h3, color: colors.primaryDark },
  heroIntro: { ...typography.body, color: colors.primaryDark, lineHeight: 21 },
  heroConfid: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  heroConfidText: { ...typography.caption, color: colors.primaryDark, flex: 1, fontWeight: "600" },
  heroActions: { gap: spacing.sm },
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
  chipPressed: { opacity: 0.7 },
  sortText: { fontSize: 13, fontWeight: "700", color: colors.text },
  sortTextActive: { color: colors.white },
  empty: { alignItems: "center", gap: spacing.sm },
  muted: { color: colors.textMuted, textAlign: "center" },
  row: { gap: spacing.md },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: radius.pill, backgroundColor: colors.primaryLight },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  name: { ...typography.name },
  specialty: { ...typography.caption, color: colors.secondary, fontWeight: "600" },
  bio: { ...typography.caption, color: colors.textMuted },
  rowFoot: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  fee: { ...typography.body, fontWeight: "700", color: colors.primary },
  feeFree: { ...typography.caption, color: colors.textMuted },
  availPill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  availPillOff: { opacity: 0.7 },
  availDot: { width: 7, height: 7, borderRadius: 3.5 },
  availText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: spacing.sm },
  cardBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, height: 42, borderRadius: radius.md, borderWidth: 1.5 },
  cardBtnPressed: { opacity: 0.75 },
  cardBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  cardBtnPrimaryText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  cardBtnOutline: { borderColor: colors.primary, backgroundColor: colors.card },
  cardBtnOutlineText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});
