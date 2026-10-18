import { useMemo, useState } from "react";
import { IoArrowForward, IoBusinessOutline, IoChevronForward, IoDownloadOutline, IoLogOutOutline, IoTimeOutline, IoCalendarOutline, IoStatsChartOutline } from "react-icons/io5";
import type { Me } from "../api";
import type { InstallState } from "../install";
import { fmtDay, fmtMins, fmtTime, greeting, initials, minutesWorked, statusOf, totals } from "../lib";
import { useLang } from "../i18n";
import { Brand, Button, Card, IconCircle, SectionHeader, Sheet, Shell, StatusChip } from "../ui";
import { LanguageButton } from "./LanguagePicker";
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
  const { t } = useLang();
  const r = me.reliever!;
  const open = me.open;
  const [confirmOut, setConfirmOut] = useState(false);
  const tot = useMemo(() => totals(me.recent ?? [], now), [me.recent, now]);

  return (
    <Shell
      header={
        <>
          <div className="header-row">
            <Brand />
            <div className="header-actions">
              <LanguageButton light />
              <button className="avatar-sm" onClick={() => onTab("profile")} aria-label={t("tab_profile")}>
                {initials(r.name)}
              </button>
            </div>
          </div>
          <div className="welcome">
            <div className="greeting">{greeting()}</div>
            <div className="user-name">{(r.name ?? "").split(" ")[0] || t("role_title")} 👋</div>
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
            <b>{t("save_app")}</b>
            <span>{t("save_app_hint")}</span>
          </div>
          <Button small icon={<IoDownloadOutline size={16} />} onClick={onInstall}>
            {t("save")}
          </Button>
        </div>
      )}

      <button className={`clock-card${open ? " working" : ""}`} onClick={() => (open ? setConfirmOut(true) : onCheckIn())}>
        <div className="clock-icon">{open ? <IoLogOutOutline size={26} /> : <IoTimeOutline size={28} />}</div>
        <div className="grow">
          <div className="clock-label">{t("clock_label")}</div>
          <div className="clock-title">{open ? t("working_for", { time: fmtMins(minutesWorked(open, now)) }) : t("tap_check_in")}</div>
          <div className="clock-sub">{open ? t("since_tap_out", { time: fmtTime(open.checkInAt) }) : t("check_in_sub")}</div>
        </div>
        <div className="arrow-circle">
          <IoArrowForward size={18} />
        </div>
      </button>

      {open && (
        <section className="block">
          <SectionHeader title={t("current_site")} />
          <Card className="site-card">
            <div className="site-top">
              <div className="building">
                <IoBusinessOutline size={24} />
              </div>
              <div className="grow">
                <div className="site-title">{open.siteName ?? open.siteCode}</div>
                <div className="site-sub">{open.clientName ?? t("checked_in")}</div>
              </div>
              <StatusChip label={t("on_duty")} tone="success" />
            </div>
            <div className="meta">
              <div>
                <IoTimeOutline size={16} /> {t("checked_in_at", { time: fmtTime(open.checkInAt) })}
              </div>
            </div>
          </Card>
        </section>
      )}

      <section className="block">
        <SectionHeader title={t("hours_worked")} />
        <div className="tiles">
          {(
            [
              [t("today"), tot.today],
              [t("this_week"), tot.week],
              [t("this_month"), tot.month],
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
          title={t("recent_days")}
          action={
            me.recent.length > 0 && (
              <button className="see-all" onClick={() => onTab("attendance")}>
                {t("see_all")} <IoChevronForward size={14} />
              </button>
            )
          }
        />
        {me.recent.length === 0 ? (
          <Card className="quiet">
            <IoCalendarOutline size={22} />
            <span>{t("no_checkins_home")}</span>
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
          <h3>{t("end_work_title")}</h3>
          <p className="muted">{t("end_work_body", { time: open ? fmtMins(minutesWorked(open, now)) : "", site: open?.siteName ?? "" })}</p>
        </div>
        <div className="sheet-actions">
          <Button variant="secondary" onClick={() => setConfirmOut(false)}>
            {t("not_yet")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmOut(false);
              onCheckOut();
            }}
          >
            {t("yes_check_out")}
          </Button>
        </div>
      </Sheet>
    </Shell>
  );
}
