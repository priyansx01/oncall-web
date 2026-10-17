import { useCallback, useEffect, useState } from "react";
import { IoArrowBack, IoBusinessOutline, IoCheckmark, IoClose, IoRefresh, IoSearch, IoShieldCheckmarkOutline } from "react-icons/io5";
import { api, type Attendance, type Reliever, type Site } from "../api";
import { fmtDist, fmtTime, getFix, message, type Fix } from "../lib";
import { Button, Card, ErrorBanner, FlowHeader, IconCircle, KeyValueRow, LocationSummary, Spinner, Stepper } from "../ui";
import { PhotoStep, stampLines, usePhoto } from "./PhotoStep";

const STEPS = ["Choose site", "Take photo", "Confirm"];

export function CheckInFlow({ reliever, onClose, onDone }: { reliever: Reliever; onClose: () => void; onDone: () => Promise<void> }) {
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
  const shot = usePhoto((f) => stampLines(reliever.oncallCode, reliever.name, site?.siteName ?? "", f));

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
    } catch (e) {
      setLocError(message(e, "Couldn't find nearby sites."));
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
      setLocError(message(e, "Search failed."));
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    const p = shot.photo;
    if (!p || !site) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const key = await api.uploadPhoto("selfie_in", p.blob);
      const a = await api.checkIn({ siteCode: site.siteCode, selfieKey: key, latitude: p.fix.lat, longitude: p.fix.lng, accuracy: p.fix.acc });
      setDone(a);
      void onDone();
    } catch (e) {
      setSubmitError(message(e, "Check-in failed."));
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
          <h2 className="hero-title">Checked In Successfully</h2>
          <p className="muted">Have a good day at work. Check out here when you leave.</p>
          <Card className="kv-card">
            <KeyValueRow label="Site" value={done.siteName ?? site?.siteName ?? done.siteCode} />
            {(done.clientName ?? site?.clientName) && <KeyValueRow label="Client" value={done.clientName ?? site?.clientName} />}
            <KeyValueRow label="Checked in at" value={fmtTime(done.checkInAt)} />
            {done.checkInDistanceM != null && <KeyValueRow label="Distance from site" value={fmtDist(done.checkInDistanceM)} />}
            <KeyValueRow label="On-call ID" value={reliever.oncallCode} />
          </Card>
        </div>
        <div className="flow-footer">
          <Button onClick={onClose}>Go to Home</Button>
        </div>
      </div>
    );
  }

  const back = () => (step === 0 ? onClose() : setStep(step - 1));

  return (
    <div className="flow">
      <FlowHeader title="Check In" onBack={back} icon={step === 0 ? <IoClose size={22} /> : <IoArrowBack size={22} />} />
      <Stepper steps={STEPS} current={step} />

      <div className="flow-body">
        {step === 0 && (
          <>
            <Card className="intro-card">
              <IoShieldCheckmarkOutline size={22} />
              <div>
                <b>Site Verification Required</b>
                <span>Pick the site you were sent to. Operations check every check-in against the photo and location.</span>
              </div>
            </Card>

            <LocationSummary
              title={fix ? `Location accurate to ±${fix.acc} m` : locating ? "Finding your location…" : "Location not found"}
              sub={fix ? `Updated at ${fmtTime(new Date(fix.at).toISOString())}` : "GPS must be on"}
            />

            <div className="row-between">
              <h3 className="sub-title">{searched ? "Search results" : "Sites near you"}</h3>
              <button className="text-btn" onClick={() => void locate()} disabled={locating}>
                <IoRefresh size={15} /> Refresh
              </button>
            </div>

            {locError && <ErrorBanner onClose={() => setLocError(null)}>{locError}</ErrorBanner>}
            {locating && !sites && (
              <div className="loading-block">
                <Spinner dark />
                <span>Finding sites near you…</span>
              </div>
            )}
            {sites && sites.length === 0 && <Card className="quiet">No site found within 2 km. Search for it by name below.</Card>}

            <div className="site-list">
              {(sites ?? []).map((s) => {
                const sel = site?.siteCode === s.siteCode;
                return (
                  <button key={s.siteCode} className={`site-option${sel ? " selected" : ""}`} onClick={() => {
                      // The site is printed on the photo, so a different site needs a new photo.
                      if (!sel) shot.reset();
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
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()} placeholder="Not listed? Search site name" />
              <button className="text-btn" onClick={() => void search()} disabled={locating || q.trim().length < 2}>
                Search
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <PhotoStep
            photo={shot.photo}
            locating={shot.locating}
            error={shot.error}
            onTake={() => void shot.take()}
            intro={`At ${site?.siteName ?? "the site"}. Take a clear photo of yourself at the site.`}
          />
        )}

        {step === 2 && shot.photo && site && (
          <>
            <div className="step-intro">
              <h2>Confirm check-in</h2>
              <p className="muted">Check the details, then submit.</p>
            </div>
            <div className="confirm-top">
              <img src={shot.photo.url} alt="" className="thumb" />
              <div className="grow">
                <b>{site.siteName}</b>
                <span>{site.clientName ?? site.siteCode}</span>
              </div>
            </div>
            <Card className="kv-card">
              <KeyValueRow label="Site" value={site.siteName} />
              {site.clientName && <KeyValueRow label="Client" value={site.clientName} />}
              {site.distanceM != null && <KeyValueRow label="Distance from site" value={fmtDist(site.distanceM)} />}
              <KeyValueRow label="Photo taken" value={fmtTime(new Date(shot.photo.fix.at).toISOString())} />
              <KeyValueRow label="Location accuracy" value={`±${shot.photo.fix.acc} m`} />
            </Card>
            {submitError && <ErrorBanner onClose={() => setSubmitError(null)}>{submitError}</ErrorBanner>}
          </>
        )}
      </div>

      <div className="flow-footer">
        {step === 0 && (
          <Button disabled={!site} onClick={() => setStep(1)}>
            {site ? `Continue at ${site.siteName}` : "Pick your site"}
          </Button>
        )}
        {step === 1 && (
          <Button disabled={!shot.photo} onClick={() => setStep(2)}>
            Continue
          </Button>
        )}
        {step === 2 && (
          <Button loading={busy} onClick={() => void submit()}>
            Submit Check-In
          </Button>
        )}
      </div>
    </div>
  );
}
