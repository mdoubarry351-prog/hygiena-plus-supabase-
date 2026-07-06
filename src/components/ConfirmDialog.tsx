import { NATIVE_ANIM } from "@/lib/anim";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { colors, durations, radius, shadows, spacing, typography } from "@/theme";

/**
 * Convention de messages de l'app :
 *  - Alert natif (Alert.alert)  → messages SYSTÈME simples (info, erreur ponctuelle).
 *  - Toast (useToast)           → feedback de SUCCÈS / ERREUR non bloquant.
 *  - ConfirmDialog (useConfirm) → CONFIRMATIONS DESTRUCTIVES (suppression, annulation…).
 */

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

// Dialogue de confirmation présentationnel (design system).
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & { visible: boolean; onConfirm: () => void; onCancel: () => void }) {
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.96);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: durations.fast, useNativeDriver: NATIVE_ANIM }),
      Animated.timing(opacity, { toValue: 1, duration: durations.fast, useNativeDriver: NATIVE_ANIM }),
    ]).start();
  }, [visible, scale, opacity]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Animated.View style={{ transform: [{ scale }], opacity }}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <View style={styles.actions}>
              <View style={styles.actionItem}>
                <Button title={cancelLabel} variant="outline" onPress={onCancel} />
              </View>
              <View style={styles.actionItem}>
                <Button title={confirmLabel} variant={danger ? "danger" : "primary"} onPress={onConfirm} />
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ---- Provider + hook : `await confirm({...})` renvoie true/false ----
const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpts(o);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setOpts(null);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        visible={!!opts}
        title={opts?.title ?? ""}
        message={opts?.message}
        confirmLabel={opts?.confirmLabel}
        cancelLabel={opts?.cancelLabel}
        danger={opts?.danger}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  card: { width: "100%", maxWidth: 380, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, ...shadows.lg },
  title: { ...typography.h3 },
  message: { ...typography.body, color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionItem: { flex: 1 },
});
