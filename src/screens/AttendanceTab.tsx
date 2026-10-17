import { useMemo, useState } from "react";
import { IoEnterOutline, IoExitOutline, IoRefresh } from "react-icons/io5";
import type { Me } from "../api";
import { fmtDay, fmtLongDay, fmtMins, fmtTime, istDate, minutesWorked, statusOf, totals } from "../lib";
import { Card, SectionHeader, Shell, StatusChip } from "../ui";

const DAY_MIN = 8 * 60;

function Dial({ minutes, label }: { minutes: number; label: string }) {
  const R = 74;
  const C = 2 * Math.PI * R;
  const share = Math.min(1, minutes / DAY_MIN);
  return (
    <div className="dial">
      <svg viewBox="0 0 170 170" width="170" height="170">
        <circle cx="85" cy="85" r={R} className="dial-track" />
        <circle cx="85" cy="85" r={R} className="dial-fill" strokeDasharray={C} strokeDashoffset={C * (1 - share)} transform="rotate(-90 85 85)" />
      </svg>
      <div className="dial-center">
        <b>{fmtMins(minutes)}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function AttendanceTab({ me, now, onRefresh }: { me: Me; now: number; onRefresh: () => Promise<void> }) {
  const [spinning, setSpinning] = useState(false);
  const t = useMemo(() => totals(me.recent, now), [me.recent, now]);
  const today = istDate();
  const todays = me.recent.filter((a) => a.date === today);

  return (
    <Shell
      header={
        <div className="page-head">
          <div>
            <h1>Attendance</h1>
            <p>{fmtLongDay()}</p>
          </div>
          <button
            className="head-icon"
            aria-label="Refresh"
            onClick={async () => {
              setSpinning(true);
              await onRefresh();
              setSpinning(false);
            }}
          >
            <IoRefresh size={20} className={spinning ? "spinning" : ""} />
          </button>
        </div>
      }
    >
      <Card className="dial-card">
        <Dial minutes={t.today} label={me.open ? "working now" : "today"} />
        <div className="dial-stats">
          <div>
            <b>{fmtMins(t.week)}</b>
            <span>This week</span>
          </div>
          <div>
            <b>{fmtMins(t.month)}</b>
            <span>This month</span>
          </div>
        </div>
      </Card>

      <section className="block">
        <SectionHeader title="Today's Timeline" />
        {todays.length === 0 ? (
          <Card className="quiet">
            <span>You haven&apos;t checked in today.</span>
          </Card>
        ) : (
          <Card className="timeline">
            {todays.map((a) => (
              <div key={a.id} className="tl-group">
                <div className="tl-row">
                  <div className="tl-dot in">
                    <IoEnterOutline size={16} />
                  </div>
                  <div className="grow">
                    <b>Checked in</b>
                    <span>{a.siteName ?? a.siteCode}</span>
                  </div>
                  <time>{fmtTime(a.checkInAt)}</time>
                </div>
                <div className={`tl-row${a.checkOutAt ? "" : " pending"}`}>
                  <div className="tl-dot out">
                    <IoExitOutline size={16} />
                  </div>
                  <div className="grow">
                    <b>{a.checkOutAt ? "Checked out" : "Not checked out yet"}</b>
                    <span>{fmtMins(minutesWorked(a, now))} worked</span>
                  </div>
                  <time>{a.checkOutAt ? fmtTime(a.checkOutAt) : "—"}</time>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="block">
        <SectionHeader title="History" />
        {me.recent.length === 0 ? (
          <Card className="quiet">
            <span>No check-ins yet.</span>
          </Card>
        ) : (
          <div className="list-card">
            {me.recent.map((a) => {
              const s = statusOf(a);
              return (
                <div key={a.id} className="hist-row">
                  <div className="hist-date">
                    <b>{new Date(`${a.date}T00:00:00`).getDate()}</b>
                    <span>{new Date(`${a.date}T00:00:00`).toLocaleDateString("en-IN", { month: "short" })}</span>
                  </div>
                  <div className="grow">
                    <b>{a.siteName ?? a.siteCode}</b>
                    <span>
                      {fmtDay(a.date)} · {fmtTime(a.checkInAt)} – {a.checkOutAt ? fmtTime(a.checkOutAt) : "now"}
                    </span>
                    {a.status === "rejected" && a.rejectReason && <span className="reason">{a.rejectReason}</span>}
                    {a.status === "verified" && a.coveredName && <span className="covered">Covered for {a.coveredName}</span>}
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
        <p className="foot-note">Operations check every day. Approved days are paid.</p>
      </section>
    </Shell>
  );
}
