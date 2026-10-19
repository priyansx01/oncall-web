import { ApiError, type Attendance, type MonthTotals } from "./api";
import { intlLocale, t } from "./i18n";

/** `approx`: not a fresh GPS fix — the phone's last known position (up to 2 minutes old). */
export type Fix = { lat: number; lng: number; acc: number; at: number; approx?: boolean };

function position(opts: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));
}

/**
 * A fresh, accurate fix first. Indoors that can fail every time, so then the phone's last
 * known position (≤ 2 min old, any source) is used and marked approximate — better than
 * leaving someone unable to check out. Blocked location is never worked around.
 */
export async function getFix(): Promise<Fix> {
  if (!navigator.geolocation) throw new Error(t("err_no_geolocation"));
  const toFix = (p: GeolocationPosition, approx: boolean): Fix => ({
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    acc: Math.round(p.coords.accuracy),
    at: approx ? Math.min(Date.now(), p.timestamp || Date.now()) : Date.now(),
    approx,
  });
  try {
    return toFix(await position({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }), false);
  } catch (e) {
    const code = (e as GeolocationPositionError)?.code;
    if (code === 1) throw new Error(t("err_location_blocked"));
    try {
      return toFix(await position({ enableHighAccuracy: false, timeout: 15_000, maximumAge: 120_000 }), true);
    } catch {
      throw new Error(code === 3 ? t("err_location_timeout") : t("err_location_failed"));
    }
  }
}

/** How good a GPS fix is, for the colour of the hint. */
export function accuracyTone(acc: number): "good" | "ok" | "weak" {
  return acc <= 20 ? "good" : acc <= 50 ? "ok" : "weak";
}

/** Same thresholds the server flags for ops (contracts ONCALL_*). */
export const LOW_ACCURACY_M = 50;
export const FAR_FROM_SITE_M = 300;
/** A photo older than this is retaken before submit: its time and place are on the stamp. */
export const PHOTO_MAX_AGE_MS = 5 * 60_000;

/** Metres between two points (haversine). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.asin(Math.sqrt(a)));
}

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };
export const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(intlLocale(), { ...IST, hour: "2-digit", minute: "2-digit" }) : "—");
export const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" });
export const fmtLongDay = (d = new Date()) => d.toLocaleDateString(intlLocale(), { ...IST, weekday: "long", day: "numeric", month: "long" });
export const fmtMonth = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(intlLocale(), { month: "short" });
export const fmtStamp = (d: Date) =>
  d.toLocaleString("en-IN", { ...IST, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " IST";
export const fmtDist = (m: number | null) => (m == null ? "" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export function minutesWorked(a: Pick<Attendance, "checkInAt" | "checkOutAt">, now = Date.now()): number {
  const end = a.checkOutAt ? new Date(a.checkOutAt).getTime() : now;
  return Math.max(0, Math.round((end - new Date(a.checkInAt).getTime()) / 60000));
}
export const fmtMins = (m: number) => t("hours_mins", { h: Math.floor(m / 60), m: String(m % 60).padStart(2, "0") });

export function istDate(d = new Date()): string {
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export function greeting(): string {
  const h = Number(new Date().toLocaleString("en-IN", { ...IST, hour: "numeric", hour12: false }));
  return h < 12 ? t("good_morning") : h < 17 ? t("good_afternoon") : t("good_evening");
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "ON";
}

export function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError || err instanceof Error) return err.message || fallback;
  return fallback;
}

/** Minutes a day counts for: none for a missed check-out (no end time) or a rejected day. */
function countedMinutes(a: Attendance, now: number): number {
  if (a.status === "rejected" || a.checkoutMissed) return 0;
  return minutesWorked(a, now);
}

/**
 * Today / this week (Mon–Sun) / this month, rejected and missed days left out. The day still
 * open always counts as today — a night shift that started yesterday is today's work too.
 * The month comes from the server when it sends it (it isn't capped at one page of days).
 */
export function totals(rows: Attendance[], now: number, open: Attendance | null = null, month?: MonthTotals) {
  const today = istDate();
  const d = new Date(`${today}T00:00:00Z`);
  const weekStart = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const closed = rows.filter((a) => a.checkOutAt || a.checkoutMissed);
  const sum = (from: string) => closed.filter((a) => a.date >= from).reduce((s, a) => s + countedMinutes(a, now), 0);
  const live = open ? minutesWorked(open, now) : 0;
  const monthClosed = month && month.month === today.slice(0, 7) ? month.minutes : sum(monthStart);
  return { today: sum(today) + live, week: sum(weekStart) + live, month: monthClosed + live };
}

/** Today's timeline: today's days plus the day still open, even if it started yesterday. */
export function todaysDays(rows: Attendance[], open: Attendance | null): Attendance[] {
  const today = istDate();
  const list = rows.filter((a) => a.date === today);
  if (open && !list.some((a) => a.id === open.id)) list.unshift(open);
  return list;
}

export function statusOf(a: Attendance): { label: string; tone: "success" | "warning" | "danger" | "info" } {
  if (a.status === "verified") return { label: t("st_approved"), tone: "success" };
  if (a.status === "rejected") return { label: t("st_rejected"), tone: "danger" };
  if (a.checkoutMissed) return { label: t("st_no_checkout"), tone: "danger" };
  if (!a.checkOutAt) return { label: t("st_working"), tone: "info" };
  return { label: t("st_pending"), tone: "warning" };
}
