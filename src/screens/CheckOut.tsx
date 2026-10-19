import { useState } from "react";
import { IoArrowBack, IoCheckmarkDone, IoClose, IoWarningOutline } from "react-icons/io5";
import { useLang } from "../i18n";
import { useBack } from "../shell";
import { api, ApiError, type Attendance, type Me, type Reliever } from "../api";
import { PHOTO_MAX_AGE_MS, fmtMins, fmtTime, message, minutesWorked } from "../lib";
import { Button, Card, ErrorBanner, FlowHeader, IconCircle, KeyValueRow, Stepper } from "../ui";
import { PhotoStep, stampLines, usePhoto } from "./PhotoStep";
import { useUploadOnce } from "./useUploadOnce";


/** onDone reloads the person's days and returns them (null when the reload failed). */
export function CheckOutFlow({ reliever, open, onClose, onDone }: { reliever: Reliever; open: Attendance; onClose: () => void; onDone: () => Promise<Me | null> }) {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<Attendance | null>(null);
  const site = open.siteName ?? open.siteCode;
  useBack(() => (busy ? undefined : done || step === 0 ? onClose() : setStep(0)));
  const shot = usePhoto((f) => stampLines(reliever.oncallCode, reliever.name, site, f));
  const upload = useUploadOnce("selfie_out");

  const submit = async () => {
    const p = shot.photo;
    if (!p) return;
    if (Date.now() - p.fix.at > PHOTO_MAX_AGE_MS) {
      shot.reset();
      setStep(0);
      shot.setError(t("err_photo_old"));
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      const key = await upload(p.blob);
      setDone(await api.checkOut({ selfieKey: key, latitude: p.fix.lat, longitude: p.fix.lng, accuracy: p.fix.acc, photoSource: p.source }));
      void onDone();
    } catch (e) {
      // A timeout or "not checked in" may mean this check-out was saved (slow network) or the
      // day was closed meanwhile: look before showing an error.
      const status = e instanceof ApiError ? e.status : undefined;
      if (status === 409 || status === undefined || status >= 500) {
        const me = await onDone();
        const row = me?.recent.find((a) => a.id === open.id);
        if (row?.checkOutAt) {
          setDone(row);
          return;
        }
      }
      setSubmitError(message(e, t("err_check_out")));
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
              <IoCheckmarkDone size={46} />
            </IconCircle>
          </div>
          <h2 className="hero-title">{t("checked_out_title")}</h2>
          <p className="muted">{t("checked_out_body")}</p>
          <div className="duration-card">
            <span>{t("total_duration")}</span>
            <b>{fmtMins(minutesWorked(done))}</b>
          </div>
          <Card className="kv-card">
            <KeyValueRow label={t("site")} value={done.siteName ?? site} />
            <KeyValueRow label={t("check_in")} value={fmtTime(done.checkInAt)} />
            <KeyValueRow label={t("check_out")} value={fmtTime(done.checkOutAt)} />
          </Card>
        </div>
        <div className="flow-footer">
          <Button onClick={onClose}>{t("done")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flow">
      <FlowHeader title={t("check_out")} onBack={() => (busy ? undefined : step === 0 ? onClose() : setStep(0))} icon={step === 0 ? <IoClose size={22} /> : <IoArrowBack size={22} />} />
      <Stepper steps={[t("step_photo"), t("step_confirm")]} current={step} />

      <div className="flow-body">
        {step === 0 && (
          <PhotoStep
            photo={shot.photo}
            locating={shot.locating}
            error={shot.error}
            onTake={() => void shot.take()}
            intro={t("photo_intro_out", { site })}
          />
        )}
        {step === 1 && shot.photo && (
          <>
            <div className="step-intro">
              <h2>{t("review_submit")}</h2>
              <p className="muted">{t("check_details_out")}</p>
            </div>
            <div className="confirm-top">
              <img src={shot.photo.url} alt="" className="thumb" />
              <div className="grow">
                <b>{site}</b>
                <span>{open.clientName ?? open.siteCode}</span>
              </div>
            </div>
            <Card className="kv-card">
              <KeyValueRow label={t("checked_in_at_label")} value={fmtTime(open.checkInAt)} />
              <KeyValueRow label={t("checking_out_at")} value={fmtTime(new Date(shot.photo.fix.at).toISOString())} />
              <KeyValueRow label={t("worked")} value={fmtMins(minutesWorked({ checkInAt: open.checkInAt, checkOutAt: new Date(shot.photo.fix.at).toISOString() }))} />
              <KeyValueRow label={t("location_accuracy")} value={`±${shot.photo.fix.acc} m`} />
            </Card>
            {shot.photo.source === "file" && (
              <Card className="warn-card">
                <IoWarningOutline size={20} />
                <span>{t("photo_from_phone_note")}</span>
              </Card>
            )}
            {submitError && <ErrorBanner onClose={() => setSubmitError(null)}>{submitError}</ErrorBanner>}
          </>
        )}
      </div>

      <div className="flow-footer">
        {step === 0 ? (
          <Button disabled={!shot.photo} onClick={() => setStep(1)}>
            {t("continue")}
          </Button>
        ) : (
          <Button variant="danger" loading={busy} onClick={() => void submit()}>
            {t("submit_check_out")}
          </Button>
        )}
      </div>
    </div>
  );
}
