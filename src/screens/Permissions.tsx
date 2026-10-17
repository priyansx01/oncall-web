import { useEffect, useState } from "react";
import { IoCameraOutline, IoCheckmarkCircle, IoLocationOutline, IoShieldCheckmarkOutline, IoWarning } from "react-icons/io5";
import { getFix } from "../lib";
import { Button, ErrorBanner, IconCircle } from "../ui";

type S = "idle" | "ok" | "denied";

export function Permissions({ onDone }: { onDone: () => void }) {
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
      s.getTracks().forEach((t) => t.stop());
      setCam("ok");
    } catch {
      setCam("denied");
    }
    setBusy(false);
  };

  useEffect(() => {
    if (loc === "ok" && cam === "ok") {
      const t = setTimeout(onDone, 600);
      return () => clearTimeout(t);
    }
  }, [loc, cam, onDone]);

  const denied = loc === "denied" || cam === "denied";
  const Row = ({ icon, label, why, state }: { icon: JSX.Element; label: string; why: string; state: S }) => (
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

  return (
    <div className="flow">
      <div className="flow-body center-text">
        <IconCircle size={92}>
          <IoShieldCheckmarkOutline size={42} />
        </IconCircle>
        <h2 className="hero-title">Allow access</h2>
        <p className="muted">Two permissions are needed to check you in at a site.</p>
        <div className="perm-list">
          <Row icon={<IoLocationOutline size={22} />} label="Location" why="Finds the sites near you and records where you checked in." state={loc} />
          <Row icon={<IoCameraOutline size={22} />} label="Camera" why="Takes a photo at check-in and check-out, stamped with the time and place." state={cam} />
        </div>
        {denied && (
          <ErrorBanner>
            {loc === "denied" && cam === "denied" ? "Location and camera are" : loc === "denied" ? "Location is" : "Camera is"} blocked. Tap the lock icon
            next to the address (or the browser&apos;s site settings), allow it, then tap Try again.
          </ErrorBanner>
        )}
      </div>
      <div className="flow-footer">
        <Button loading={busy} onClick={() => void ask()}>
          {loc === "idle" && cam === "idle" ? "Allow access" : "Try again"}
        </Button>
        {denied && (
          <Button variant="ghost" onClick={onDone}>
            Continue anyway
          </Button>
        )}
      </div>
    </div>
  );
}
