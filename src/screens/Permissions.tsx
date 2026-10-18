import { useEffect, useState } from "react";
import { IoCameraOutline, IoCheckmarkCircle, IoLocationOutline, IoShieldCheckmarkOutline, IoWarning } from "react-icons/io5";
import { useLang } from "../i18n";
import { getFix } from "../lib";
import { Button, ErrorBanner, IconCircle } from "../ui";

const PERMS_KEY = "oncall_perms_v1";

export function permissionsGranted(): boolean {
  try {
    return localStorage.getItem(PERMS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Joining already asked for location + camera (the geo-tagged photo), so Home needn't ask again. */
export function markPermissionsGranted(): void {
  try {
    localStorage.setItem(PERMS_KEY, "1");
  } catch {
    /* ignore */
  }
}

type S = "idle" | "ok" | "denied";

function Row({ icon, label, why, state }: { icon: JSX.Element; label: string; why: string; state: S }) {
  return (
    <div className={`perm-card ${state}`}>
      <div className="perm-icon">{icon}</div>
      <div className="grow">
        <b>{label}</b>
        <span>{why}</span>
      </div>
      {state === "ok" && <IoCheckmarkCircle size={24} className="ok-icon" />}
      {state === "denied" && <IoWarning size={22} className="bad-icon" />}
    </div>
  );
}

export function Permissions({ onDone }: { onDone: () => void }) {
  const { t } = useLang();
  const [loc, setLoc] = useState<S>("idle");
  const [cam, setCam] = useState<S>("idle");
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
      s.getTracks().forEach((tr) => tr.stop());
      setCam("ok");
    } catch {
      setCam("denied");
    }
    setBusy(false);
  };

  useEffect(() => {
    if (loc === "ok" && cam === "ok") {
      markPermissionsGranted();
      const timer = setTimeout(onDone, 600);
      return () => clearTimeout(timer);
    }
  }, [loc, cam, onDone]);

  const denied = loc === "denied" || cam === "denied";
  return (
    <div className="flow">
      <div className="flow-body center-text">
        <IconCircle size={92}>
          <IoShieldCheckmarkOutline size={42} />
        </IconCircle>
        <h2 className="hero-title">{t("perm_title")}</h2>
        <p className="muted">{t("perm_intro")}</p>
        <div className="perm-list">
          <Row icon={<IoLocationOutline size={22} />} label={t("perm_location")} why={t("perm_location_why")} state={loc} />
          <Row icon={<IoCameraOutline size={22} />} label={t("perm_camera")} why={t("perm_camera_why")} state={cam} />
        </div>
        {denied && <ErrorBanner>{t("perm_blocked")}</ErrorBanner>}
      </div>
      <div className="flow-footer">
        <Button loading={busy} onClick={() => void ask()}>
          {loc === "idle" && cam === "idle" ? t("perm_allow") : t("try_again")}
        </Button>
        {denied && (
          <Button variant="ghost" onClick={onDone}>
            {t("continue_anyway")}
          </Button>
        )}
      </div>
    </div>
  );
}
