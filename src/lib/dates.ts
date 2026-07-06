// =====================================================
// Dates calendaires — convention UNIQUE de l'app (P2, normalisation fuseaux).
//
// Les dates métier (règles, RDV, périodes) sont des dates CALENDAIRES locales
// « AAAA-MM-JJ », jamais des instants UTC. Règles :
//  - Sérialiser : toISODate(d) → composants LOCAUX (getFullYear/Month/Date).
//    ⚠️ jamais d.toISOString().slice/split : ça convertit en UTC et décale la
//    date autour de minuit pour tout fuseau ≠ UTC (app web hors Guinée).
//  - Parser : parseISODate("AAAA-MM-JJ") → Date à 12:00 locale (midi neutralise
//    les bascules de fuseau/DST pour l'affichage et les calculs de jour).
// =====================================================

/** Date calendaire locale → « AAAA-MM-JJ ». */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Aujourd'hui (fuseau local) → « AAAA-MM-JJ ». */
export function todayISO(): string {
  return toISODate(new Date());
}

/** « AAAA-MM-JJ » → Date à midi local (stable vis-à-vis des fuseaux). */
export function parseISODate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/** d + n jours (calendaire local). */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
