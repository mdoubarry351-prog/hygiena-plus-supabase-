import { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
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
import { uploadProductImage } from "@/lib/storage";
import { formatPrice } from "@/lib/marketplace-service";
import type { MarketplaceProduct } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

type Editing = MarketplaceProduct | "new" | null;

export default function AdminProducts() {
  const { session } = useAuth();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await adminService.getProducts());
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(p: MarketplaceProduct) {
    if (!session?.user) return;
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
    try {
      await adminService.updateProduct(session.user.id, p.id, { is_active: !p.is_active });
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Action échouée");
      await load();
    }
  }

  if (loading && products.length === 0) return <Loading />;

  if (editing) {
    return (
      <ProductForm
        product={editing === "new" ? null : editing}
        onDone={async () => { setEditing(null); await load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <Screen>
      <AdminHeader
        title="Produits"
        right={
          <Pressable onPress={() => setEditing("new")} hitSlop={8} style={styles.addBtn}>
            <Ionicons name="add" size={20} color={colors.white} />
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {products.length === 0 ? (
          <EmptyState icon="bag-handle-outline" title="Aucun produit" message="Touchez + pour en créer un." />
        ) : (
          products.map((p) => (
            <Card key={p.id} style={styles.row}>
              <Pressable style={styles.rowMain} onPress={() => setEditing(p)}>
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={styles.adminThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.adminThumb, styles.adminThumbPlaceholder]}>
                    <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.rowInfo}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.meta}>{formatPrice(p.price)} · stock {p.stock}</Text>
                </View>
              </Pressable>
              <View style={styles.rowActions}>
                <Text style={[styles.badge, p.is_active ? styles.badgeOn : styles.badgeOff]}>{p.is_active ? "Actif" : "Inactif"}</Text>
                <Switch
                  value={p.is_active}
                  onValueChange={() => toggleActive(p)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function ProductForm({ product, onDone, onCancel }: { product: MarketplaceProduct | null; onDone: () => void; onCancel: () => void }) {
  const { session } = useAuth();
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : "");
  const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : "0");
  const [description, setDescription] = useState(product?.description ?? "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  // Aperçu : la photo locale (immédiate) puis l'URL distante une fois uploadée.
  const previewUri = localPreview ?? (imageUrl || null);

  // Sélection d'une photo depuis la galerie + upload haute qualité vers Storage.
  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Autorisation requise", "Autorisez l'accès à vos photos pour ajouter une image de produit.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // garde la résolution d'origine
      quality: 1, // aucune compression
      base64: true, // octets fiables pour l'upload en RN
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) {
      Alert.alert("Erreur", "Impossible de lire la photo sélectionnée.");
      return;
    }
    setLocalPreview(asset.uri);
    setUploading(true);
    try {
      const url = await uploadProductImage(asset.base64);
      setImageUrl(url);
    } catch (e) {
      setLocalPreview(null);
      Alert.alert("Échec de l'upload", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setImageUrl("");
    setLocalPreview(null);
  }

  async function handleSave() {
    if (!session?.user) return;
    if (uploading) { Alert.alert("Patientez", "La photo est encore en cours d'envoi."); return; }
    const priceNum = Number(price.replace(/\s/g, ""));
    const stockNum = Number(stock.replace(/\s/g, ""));
    if (!name.trim()) { Alert.alert("Nom requis", "Indiquez le nom du produit."); return; }
    if (Number.isNaN(priceNum) || priceNum < 0) { Alert.alert("Prix invalide", "Le prix doit être un nombre positif."); return; }
    if (Number.isNaN(stockNum) || stockNum < 0) { Alert.alert("Stock invalide", "Le stock doit être un nombre positif."); return; }

    setSaving(true);
    try {
      if (product) {
        await adminService.updateProduct(session.user.id, product.id, {
          name: name.trim(), price: priceNum, stock: stockNum,
          description: description.trim() || null, image_url: imageUrl.trim() || null, is_active: isActive,
        });
      } else {
        await adminService.createProduct(session.user.id, {
          name: name.trim(), price: priceNum, stock: stockNum,
          description: description.trim() || null, image_url: imageUrl.trim() || null, is_active: isActive,
        });
      }
      onDone();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Enregistrement échoué");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <AdminHeader title={product ? "Modifier le produit" : "Nouveau produit"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
        <Input label="Nom" value={name} onChangeText={setName} placeholder="Nom du produit" />
        <Input label="Prix (GNF)" value={price} onChangeText={setPrice} placeholder="Ex. 50000" keyboardType="numeric" />
        <Input label="Stock" value={stock} onChangeText={setStock} placeholder="Ex. 20" keyboardType="numeric" />
        <Input label="Description" value={description} onChangeText={setDescription} placeholder="Description (facultatif)" multiline numberOfLines={4} style={styles.textArea} />
        <View style={styles.photoBlock}>
          <Text style={styles.photoLabel}>Photo du produit (facultatif)</Text>
          {previewUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
              {uploading && (
                <View style={styles.previewOverlay}>
                  <ActivityIndicator color={colors.white} />
                  <Text style={styles.previewOverlayText}>Envoi…</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.preview, styles.previewPlaceholder]}>
              <Ionicons name="image-outline" size={44} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.photoActions}>
            <Pressable onPress={pickImage} disabled={uploading} style={[styles.photoBtn, uploading && styles.photoBtnDisabled]}>
              <Ionicons name="image" size={18} color={colors.primary} />
              <Text style={styles.photoBtnText}>{previewUri ? "Changer la photo" : "Choisir une photo"}</Text>
            </Pressable>
            {previewUri && !uploading ? (
              <Pressable onPress={removePhoto} style={[styles.photoBtn, styles.photoBtnDanger]}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.photoBtnText, { color: colors.danger }]}>Retirer</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={styles.activeRow}>
          <Text style={styles.activeLabel}>Produit actif</Text>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
        </View>
        <Button title={product ? "Enregistrer" : "Créer le produit"} onPress={handleSave} loading={saving} disabled={uploading} />
        <Button title="Annuler" variant="outline" onPress={onCancel} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  empty: { alignItems: "center" },
  muted: { color: colors.textMuted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  adminThumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface },
  adminThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 2 },
  name: { ...typography.name },
  meta: { ...typography.caption, color: colors.textMuted },
  rowActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: { ...typography.caption, color: colors.white, fontWeight: "700", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  badgeOn: { backgroundColor: colors.success },
  badgeOff: { backgroundColor: colors.textMuted },
  formContent: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  textArea: { height: 100, textAlignVertical: "top", paddingTop: spacing.sm },
  activeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  activeLabel: { ...typography.name },
  // Sélecteur de photo
  photoBlock: { gap: spacing.sm },
  photoLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
  previewWrap: { position: "relative" },
  preview: { width: "100%", height: 220, borderRadius: radius.lg, backgroundColor: colors.surface },
  previewPlaceholder: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed" },
  previewOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: radius.lg, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  previewOverlayText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  photoActions: { flexDirection: "row", gap: spacing.sm },
  photoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  photoBtnDisabled: { opacity: 0.5 },
  photoBtnDanger: { borderColor: colors.danger },
  photoBtnText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});
