import { useMemo, useState } from "react";
import { IoArrowForward, IoBusinessOutline, IoChevronForward, IoDownloadOutline, IoLogOutOutline, IoTimeOutline, IoCalendarOutline, IoStatsChartOutline } from "react-icons/io5";
import type { Me } from "../api";
import type { InstallState } from "../install";
import { fmtDay, fmtMins, fmtTime, greeting, initials, minutesWorked, statusOf, totals } from "../lib";
import { Brand, Button, Card, IconCircle, SectionHeader, Sheet, Shell, StatusChip } from "../ui";
import type { Tab } from "./Main";

export function HomeTab({
  me,
  now,
  install,
  onInstall,
  onCheckIn,
  onCheckOut,
  onTab,
}: {
  me: Me;
  now: number;
  install: InstallState;
  onInstall: () => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onTab: (t: Tab) => void;
}) {
  const r = me.reliever!;
  const open = me.open;
  const [confirmOut, setConfirmOut] = useState(false);
  const t = useMemo(() => totals(me.recent, now), [me.recent, now]);

  return (
    <Shell
      header={
        <>
          <div className="header-row">
            <Brand />
            <button className="avatar-sm" onClick={() => onTab("profile")} aria-label="Profile">
              {initials(r.name)}
            </button>
          </div>
          <div className="welcome">
            <div className="greeting">{greeting()}</div>
            <div className="user-name">{(r.name ?? "").split(" ")[0] || "Reliever"} 👋</div>
            <div className="id-row">
              <i className="live-dot" />
              ID: {r.oncallCode}
            </div>
          </div>
        </>
      }
    >
      {install.show && (
        <div className="install-banner">
          <div className="install-icon">
            <img src="/icons/icon-192.png" alt="" />
          </div>
          <div className="grow">
            <b>Install the app</b>
            <span>Open it from your home screen, full screen.</span>
          </div>
          <Button small icon={<IoDownloadOutline size={16} />} onClick={onInstall}>
            Install
          </Button>
        </div>
      )}

      <button className={`clock-card${open ? " working" : ""}`} onClick={() => (open ? setConfirmOut(true) : onCheckIn())}>
        <div className="clock-icon">{open ? <IoLogOutOutline size={26} /> : <IoTimeOutline size={28} />}</div>
        <div className="grow">
          <div className="clock-label">Clock In / Out</div>
          <div className="clock-title">{open ? `Working · ${fmtMins(minutesWorked(open, now))}` : "Tap to check in"}</div>
          <div className="clock-sub">{open ? `Since ${fmtTime(open.checkInAt)} · tap to check out` : "Pick your site and take a photo"}</div>
        </div>
        <div className="arrow-circle">
          <IoArrowForward size={18} />
        </div>
      </button>

      {open && (
        <section className="block">
          <SectionHeader title="Current Site" />
          <Card className="site-card">
            <div className="site-top">
              <div className="building">
                <IoBusinessOutline size={24} />
              </div>
              <div className="grow">
                <div className="site-title">{open.siteName ?? open.siteCode}</div>
                <div className="site-sub">{open.clientName ?? "Checked in"}</div>
              </div>
              <StatusChip label="On duty" tone="success" />
            </div>
            <div className="meta">
              <div>
                <IoTimeOutline size={16} /> Checked in at {fmtTime(open.checkInAt)}
              </div>
            </div>
          </Card>
        </section>
      )}

      <section className="block">
        <SectionHeader title="Hours Worked" />
        <div className="tiles">
          {(
            [
              ["Today", t.today],
              ["This week", t.week],
              ["This month", t.month],
            ] as const
          ).map(([label, m]) => (
            <div key={label} className="tile">
              <b>{fmtMins(m)}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <SectionHeader
          title="Recent Days"
          action={
            me.recent.length > 0 && (
              <button className="see-all" onClick={() => onTab("attendance")}>
                See All <IoChevronForward size={14} />
              </button>
            )
          }
        />
        {me.recent.length === 0 ? (
          <Card className="quiet">
            <IoCalendarOutline size={22} />
            <span>No check-ins yet. Your days show up here.</span>
          </Card>
        ) : (
          <div className="list-card">
            {me.recent.slice(0, 4).map((a) => {
              const s = statusOf(a);
              return (
                <div key={a.id} className="day-row">
                  <div className="day-icon">
                    <IoStatsChartOutline size={18} />
                  </div>
                  <div className="grow">
                    <b>{fmtDay(a.date)}</b>
                    <span>{a.siteName ?? a.siteCode}</span>
                  </div>
                  <div className="right">
                    <b>{fmtMins(minutesWorked(a, now))}</b>
                    <StatusChip label={s.label} tone={s.tone} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Sheet open={confirmOut} onClose={() => setConfirmOut(false)}>
        <div className="sheet-head">
          <IconCircle tone="danger" size={64}>
            <IoLogOutOutline size={30} />
          </IconCircle>
          <h3>End Today&apos;s Work?</h3>
          <p className="muted">
            You&apos;ve worked <b className="ink">{open ? fmtMins(minutesWorked(open, now)) : ""}</b> at {open?.siteName ?? "this site"}. Check out only when
            you are leaving — you&apos;ll take a photo next.
          </p>
        </div>
        <div className="sheet-actions">
          <Button variant="secondary" onClick={() => setConfirmOut(false)}>
            Not Yet
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmOut(false);
              onCheckOut();
            }}
          >
            Yes, Check Out
          </Button>
        </div>
      </Sheet>
    </Shell>
  );
}
