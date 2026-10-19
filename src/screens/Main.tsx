import { useCallback, useEffect, useState, type ReactNode } from "react";
import { IoBanOutline, IoCalendar, IoCalendarOutline, IoHome, IoHomeOutline, IoPerson, IoPersonAddOutline, IoPersonOutline, IoRefresh, IoSwapHorizontal } from "react-icons/io5";
import { api, type Attendance, type Me } from "../api";
import { crumb } from "../crash";
import { useBack } from "../shell";
import { useLang } from "../i18n";
import { useInstall } from "../install";
import { message } from "../lib";
import { Button, EmptyState, ErrorBanner, Spinner } from "../ui";
import { AttendanceTab } from "./AttendanceTab";
import { CheckInFlow } from "./CheckIn";
import { CheckOutFlow } from "./CheckOut";
import { HomeTab } from "./HomeTab";
import { InstallSheet } from "./InstallSheet";
import { Join } from "./Join";
import { Permissions, permissionsGranted } from "./Permissions";
import { ProfileTab } from "./ProfileTab";

export type Tab = "home" | "attendance" | "profile";

export function Splash({ children }: { children?: ReactNode }) {
  const { t } = useLang();
  return (
    <div className="splash">
      <span className="circle one" />
      <span className="circle two" />
      <div className="splash-logo">
        <img src="/logo-white.png" alt="" />
      </div>
      <div className="splash-name">iSmart Facitech</div>
      <div className="splash-tag">{t("role_title")}</div>
      <div className="splash-foot">{children ?? <Spinner />}</div>
    </div>
  );
}

/**
 * After sign-in: the server says who this mobile is. Not registered (or a draft) → Join;
 * inactive → told so; active → permissions once, then Home / Attendance / Profile.
 */
