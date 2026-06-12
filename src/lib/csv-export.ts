import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export type CsvColumn = { key: string; label: string };

// Échappe une cellule CSV (virgules, guillemets, retours ligne).
function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Construit un CSV (BOM UTF-8 pour Excel/accents), l'écrit dans un fichier
 * temporaire, puis ouvre le partage natif. Lève une erreur si le partage est
 * indisponible sur l'appareil.
 */
export async function exportCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns?: CsvColumn[]
): Promise<void> {
  const cols: CsvColumn[] =
    columns ?? (rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : []);

  const header = cols.map((c) => escapeCell(c.label)).join(",");
  const body = rows.map((r) => cols.map((c) => escapeCell(r[c.key])).join(",")).join("\r\n");
  const csv = `﻿${header}\r\n${body}`; // ﻿ = BOM UTF-8

  const name = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, csv);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Le partage n'est pas disponible sur cet appareil.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "text/csv",
    dialogTitle: name,
    UTI: "public.comma-separated-values-text",
  });
}
