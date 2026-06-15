import type { MenstrualCycle } from "@/lib/database.types";
import { cycleService } from "@/lib/cycle-service";
import {
  appointmentsService,
  doctorDisplayName,
  formatAppointmentTime,
  type AppointmentWithDoctor,
} from "@/lib/appointments-service";
import { loadNotifPrefs, isNotifEnabled } from "@/lib/notification-prefs";
import {
  notificationsSupported,
  getPermissionStatus,
  scheduleAt,
  cancelByKindPrefix,
} from "@/lib/local-notifications";

// Préfixes `data.kind` → permettent d'annuler par catégorie avant de replanifier.
const KIND_CYCLE = "cycle";
const KIND_APPT = "appt";

const CYCLE_HOUR = 9; // rappels cycle à 9h
const APPT_EVE_HOUR = 18; // rappel « veille » à 18h

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function atHour(d: Date, hour: number, min = 0): Date {
  const r = new Date(d);
  r.setHours(hour, min, 0, 0);
  return r;
}

// =====================================================
// CYCLE — règles, ovulation, fenêtre fertile, saisie quotidienne.
// Pilotée par computePrediction + préférences locales. Idempotent : annule les
// anciens rappels cycle puis replanifie ceux dont la catégorie est activée.
// =====================================================
export async function syncCycleReminders(cycles: MenstrualCycle[]): Promise<void> {
  if (!notificationsSupported()) return;
  await cancelByKindPrefix(KIND_CYCLE);
  if ((await getPermissionStatus()) !== "granted") return;

  const prefs = await loadNotifPrefs();
  const pred = cycleService.computePrediction(cycles);
  if (!pred.hasEnoughData) return;

  const { nextPeriodStart, nextOvulation, fertileWindowStart, averagePeriodLength } = pred;
  const tasks: Promise<void>[] = [];

  if (nextPeriodStart && isNotifEnabled(prefs, "cycle_period_soon")) {
    tasks.push(
      scheduleAt(
        atHour(addDays(nextPeriodStart, -3), CYCLE_HOUR),
        { title: "Tes règles approchent", body: "Elles sont prévues dans 3 jours d'après ton suivi 💛" },
        `${KIND_CYCLE}_period_soon_3`
      ),
      scheduleAt(
        atHour(nextPeriodStart, CYCLE_HOUR),
        { title: "Tes règles sont prévues aujourd'hui", body: "D'après ton cycle, c'est le jour J." },
        `${KIND_CYCLE}_period_soon_0`
      )
    );
  }

  if (nextOvulation && isNotifEnabled(prefs, "cycle_ovulation")) {
    tasks.push(
      scheduleAt(
        atHour(nextOvulation, CYCLE_HOUR),
        { title: "Ovulation estimée aujourd'hui", body: "D'après ton cycle, l'ovulation est prévue aujourd'hui." },
        `${KIND_CYCLE}_ovulation`
      )
    );
  }

  if (fertileWindowStart && isNotifEnabled(prefs, "cycle_fertile")) {
    tasks.push(
      scheduleAt(
        atHour(fertileWindowStart, CYCLE_HOUR),
        { title: "Début de ta fenêtre fertile", body: "Ta période fertile commence aujourd'hui." },
        `${KIND_CYCLE}_fertile`
      )
    );
  }

  // Saisie quotidienne pendant la période estimée (une notif/jour, bornée à 8 j).
  if (nextPeriodStart && isNotifEnabled(prefs, "cycle_log_daily")) {
    const days = Math.min(Math.max(averagePeriodLength, 1), 8);
    for (let i = 0; i < days; i++) {
      tasks.push(
        scheduleAt(
          atHour(addDays(nextPeriodStart, i), CYCLE_HOUR),
          { title: "Pense à enregistrer ton suivi", body: "Note ton flux et tes symptômes du jour." },
          `${KIND_CYCLE}_log_${i}`
        )
      );
    }
  }

  await Promise.all(tasks);
}

// =====================================================
// RENDEZ-VOUS — rappel la veille (18h) + ~2h avant. Pour les RDV à venir
// (pending/confirmed). Idempotent : annule puis replanifie.
// =====================================================
export async function syncAppointmentReminders(appts: AppointmentWithDoctor[]): Promise<void> {
  if (!notificationsSupported()) return;
  await cancelByKindPrefix(KIND_APPT);
  if ((await getPermissionStatus()) !== "granted") return;

  const prefs = await loadNotifPrefs();
  if (!isNotifEnabled(prefs, "appointment_reminder")) return;

  const now = Date.now();
  const tasks: Promise<void>[] = [];

  for (const a of appts) {
    if (a.status !== "pending" && a.status !== "confirmed") continue;
    const hhmm = formatAppointmentTime(a.appointment_time);
    const start = new Date(`${a.appointment_date}T${hhmm}:00`);
    if (Number.isNaN(start.getTime()) || start.getTime() <= now) continue;
    const name = doctorDisplayName(a.doctor?.profile ?? null);

    tasks.push(
      scheduleAt(
        atHour(addDays(start, -1), APPT_EVE_HOUR),
        { title: "Rappel de rendez-vous", body: `Demain à ${hhmm} avec ${name}.` },
        `${KIND_APPT}_${a.id}_eve`
      ),
      scheduleAt(
        new Date(start.getTime() - 2 * 60 * 60 * 1000),
        { title: "Votre rendez-vous approche", body: `Aujourd'hui à ${hhmm} avec ${name}.` },
        `${KIND_APPT}_${a.id}_2h`
      )
    );
  }

  await Promise.all(tasks);
}

// =====================================================
// Helpers de replanification (récupèrent les données fraîches puis planifient).
// À appeler après une mutation (best-effort, silencieux).
// =====================================================
export async function resyncCycleReminders(userId: string): Promise<void> {
  try {
    await syncCycleReminders(await cycleService.getCycles(userId));
  } catch {
    // best-effort
  }
}

export async function resyncAppointmentReminders(userId: string): Promise<void> {
  try {
    await syncAppointmentReminders(await appointmentsService.getAppointments(userId));
  } catch {
    // best-effort
  }
}

export async function resyncAllReminders(userId: string): Promise<void> {
  await Promise.all([resyncCycleReminders(userId), resyncAppointmentReminders(userId)]);
}
