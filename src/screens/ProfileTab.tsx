import { useState, type ReactNode } from "react";
import { IoCallOutline, IoCardOutline, IoChevronForward, IoDownloadOutline, IoHelpCircleOutline, IoLogOutOutline } from "react-icons/io5";
import type { Reliever } from "../api";
import type { InstallState } from "../install";
import { initials } from "../lib";
import { Button, IconCircle, Sheet, Shell } from "../ui";

function Row({ icon, label, value, onClick, danger }: { icon: ReactNode; label: string; value?: string; onClick?: () => void; danger?: boolean }) {
  const body = (
    <>
      <div className={`row-icon${danger ? " danger" : ""}`}>{icon}</div>
      <div className="grow">
        <b className={danger ? "danger-text" : ""}>{label}</b>
        {value && <span>{value}</span>}
      </div>
      {onClick && <IoChevronForward size={18} className="chev" />}
    </>
  );
  return onClick ? (
    <button className="menu-row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="menu-row">{body}</div>
  );
}

export function ProfileTab({
  reliever,
  mobile,
  install,
  onInstall,
  onSignOut,
}: {
  reliever: Reliever;
  mobile: string;
  install: InstallState;
  onInstall: () => void;
  onSignOut: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [help, setHelp] = useState(false);

  return (
    <Shell
      tall
      header={
        <div className="profile-head">
          <div className="avatar-lg">{initials(reliever.name)}</div>
          <h1>{reliever.name ?? "On-call reliever"}</h1>
          <div className="id-row center">
            <i className="live-dot" />
            {reliever.oncallCode} · On-call Reliever
          </div>
        </div>
      }
    >
      <div className="menu-card">
        <Row icon={<IoCardOutline size={20} />} label="On-call ID" value={reliever.oncallCode ?? "—"} />
        <Row icon={<IoCallOutline size={20} />} label="Mobile" value={`+91 ${mobile}`} />
      </div>

      <div className="menu-card">
        {install.show && <Row icon={<IoDownloadOutline size={20} />} label="Install app" value="Add to your home screen" onClick={onInstall} />}
        <Row icon={<IoHelpCircleOutline size={20} />} label="How it works" value="Check-in, photo and pay" onClick={() => setHelp(true)} />
      </div>

      <div className="menu-card">
        <Row icon={<IoLogOutOutline size={20} />} label="Sign out" onClick={() => setConfirm(true)} danger />
      </div>

      <p className="foot-note">SmartFM Reliever · iSmart Facitech</p>

      <Sheet open={help} onClose={() => setHelp(false)}>
        <div className="sheet-head">
          <IconCircle size={64}>
            <IoHelpCircleOutline size={32} />
          </IconCircle>
          <h3>How it works</h3>
        </div>
        <ol className="steps">
          <li>
            When you reach the site, tap <b>Clock In / Out</b>, pick the site and take a photo. The photo shows your ID, the site, the time and your location.
          </li>
          <li>
            When you leave, tap the card again to <b>check out</b> with a photo.
          </li>
          <li>Operations check each day and match it to the absent employee you covered. Approved days are paid at your daily rate.</li>
        </ol>
        <Button onClick={() => setHelp(false)}>Got it</Button>
      </Sheet>

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <div className="sheet-head">
          <IconCircle tone="danger" size={64}>
            <IoLogOutOutline size={30} />
          </IconCircle>
          <h3>Sign out?</h3>
          <p className="muted">You&apos;ll need a new SMS code to sign in again.</p>
        </div>
        <div className="sheet-actions">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </Sheet>
    </Shell>
  );
}
