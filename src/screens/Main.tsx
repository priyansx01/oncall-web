import { useCallback, useEffect, useState } from "react";
import { IoCalendar, IoCalendarOutline, IoHome, IoHomeOutline, IoPerson, IoPersonOutline, IoPersonAddOutline, IoRefresh, IoBanOutline } from "react-icons/io5";
import { api, type Attendance, type Me } from "../api";
import { useInstall } from "../install";
import { message } from "../lib";
import { Button, EmptyState, ErrorBanner, Spinner } from "../ui";
import { AttendanceTab } from "./AttendanceTab";
import { CheckInFlow } from "./CheckIn";
import { CheckOutFlow } from "./CheckOut";
import { HomeTab } from "./HomeTab";
import { InstallSheet } from "./InstallSheet";
import { ProfileTab } from "./ProfileTab";

export type Tab = "home" | "attendance" | "profile";

export function Splash({ children }: { children?: React.ReactNode }) {
  return (
    <div className="splash">
      <span className="circle one" />
      <span className="circle two" />
      <div className="splash-logo">
        <img src="/logo-white.png" alt="" />
      </div>
      <div className="splash-name">SmartFM Reliever</div>
      <div className="splash-tag">Safe People · Smart Buildings</div>
      <div className="splash-foot">{children ?? <Spinner />}</div>
    </div>
  );
}

export function Main({ mobile, onSignOut }: { mobile: string; onSignOut: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  // The open day is kept for check-out: once it is submitted, `me.open` is gone but the summary still shows.
  const [flow, setFlow] = useState<{ kind: "in" } | { kind: "out"; open: Attendance } | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const install = useInstall();

  const reload = useCallback(async () => {
    try {
      setMe(await api.me());
      setLoadError(null);
    } catch (e) {
      setLoadError(message(e, "Couldn't load your details."));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Back from another app (or the phone waking up): refresh, the day may have changed.
  useEffect(() => {
    const on = () => document.visibilityState === "visible" && void reload();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [reload]);

  const open = me?.open ?? null;
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, [open]);

  const startInstall = async () => {
    if (install.canPrompt) await install.prompt();
    else setInstallOpen(true);
  };

  if (!me) {
    return (
      <Splash>
        {loadError ? (
          <div className="splash-error">
            <ErrorBanner>{loadError}</ErrorBanner>
            <Button variant="light" icon={<IoRefresh size={18} />} onClick={() => void reload()}>
              Try again
            </Button>
          </div>
        ) : undefined}
      </Splash>
    );
  }

  const r = me.reliever;
  if (!r || r.status === "draft" || r.status === "inactive") {
    return (
      <div className="flow">
        <div className="flow-body center-text">
          {r?.status === "inactive" ? (
            <EmptyState
              icon={<IoBanOutline size={34} />}
              title="Registration inactive"
              body={
                <>
                  Your on-call registration <b className="ink">{r.oncallCode}</b> is inactive. Please contact the operations team.
                </>
              }
            />
          ) : (
            <EmptyState
              icon={<IoPersonAddOutline size={34} />}
              title="Not registered yet"
              body={
                <>
                  +91 {mobile} {r ? "has an unfinished on-call registration" : "isn't registered as an on-call reliever"}. Open the iSmart app, tap{" "}
                  <b className="ink">On-call</b> on the login screen and finish registering — or ask the operations team to register you.
                </>
              }
            />
          )}
        </div>
        <div className="flow-footer">
          <Button icon={<IoRefresh size={18} />} onClick={() => void reload()}>
            {r?.status === "inactive" ? "Check again" : "I've registered — check again"}
          </Button>
          <Button variant="ghost" onClick={onSignOut}>
            Use another number
          </Button>
        </div>
      </div>
    );
  }

  if (flow?.kind === "in") return <CheckInFlow reliever={r} onClose={() => setFlow(null)} onDone={reload} />;
  if (flow?.kind === "out") return <CheckOutFlow reliever={r} open={flow.open} onClose={() => setFlow(null)} onDone={reload} />;

  return (
    <div className="tabs-page">
      {tab === "home" && (
        <HomeTab me={me} now={now} install={install} onInstall={() => void startInstall()} onCheckIn={() => setFlow({ kind: "in" })} onCheckOut={() => open && setFlow({ kind: "out", open })} onTab={setTab} />
      )}
      {tab === "attendance" && <AttendanceTab me={me} now={now} onRefresh={reload} />}
      {tab === "profile" && <ProfileTab reliever={r} mobile={mobile} install={install} onInstall={() => void startInstall()} onSignOut={onSignOut} />}

      <nav className="tabbar">
        {(
          [
            ["home", "Home", IoHomeOutline, IoHome],
            ["attendance", "Attendance", IoCalendarOutline, IoCalendar],
            ["profile", "Profile", IoPersonOutline, IoPerson],
          ] as const
        ).map(([key, label, Off, On]) => (
          <button key={key} className={`tab${tab === key ? " active" : ""}`} onClick={() => setTab(key)}>
            {tab === key ? <On size={22} /> : <Off size={22} />}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} install={install} />
    </div>
  );
}
