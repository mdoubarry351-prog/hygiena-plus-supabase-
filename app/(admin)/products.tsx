import { useEffect, useRef, useState, useCallback } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { EmptyState } from "@/components/EmptyState";
import { ExportButton } from "@/components/ExportButton";
import { LoadMoreFooter, isNearBottom } from "@/components/LoadMoreFooter";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
import { uploadProductImage } from "@/lib/storage";
import { exportCsv } from "@/lib/csv-export";
import { formatPrice, PRODUCT_CATEGORIES } from "@/lib/marketplace-service";
import type { MarketplaceProduct } from "@/lib/database.types";
import { colors, radius, spacing, typography } from "@/theme";

type Editing = MarketplaceProduct | "new" | null;

export default function AdminProducts() {
  const { session } = useAuth();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [exporting, setExporting] = useState(false);
  const offsetRef = useRef(0);
  const filtersRef = useRef<{ search: string; status: "all" | "active" | "inactive" }>({ search: "", status: "all" });
  const PAGE = 20;

  // Filtres serveur courants (lus par load/loadMore sans recréer les callbacks).
  const serverFilters = () => ({
    search: filtersRef.current.search || null,
    status: filtersRef.current.status === "all" ? null : filtersRef.current.status,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getProductsPage(PAGE, 0, serverFilters());
      setProducts(data);
      offsetRef.current = PAGE;
      setHasMore(data.length === PAGE);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await adminService.getProductsPage(PAGE, offsetRef.current, serverFilters());
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.filter((p) => !seen.has(p.id))];
      });
      offsetRef.current += PAGE;
      setHasMore(data.length === PAGE);
    } catch {
      // garde l'état
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  // Recharge serveur (page 0) à chaque changement de recherche/statut, avec debounce.
  useEffect(() => {
    filtersRef.current = { search, status };
    const t = setTimeout(() => { load(); }, 350);
    return () => clearTimeout(t);
  }, [search, status, load]);

  async function handleExport() {
    setExporting(true);
    try {
      const all = await adminService.getAllProductsFiltered(serverFilters());
      const rows = all.map((p) => ({
        nom: p.name,
        prix: formatPrice(p.price),
        stock: String(p.stock),
        statut: p.is_active ? "Actif" : "Inactif",
        note: p.rating_count > 0 ? p.rating_avg.toFixed(1) : "—",
        avis: String(p.rating_count),
      }));
      await exportCsv("produits", rows, [
        { key: "nom", label: "Nom" },
        { key: "prix", label: "Prix" },
        { key: "stock", label: "Stock" },
        { key: "statut", label: "Statut" },
        { key: "note", label: "Note" },
        { key: "avis", label: "Nbre d'avis" },
      ]);
    } catch (e) {
      Alert.alert("Export impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setExporting(false);
    }
  }

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
          <View style={styles.headerActions}>
            <ExportButton onPress={handleExport} loading={exporting} />
            <Pressable onPress={() => setEditing("new")} hitSlop={8} style={styles.addBtn}>
              <Ionicons name="add" size={20} color={colors.white} />
            </Pressable>
          </View>
        }
      />
      <View style={styles.filters}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un produit…"
          autoCapitalize="none"
          style={styles.searchInput}
        />
        <View style={styles.statusRow}>
          {([
            { key: "all", label: "Tous" },
            { key: "active", label: "Actifs" },
            { key: "inactive", label: "Inactifs" },
          ] as const).map((s) => {
            const active = status === s.key;
            return (
              <Pressable key={s.key} onPress={() => setStatus(s.key)} style={[styles.statusChip, active && styles.statusChipActive]}>
                <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { if (isNearBottom(e)) loadMore(); }}
        scrollEventThrottle={400}
      >
        {products.length === 0 ? (
          <EmptyState icon="bag-handle-outline" title={search.trim() || status !== "all" ? "Aucun résultat" : "Aucun produit"} message={search.trim() || status !== "all" ? "Ajustez la recherche ou les filtres." : "Touchez + pour en créer un."} />
        ) : (
          <>
            {products.map((p) => (
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
                    <Text style={styles.meta}>{formatPrice(p.price)} · stock {p.stock}{p.category ? ` · ${p.category}` : ""}</Text>
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
            ))}
            <LoadMoreFooter hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} />
          </>
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
  const [category, setCategory] = useState<string>(product?.category ?? "");
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
          description: description.trim() || null, image_url: imageUrl.trim() || null,
          category: category || null, is_active: isActive,
        });
      } else {
        await adminService.createProduct(session.user.id, {
          name: name.trim(), price: priceNum, stock: stockNum,
          description: description.trim() || null, image_url: imageUrl.trim() || null,
          category: category || null, is_active: isActive,
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

        <Text style={styles.fieldLabel}>Catégorie</Text>
        <View style={styles.catChips}>
          {PRODUCT_CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <Pressable key={c} onPress={() => setCategory(active ? "" : c)} style={[styles.catChip, active && styles.catChipActive]}>
                <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

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
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  addBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  filters: { paddingTop: spacing.sm, gap: spacing.sm },
  searchInput: { marginBottom: 0 },
  statusRow: { flexDirection: "row", gap: spacing.xs },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  statusChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusChipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  statusChipTextActive: { color: colors.white },
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
  fieldLabel: { ...typography.caption, color: colors.text, fontWeight: "700" },
  catChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  catChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  catChipTextActive: { color: colors.white },
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
