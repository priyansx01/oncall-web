// Gateway calls for the on-call reliever. Sign-in is the same SMS OTP as Join iSmart;
// the scoped token it returns is all the identity there is — the server resolves the
// reliever from the mobile inside it, so no ids are ever sent.

import { t } from "./i18n";

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "https://api.ismartfacitech.com/api/v1";
const API = API_BASE;
const SESSION_KEY = "oncall_session_v1";

export type Session = { token: string; mobile: string; exp: number };

export type KycStatus = "verified" | "pending_manual" | null;

export type Reliever = {
  id: number;
  oncallCode: string | null;
  mobile: string;
  name: string | null;
  dob: string | null;
  gender: string | null;
  aadhaarLast4: string | null;
  aadhaarStatus: KycStatus;
  accountNo: string | null;
  ifsc: string | null;
  bankName: string | null;
  bankStatus: KycStatus;
  passbookKey: string | null;
  status: "draft" | "active" | "inactive";
  photoKey: string | null;
  missing: string[];
  /** Set by the Aadhaar / bank checks when the provider was down (saved for manual review). */
  kycMessage?: string | null;
};

export type Attendance = {
  id: number;
  siteCode: string;
  siteName: string | null;
  clientName: string | null;
  date: string;
  checkInAt: string;
  checkInDistanceM: number | null;
  checkOutAt: string | null;
  status: "pending" | "verified" | "rejected";
  rejectReason: string | null;
  coveredName: string | null;
};

export type Me = { reliever: Reliever | null; open: Attendance | null; recent: Attendance[] };

export type Site = {
  siteCode: string;
  siteName: string;
  clientName: string | null;
  city: string | null;
  distanceM: number | null;
};

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly data?: Record<string, unknown>) {
    super(message);
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s && s.token && s.exp > Date.now() + 60_000 ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode: the session lasts this tab only */
  }
}

let current: Session | null = null;
export function setApiSession(s: Session | null) {
  current = s;
}

/** Fired when the server rejects the token, so the app can go back to sign-in. */
export const onExpired = new EventTarget();

async function call<T>(method: string, path: string, body?: unknown, timeoutMs = 45_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(current ? { Authorization: `Bearer ${current.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError((err as Error)?.name === "AbortError" ? t("err_slow") : t("err_offline"));
  } finally {
    clearTimeout(timer);
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (res.status === 401 && current) onExpired.dispatchEvent(new Event("expired"));
    const body = json as { message?: unknown; data?: unknown } | null;
    const m = body?.message;
    const msg = res.status === 429 ? t("err_too_many") : typeof m === "string" && m ? m : Array.isArray(m) && m.length ? String(m[0]) : t("err_generic");
    throw new ApiError(msg, res.status, (body?.data && typeof body.data === "object" ? body.data : body ?? undefined) as Record<string, unknown> | undefined);
  }
  // The gateway wraps replies as { code, message, data }.
  if (json && typeof json === "object" && "data" in json && "code" in json) return (json as { data: T }).data;
  return json as T;
}

export const api = {
  sendOtp: (mobile: string) => call<unknown>("POST", "/oncall/public/send-otp", { mobile }),
  verifyOtp: (mobile: string, otpCode: string) =>
    call<{ onboardingToken: string; expiresIn: number; mobile: string }>("POST", "/oncall/public/verify-otp", { mobile, otpCode }),
  me: () => call<Me>("GET", "/oncall/public/me"),
  sitesNear: (lat: number, lng: number) => call<Site[]>("GET", `/oncall/public/sites-near?lat=${lat}&lng=${lng}`),
  searchSites: (q: string, lat?: number, lng?: number) =>
    call<Site[]>("GET", `/oncall/public/sites-near?q=${encodeURIComponent(q)}${lat != null && lng != null ? `&lat=${lat}&lng=${lng}` : ""}`),
  checkIn: (b: { siteCode: string; selfieKey: string; latitude: number; longitude: number; accuracy?: number }) =>
    call<Attendance>("POST", "/oncall/public/me/check-in", b, 30_000),
  checkOut: (b: { selfieKey: string; latitude: number; longitude: number; accuracy?: number }) =>
    call<Attendance>("POST", "/oncall/public/me/check-out", b, 30_000),

  /** Check-in / check-out photo: presign, then PUT straight to storage; returns the object key. */
  uploadPhoto: (kind: "selfie_in" | "selfie_out", blob: Blob) => upload(kind, blob, "jpg", "image/jpeg"),

  // ── Join (registration) — the same public routes the mobile app's on-call sign-up uses ──
  /** Creates the draft on the first call (name + gender), then saves any field. */
  updateMe: (b: { name?: string; dob?: string; gender?: string; passbookKey?: string; photoKey?: string }) => call<Reliever>("PATCH", "/oncall/public/me", b),
  verifyAadhaar: (aadhaarNo: string) => call<Reliever>("POST", "/oncall/public/me/aadhaar", { aadhaarNo }, 45_000),
  verifyBank: (b: { accountNo: string; ifsc: string }) => call<Reliever>("POST", "/oncall/public/me/bank", b, 45_000),
  complete: () => call<Reliever>("POST", "/oncall/public/me/complete"),
  uploadDoc: (kind: "passbook" | "photo", blob: Blob, ext: string, mimeType: string) => upload(kind, blob, ext, mimeType),
};

async function upload(docType: string, blob: Blob, ext: string, mimeType: string): Promise<string> {
  const { uploadUrl, objectKey } = await call<{ uploadUrl: string; objectKey: string }>("POST", "/oncall/public/me/documents/presign-upload", {
    docType,
    ext,
    mimeType,
  });
  let put: Response;
  try {
    put = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": mimeType } });
  } catch {
    throw new ApiError(t("err_upload"));
  }
  if (!put.ok) throw new ApiError(t("err_upload_status", { status: put.status }));
  return objectKey;
}
