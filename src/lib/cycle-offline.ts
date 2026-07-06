import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { MenstrualCycle, TablesInsert, TablesUpdate } from "@/lib/database.types";

// =====================================================
// HORS-LIGNE · CYCLE
// - Cache local des saisies (lecture instantanée sans réseau)
// - File d'attente des écritures faites hors-ligne (ajout /
//   modification / suppression), rejouées automatiquement
//   au prochain passage en ligne.
// Une seule utilisatrice par appareil pour ses propres données
// → aucun conflit possible : la dernière écriture gagne.
// =====================================================

const cacheKey = (userId: string) => `cycles_cache_${userId}`;
const pendingKey = (userId: string) => `cycles_pending_${userId}`;

export type CyclesCache = { cachedAt: string; cycles: MenstrualCycle[] };

type PendingOp =
  | { kind: "add"; row: MenstrualCycle; queuedAt: string }
  | { kind: "update"; id: string; patch: TablesUpdate<"menstrual_cycles">; queuedAt: string }
  | { kind: "delete"; id: string; queuedAt: string };

// UUID v4 côté client : permet de créer une saisie hors-ligne avec un id
// définitif (le même id sera inséré côté serveur à la synchronisation).
export function makeUuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (g.crypto?.getRandomValues) g.crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Vrai si l'erreur ressemble à une panne RÉSEAU (et non à un refus serveur type
// RLS/validation) : seules les pannes réseau justifient la mise en file d'attente.
export function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true; // fetch: "Network request failed"
  const msg = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  return /network|fetch|timeout|abort|connection|internet|hors.?ligne/.test(msg);
}

// Ordre canonique des saisies (identique à getCycles : plus récentes d'abord).
function sortCycles(rows: MenstrualCycle[]): MenstrualCycle[] {
  return [...rows].sort((a, b) => (a.period_start < b.period_start ? 1 : -1));
}

export async function readCyclesCache(userId: string): Promise<CyclesCache | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as CyclesCache) : null;
  } catch {
    return null;
  }
}

export async function writeCyclesCache(userId: string, cycles: MenstrualCycle[]): Promise<void> {
  const payload: CyclesCache = { cachedAt: new Date().toISOString(), cycles };
  await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(payload)).catch(() => {});
}

async function readPending(userId: string): Promise<PendingOp[]> {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(userId));
    return raw ? (JSON.parse(raw) as PendingOp[]) : [];
  } catch {
    return [];
  }
}

async function writePending(userId: string, ops: PendingOp[]): Promise<void> {
  if (ops.length === 0) await AsyncStorage.removeItem(pendingKey(userId)).catch(() => {});
  else await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(ops)).catch(() => {});
}

export async function pendingCount(userId: string): Promise<number> {
  return (await readPending(userId)).length;
}

// Applique les opérations en attente à une liste de saisies (vue locale à jour).
export function applyPendingOps(cycles: MenstrualCycle[], ops: PendingOp[]): MenstrualCycle[] {
  let out = [...cycles];
  for (const op of ops) {
    if (op.kind === "add") {
      if (!out.some((c) => c.id === op.row.id)) out.push(op.row);
    } else if (op.kind === "update") {
      out = out.map((c) => (c.id === op.id ? ({ ...c, ...op.patch } as MenstrualCycle) : c));
    } else {
      out = out.filter((c) => c.id !== op.id);
    }
  }
  return sortCycles(out);
}

// Met en file une opération ET met à jour le cache local immédiatement
// (la saisie apparaît dans le calendrier même sans réseau).
async function queueOp(userId: string, op: PendingOp): Promise<void> {
  const ops = await readPending(userId);
  ops.push(op);
  await writePending(userId, ops);
  const cache = await readCyclesCache(userId);
  await writeCyclesCache(userId, applyPendingOps(cache?.cycles ?? [], [op]));
}