export function Main({ mobile, onSignOut, joinIntent = false }: { mobile: string; onSignOut: () => void; joinIntent?: boolean }) {
  const { t } = useLang();
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Decided on the first load and kept until the ON id screen's Continue: the app reloads
  // `me` whenever it comes back to the foreground (camera, file picker), which must not
  // pull someone out of the middle of joining.
  const [joining, setJoining] = useState<boolean | null>(null);
  // A number with no registration at all is told so first, then chooses Join or another number.
  const [joinChosen, setJoinChosen] = useState(joinIntent);
  const [permsOk, setPermsOk] = useState(permissionsGranted);
  const [tab, setTab] = useState<Tab>("home");
  // The open day is kept for check-out: once it is submitted, `me.open` is gone but the summary still shows.
  const [flow, setFlow] = useState<{ kind: "in" } | { kind: "out"; open: Attendance } | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const install = useInstall();
  useBack(() => setTab("home"), tab !== "home" && !flow);

  /** Reloads the person's days; returns them, or null when it failed (the error is shown). */
  const reload = useCallback(async (): Promise<Me | null> => {
    try {
      const m = await api.me();
      setMe(m);
      setLoadError(null);
      setJoining((j) => (j == null ? !m.reliever || m.reliever.status === "draft" : j));
      return m;
    } catch (e) {
      setLoadError(message(e, t("err_load")));
      return null;
    }
  }, [t]);
  // Closing a flow always refreshes: a check-in saved on a slow network, or a day closed
  // meanwhile, must not leave Home showing the old state.
  const closeFlow = useCallback(() => {
    setFlow(null);
    void reload();
  }, [reload]);

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
    const timer = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (me && !joining) crumb(`screen:${flow ? `flow-${flow.kind}` : `tab-${tab}`}`);
  }, [me, joining, flow, tab]);

  const startInstall = async () => {
    if (install.canPrompt) await install.prompt();
    else setInstallOpen(true);
  };

  if (!me || joining == null) {
    return (
      <Splash>
        {loadError ? (
          <div className="splash-error">
            <ErrorBanner>{loadError}</ErrorBanner>
            <Button variant="light" icon={<IoRefresh size={18} />} onClick={() => void reload()}>
              {t("try_again")}
            </Button>
            <Button variant="ghost" onClick={onSignOut}>
              <span className="on-dark">{t("sign_out")}</span>
            </Button>
          </div>
        ) : undefined}
      </Splash>
    );
  }

  const r = me.reliever;
  // An iSmart employee's number can't register as on-call (the server refuses it too).
  if (me.employee && (!r || r.status === "draft")) {
    return <EmployeeNumber code={me.employee.employeeCode} onOtherNumber={onSignOut} />;
  }
  if (joining && !r && !joinChosen) {
    return <NotRegistered mobile={mobile} onJoin={() => setJoinChosen(true)} onOtherNumber={onSignOut} />;
  }
  if (joining) {
    return (
      <Join
        initial={r}
        mobile={mobile}
        onSignOut={onSignOut}
        onFinished={async () => {
          // Wait for the new registration before leaving Join, so the old (draft) state
          // never flashes "inactive". If the reload fails, Join stays with its own error.
          const m = await reload();
          if (m?.reliever && m.reliever.status !== "draft") setJoining(false);
          return !!m;
        }}
      />
    );
  }

  if (!r || r.status !== "active") {
    return (
      <div className="flow">
        <div className="flow-body center-text">
          <EmptyState
            icon={<IoBanOutline size={34} />}
            title={t("inactive_title")}
            body={
              <>
                {r?.oncallCode ? t("inactive_body", { code: r.oncallCode }) : t("inactive_body_nocode")}
                <br />
                <span className="small">{t("inactive_contact")}</span>
              </>
            }
          />
        </div>
        <div className="flow-footer">
          <Button icon={<IoRefresh size={18} />} onClick={() => void reload()}>
            {t("check_again")}
          </Button>
          <Button variant="ghost" onClick={onSignOut}>
            {t("sign_out")}
          </Button>
        </div>
      </div>
    );
  }

  if (!permsOk) return <Permissions onDone={() => setPermsOk(true)} />;
  if (flow?.kind === "in") return <CheckInFlow reliever={r} onClose={closeFlow} onDone={reload} />;
  if (flow?.kind === "out") return <CheckOutFlow reliever={r} open={flow.open} onClose={closeFlow} onDone={reload} />;

  return (
    <div className="tabs-page">
      {loadError && (
        <div className="load-error">
          <ErrorBanner onClose={() => setLoadError(null)}>
            {loadError}{" "}
            <button className="text-btn" onClick={() => void reload()}>
              {t("try_again")}
            </button>
          </ErrorBanner>
        </div>
      )}
      {tab === "home" && (
        <HomeTab
          me={me}
          now={now}
          install={install}
          onInstall={() => void startInstall()}
          onCheckIn={() => setFlow({ kind: "in" })}
          onCheckOut={() => open && setFlow({ kind: "out", open })}
          onTab={setTab}
        />
      )}
      {tab === "attendance" && <AttendanceTab me={me} now={now} onRefresh={async () => !!(await reload())} />}
      {tab === "profile" && <ProfileTab reliever={r} mobile={mobile} install={install} onInstall={() => void startInstall()} onSignOut={onSignOut} />}

      <nav className="tabbar">
        {(
          [
            ["home", t("tab_home"), IoHomeOutline, IoHome],
            ["attendance", t("tab_attendance"), IoCalendarOutline, IoCalendar],
            ["profile", t("tab_profile"), IoPersonOutline, IoPerson],
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

/** After the code: the number is an iSmart employee's. On-call is only for people who aren't. */
function EmployeeNumber({ code, onOtherNumber }: { code: string | null; onOtherNumber: () => void }) {
  const { t } = useLang();
  useEffect(() => {
    crumb("screen:employee-number");
  }, []);
  return (
    <div className="flow">
      <div className="flow-body center-text">
        <EmptyState icon={<IoBanOutline size={34} />} title={t("employee_title")} body={t("employee_body", { code: code ?? "—" })} />
      </div>
      <div className="flow-footer">
        <Button variant="secondary" icon={<IoSwapHorizontal size={18} />} onClick={onOtherNumber}>
          {t("use_other_number")}
        </Button>
      </div>
    </div>
  );
}

/** After the code: this number has no registration. Said plainly, then Join or another number. */
function NotRegistered({ mobile, onJoin, onOtherNumber }: { mobile: string; onJoin: () => void; onOtherNumber: () => void }) {
  const { t } = useLang();
  useEffect(() => {
    crumb("screen:not-registered");
  }, []);
  return (
    <div className="flow">
      <div className="flow-body center-text">
        <EmptyState
          icon={<IoPersonAddOutline size={34} />}
          title={t("not_registered_title")}
          body={t("not_registered_body", { mobile: `+91 ${mobile}` })}
        />
      </div>
      <div className="flow-footer">
        <Button icon={<IoPersonAddOutline size={18} />} onClick={onJoin}>
          {t("join_now")}
        </Button>
        <Button variant="ghost" icon={<IoSwapHorizontal size={18} />} onClick={onOtherNumber}>
          {t("use_other_number")}
        </Button>
      </div>
    </div>
  );
}
