import { ApiError, type Attendance } from "./api";

export type Fix = { lat: number; lng: number; acc: number; at: number };

export function getFix(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser can't share your location."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), at: Date.now() }),
      (e) =>
        reject(
          new Error(
            e.code === 1
              ? "Location is blocked. Allow location for this site in your browser settings, then try again."
              : "Couldn't get your location — turn on GPS / move near a window and try again.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };
export const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { ...IST, hour: "2-digit", minute: "2-digit" }) : "—");
export const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
export const fmtLongDay = (d = new Date()) => d.toLocaleDateString("en-IN", { ...IST, weekday: "long", day: "numeric", month: "long" });
export const fmtStamp = (d: Date) =>
  d.toLocaleString("en-IN", { ...IST, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " IST";
export const fmtDist = (m: number | null) => (m == null ? "" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export function minutesWorked(a: Pick<Attendance, "checkInAt" | "checkOutAt">, now = Date.now()): number {
  const end = a.checkOutAt ? new Date(a.checkOutAt).getTime() : now;
  return Math.max(0, Math.round((end - new Date(a.checkInAt).getTime()) / 60000));
}
export const fmtMins = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

export function istDate(d = new Date()): string {
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export function greeting(): string {
  const h = Number(new Date().toLocaleString("en-IN", { ...IST, hour: "numeric", hour12: false }));
  return h < 12 ? "Good Morning," : h < 17 ? "Good Afternoon," : "Good Evening,";
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "ON";
}

export function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError || err instanceof Error) return err.message || fallback;
  return fallback;
}

/** Today / this week (Mon–Sun) / this month, rejected days left out. */
export function totals(rows: Attendance[], now: number) {
  const today = istDate();
  const d = new Date(`${today}T00:00:00Z`);
  const weekStart = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const sum = (from: string) => rows.filter((a) => a.date >= from && a.status !== "rejected").reduce((s, a) => s + minutesWorked(a, now), 0);
  return { today: sum(today), week: sum(weekStart), month: sum(monthStart) };
}

export function statusOf(a: Attendance): { label: string; tone: "success" | "warning" | "danger" | "info" } {
  if (a.status === "verified") return { label: "Approved", tone: "success" };
  if (a.status === "rejected") return { label: "Not approved", tone: "danger" };
  if (!a.checkOutAt) return { label: "Working", tone: "info" };
  return { label: "Pending check", tone: "warning" };
}
