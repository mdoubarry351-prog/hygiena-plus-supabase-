import { useEffect, useRef, useState, useCallback } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { ExportButton } from "@/components/ExportButton";
import { StarRating } from "@/components/StarRating";
import { AppImage } from "@/components/AppImage";
import { LoadMoreFooter, isNearBottom } from "@/components/LoadMoreFooter";
import { PhoneInput } from "@/components/PhoneInput";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/providers/ToastProvider";
import { onlyDigits, toE164, isValidGuineaLocal } from "@/lib/phone";
import { practitionerTypeOf, PRACTITIONER_TYPES, PRACTITIONER_LABELS } from "@/lib/practitioner";
import type { PractitionerType } from "@/lib/database.types";
import { useAuth } from "@/providers/AuthProvider";
import { adminService, type DoctorRow, type DoctorActivity } from "@/lib/admin-service";
import { uploadAvatar } from "@/lib/storage";
import { exportCsv } from "@/lib/csv-export";
import { formatPrice } from "@/lib/marketplace-service";
import { hapticSuccess } from "@/lib/haptics";
import { colors, radius, spacing, typography } from "@/theme";

const SPECIALTIES = [
  "Médecine générale",
  "Gynécologie",
  "Obstétrique",
  "Dermatologie",
  "Pédiatrie",
  "Nutrition",
  "Psychologie",
  "Sage-femme",
];

const DEFAULT_FEE = "75000";

