import { useEffect, useState, useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loading } from "@/components/Loading";
import { AdminHeader } from "@/components/AdminHeader";
import { useAuth } from "@/providers/AuthProvider";
import { adminService } from "@/lib/admin-service";
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
          <Card style={styles.empty}><Text style={[typography.body, styles.muted]}>Aucun produit. Touchez + pour en créer un.</Text></Card>
        ) : (
          products.map((p) => (
            <Card key={p.id} style={styles.row}>
              <Pressable style={styles.rowMain} onPress={() => setEditing(p)}>
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
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!session?.user) return;
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
        <Input label="URL de l'image" value={imageUrl} onChangeText={setImageUrl} placeholder="https://… (facultatif)" autoCapitalize="none" />
        <View style={styles.activeRow}>
          <Text style={styles.activeLabel}>Produit actif</Text>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
        </View>
        <Button title={product ? "Enregistrer" : "Créer le produit"} onPress={handleSave} loading={saving} />
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
  rowMain: { flex: 1 },
  rowInfo: { gap: 2 },
  name: { ...typography.body, fontWeight: "600" },
  meta: { ...typography.caption, color: colors.textMuted },
  rowActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: { ...typography.caption, color: colors.white, fontWeight: "700", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  badgeOn: { backgroundColor: colors.success },
  badgeOff: { backgroundColor: colors.textMuted },
  formContent: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  textArea: { height: 100, textAlignVertical: "top", paddingTop: spacing.sm },
  activeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  activeLabel: { ...typography.body, fontWeight: "600" },
});
