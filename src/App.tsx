import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, loadSession, onExpired, saveSession, setApiSession, type Attendance, type Me, type Session, type Site } from "./api";
import { CameraSheet } from "./camera";

// ─── helpers ────────────────────────────────────────────────────────────────

type Fix = { lat: number; lng: number; acc: number; at: number };

function getFix(): Promise<Fix> {
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
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { ...IST, hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fmtStamp = (d: Date) =>
  d.toLocaleString("en-IN", { ...IST, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " IST";
const fmtDist = (m: number | null) => (m == null ? "" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

function minutesWorked(a: Pick<Attendance, "checkInAt" | "checkOutAt">, now = Date.now()): number {
  const end = a.checkOutAt ? new Date(a.checkOutAt).getTime() : now;
  return Math.max(0, Math.round((end - new Date(a.checkInAt).getTime()) / 60000));
}
const fmtMins = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

function istDate(d = new Date()): string {
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError || err instanceof Error) return err.message || fallback;
  return fallback;
}

// ─── app ────────────────────────────────────────────────────────────────────

export function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const s = loadSession();
    setApiSession(s);
    return s;
  });
  const [permsOk, setPermsOk] = useState<boolean>(() => {
    try {
      return localStorage.getItem("oncall_perms_v1") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const out = () => {
      saveSession(null);
      setApiSession(null);
      setSession(null);
    };
    onExpired.addEventListener("expired", out);
    return () => onExpired.removeEventListener("expired", out);
  }, []);

  const signOut = () => {
    saveSession(null);
    setApiSession(null);
    setSession(null);
  };

  return (
    <div className="app">
      <header className="top">
        <img src="/logo.png" alt="" />
        <div className="grow">
          <div className="top-title">On-call</div>
          <div className="top-sub">iSmart Facitech</div>
        </div>
        {session && (
          <button className="link" onClick={signOut}>
            Sign out
          </button>
        )}
      </header>

      {!session ? (
        <SignIn
          onSignedIn={(s) => {
            saveSession(s);
            setApiSession(s);
            setSession(s);
          }}
        />
      ) : !permsOk ? (
        <Permissions
          onDone={() => {
            try {
              localStorage.setItem("oncall_perms_v1", "1");
            } catch {
              /* ignore */
            }
            setPermsOk(true);
          }}
        />
      ) : (
        <Home mobile={session.mobile} />
      )}
    </div>
  );
}

// ─── sign in ────────────────────────────────────────────────────────────────

function SignIn({ onSignedIn }: { onSignedIn: (s: Session) => void }) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) return setError("Enter your 10-digit mobile number.");
    setBusy(true);
    setError(null);
    try {
      await api.sendOtp(mobile);
      setSent(true);
      setOtp("");
      setCooldown(30);
    } catch (e) {
      setError(message(e, "Couldn't send the code."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code from the SMS.");
    setBusy(true);
    setError(null);
    try {
      const r = await api.verifyOtp(mobile, otp);
      onSignedIn({ token: r.onboardingToken, mobile: r.mobile || mobile, exp: Date.now() + (r.expiresIn || 3600) * 1000 });
    } catch (e) {
      setError(message(e, "That code didn't work."));
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="card">
      <h1>{sent ? "Enter the code" : "Sign in"}</h1>
      <p className="muted">
        {sent ? `We sent a 6-digit code to +91 ${mobile}.` : "Use the mobile number you registered with as an on-call reliever."}
      </p>
      {!sent ? (
        <label className="field">
          <span>Mobile number</span>
          <div className="phone">
            <b>+91</b>
            <input
              inputMode="numeric"
              autoComplete="tel-national"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(-10))}
              onKeyDown={(e) => e.key === "Enter" && void send()}
              placeholder="10-digit mobile"
            />
          </div>
        </label>
      ) : (
        <label className="field">
          <span>Code</span>
          <input
            className="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && void verify()}
            placeholder="••••••"
            autoFocus
          />
        </label>
      )}
      {error && <div className="error">{error}</div>}
      <button className="btn primary block" disabled={busy} onClick={() => void (sent ? verify() : send())}>
        {busy && <span className="spin" />} {sent ? "Verify" : "Send code"}
      </button>
      {sent && (
        <div className="row-between">
          <button className="link" onClick={() => (setSent(false), setError(null))} disabled={busy}>
            Change number
          </button>
          <button className="link" onClick={() => void send()} disabled={busy || cooldown > 0}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      )}
    </main>
  );
}

// ─── permissions ────────────────────────────────────────────────────────────

function Permissions({ onDone }: { onDone: () => void }) {
  const [loc, setLoc] = useState<"idle" | "ok" | "denied">("idle");
  const [cam, setCam] = useState<"idle" | "ok" | "denied">("idle");
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    setBusy(true);
    try {
      await getFix();
      setLoc("ok");
    } catch {
      setLoc("denied");
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      s.getTracks().forEach((t) => t.stop());
      setCam("ok");
    } catch {
      setCam("denied");
    }
    setBusy(false);
  };

  useEffect(() => {
    if (loc === "ok" && cam === "ok") {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
  }, [loc, cam, onDone]);

  const Row = ({ label, why, state }: { label: string; why: string; state: "idle" | "ok" | "denied" }) => (
    <div className="perm">
      <div className={`perm-dot ${state}`}>{state === "ok" ? "✓" : state === "denied" ? "!" : ""}</div>
      <div className="grow">
        <div className="strong">{label}</div>
        <div className="muted small">{why}</div>
      </div>
    </div>
  );

  return (
    <main className="card">
      <h1>Allow access</h1>
      <p className="muted">The app needs two permissions to check you in at a site.</p>
      <Row label="Location" why="To find the sites near you and record where you checked in." state={loc} />
      <Row label="Camera" why="To take a photo at check-in and check-out. The photo shows the time and your location." state={cam} />
      {(loc === "denied" || cam === "denied") && (
        <div className="error">
          {loc === "denied" ? "Location " : ""}
          {loc === "denied" && cam === "denied" ? "and camera are" : loc === "denied" ? "is" : "Camera is"} blocked. Open your browser&apos;s site
          settings for this page, allow it, then tap the button again.
        </div>
      )}
      <button className="btn primary block" disabled={busy} onClick={() => void ask()}>
        {busy && <span className="spin" />} {loc === "idle" && cam === "idle" ? "Allow location and camera" : "Try again"}
      </button>
      {(loc === "denied" || cam === "denied") && (
        <button className="link center" onClick={onDone}>
          Continue anyway
        </button>
      )}
    </main>
  );
}

// ─── home ───────────────────────────────────────────────────────────────────

function Home({ mobile }: { mobile: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [q, setQ] = useState("");
  const [locating, setLocating] = useState(false);
  const [camera, setCamera] = useState<{ kind: "in" | "out"; fix: Fix } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [now, setNow] = useState(Date.now());
  const toastTimer = useRef<number | undefined>(undefined);

  const say = (text: string, tone: "ok" | "err" = "ok") => {
    setToast({ text, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  };

  const reload = useCallback(async () => {
    try {
      setMe(await api.me());
      setLoadError(null);
    } catch (e) {
      setLoadError(message(e, "Couldn't load your details."));
    }
  }, []);

  const locate = useCallback(async () => {
    setLocating(true);
    setLocError(null);
    try {
      const f = await getFix();
      setFix(f);
      const list = await api.sitesNear(f.lat, f.lng);
      setSites(list);
      // The nearest site is preselected when it is close enough to be where they are.
      setSite((cur) => (cur && list.some((s) => s.siteCode === cur.siteCode) ? cur : list[0] && (list[0].distanceM ?? 99999) <= 500 ? list[0] : null));
    } catch (e) {
      setLocError(message(e, "Couldn't find nearby sites."));
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const open = me?.open ?? null;
  const active = me?.reliever?.status === "active";

  useEffect(() => {
    if (active && !open && !sites && !locating) void locate();
  }, [active, open, sites, locating, locate]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open]);

  const search = async () => {
    if (q.trim().length < 2) return;
    setLocating(true);
    try {
      setSites(await api.searchSites(q.trim(), fix?.lat, fix?.lng));
      setSite(null);
    } catch (e) {
      setLocError(message(e, "Search failed."));
    } finally {
      setLocating(false);
    }
  };

  const startCamera = async (kind: "in" | "out") => {
    if (kind === "in" && !site) return say("Pick the site you are at.", "err");
    setBusy(true);
    try {
      const f = await getFix(); // fresh fix: the photo stamp and the check-in carry the same point
      setFix(f);
      setCamera({ kind, fix: f });
    } catch (e) {
      say(message(e, "Couldn't get your location."), "err");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (photo: Blob) => {
    if (!camera) return;
    setBusy(true);
    try {
      const key = await api.uploadPhoto(camera.kind === "in" ? "selfie_in" : "selfie_out", photo);
      const point = { selfieKey: key, latitude: camera.fix.lat, longitude: camera.fix.lng, accuracy: camera.fix.acc };
      if (camera.kind === "in") {
        const a = await api.checkIn({ ...point, siteCode: site!.siteCode });
        say(`Checked in at ${a.siteName ?? site!.siteName}.`);
      } else {
        const a = await api.checkOut(point);
        say(`Checked out. You worked ${fmtMins(minutesWorked(a))}.`);
      }
      setCamera(null);
      setSites(null);
      setSite(null);
      await reload();
    } catch (e) {
      say(message(e, camera.kind === "in" ? "Check-in failed." : "Check-out failed."), "err");
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    const rows = me?.recent ?? [];
    const today = istDate();
    const d = new Date(`${today}T00:00:00Z`);
    const weekStart = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 8)}01`;
    const sum = (from: string) => rows.filter((a) => a.date >= from && a.status !== "rejected").reduce((s, a) => s + minutesWorked(a, now), 0);
    return { today: sum(today), week: sum(weekStart), month: sum(monthStart) };
  }, [me, now]);

  if (!me) {
    return (
      <main className="card center-col">
        {loadError ? (
          <>
            <div className="error">{loadError}</div>
            <button className="btn primary" onClick={() => void reload()}>
              Try again
            </button>
          </>
        ) : (
          <span className="spin dark" />
        )}
      </main>
    );
  }

  const r = me.reliever;
  if (!r || r.status === "draft") {
    return (
      <main className="card">
        <h1>Not registered yet</h1>
        <p className="muted">
          +91 {mobile} {r ? "has an unfinished on-call registration" : "isn't registered as an on-call reliever"}. Open the iSmart app, tap{" "}
          <b>On-call</b> on the login screen and finish registering — or ask the operations team to register you. Then come back here.
        </p>
        <button className="btn ghost block" onClick={() => void reload()}>
          I&apos;ve registered — check again
        </button>
      </main>
    );
  }
  if (r.status === "inactive") {
    return (
      <main className="card">
        <div className="code">{r.oncallCode}</div>
        <p className="muted">Your on-call registration is inactive. Please contact the operations team.</p>
      </main>
    );
  }

  const stamp = (f: Fix, siteName: string) => [
    `${r.oncallCode} · ${r.name ?? ""}`,
    siteName,
    fmtStamp(new Date(f.at)),
    `${f.lat.toFixed(6)}, ${f.lng.toFixed(6)}  ±${f.acc} m`,
  ];

  return (
    <>
      <section className="card id-card">
        <div>
          <div className="muted small">On-call ID</div>
          <div className="code">{r.oncallCode}</div>
          <div className="strong">{r.name}</div>
        </div>
        <button className="link" onClick={() => void reload()}>
          Refresh
        </button>
      </section>

      {open ? (
        <section className="card working">
          <div className="pill ok">● Working</div>
          <div className="big">{fmtMins(minutesWorked(open, now))}</div>
          <div className="muted">
            since {fmtTime(open.checkInAt)} at <b>{open.siteName}</b>
            {open.clientName ? ` · ${open.clientName}` : ""}
          </div>
          <button className="btn danger block" disabled={busy} onClick={() => void startCamera("out")}>
            {busy && <span className="spin" />} Check out — take photo
          </button>
        </section>
      ) : (
        <section className="card">
          <div className="row-between">
            <h2>Sites near you</h2>
            <button className="link" disabled={locating} onClick={() => void locate()}>
              {locating ? "Locating…" : "Refresh"}
            </button>
          </div>
          {fix && <div className="muted small">Your location is accurate to about {fix.acc} m.</div>}
          {locError && <div className="error">{locError}</div>}
          {locating && !sites && (
            <div className="center-col pad">
              <span className="spin dark" />
              <div className="muted small">Finding sites near you…</div>
            </div>
          )}
          {sites && sites.length === 0 && <div className="muted pad">No site found within 2 km. Search for it by name below.</div>}
          <div className="sites">
            {(sites ?? []).map((s) => (
              <button key={s.siteCode} className={`site ${site?.siteCode === s.siteCode ? "sel" : ""}`} onClick={() => setSite(s)}>
                <div className="grow">
                  <div className="strong">{s.siteName}</div>
                  <div className="muted small">{[s.clientName, s.city].filter(Boolean).join(" · ")}</div>
                </div>
                {s.distanceM != null && <div className="dist">{fmtDist(s.distanceM)}</div>}
              </button>
            ))}
          </div>
          <div className="search">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()} placeholder="Not listed? Search site name" />
            <button className="btn ghost" onClick={() => void search()} disabled={locating || q.trim().length < 2}>
              Search
            </button>
          </div>
          <p className="muted small">Not sure which site? Pick the one you were sent to — the operations team checks every check-in.</p>
          <button className="btn primary block" disabled={!site || busy} onClick={() => void startCamera("in")}>
            {busy && <span className="spin" />} {site ? `Check in at ${site.siteName} — take photo` : "Pick your site to check in"}
          </button>
        </section>
      )}

      <section className="card">
        <h2>Hours worked</h2>
        <div className="totals">
          <div>
            <b>{fmtMins(totals.today)}</b>
            <span>Today</span>
          </div>
          <div>
            <b>{fmtMins(totals.week)}</b>
            <span>This week</span>
          </div>
          <div>
            <b>{fmtMins(totals.month)}</b>
            <span>This month</span>
          </div>
        </div>
        <div className="days">
          {me.recent.length === 0 && <div className="muted small">No check-ins yet.</div>}
          {me.recent.map((a) => (
            <div key={a.id} className="day">
              <div className="grow">
                <div className="strong">{fmtDay(a.date)}</div>
                <div className="muted small">{a.siteName}</div>
              </div>
              <div className="right">
                <div>
                  {fmtTime(a.checkInAt)} – {a.checkOutAt ? fmtTime(a.checkOutAt) : "now"}
                </div>
                <div className="small">
                  <b>{fmtMins(minutesWorked(a, now))}</b>{" "}
                  <span className={`status ${a.status}`}>
                    {a.status === "verified" ? "Approved" : a.status === "rejected" ? "Not approved" : !a.checkOutAt ? "Working" : "Pending check"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {camera && (
        <CameraSheet
          title={camera.kind === "in" ? "Check-in photo" : "Check-out photo"}
          stampLines={stamp(camera.fix, camera.kind === "in" ? site?.siteName ?? "" : open?.siteName ?? "")}
          busy={busy}
          onCancel={() => setCamera(null)}
          onUse={(b) => void submit(b)}
        />
      )}

      {toast && <div className={`toast ${toast.tone}`}>{toast.text}</div>}
    </>
  );
}
