import { useCallback, useEffect, useState } from "react";
import { IoArrowBack, IoBusinessOutline, IoCheckmark, IoClose, IoHelpCircleOutline, IoRefresh, IoSearch, IoShieldCheckmarkOutline, IoWarningOutline } from "react-icons/io5";
import { useLang } from "../i18n";
import { api, type Attendance, type Reliever, type Site } from "../api";
import { fmtDist, fmtTime, getFix, message, type Fix } from "../lib";
import { Button, Card, ErrorBanner, FlowHeader, IconCircle, KeyValueRow, LocationSummary, Spinner, Stepper } from "../ui";
import { PhotoStep, stampLines, usePhoto } from "./PhotoStep";


export function CheckInFlow({ reliever, onClose, onDone }: { reliever: Reliever; onClose: () => void; onDone: () => Promise<void> }) {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const [fix, setFix] = useState<Fix | null>(null);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [q, setQ] = useState("");
  const [searched, setSearched] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<Attendance | null>(null);
  // "My site is not in the list": check in anyway with the name typed; the photo must show the
  // site board and building, and ops confirm the GPS on a map before the day is mapped.
  const [unlisted, setUnlisted] = useState(false);
  const [reported, setReported] = useState("");
  const reportedName = reported.replace(/\s+/g, " ").trim();
  const siteLabel = unlisted ? reportedName : (site?.siteName ?? "");
  const ready = unlisted ? reportedName.length >= 3 : !!site;
  const shot = usePhoto((f) => stampLines(reliever.oncallCode, reliever.name, unlisted ? `${reportedName} · NOT IN SITE LIST` : (site?.siteName ?? ""), f));

  const locate = useCallback(async () => {
    setLocating(true);
    setLocError(null);
    try {
      const f = await getFix();
      setFix(f);
      const list = await api.sitesNear(f.lat, f.lng);
      setSites(list);
      setSearched(false);
      // The nearest site is preselected when it is close enough to be where they are.
      setSite((cur) => (cur && list.some((s) => s.siteCode === cur.siteCode) ? cur : list[0] && (list[0].distanceM ?? 99999) <= 500 ? list[0] : null));
      // Nothing within 2 km: offer "not in the list" straight away.
      if (list.length === 0) setUnlisted(true);
    } catch (e) {
      setLocError(message(e, t("err_sites")));
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  const search = async () => {
    if (q.trim().length < 2) return;
    setLocating(true);
    setLocError(null);
    try {
      setSites(await api.searchSites(q.trim(), fix?.lat, fix?.lng));
      setSearched(true);
      setSite(null);
      shot.reset();
    } catch (e) {
      setLocError(message(e, t("err_search")));
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    const p = shot.photo;
    if (!p || !ready) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const key = await api.uploadPhoto("selfie_in", p.blob);
      const point = { selfieKey: key, latitude: p.fix.lat, longitude: p.fix.lng, accuracy: p.fix.acc };
      const a = unlisted
        ? await api.checkIn({ ...point, siteCode: "", unlisted: true, reportedSite: reportedName })
        : await api.checkIn({ ...point, siteCode: site!.siteCode });
      setDone(a);
      void onDone();
    } catch (e) {
      setSubmitError(message(e, t("err_check_in")));
    } finally {
      setBusy(false);
    }
  };

  if (shot.camera) return shot.camera;

  if (done) {
    return (
      <div className="flow">
        <div className="flow-body center-text">
          <div className="success-ring">
            <IconCircle tone="solid" size={92}>
              <IoCheckmark size={48} />
            </IconCircle>
          </div>
          <h2 className="hero-title">{t("checked_in_title")}</h2>
          <p className="muted">{t("checked_in_body")}</p>
          <Card className="kv-card">
            <KeyValueRow label={t("site")} value={done.siteName ?? siteLabel ?? done.siteCode} />
            {(done.clientName ?? site?.clientName) && <KeyValueRow label={t("client")} value={done.clientName ?? site?.clientName} />}
            <KeyValueRow label={t("checked_in_at_label")} value={fmtTime(done.checkInAt)} />
            {done.checkInDistanceM != null && <KeyValueRow label={t("distance_from_site")} value={fmtDist(done.checkInDistanceM)} />}
            <KeyValueRow label={t("your_oncall_id")} value={reliever.oncallCode} />
          </Card>
          {unlisted && <Card className="intro-card plain">{t("unlisted_confirm_note")}</Card>}
        </div>
        <div className="flow-footer">
          <Button onClick={onClose}>{t("go_home")}</Button>
        </div>
      </div>
    );
  }

  const back = () => (step === 0 ? onClose() : setStep(step - 1));

  return (
    <div className="flow">
      <FlowHeader title={t("check_in")} onBack={back} icon={step === 0 ? <IoClose size={22} /> : <IoArrowBack size={22} />} />
      <Stepper steps={[t("step_site"), t("step_photo"), t("step_confirm")]} current={step} />

      <div className="flow-body">
        {step === 0 && (
          <>
            <Card className="intro-card">
              <IoShieldCheckmarkOutline size={22} />
              <div>
                <b>{t("site_verification")}</b>
                <span>{t("site_verification_body")}</span>
              </div>
            </Card>

            <LocationSummary
              title={fix ? t("location_accuracy_value", { m: fix.acc }) : locating ? t("finding_location") : t("location_not_found")}
              sub={fix ? t("updated_at", { time: fmtTime(new Date(fix.at).toISOString()) }) : t("gps_on")}
            />

            <div className="row-between">
              <h3 className="sub-title">{searched ? t("search_results") : t("sites_near")}</h3>
              <button className="text-btn" onClick={() => void locate()} disabled={locating}>
                <IoRefresh size={15} /> {t("refresh")}
              </button>
            </div>

            {locError && <ErrorBanner onClose={() => setLocError(null)}>{locError}</ErrorBanner>}
            {locating && !sites && (
              <div className="loading-block">
                <Spinner dark />
                <span>{t("finding_sites")}</span>
              </div>
            )}
            {sites && sites.length === 0 && <Card className="quiet">{t("no_sites")}</Card>}

            <div className="site-list">
              {(sites ?? []).map((s) => {
                const sel = !unlisted && site?.siteCode === s.siteCode;
                return (
                  <button key={s.siteCode} className={`site-option${sel ? " selected" : ""}`} onClick={() => {
                      // The site is printed on the photo, so a different site needs a new photo.
                      if (!sel || unlisted) shot.reset();
                      setUnlisted(false);
                      setSite(s);
                    }}>
                    <div className="building">
                      <IoBusinessOutline size={22} />
                    </div>
                    <div className="grow">
                      <b>{s.siteName}</b>
                      <span>{[s.clientName, s.city].filter(Boolean).join(" · ") || s.siteCode}</span>
                    </div>
                    {s.distanceM != null && <span className="dist">{fmtDist(s.distanceM)}</span>}
                    <span className={`radio${sel ? " on" : ""}`}>{sel && <IoCheckmark size={14} />}</span>
                  </button>
                );
              })}
            </div>

            <div className="search-box">
              <IoSearch size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()} placeholder={t("search_placeholder")} />
              <button className="text-btn" onClick={() => void search()} disabled={locating || q.trim().length < 2}>
                {t("search")}
              </button>
            </div>

            <button
              className={`site-option unlisted-option${unlisted ? " selected" : ""}`}
              onClick={() => {
                if (!unlisted) shot.reset();
                setUnlisted(true);
              }}
            >
              <div className="building warn">
                <IoHelpCircleOutline size={22} />
              </div>
              <div className="grow">
                <b>{t("unlisted_option")}</b>
                <span>{t("unlisted_option_sub")}</span>
              </div>
              <span className={`radio${unlisted ? " on" : ""}`}>{unlisted && <IoCheckmark size={14} />}</span>
            </button>

            {unlisted && (
              <Card className="unlisted-card">
                <div className="unlisted-head">
                  <IoWarningOutline size={20} />
                  <b>{t("unlisted_title")}</b>
                </div>
                <p>{t("unlisted_body")}</p>
                <label className="field">
                  <span>{t("unlisted_name_label")}</span>
                  <div className="input-wrap">
                    <input
                      value={reported}
                      maxLength={120}
                      placeholder={t("unlisted_name_placeholder")}
                      onChange={(e) => {
                        setReported(e.target.value);
                        shot.reset(); // the name is printed on the photo
                      }}
                    />
                  </div>
                </label>
              </Card>
            )}
          </>
        )}

        {step === 1 && (
          <PhotoStep
            photo={shot.photo}
            locating={shot.locating}
            error={shot.error}
            onTake={() => void shot.take()}
            intro={unlisted ? t("unlisted_photo_intro") : t("photo_intro_in", { site: site?.siteName ?? "" })}
          />
        )}

        {step === 2 && shot.photo && ready && (
          <>
            <div className="step-intro">
              <h2>{t("confirm_check_in")}</h2>
              <p className="muted">{t("check_details")}</p>
            </div>
            <div className="confirm-top">
              <img src={shot.photo.url} alt="" className="thumb" />
              <div className="grow">
                <b>{siteLabel}</b>
                <span>{unlisted ? <span className="chip warning"><i />{t("unlisted_badge")}</span> : (site?.clientName ?? site?.siteCode)}</span>
              </div>
            </div>
            <Card className="kv-card">
              <KeyValueRow label={t("site")} value={siteLabel} />
              {!unlisted && site?.clientName && <KeyValueRow label={t("client")} value={site.clientName} />}
              {!unlisted && site?.distanceM != null && <KeyValueRow label={t("distance_from_site")} value={fmtDist(site.distanceM)} />}
              <KeyValueRow label={t("photo_taken")} value={fmtTime(new Date(shot.photo.fix.at).toISOString())} />
              <KeyValueRow label={t("location_accuracy")} value={`±${shot.photo.fix.acc} m`} />
            </Card>
            {unlisted && <Card className="intro-card plain">{t("unlisted_confirm_note")}</Card>}
            {submitError && <ErrorBanner onClose={() => setSubmitError(null)}>{submitError}</ErrorBanner>}
          </>
        )}
      </div>

      <div className="flow-footer">
        {step === 0 && (
          <Button disabled={!ready} onClick={() => setStep(1)}>
            {unlisted ? (ready ? t("continue_at", { site: reportedName }) : t("unlisted_err_name")) : site ? t("continue_at", { site: site.siteName }) : t("pick_site")}
          </Button>
        )}
        {step === 1 && (
          <Button disabled={!shot.photo} onClick={() => setStep(2)}>
            {t("continue")}
          </Button>
        )}
        {step === 2 && (
          <Button loading={busy} onClick={() => void submit()}>
            {t("submit_check_in")}
          </Button>
        )}
      </div>
    </div>
  );
}
