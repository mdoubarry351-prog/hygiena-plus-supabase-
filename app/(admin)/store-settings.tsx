import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import type { StoreSettings, Json } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

// Format monétaire « X GNF » (séparateurs fr-FR).
const fmtGNF = (n: number) => `${n.toLocaleString("fr-FR")} GNF`;

// Indice formaté sous un champ montant (null si vide/invalide).
function moneyHint(s: string): string | null {
  const t = s.replace(/\s/g, "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? fmtGNF(n) : null;
}

function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function StoreSettingsScreen() {
  const { session } = useAuth();
  const [row, setRow] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Champs éditables
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [codEnabled, setCodEnabled] = useState(false);
  const [codMax, setCodMax] = useState("");
  const [codMinAge, setCodMinAge] = useState("");
  const [codZones, setCodZones] = useState<string[]>([]);
  const [zoneDraft, setZoneDraft] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [freeThreshold, setFreeThreshold] = useState("");
  const [deliveryZonesJson, setDeliveryZonesJson] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await adminService.getStoreSettings();
      setRow(s);
      if (s) {
        setWhatsappEnabled(!!s.whatsapp_enabled);
        setWhatsappNumber(s.whatsapp_number ?? "");
        setCodEnabled(!!s.cod_enabled);
        setCodMax(s.cod_max_amount != null ? String(s.cod_max_amount) : "");
        setCodMinAge(s.cod_min_account_age_days != null ? String(s.cod_min_account_age_days) : "");
        setCodZones(s.cod_zones ?? []);
        setDeliveryFee(s.default_delivery_fee != null ? String(s.default_delivery_fee) : "");
        setFreeThreshold(s.free_delivery_threshold != null ? String(s.free_delivery_threshold) : "");
        setDeliveryZonesJson(s.delivery_zones != null ? JSON.stringify(s.delivery_zones, null, 2) : "");
        setAnnouncement(s.announcement ?? "");
      }
    } catch {
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function addZone() {
    const z = zoneDraft.trim();
    if (!z) return;
    if (!codZones.includes(z)) setCodZones((prev) => [...prev, z]);
    setZoneDraft("");
  }

  function removeZone(z: string) {
    setCodZones((prev) => prev.filter((x) => x !== z));
  }

  async function handleSave() {
    if (!session?.user || !row) return;

    // --- Validation montants ---
    const codMaxNum = Number(codMax.replace(/\s/g, ""));
    if (codMax.trim() === "" || !Number.isFinite(codMaxNum) || codMaxNum < 0) {
      Alert.alert("Montant invalide", "Le montant max COD doit être un nombre positif.");
      return;
    }
    const codAgeNum = Number(codMinAge.replace(/\s/g, ""));
    if (codMinAge.trim() === "" || !Number.isInteger(codAgeNum) || codAgeNum < 0) {
      Alert.alert("Valeur invalide", "L'ancienneté minimale doit être un entier positif (en jours).");
      return;
    }
    const feeNum = Number(deliveryFee.replace(/\s/g, ""));
    if (deliveryFee.trim() === "" || !Number.isFinite(feeNum) || feeNum < 0) {
      Alert.alert("Frais invalides", "Les frais de livraison doivent être un nombre positif.");
      return;
    }
    let thresholdNum: number | null = null;
    if (freeThreshold.trim() !== "") {
      const t = Number(freeThreshold.replace(/\s/g, ""));
      if (!Number.isFinite(t) || t < 0) {
        Alert.alert("Seuil invalide", "Le seuil de livraison gratuite doit être un nombre positif.");
        return;
      }
      thresholdNum = t;
    }

    // --- Validation JSON zones de livraison ---
    let deliveryZones: Json | null = null;
    if (deliveryZonesJson.trim() !== "") {
      try {
        deliveryZones = JSON.parse(deliveryZonesJson) as Json;
      } catch {
        Alert.alert("JSON invalide", "Le champ « Zones de livraison » doit contenir du JSON valide.");
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await adminService.updateStoreSettings(session.user.id, row.id, {
        whatsapp_enabled: whatsappEnabled,
        whatsapp_number: whatsappNumber.trim() || null,
        cod_enabled: codEnabled,
        cod_max_amount: codMaxNum,
        cod_min_account_age_days: codAgeNum,
        cod_zones: codZones,
        default_delivery_fee: feeNum,
        free_delivery_threshold: thresholdNum,
        delivery_zones: deliveryZones,
        announcement: announcement.trim() || null,
      });
      setRow(updated);
      Alert.alert("Enregistré", "Les paramètres de la boutique ont été mis à jour.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Enregistrement échoué");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  if (!row) {
    return (
      <Screen>
        <AdminHeader title="Paramètres de la boutique" />
        <EmptyState icon="storefront-outline" title="Paramètres introuvables" message="Aucune ligne store_settings n'a été trouvée." />
      </Screen>
    );
  }

  const lastUpdate = formatDateTime(row.updated_at);

  return (
    <Screen>
      <AdminHeader title="Paramètres de la boutique" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Configuration de la Boutique Officielle Hygiena+</Text>

        {/* WhatsApp */}
        <Card style={styles.card}>
          <SectionHeader icon="logo-whatsapp" title="WhatsApp" />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Commandes WhatsApp activées</Text>
            <Switch value={whatsappEnabled} onValueChange={setWhatsappEnabled} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
          </View>
          <Input label="Numéro WhatsApp" value={whatsappNumber} onChangeText={setWhatsappNumber} placeholder="+224..." keyboardType="phone-pad" autoCapitalize="none" />
        </Card>

        {/* Paiement à la livraison */}
        <Card style={styles.card}>
          <SectionHeader icon="cash-outline" title="Paiement à la livraison (COD)" />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Paiement à la livraison activé</Text>
            <Switch value={codEnabled} onValueChange={setCodEnabled} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
          </View>
          <Input label="Montant max COD (GNF)" value={codMax} onChangeText={setCodMax} placeholder="Ex. 150000" keyboardType="numeric" />
          {moneyHint(codMax) ? <Text style={styles.hint}>{moneyHint(codMax)}</Text> : null}
          <Input label="Ancienneté min. du compte (jours)" value={codMinAge} onChangeText={setCodMinAge} placeholder="Ex. 1" keyboardType="numeric" />

          <Text style={styles.fieldLabel}>Zones éligibles COD</Text>
          <View style={styles.zoneAdd}>
            <Input value={zoneDraft} onChangeText={setZoneDraft} placeholder="Ex. Conakry" autoCapitalize="words" style={styles.zoneInput} returnKeyType="done" onSubmitEditing={addZone} />
            <Pressable onPress={addZone} style={styles.addBtn}>
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.addBtnText}>Ajouter</Text>
            </Pressable>
          </View>
          {codZones.length > 0 ? (
            <View style={styles.chips}>
              {codZones.map((z) => (
                <View key={z} style={styles.chip}>
                  <Text style={styles.chipText}>{z}</Text>
                  <Pressable onPress={() => removeZone(z)} hitSlop={6}>
                    <Ionicons name="close" size={14} color={colors.primaryDark} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        {/* Livraison */}
        <Card style={styles.card}>
          <SectionHeader icon="bicycle-outline" title="Livraison" />
          <Input label="Frais de livraison par défaut (GNF)" value={deliveryFee} onChangeText={setDeliveryFee} placeholder="Ex. 15000" keyboardType="numeric" />
          {moneyHint(deliveryFee) ? <Text style={styles.hint}>{moneyHint(deliveryFee)}</Text> : null}
          <Input label="Seuil livraison gratuite (GNF) — optionnel" value={freeThreshold} onChangeText={setFreeThreshold} placeholder="Ex. 200000" keyboardType="numeric" />
          {moneyHint(freeThreshold) ? <Text style={styles.hint}>{moneyHint(freeThreshold)}</Text> : null}
          <Input
            label="Zones de livraison (JSON)"
            value={deliveryZonesJson}
            onChangeText={setDeliveryZonesJson}
            placeholder={'ex : [{"name":"Conakry","fee":15000}]'}
            autoCapitalize="none"
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />
          <Text style={styles.note}>Format JSON. Laisser vide pour utiliser les frais par défaut.</Text>
        </Card>

        {/* Annonce */}
        <Card style={styles.card}>
          <SectionHeader icon="megaphone-outline" title="Annonce boutique" />
          <Input
            label="Message d'annonce (bannière storefront)"
            value={announcement}
            onChangeText={setAnnouncement}
            placeholder="ex : Livraison gratuite ce week-end !"
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />
        </Card>

        <Button title="Enregistrer" onPress={handleSave} loading={saving} />
        {lastUpdate ? <Text style={styles.lastUpdate}>Dernière mise à jour : {lastUpdate}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color={colors.primaryDark} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  subtitle: { ...typography.caption, color: colors.textMuted },
  card: { gap: spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  sectionIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  sectionTitle: { ...typography.h3 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  toggleLabel: { ...typography.name, flex: 1 },
  hint: { ...typography.caption, color: colors.primaryDark, fontWeight: "700", marginTop: -spacing.xs },
  fieldLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700", marginTop: spacing.xs },
  zoneAdd: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  zoneInput: { flex: 1, marginBottom: 0 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, height: 48, borderRadius: radius.md, backgroundColor: colors.primary },
  addBtnText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill },
  chipText: { ...typography.caption, color: colors.primaryDark, fontWeight: "700" },
  textArea: { height: 110, textAlignVertical: "top", paddingTop: spacing.sm },
  note: { ...typography.caption, color: colors.textMuted },
  lastUpdate: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
});
