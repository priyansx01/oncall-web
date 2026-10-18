import { API_BASE } from "./api";

// Errors from the phones go to the same place as the mobile app's: POST /client-crashes
// (public, throttled, PII-scrubbed server side) → admin Developer → Crash reports.

const APP_VERSION = "oncall-pwa-2";
const crumbs: string[] = [];
const sent = new Set<string>();

/** Short trail of what the person did, sent with a report ("screen:join/aadhaar"). */
export function crumb(s: string): void {
  crumbs.push(`${new Date().toISOString().slice(11, 19)} ${s}`);
  if (crumbs.length > 20) crumbs.shift();
}

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export function reportError(err: unknown, source: string, fatal = true): void {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
    const key = `${e.name}:${e.message}:${(e.stack ?? "").slice(0, 200)}`;
    if (sent.has(key)) return; // once per page load
    sent.add(key);
    const body = {
      clientEventId: uuid(),
      errorType: e.name || "Error",
      message: (e.message || "").slice(0, 1000),
      stack: (e.stack || "").slice(0, 8000),
      fatal,
      source: `oncall-pwa:${source}`,
      appVersion: APP_VERSION,
      platform: "web",
      osVersion: navigator.platform || null,
      deviceModel: navigator.userAgent.slice(0, 250),
      breadcrumbs: [...crumbs, `url ${location.pathname}${location.search}`],
      occurredAt: new Date().toISOString(),
    };
    void fetch(`${API_BASE}/client-crashes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* reporting must never throw */
  }
}

export function installGlobalHandlers(): void {
  window.addEventListener("error", (ev) => reportError(ev.error ?? ev.message, "window.onerror"));
  window.addEventListener("unhandledrejection", (ev) => reportError(ev.reason, "unhandledrejection", false));
}