// Rejoue la file d'attente dans l'ordre. S'arrête à la première panne réseau
// (le reste attend le prochain passage). Une erreur NON réseau (ex. RLS) fait
// abandonner l'opération fautive pour ne jamais bloquer la file.
export async function flushPendingCycles(userId: string): Promise<{ flushed: number; remaining: number }> {
  const ops = await readPending(userId);
  if (ops.length === 0) return { flushed: 0, remaining: 0 };
  let flushed = 0;
  while (ops.length > 0) {
    const op = ops[0];
    try {
      if (op.kind === "add") {
        const { error } = await supabase.from("menstrual_cycles").insert(op.row as TablesInsert<"menstrual_cycles">);
        if (error && error.code !== "23505") throw error; // doublon (déjà synchronisé) → ok
      } else if (op.kind === "update") {
        const { error } = await supabase.from("menstrual_cycles").update(op.patch).eq("id", op.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menstrual_cycles").delete().eq("id", op.id);
        if (error) throw error;
      }
      ops.shift();
      flushed++;
      await writePending(userId, ops);
    } catch (e) {
      if (isNetworkError(e)) break; // toujours hors-ligne : on réessaiera
      ops.shift(); // erreur serveur définitive : on abandonne cette op
      await writePending(userId, ops);
    }
  }
  return { flushed, remaining: ops.length };
}

// ---------------- Écritures « intelligentes » ----------------
// Réseau d'abord ; en cas de panne réseau → file d'attente + cache local.
// `queued: true` signale à l'écran d'afficher le bon message.

export async function addCycleSmart(
  entry: TablesInsert<"menstrual_cycles">
): Promise<{ row: MenstrualCycle; queued: boolean }> {
  const id = entry.id ?? makeUuid();
  const withId = { ...entry, id };
  try {
    const { data, error } = await supabase.from("menstrual_cycles").insert(withId).select("*").single();
    if (error) throw error;
    return { row: data, queued: false };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    const now = new Date().toISOString();
    const row = {
      id,
      user_id: entry.user_id,
      period_start: entry.period_start,
      period_end: entry.period_end ?? null,
      ovulation_date: entry.ovulation_date ?? null,
      cycle_length: entry.cycle_length ?? null,
      symptoms: entry.symptoms ?? null,
      notes: entry.notes ?? null,
      flow: entry.flow ?? null,
      mood: entry.mood ?? null,
      pain: entry.pain ?? null,
      created_at: now,
      updated_at: now,
    } as MenstrualCycle;
    await queueOp(entry.user_id, { kind: "add", row, queuedAt: now });
    return { row, queued: true };
  }
}

// Clé d'identification d'une op (pour comparer par id de ligne).
function opId(op: PendingOp): string {
  return op.kind === "add" ? op.row.id : op.id;
}

export async function updateCycleSmart(
  userId: string,
  id: string,
  patch: TablesUpdate<"menstrual_cycles">
): Promise<{ queued: boolean }> {
  // RÉCONCILIATION : si la ligne a été créée hors-ligne et n'est pas encore
  // synchronisée (un `add` en attente), le serveur ne la connaît pas → on fusionne
  // la modification dans l'`add` en file (au lieu de partir au réseau et d'échouer).
  const ops = await readPending(userId);
  const addIdx = ops.findIndex((o) => o.kind === "add" && o.row.id === id);
  if (addIdx >= 0) {
    const add = ops[addIdx];
    if (add.kind === "add") add.row = { ...add.row, ...patch } as MenstrualCycle;
    await writePending(userId, ops);
    const cache = await readCyclesCache(userId);
    if (cache) {
      await writeCyclesCache(userId, cache.cycles.map((c) => (c.id === id ? ({ ...c, ...patch } as MenstrualCycle) : c)));
    }
    return { queued: true };
  }

  try {
    // Pas de .single() : un 0-ligne (bord de course) ne doit pas lever d'erreur.
    const { error } = await supabase.from("menstrual_cycles").update(patch).eq("id", id);
    if (error) throw error;
    return { queued: false };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    await queueOp(userId, { kind: "update", id, patch, queuedAt: new Date().toISOString() });
    return { queued: true };
  }
}

export async function deleteCycleSmart(userId: string, id: string): Promise<{ queued: boolean }> {
  // RÉCONCILIATION : si la ligne n'est qu'un `add` en attente (jamais montée au
  // serveur), supprimer = retirer l'`add` (et toute `update`) de la file. Sinon
  // le `add` serait rejoué plus tard et la suppression annulée toute seule.
  const ops = await readPending(userId);
  const hasPendingAdd = ops.some((o) => o.kind === "add" && o.row.id === id);
  if (hasPendingAdd) {
    await writePending(userId, ops.filter((o) => opId(o) !== id));
    const cache = await readCyclesCache(userId);
    if (cache) await writeCyclesCache(userId, cache.cycles.filter((c) => c.id !== id));
    return { queued: false };
  }

  try {
    const { error } = await supabase.from("menstrual_cycles").delete().eq("id", id);
    if (error) throw error;
    // Purge d'éventuelles `update` en attente pour cet id (deviendraient orphelines).
    if (ops.some((o) => o.kind !== "add" && o.id === id)) {
      await writePending(userId, ops.filter((o) => opId(o) !== id));
    }
    return { queued: false };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    await queueOp(userId, { kind: "delete", id, queuedAt: new Date().toISOString() });
    return { queued: true };
  }
}
