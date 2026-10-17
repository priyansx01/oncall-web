import { useState } from "react";
import { IoArrowBack, IoCheckmarkDone, IoClose } from "react-icons/io5";
import { api, type Attendance, type Reliever } from "../api";
import { fmtMins, fmtTime, message, minutesWorked } from "../lib";
import { Button, Card, ErrorBanner, FlowHeader, IconCircle, KeyValueRow, Stepper } from "../ui";
import { PhotoStep, stampLines, usePhoto } from "./PhotoStep";

const STEPS = ["Take photo", "Confirm"];

export function CheckOutFlow({ reliever, open, onClose, onDone }: { reliever: Reliever; open: Attendance; onClose: () => void; onDone: () => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<Attendance | null>(null);
  const site = open.siteName ?? open.siteCode;
  const shot = usePhoto((f) => stampLines(reliever.oncallCode, reliever.name, site, f));

  const submit = async () => {
    const p = shot.photo;
    if (!p) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const key = await api.uploadPhoto("selfie_out", p.blob);
      setDone(await api.checkOut({ selfieKey: key, latitude: p.fix.lat, longitude: p.fix.lng, accuracy: p.fix.acc }));
      void onDone();
    } catch (e) {
      setSubmitError(message(e, "Check-out failed."));
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
          <h2 className="hero-title">Checked Out</h2>
          <p className="muted">Thanks for today. Operations will check and approve the day.</p>
          <div className="duration-card">
            <span>Total duration</span>
            <b>{fmtMins(minutesWorked(done))}</b>
          </div>
          <Card className="kv-card">
            <KeyValueRow label="Site" value={done.siteName ?? site} />
            <KeyValueRow label="Check-in" value={fmtTime(done.checkInAt)} />
            <KeyValueRow label="Check-out" value={fmtTime(done.checkOutAt)} />
          </Card>
        </div>
        <div className="flow-footer">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flow">
      <FlowHeader title="Check Out" onBack={() => (step === 0 ? onClose() : setStep(0))} icon={step === 0 ? <IoClose size={22} /> : <IoArrowBack size={22} />} />
      <Stepper steps={STEPS} current={step} />

      <div className="flow-body">
        {step === 0 && (
          <PhotoStep
            photo={shot.photo}
            locating={shot.locating}
            error={shot.error}
            onTake={() => void shot.take()}
            intro={`Leaving ${site}. Take a photo at the site as you check out.`}
          />
        )}
        {step === 1 && shot.photo && (
          <>
            <div className="step-intro">
              <h2>Review &amp; submit</h2>
              <p className="muted">Check the details, then check out.</p>
            </div>
            <div className="confirm-top">
              <img src={shot.photo.url} alt="" className="thumb" />
              <div className="grow">
                <b>{site}</b>
                <span>{open.clientName ?? open.siteCode}</span>
              </div>
            </div>
            <Card className="kv-card">
              <KeyValueRow label="Checked in at" value={fmtTime(open.checkInAt)} />
              <KeyValueRow label="Checking out at" value={fmtTime(new Date(shot.photo.fix.at).toISOString())} />
              <KeyValueRow label="Worked" value={fmtMins(minutesWorked({ checkInAt: open.checkInAt, checkOutAt: new Date(shot.photo.fix.at).toISOString() }))} />
              <KeyValueRow label="Location accuracy" value={`±${shot.photo.fix.acc} m`} />
            </Card>
            {submitError && <ErrorBanner onClose={() => setSubmitError(null)}>{submitError}</ErrorBanner>}
          </>
        )}
      </div>

      <div className="flow-footer">
        {step === 0 ? (
          <Button disabled={!shot.photo} onClick={() => setStep(1)}>
            Continue
          </Button>
        ) : (
          <Button variant="danger" loading={busy} onClick={() => void submit()}>
            Submit Check-Out
          </Button>
        )}
      </div>
    </div>
  );
}