export default function AdminDoctors() {
  const { session } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activity, setActivity] = useState<DoctorActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [kycUrl, setKycUrl] = useState<string | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const offsetRef = useRef(0);
  const PAGE = 20;

  // Flux "Ajouter un médecin" (création complète, compte de connexion inclus)
  const [adding, setAdding] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [practitionerType, setPractitionerType] = useState<PractitionerType>("gynecology");
  const [interventionAreas, setInterventionAreas] = useState("");
  // Filtre de la liste par type de praticien.
  const [typeFilter, setTypeFilter] = useState<"all" | PractitionerType>("all");
  const [yearsExp, setYearsExp] = useState("0");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fee, setFee] = useState(DEFAULT_FEE);
  const [isValidated, setIsValidated] = useState(true);
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getDoctorsPage(PAGE, 0);
      setDoctors(data);
      offsetRef.current = PAGE;
      setHasMore(data.length === PAGE);
    } catch {
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await adminService.getDoctorsPage(PAGE, offsetRef.current);
      setDoctors((prev) => {
        const seen = new Set(prev.map((d) => d.id));
        return [...prev, ...data.filter((d) => !seen.has(d.id))];
      });
      offsetRef.current += PAGE;
      setHasMore(data.length === PAGE);
    } catch {
      // garde l'état
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => { load(); }, [load]);

  // Charge le récap d'activité du médecin déplié. (Réinitialise aussi le doc KYC.)
  useEffect(() => {
    setKycUrl(null);
    setKycLoading(false);
    if (!expandedId) { setActivity(null); return; }
    let cancelled = false;
    setActivity(null);
    setActivityLoading(true);
    adminService
      .getDoctorActivity(expandedId)
      .then((a) => { if (!cancelled) setActivity(a); })
      .catch(() => { if (!cancelled) setActivity(null); })
      .finally(() => { if (!cancelled) setActivityLoading(false); });
    return () => { cancelled = true; };
  }, [expandedId]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Génère une URL signée (60s) pour afficher le document KYC du bucket privé.
  async function viewKyc(path: string) {
    setKycLoading(true);
    try {
      setKycUrl(await adminService.getKycSignedUrl(path));
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Document indisponible.");
    } finally {
      setKycLoading(false);
    }
  }

  // Recherche par NOM côté client (le nom vit sur profiles ; jeu réduit). On
  // l'applique sur le chargé pour la liste, et sur le « tout » pour l'export.
  function matchesSearch(d: DoctorRow, q: string): boolean {
    if (!q) return true;
    return (d.profile?.full_name ?? "").toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q);
  }
  const q = search.trim().toLowerCase();
  const visibleDoctors = doctors
    .filter((d) => typeFilter === "all" || practitionerTypeOf(d.practitioner_type) === typeFilter)
    .filter((d) => matchesSearch(d, q));

  async function handleExport() {
    setExporting(true);
    try {
      // Export COMPLET : tous les médecins, puis filtre nom/spécialité côté client.
      const all = await adminService.getAllDoctors();
      const rows = all.filter((d) => matchesSearch(d, q)).map((d) => ({
        nom: d.profile?.full_name ?? "",
        specialite: d.specialty,
        valide: d.is_validated ? "Oui" : "Non",
        note: d.rating_count > 0 ? d.rating_avg.toFixed(1) : "—",
        avis: String(d.rating_count),
        tarif: d.consultation_fee != null ? formatPrice(d.consultation_fee) : "",
      }));
      await exportCsv("medecins", rows, [
        { key: "nom", label: "Nom" },
        { key: "specialite", label: "Spécialité" },
        { key: "valide", label: "Validé" },
        { key: "note", label: "Note" },
        { key: "avis", label: "Nbre d'avis" },
        { key: "tarif", label: "Tarif" },
      ]);
    } catch (e) {
      Alert.alert("Export impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setExporting(false);
    }
  }

  function resetAdd() {
    setAdding(false);
    setAvatarUrl(null); setLocalAvatar(null); setAvatarUploading(false);
    setFullName(""); setSpecialty(""); setYearsExp("0"); setPhone(""); setEmail("");
    setFee(DEFAULT_FEE); setIsValidated(true); setBio("");
    setPractitionerType("gynecology"); setInterventionAreas("");
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Autorisation requise", "Autorisez l'accès à vos photos pour ajouter une photo de médecin.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) { Alert.alert("Erreur", "Impossible de lire la photo."); return; }
    setLocalAvatar(asset.uri);
    setAvatarUploading(true);
    try {
      setAvatarUrl(await uploadAvatar(asset.base64));
    } catch (e) {
      setLocalAvatar(null);
      Alert.alert("Échec de l'upload", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function submitCreate() {
    if (!session?.user) return;
    if (avatarUploading) { Alert.alert("Patientez", "La photo est encore en cours d'envoi."); return; }
    if (!fullName.trim()) { Alert.alert("Nom requis", "Indiquez le nom complet du médecin."); return; }
    if (!specialty) { Alert.alert("Spécialité requise", "Sélectionnez une spécialité."); return; }
    if (!isValidGuineaLocal(phone)) { Alert.alert("Téléphone requis", "Saisissez le numéro de connexion du médecin (9 chiffres)."); return; }

    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");

    const years = Number(yearsExp.replace(/\s/g, "")) || 0;
    const feeNum = fee.trim() ? Number(fee.replace(/\s/g, "")) : 0;
    if (!Number.isFinite(feeNum) || feeNum < 0) { Alert.alert("Tarif invalide", "Le tarif doit être un nombre positif."); return; }

    setSaving(true);
    try {
      const interv = interventionAreas.trim() || null;
      const res = await adminService.createDoctor({
        firstName,
        lastName,
        phone: toE164(onlyDigits(phone)),
        email: email.trim() || null,
        specialty,
        practitionerType,
        interventionAreas: interv,
        yearsExperience: years,
        consultationFeeGNF: feeNum,
        bio: bio.trim() || null,
        avatarUrl,
        isValidated,
      });
      // Filet de sécurité : garantit le type + domaines même si l'Edge Function
      // ne les traite pas (l'admin peut écrire `doctors`). Best-effort.
      if (res.user_id) {
        await adminService.setDoctorType(res.user_id, practitionerType, interv).catch(() => {});
      }
      const lines = [
        "Identifiants de connexion à communiquer au médecin :",
        `Téléphone : ${res.phone ?? toE164(onlyDigits(phone))}`,
      ];
      if (res.email) lines.push(`Email : ${res.email}`);
      lines.push(`Mot de passe temporaire : ${res.temp_password}`);
      if (!res.email) lines.push("\nAstuce : ajoutez un email pour une connexion immédiate (email + mot de passe).");
      resetAdd();
      await load();
      hapticSuccess();
      Alert.alert("Médecin créé ✅", lines.join("\n"));
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Création échouée");
    } finally {
      setSaving(false);
    }
  }

  async function demote(d: DoctorRow) {
    if (!session?.user) return;
    const ok = await confirm({
      title: "Retirer le statut médecin ?",
      message: `${d.profile?.full_name ?? "Ce médecin"} redeviendra un utilisateur simple et sa fiche médecin sera supprimée. Le compte est conservé.`,
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminService.demoteDoctor(session.user.id, { id: d.id, user_id: d.user_id });
      setDoctors((prev) => prev.filter((x) => x.id !== d.id));
      toast.success("Le compte est redevenu utilisateur simple.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action échouée");
    }
  }

  async function deleteDoctor(d: DoctorRow) {
    if (!session?.user) return;
    const ok = await confirm({
      title: "Supprimer définitivement ?",
      message: `Le compte de ${d.profile?.full_name ?? "ce médecin"} et toutes ses données seront supprimés. Cette action est IRRÉVERSIBLE.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminService.deleteDoctorAccount(session.user.id, d.user_id);
      setDoctors((prev) => prev.filter((x) => x.id !== d.id));
      toast.success("Le compte médecin a été supprimé définitivement.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression échouée");
    }
  }

  async function setValidation(d: DoctorRow, validate: boolean) {
    if (!session?.user) return;
    const ok = await confirm({
      title: validate ? "Valider ce médecin ?" : "Révoquer ce médecin ?",
      message: validate ? "Sa fiche deviendra visible par les patientes." : "Sa fiche ne sera plus visible.",
      confirmLabel: validate ? "Valider" : "Révoquer",
      danger: !validate,
    });
    if (!ok) return;
    try {
      await adminService.setDoctorValidation(session.user.id, d.id, validate);
      setDoctors((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_validated: validate } : x)));
      toast.success(validate ? "Médecin validé." : "Validation révoquée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action échouée");
    }
  }

  if (loading && doctors.length === 0) return <Loading />;

  const feeHint = (() => {
    const n = Number(fee.replace(/\s/g, ""));
    return fee.trim() && Number.isFinite(n) && n >= 0 ? formatPrice(n) : null;
  })();
  const avatarPreview = localAvatar ?? avatarUrl;
  // Essentiel requis pour activer « Créer » (nom + spécialité + téléphone valide).
  const canCreate = fullName.trim().length > 0 && !!specialty && isValidGuineaLocal(phone) && !avatarUploading;

  return (
    <Screen>
      <AdminHeader title="Médecins" right={<ExportButton onPress={handleExport} loading={exporting} />} />
      {!adding ? (
        <View style={styles.searchRow}>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher (nom ou spécialité)…"
            autoCapitalize="none"
            style={styles.searchInput}
          />
          <SegmentedControl
            items={[
              { key: "all", label: "Tous" },
              ...PRACTITIONER_TYPES.map((t) => ({ key: t, label: PRACTITIONER_LABELS[t].shortTitle })),
            ]}
            value={typeFilter}
            onChange={(k) => setTypeFilter(k as "all" | PractitionerType)}
          />
        </View>
      ) : null}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { if (isNearBottom(e)) loadMore(); }}
        scrollEventThrottle={400}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {adding ? (
          <Card style={styles.addCard}>
            <View style={styles.addHead}>
              <Text style={typography.h3}>Ajouter un médecin</Text>
              <Pressable onPress={resetAdd} hitSlop={8}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
            </View>

            {/* Photo */}
            <View style={styles.avatarBlock}>
              {avatarPreview ? (
                <View>
                  <AppImage source={avatarPreview} style={styles.avatarPreview} />
                  {avatarUploading && (
                    <View style={styles.avatarOverlay}><ActivityIndicator color={colors.white} /></View>
                  )}
                </View>
              ) : (
                <View style={[styles.avatarPreview, styles.avatarPlaceholder]}>
                  <Ionicons name="person-outline" size={40} color={colors.textMuted} />
                </View>
              )}
              <Pressable onPress={pickAvatar} disabled={avatarUploading} style={[styles.photoBtn, avatarUploading && styles.photoBtnDisabled]}>
                <Ionicons name="camera-outline" size={18} color={colors.primary} />
                <Text style={styles.photoBtnText}>{avatarPreview ? "Changer la photo" : "Ajouter une photo"}</Text>
              </Pressable>
            </View>

            {/* Section : Identité & contact */}
            <Text style={styles.section}>Identité & contact</Text>
            <Input label="Nom complet *" value={fullName} onChangeText={setFullName} placeholder="Ex. Aïssata Diallo" autoCapitalize="words" />
            <PhoneInput label="Téléphone (connexion) *" value={phone} onChangeText={(f) => setPhone(f)} />
            <Text style={styles.note}>Identifiant de connexion du médecin. Pour une connexion immédiate, renseignez aussi un email (la connexion par SMS nécessite un fournisseur SMS).</Text>
            <Input label="Email (optionnel)" value={email} onChangeText={setEmail} placeholder="medecin@exemple.com" keyboardType="email-address" autoCapitalize="none" />

            {/* Section : Profil professionnel */}
            <Text style={styles.section}>Profil professionnel</Text>
            <Text style={styles.fieldLabel}>Type de praticien *</Text>
            <View style={styles.chips}>
              {PRACTITIONER_TYPES.map((t) => {
                const active = practitionerType === t;
                return (
                  <Pressable key={t} onPress={() => setPractitionerType(t)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{PRACTITIONER_LABELS[t].emoji} {PRACTITIONER_LABELS[t].shortTitle}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fieldLabel}>Spécialité *</Text>
            <View style={styles.chips}>
              {SPECIALTIES.map((s) => {
                const active = specialty === s;
                return (
                  <Pressable key={s} onPress={() => setSpecialty(s)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Input label="Domaines d'intervention (optionnel)" value={interventionAreas} onChangeText={setInterventionAreas} placeholder="Ex. anxiété, stress, deuil, couple…" multiline numberOfLines={2} style={styles.textArea} />
            <Input label="Années d'expérience" value={yearsExp} onChangeText={setYearsExp} placeholder="0" keyboardType="numeric" />
            <Input label="Présentation" value={bio} onChangeText={setBio} placeholder="Quelques phrases sur le médecin, son parcours, son approche…" multiline numberOfLines={4} style={styles.textArea} />

            {/* Section : Tarif & statut */}
            <Text style={styles.section}>Tarif & statut</Text>
            <Input label="Tarif consultation (GNF)" value={fee} onChangeText={setFee} placeholder="75000" keyboardType="numeric" />
            {feeHint ? <Text style={styles.hint}>{feeHint}</Text> : null}
            <Text style={styles.fieldLabel}>Statut initial</Text>
            <View style={styles.statusRow}>
              <Pressable onPress={() => setIsValidated(true)} style={[styles.statusBtn, isValidated && styles.statusBtnActive]}>
                <Ionicons name="shield-checkmark-outline" size={16} color={isValidated ? colors.white : colors.textMuted} />
                <Text style={[styles.statusText, isValidated && styles.statusTextActive]}>Actif (visible, certifié)</Text>
              </Pressable>
              <Pressable onPress={() => setIsValidated(false)} style={[styles.statusBtn, !isValidated && styles.statusBtnInactive]}>
                <Ionicons name="eye-off-outline" size={16} color={!isValidated ? colors.white : colors.textMuted} />
                <Text style={[styles.statusText, !isValidated && styles.statusTextActive]}>Inactif</Text>
              </Pressable>
            </View>

            <Button title="Créer le médecin" onPress={submitCreate} loading={saving} disabled={!canCreate} />
            {!canCreate && !saving ? <Text style={styles.requiredHint}>Renseigne le nom, la spécialité et un téléphone valide pour créer le médecin.</Text> : null}
          </Card>
        ) : (
          <Pressable onPress={() => setAdding(true)} style={styles.addToggle}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.addToggleText}>Ajouter un médecin</Text>
          </Pressable>
        )}

        {visibleDoctors.length === 0 ? (
          <EmptyState icon="medkit-outline" title={q ? "Aucun résultat" : "Aucun médecin enregistré"} />
        ) : (
          <>
          {visibleDoctors.map((d) => {
            const isSelf = session?.user?.id === d.user_id;
            const open = expandedId === d.id;
            return (
            <Card key={d.id} style={styles.card}>
              <Pressable onPress={() => setExpandedId(open ? null : d.id)} style={styles.head} accessibilityRole="button" accessibilityLabel={open ? "Masquer l'activité" : "Voir l'activité"}>
                <View style={styles.info}>
                  <Text style={styles.name}>{d.profile?.full_name ?? "Médecin"}</Text>
                  <Text style={styles.specialty}>{PRACTITIONER_LABELS[practitionerTypeOf(d.practitioner_type)].shortTitle} · {d.specialty}</Text>
                  <Text style={styles.meta}>{d.profile?.email ?? "—"}</Text>
                </View>
                <Badge label={d.is_validated ? "Validé" : "En attente"} tone={d.is_validated ? "success" : "warning"} soft />
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
              </Pressable>
              <View style={styles.metaRow}>
                {d.license_number ? <Text style={styles.meta}>Licence : {d.license_number}</Text> : null}
                {d.consultation_fee != null ? <Text style={styles.meta}>{formatPrice(d.consultation_fee)}</Text> : null}
              </View>
              {d.bio ? <Text style={styles.bio} numberOfLines={3}>{d.bio}</Text> : null}

              {/* Activité (au dépliage) */}
              {open ? (
                <View style={styles.activityBox}>
                  <Text style={styles.activityTitle}>Activité</Text>
                  {activityLoading ? (
                    <ActivityIndicator color={colors.primary} style={styles.activitySpinner} />
                  ) : activity ? (
                    <>
                      <View style={styles.activityRow}>
                        <View style={styles.activityStat}>
                          <Ionicons name="calendar-outline" size={18} color={colors.primaryDark} />
                          <Text style={styles.activityValue}>{activity.appointments}</Text>
                          <Text style={styles.activityLabel}>Rendez-vous</Text>
                        </View>
                        <View style={styles.activityStat}>
                          <Ionicons name="cash-outline" size={18} color={colors.primaryDark} />
                          <Text style={styles.activityValue}>{formatPrice(activity.revenue)}</Text>
                          <Text style={styles.activityLabel}>Revenus</Text>
                        </View>
                      </View>
                      <View style={styles.activityRating}>
                        <StarRating value={activity.ratingAvg} count={activity.ratingCount} size={14} compact />
                        <Text style={styles.activityLabel}>{activity.isValidated ? "Compte validé" : "En attente de validation"}</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.meta}>—</Text>
                  )}

                  {/* Vérification (KYC) */}
                  <Text style={[styles.activityTitle, styles.kycTitle]}>Vérification (KYC)</Text>
                  {d.license_document_url ? (
                    <>
                      {!d.is_validated ? (
                        <Text style={styles.kycPending}>● En attente de vérification</Text>
                      ) : null}
                      {kycUrl ? (
                        <AppImage source={kycUrl} style={styles.kycImage} contentFit="contain" />
                      ) : null}
                      <View style={styles.kycActions}>
                        <Pressable onPress={() => viewKyc(d.license_document_url!)} disabled={kycLoading} style={[styles.btn, styles.btnOutlineMuted, kycLoading && styles.kycBtnDisabled]}>
                          {kycLoading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <>
                              <Ionicons name="document-text-outline" size={16} color={colors.text} />
                              <Text style={[styles.btnText, { color: colors.text }]}>{kycUrl ? "Recharger le document" : "Voir le document"}</Text>
                            </>
                          )}
                        </Pressable>
                        {!d.is_validated ? (
                          <Pressable onPress={() => setValidation(d, true)} style={[styles.btn, { backgroundColor: colors.success }]}>
                            <Ionicons name="checkmark" size={16} color={colors.white} />
                            <Text style={styles.btnText}>Valider</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.meta}>Aucun document fourni</Text>
                  )}
                </View>
              ) : null}
              <View style={styles.actions}>
                {!d.is_validated ? (
                  <Pressable onPress={() => setValidation(d, true)} style={[styles.btn, { backgroundColor: colors.success }]}>
                    <Ionicons name="checkmark" size={16} color={colors.white} />
                    <Text style={styles.btnText}>Valider</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setValidation(d, false)} style={[styles.btn, styles.btnOutline]}>
                    <Ionicons name="close" size={16} color={colors.danger} />
                    <Text style={[styles.btnText, { color: colors.danger }]}>Révoquer</Text>
                  </Pressable>
                )}
              </View>
              {isSelf ? (
                <Text style={styles.selfNote}>C'est votre compte : retrait/suppression indisponibles.</Text>
              ) : (
                <View style={styles.actions}>
                  <Pressable onPress={() => demote(d)} style={[styles.btn, styles.btnOutlineMuted]}>
                    <Ionicons name="person-remove-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.btnText, { color: colors.textMuted }]}>Retirer le statut</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteDoctor(d)} style={[styles.btn, styles.btnOutline]}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={[styles.btnText, { color: colors.danger }]}>Supprimer</Text>
                  </Pressable>
                </View>
              )}
            </Card>
            );
          })}
          <LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { paddingTop: spacing.sm },
  searchInput: { marginBottom: 0 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { alignItems: "center" },
  muted: { color: colors.textMuted },
  card: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  activityBox: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  activityTitle: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  activitySpinner: { alignSelf: "flex-start" },
  activityRow: { flexDirection: "row", gap: spacing.sm },
  activityStat: { flex: 1, alignItems: "center", gap: 2, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  activityValue: { ...typography.name, color: colors.primaryDark },
  activityLabel: { ...typography.caption, color: colors.textMuted },
  activityRating: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  kycTitle: { marginTop: spacing.sm },
  kycPending: { ...typography.caption, color: colors.accent, fontWeight: "700" },
  kycImage: { width: "100%", height: 220, borderRadius: radius.md, backgroundColor: colors.surface },
  kycActions: { flexDirection: "row", gap: spacing.sm },
  kycBtnDisabled: { opacity: 0.6 },
  info: { flex: 1, gap: 2 },
  name: { ...typography.name },
  specialty: { ...typography.caption, color: colors.secondary, fontWeight: "600" },
  meta: { ...typography.caption, color: colors.textMuted },
  metaRow: { flexDirection: "row", gap: spacing.lg },
  bio: { ...typography.caption, color: colors.text },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, height: 44, borderRadius: radius.md },
  btnOutline: { borderWidth: 1.5, borderColor: colors.danger },
  btnOutlineMuted: { borderWidth: 1.5, borderColor: colors.border },
  btnText: { fontSize: 14, fontWeight: "700", color: colors.white },
  selfNote: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.xs },
  // Flux "Ajouter un médecin"
  addToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, borderStyle: "dashed" },
  addToggleText: { ...typography.name, color: colors.primary },
  addCard: { gap: spacing.sm },
  addHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  note: { ...typography.caption, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.primaryDark, fontWeight: "700", marginTop: -spacing.xs },
  requiredHint: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  // En-tête de section du formulaire (back-office sobre).
  section: { ...typography.caption, color: colors.primaryDark, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.sm, marginBottom: -spacing.xs },
  fieldLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700", marginTop: spacing.xs },
  textArea: { height: 100, textAlignVertical: "top", paddingTop: spacing.sm },
  // Avatar
  avatarBlock: { alignItems: "center", gap: spacing.sm },
  avatarPreview: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surface },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed" },
  avatarOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 50, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  photoBtnDisabled: { opacity: 0.5 },
  photoBtnText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  // Selects (chips + statut)
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  statusRow: { flexDirection: "row", gap: spacing.sm },
  statusBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  statusBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusBtnInactive: { backgroundColor: colors.textMuted, borderColor: colors.textMuted },
  statusText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
  statusTextActive: { color: colors.white },
});
