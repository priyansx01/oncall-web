import { useMemo, useState } from "react";
import { IoEnterOutline, IoExitOutline, IoRefresh } from "react-icons/io5";
import type { Me } from "../api";
import { useLang } from "../i18n";
import { fmtDay, fmtLongDay, fmtMins, fmtMonth, fmtTime, istDate, minutesWorked, statusOf, totals } from "../lib";
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
  const { t } = useLang();
  const [spinning, setSpinning] = useState(false);
  const tot = useMemo(() => totals(me.recent ?? [], now), [me.recent, now]);
  const today = istDate();
  const todays = me.recent.filter((a) => a.date === today);

  return (
    <Shell
      header={
        <div className="page-head">
          <div>
            <h1>{t("tab_attendance")}</h1>
            <p>{fmtLongDay()}</p>
          </div>
          <button
            className="head-icon"
            aria-label={t("refresh")}
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
        <Dial minutes={tot.today} label={me.open ? t("working_now") : t("today")} />
        <div className="dial-stats">
          <div>
            <b>{fmtMins(tot.week)}</b>
            <span>{t("this_week")}</span>
          </div>
          <div>
            <b>{fmtMins(tot.month)}</b>
            <span>{t("this_month")}</span>
          </div>
        </div>
      </Card>

      <section className="block">
        <SectionHeader title={t("todays_timeline")} />
        {todays.length === 0 ? (
          <Card className="quiet">
            <span>{t("not_checked_in_today")}</span>
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
                    <b>{t("checked_in")}</b>
                    <span>{a.siteName ?? a.siteCode}</span>
                  </div>
                  <time>{fmtTime(a.checkInAt)}</time>
                </div>
                <div className={`tl-row${a.checkOutAt ? "" : " pending"}`}>
                  <div className="tl-dot out">
                    <IoExitOutline size={16} />
                  </div>
                  <div className="grow">
                    <b>{a.checkOutAt ? t("checked_out") : t("not_checked_out")}</b>
                    <span>{t("worked_time", { time: fmtMins(minutesWorked(a, now)) })}</span>
                  </div>
                  <time>{a.checkOutAt ? fmtTime(a.checkOutAt) : "—"}</time>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="block">
        <SectionHeader title={t("history")} />
        {me.recent.length === 0 ? (
          <Card className="quiet">
            <span>{t("no_checkins")}</span>
          </Card>
        ) : (
          <div className="list-card">
            {me.recent.map((a) => {
              const s = statusOf(a);
              return (
                <div key={a.id} className="hist-row">
                  <div className="hist-date">
                    <b>{new Date(`${a.date}T00:00:00`).getDate()}</b>
                    <span>{fmtMonth(a.date)}</span>
                  </div>
                  <div className="grow">
                    <b>{a.siteName ?? a.siteCode}</b>
                    <span>
                      {fmtDay(a.date)} · {fmtTime(a.checkInAt)} – {a.checkOutAt ? fmtTime(a.checkOutAt) : t("now")}
                    </span>
                    {a.status === "rejected" && a.rejectReason && <span className="reason">{a.rejectReason}</span>}
                    {a.status === "verified" && a.coveredName && <span className="covered">{t("covered_for", { name: a.coveredName })}</span>}
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
        <p className="foot-note">{t("attendance_note")}</p>
      </section>
    </Shell>
  );
}
