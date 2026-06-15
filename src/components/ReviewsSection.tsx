import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useConfirm } from "@/components/ConfirmDialog";
import { Input } from "@/components/Input";
import { StarRating, StarSelector } from "@/components/StarRating";
import { reviewsService } from "@/lib/reviews-service";
import { hapticSuccess } from "@/lib/haptics";
import { useToast } from "@/providers/ToastProvider";
import { colors, radius, spacing, typography } from "@/theme";

type ReviewItem = { id: string; authorName: string; rating: number; comment: string | null; created_at: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Section « Avis » autonome (produit ou médecin) : note moyenne, encart
 * « Donner mon avis » (pré-rempli/modifiable/supprimable) et liste des avis.
 * Réservé aux patientes ayant eu un RDV pour les médecins.
 */
export function ReviewsSection({
  kind,
  targetId,
  ratingAvg,
  ratingCount,
  onChanged,
}: {
  kind: "product" | "doctor";
  targetId: string;
  ratingAvg: number;
  ratingCount: number;
  onChanged?: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [hasMine, setHasMine] = useState(false);
  const [canReview, setCanReview] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (kind === "product") {
        const [list, mine] = await Promise.all([
          reviewsService.getProductReviews(targetId),
          reviewsService.getMyProductReview(targetId),
        ]);
        setReviews(list);
        setCanReview(true);
        if (mine) { setHasMine(true); setMyRating(mine.rating); setMyComment(mine.comment ?? ""); }
        else { setHasMine(false); }
      } else {
        const [list, mine, allowed] = await Promise.all([
          reviewsService.getDoctorReviews(targetId),
          reviewsService.getMyDoctorReview(targetId),
          reviewsService.canReviewDoctor(targetId),
        ]);
        setReviews(list);
        setCanReview(allowed);
        if (mine) { setHasMine(true); setMyRating(mine.rating); setMyComment(mine.comment ?? ""); }
        else { setHasMine(false); }
      }
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [kind, targetId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (myRating < 1) { Alert.alert("Note requise", "Sélectionnez une note de 1 à 5 étoiles."); return; }
    setSaving(true);
    try {
      if (kind === "product") await reviewsService.upsertProductReview(targetId, myRating, myComment);
      else await reviewsService.upsertDoctorReview(targetId, myRating, myComment);
      await load();
      onChanged?.();
      hapticSuccess();
      toast.success("Votre avis a été enregistré.");
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez plus tard.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Supprimer votre avis ?",
      message: "Cette action est irréversible.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try {
      if (kind === "product") await reviewsService.deleteMyProductReview(targetId);
      else await reviewsService.deleteMyDoctorReview(targetId);
      setHasMine(false); setMyRating(0); setMyComment("");
      await load();
      onChanged?.();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Suppression échouée");
    }
  }

  return (
    <View style={styles.wrap}>
      {/* Note moyenne */}
      <View style={styles.summary}>
        <Text style={styles.sectionTitle}>Avis</Text>
        <StarRating value={ratingAvg} count={ratingCount} size={18} />
      </View>

      {/* Donner mon avis */}
      {canReview ? (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>{hasMine ? "Modifier mon avis" : "Donner mon avis"}</Text>
          <StarSelector value={myRating} onChange={setMyRating} />
          <Input
            value={myComment}
            onChangeText={setMyComment}
            placeholder="Votre commentaire (facultatif)"
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />
          <Button title={hasMine ? "Mettre à jour" : "Enregistrer"} onPress={save} loading={saving} />
          {hasMine ? (
            <Pressable onPress={remove} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.deleteText}>Supprimer mon avis</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : (
        <Card style={styles.hintCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.hintText}>Vous pourrez laisser un avis après une consultation avec ce médecin.</Text>
        </Card>
      )}

      {/* Liste des avis */}
      {loading ? (
        <Text style={styles.muted}>Chargement des avis…</Text>
      ) : reviews.length === 0 ? (
        <Text style={styles.muted}>Aucun avis pour le moment.</Text>
      ) : (
        reviews.map((r) => (
          <Card key={r.id} style={styles.reviewCard}>
            <View style={styles.reviewHead}>
              <Text style={styles.reviewAuthor} numberOfLines={1}>{r.authorName}</Text>
              <Text style={styles.reviewDate}>{formatDate(r.created_at)}</Text>
            </View>
            <StarRating value={r.rating} size={14} showValue={false} />
            {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { ...typography.h3 },
  formCard: { gap: spacing.sm },
  formTitle: { ...typography.name },
  textArea: { height: 80, textAlignVertical: "top", paddingTop: spacing.sm },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.xs },
  deleteText: { ...typography.caption, color: colors.danger, fontWeight: "700" },
  hintCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.primaryLight },
  hintText: { ...typography.caption, color: colors.primaryDark, flex: 1, lineHeight: 18 },
  muted: { ...typography.caption, color: colors.textMuted },
  reviewCard: { gap: spacing.xs },
  reviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  reviewAuthor: { ...typography.name, flex: 1 },
  reviewDate: { ...typography.caption, color: colors.textMuted },
  reviewComment: { ...typography.body, color: colors.text, lineHeight: 20 },
});
