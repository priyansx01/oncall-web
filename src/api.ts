// Gateway calls for the on-call reliever. Sign-in is the same SMS OTP as Join iSmart;
// the scoped token it returns is all the identity there is — the server resolves the
// reliever from the mobile inside it, so no ids are ever sent.

const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "https://api.ismartfacitech.com/api/v1";
const SESSION_KEY = "oncall_session_v1";

export type Session = { token: string; mobile: string; exp: number };

export type Reliever = {
  id: number;
  oncallCode: string | null;
  mobile: string;
  name: string | null;
  status: "draft" | "active" | "inactive";
  photoKey: string | null;
  missing: string[];
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
  constructor(message: string, readonly status?: number) {
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
    throw new ApiError((err as Error)?.name === "AbortError" ? "The network is slow — please try again." : "No internet connection — please try again.");
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
    const m = (json as { message?: unknown } | null)?.message;
    const msg = typeof m === "string" ? m : Array.isArray(m) && m.length ? String(m[0]) : res.status === 429 ? "Too many tries — wait a minute and try again." : "Something went wrong — please try again.";
    throw new ApiError(msg, res.status);
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

  /** Presign, then PUT the photo straight to storage; returns the object key. */
  async uploadPhoto(kind: "selfie_in" | "selfie_out", blob: Blob): Promise<string> {
    const { uploadUrl, objectKey } = await call<{ uploadUrl: string; objectKey: string }>("POST", "/oncall/public/me/documents/presign-upload", {
      docType: kind,
      ext: "jpg",
      mimeType: "image/jpeg",
    });
    let put: Response;
    try {
      put = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
    } catch {
      throw new ApiError("The photo didn't upload — check your internet and try again.");
    }
    if (!put.ok) throw new ApiError(`The photo didn't upload (${put.status}) — please try again.`);
    return objectKey;
  },
};
