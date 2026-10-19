import { useEffect, useRef, useState } from "react";
import {
  IoCamera,
  IoCheckmark,
  IoBusinessOutline,
  IoCheckmarkCircle,
  IoClose,
  IoDocumentAttachOutline,
  IoImageOutline,
  IoLocationOutline,
  IoRefresh,
} from "react-icons/io5";
import { ApiError, api, type BankCheck, type Reliever } from "../api";
import { CameraScreen, shrinkImage } from "../camera";
import { crumb } from "../crash";
import { useLang, type TKey } from "../i18n";
import { fmtStamp, getFix, message, type Fix } from "../lib";
import { Button, Card, ErrorBanner, FlowHeader, IconCircle, KeyValueRow, Sheet, Stepper } from "../ui";
import { markPermissionsGranted } from "./Permissions";

/** 0 name · 1 Aadhaar · 2 bank + passbook · 3 photo · 4 done — the same rule as the mobile app. */
function stepOf(r: Reliever | null): number {
  if (!r || !r.name || !r.gender) return 0;
  if (r.status !== "draft") return 4;
  if (!r.aadhaarStatus) return 1;
  if (!r.bankStatus || !r.passbookKey) return 2;
  return 3;
}

const MAX_DOC_BYTES = 10 * 1024 * 1024;

/**
 * Registration as an on-call reliever, after the mobile is verified by OTP:
 * name → Aadhaar (verified) → bank account (verified) + passbook → geo-tagged photo → ON id.
 * The server keeps the draft, so someone who comes back later lands on the first unfinished step.
 */
export function Join({
  initial,
  mobile,
  onFinished,
  onSignOut,
}: {
  initial: Reliever | null;
  mobile: string;
  /** Resolves true once the app has the new registration; false when that reload failed. */
  onFinished: () => Promise<boolean>;
  onSignOut: () => void;
}) {
  const { t } = useLang();
  const [r, setR] = useState<Reliever | null>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // After a successful bank check: the bank's answer, shown for the person to confirm.
  const [bankCheck, setBankCheck] = useState<BankCheck | null>(null);
  const [editBank, setEditBank] = useState(false);
  const step = stepOf(r);

  useEffect(() => {
    crumb(`screen:join/${step}`);
    window.scrollTo(0, 0);
  }, [step]);

  const run = async (key: string, fn: () => Promise<Reliever | void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const next = await fn();
      if (next) {
        setR(next);
        if (next.kycMessage) setNotice(next.kycMessage);
      }
    } catch (e) {
      const code = e instanceof ApiError ? (e.data?.["oncallCode"] as string | undefined) : undefined;
      setError(code && e instanceof ApiError && e.status === 409 ? t("join_already_registered", { code }) : message(e, t("err_generic")));
    } finally {
      setBusy(null);
    }
  };

  if (step === 4 && r) {
    return (
      <div className="flow">
        <div className="flow-body center-text">
          <div className="success-ring">
            <IconCircle tone="solid" size={92}>
              <IoCheckmark size={48} />
            </IconCircle>
          </div>
          <h2 className="hero-title">{r.status === "inactive" ? t("inactive_title") : t("join_done_title")}</h2>
          <div className="oncall-id-card">
            <span>{t("your_oncall_id")}</span>
            <b>{r.oncallCode}</b>
            <em>{r.name}</em>
          </div>
          <p className="muted">{r.status === "inactive" ? t("inactive_body", { code: r.oncallCode }) : t("join_done_body")}</p>
        </div>
        <div className="flow-footer">
          {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
          <Button
            loading={busy === "finish"}
            onClick={async () => {
              setBusy("finish");
              setError(null);
              const ok = await onFinished();
              setBusy(null);
              if (!ok) setError(t("err_load"));
            }}
          >
            {t("continue")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flow">
      <FlowHeader title={t("join_title")} onBack={onSignOut} icon={<IoClose size={22} />} />
      <Stepper steps={[t("s_name"), t("s_aadhaar"), t("s_bank"), t("s_photo")]} current={step} />
      <div className="flow-body">
        {step === 0 && !r && <Card className="intro-card plain">{t("join_not_registered", { mobile: `+91 ${mobile}` })}</Card>}
        {initial?.status === "draft" && step === stepOf(initial) && (
          <Card className="intro-card plain">{t("join_resume", { n: Math.max(1, 4 - step) })}</Card>
        )}
        {step === 0 && <NameStep r={r} busy={busy} onSave={(b) => run("name", () => api.updateMe(b))} mobile={mobile} />}
        {step === 1 && <AadhaarStep busy={busy} onVerify={(no) => run("aadhaar", () => api.verifyAadhaar(no))} />}
        {step === 2 && r && (
          <BankStep
            r={r}
            busy={busy}
            editing={editBank}
            onEdit={() => setEditBank(true)}
            onCancelEdit={() => setEditBank(false)}
            onVerify={(b) =>
              run("bank", async () => {
                const res = await api.verifyBank(b);
                setEditBank(false);
                if (res.bankCheck) setBankCheck(res.bankCheck);
                return res;
              })
            }
            onPassbook={(blob, ext, mime) =>
              run("passbook", async () => {
                const key = await api.uploadDoc("passbook", blob, ext, mime);
                return api.updateMe({ passbookKey: key });
              })
            }
            onError={setError}
          />
        )}
        {step === 3 && r && (
          <PhotoJoinStep
            r={r}
            mobile={mobile}
            busy={busy}
            onSave={(blob) =>
              run("photo", async () => {
                const key = await api.uploadDoc("photo", blob, "jpg", "image/jpeg");
                markPermissionsGranted(); // location + camera were just used
                return api.updateMe({ photoKey: key });
              })
            }
            onFinish={() => run("finish", () => api.complete())}
          />
        )}
        {notice && <Card className="intro-card plain">{notice}</Card>}
        {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      </div>
      <BankConfirmSheet
        check={bankCheck}
        accountNo={r?.accountNo ?? null}
        name={r?.name ?? null}
        onYes={() => setBankCheck(null)}
        onNo={() => {
          setBankCheck(null);
          setEditBank(true);
        }}
      />
    </div>
  );
}

/** True when the bank's account holder shares at least one name word with the Aadhaar name. */
function namesMatch(a: string | null, b: string | null): boolean {
  const words = (s: string | null) => new Set((s ?? "").toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter((w) => w.length > 1));
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return true; // nothing to compare: don't alarm
  for (const w of x) if (y.has(w)) return true;
  return false;
}

/** "Is this your bank account?" — what the bank returned, confirmed by the person before going on. */
function BankConfirmSheet({
  check,
  accountNo,
  name,
  onYes,
  onNo,
}: {
  check: BankCheck | null;
  accountNo: string | null;
  name: string | null;
  onYes: () => void;
  onNo: () => void;
}) {
  const { t } = useLang();
  if (!check) return null;
  const place = [check.city, check.state].filter(Boolean).join(", ");
  const mismatch = !namesMatch(check.accountHolder, name);
  return (
    <Sheet open onClose={onYes}>
      <div className="sheet-head">
        <IconCircle size={64}>
          <IoBusinessOutline size={30} />
        </IconCircle>
        <h3>{t("bank_confirm_title")}</h3>
        <p className="muted">{t("bank_confirm_body")}</p>
      </div>
      {check.accountHolder && (
        <div className="holder-card">
          <span>{t("bank_holder")}</span>
          <b>{check.accountHolder}</b>
        </div>
      )}
      <Card className="kv-card">
        {check.bankName && <KeyValueRow label={t("bank_name")} value={check.bankName} />}
        {check.branch && <KeyValueRow label={t("bank_branch")} value={check.branch} />}
        {place && <KeyValueRow label={t("bank_city")} value={place} />}
        <KeyValueRow label={t("oc_ifsc_label")} value={check.ifsc} />
        {accountNo && <KeyValueRow label={t("oc_acc_label")} value={`•••• ${accountNo.slice(-4)}`} />}
      </Card>
      {mismatch && <ErrorBanner>{t("bank_name_mismatch", { name })}</ErrorBanner>}
      <div className="sheet-actions">
        <Button variant="secondary" onClick={onNo}>
          {t("bank_no_change")}
        </Button>
        <Button onClick={onYes}>{t("bank_yes_mine")}</Button>
      </div>
    </Sheet>
  );
}

function NameStep({ r, busy, onSave, mobile }: { r: Reliever | null; busy: string | null; onSave: (b: { name: string; gender: string; dob?: string }) => void; mobile: string }) {
  const { t } = useLang();
  const [name, setName] = useState(r?.name ?? "");
  const [gender, setGender] = useState(r?.gender ?? "");
  const [dob, setDob] = useState(r?.dob ?? "");
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const next = () => {
    if (name.trim().length < 2) return setErr(t("oc_err_name"));
    if (!gender) return setErr(t("oc_err_gender"));
    setErr(null);
    onSave({ name: name.trim(), gender, ...(dob ? { dob } : {}) });
  };

  return (
    <>
      <div className="step-intro">
        <h2>{t("oc_name_title")}</h2>
        <p className="muted">{t("oc_name_intro", { mobile })}</p>
      </div>
      <label className="field">
        <span>{t("oc_name_label")}</span>
        <div className="input-wrap">
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoCapitalize="words" />
        </div>
      </label>
      <div className="field">
        <span>{t("oc_gender_label")}</span>
        <div className="chips">
          {(["male", "female", "other"] as const).map((g) => (
            <button key={g} className={`chip-btn${gender === g ? " on" : ""}`} onClick={() => setGender(g)}>
              {gender === g && <IoCheckmark size={15} />} {t(`oc_gender_${g}` as TKey)}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>{t("oc_dob_label")}</span>
        <div className="input-wrap">
          <input type="date" value={dob} max={today} onChange={(e) => setDob(e.target.value)} />
        </div>
      </label>
      {err && <ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner>}
      <Button loading={busy === "name"} onClick={next}>
        {t("next")}
      </Button>
    </>
  );
}

function AadhaarStep({ busy, onVerify }: { busy: string | null; onVerify: (no: string) => void }) {
  const { t } = useLang();
  const [no, setNo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const shown = no.replace(/(\d{4})(?=\d)/g, "$1 ");
  return (
    <>
      <div className="step-intro">
        <h2>{t("oc_aadhaar_title")}</h2>
        <p className="muted">{t("oc_aadhaar_intro")}</p>
      </div>
      <label className="field">
        <span>{t("s_aadhaar")}</span>
        <div className="input-wrap big">
          <input
            inputMode="numeric"
            value={shown}
            placeholder="1234 5678 9012"
            onChange={(e) => {
              setNo(e.target.value.replace(/\D/g, "").slice(0, 12));
              setErr(null);
            }}
          />
        </div>
      </label>
      {err && <ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner>}
      <Button
        loading={busy === "aadhaar"}
        disabled={no.length !== 12}
        onClick={() => (no.length === 12 ? onVerify(no) : setErr(t("oc_err_aadhaar")))}
      >
        {t("oc_verify_aadhaar")}
      </Button>
    </>
  );
}

function BankStep({
  r,
  busy,
  editing,
  onEdit,
  onCancelEdit,
  onVerify,
  onPassbook,
  onError,
}: {
  r: Reliever;
  busy: string | null;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onVerify: (b: { accountNo: string; ifsc: string }) => void;
  onPassbook: (blob: Blob, ext: string, mime: string) => void;
  onError: (m: string) => void;
}) {
  const { t } = useLang();
  const [acc, setAcc] = useState("");
  const [acc2, setAcc2] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const verify = () => {
    if (!/^\d{9,18}$/.test(acc)) return setErr(t("oc_err_acc"));
    if (acc !== acc2) return setErr(t("oc_err_acc_match"));
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return setErr(t("oc_err_ifsc"));
    setErr(null);
    onVerify({ accountNo: acc, ifsc });
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        if (f.size > MAX_DOC_BYTES) return onError(t("err_file_big"));
        return onPassbook(f, "pdf", "application/pdf");
      }
      onPassbook(await shrinkImage(f), "jpg", "image/jpeg");
    } catch {
      onError(t("err_file_read"));
    }
  };

  if (!r.bankStatus || editing) {
    return (
      <>
        <div className="step-intro">
          <h2>{t("oc_bank_title")}</h2>
          <p className="muted">{t("oc_bank_intro")}</p>
        </div>
        <label className="field">
          <span>{t("oc_acc_label")}</span>
          <div className="input-wrap">
            <input inputMode="numeric" value={acc} onChange={(e) => setAcc(e.target.value.replace(/\D/g, "").slice(0, 18))} />
          </div>
        </label>
        <label className="field">
          <span>{t("oc_acc2_label")}</span>
          <div className="input-wrap">
            <input inputMode="numeric" value={acc2} onChange={(e) => setAcc2(e.target.value.replace(/\D/g, "").slice(0, 18))} />
          </div>
        </label>
        <label className="field">
          <span>{t("oc_ifsc_label")}</span>
          <div className="input-wrap">
            <input
              value={ifsc}
              placeholder="SBIN0001234"
              autoCapitalize="characters"
              onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
            />
          </div>
        </label>
        {err && <ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner>}
        <Button loading={busy === "bank"} onClick={verify}>
          {t("oc_verify_bank")}
        </Button>
        {editing && r.bankStatus && (
          <Button variant="ghost" disabled={busy === "bank"} onClick={onCancelEdit}>
            {t("cancel")}
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      <div className="step-intro">
        <h2>{t("oc_passbook_label")}</h2>
        <p className="muted">{t("oc_passbook_hint")}</p>
      </div>
      <Card className="kv-card">
        <KeyValueRow label={t("oc_acc_label")} value={r.accountNo ? `•••• ${r.accountNo.slice(-4)}` : "—"} />
        <KeyValueRow label={t("oc_ifsc_label")} value={r.ifsc ?? "—"} />
        {r.accountHolder && <KeyValueRow label={t("bank_holder")} value={r.accountHolder} />}
        {r.bankName && <KeyValueRow label={t("bank_name")} value={r.bankName} />}
        <KeyValueRow
          label={t("s_bank")}
          value={
            <span className="ok-text">
              <IoCheckmarkCircle size={15} /> {r.bankStatus === "verified" ? t("oc_bank_verified") : t("oc_bank_manual")}
            </span>
          }
        />
      </Card>
      <button className="text-btn center-self" onClick={onEdit} disabled={!!busy}>
        {t("change_account")}
      </button>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ""))} />
      <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ""))} />
      <div className="two-btns">
        <Button loading={busy === "passbook"} icon={<IoCamera size={18} />} onClick={() => cameraInput.current?.click()}>
          {t("take_photo")}
        </Button>
        <Button variant="secondary" disabled={busy === "passbook"} icon={<IoDocumentAttachOutline size={18} />} onClick={() => fileInput.current?.click()}>
          {t("choose_file")}
        </Button>
      </div>
    </>
  );
}

function PhotoJoinStep({
  r,
  mobile,
  busy,
  onSave,
  onFinish,
}: {
  r: Reliever;
  mobile: string;
  busy: string | null;
  onSave: (blob: Blob) => void;
  onFinish: () => void;
}) {
  const { t } = useLang();
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; url: string; saved: boolean } | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview.url)), [preview?.url]); // eslint-disable-line react-hooks/exhaustive-deps
  // The server took the photo: the preview on screen is now the saved one.
  useEffect(() => {
    if (r.photoKey) setPreview((p) => (p && !p.saved ? { ...p, saved: true } : p));
  }, [r.photoKey]);

  const open = async () => {
    setLocating(true);
    setErr(null);
    try {
      setFix(await getFix()); // the photo is geo-tagged: no location, no photo
    } catch (e) {
      setErr(message(e, t("err_location_failed")));
    } finally {
      setLocating(false);
    }
  };

  if (fix) {
    return (
      <CameraScreen
        title={t("oc_photo_title")}
        stampLines={[`+91 ${mobile} · ${r.name ?? ""}`, "On-call registration", fmtStamp(new Date(fix.at)), `${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}  ±${fix.acc} m`]}
        onCancel={() => setFix(null)}
        onShot={(blob) => {
          setPreview({ blob, url: URL.createObjectURL(blob), saved: false });
          setFix(null);
        }}
      />
    );
  }

  const pending = !!preview && !preview.saved;
  const saved = !!r.photoKey && !pending;
  return (
    <>
      <div className="step-intro">
        <h2>{t("oc_photo_title")}</h2>
        <p className="muted">{t("oc_photo_intro")}</p>
      </div>
      {preview ? (
        <div className="selfie-preview">
          <img src={preview.url} alt="" />
        </div>
      ) : (
        <button className="photo-placeholder" onClick={() => void open()} disabled={locating}>
          <div className="ph-icon">{locating ? <span className="spin" /> : saved ? <IoCheckmarkCircle size={34} /> : <IoCamera size={34} />}</div>
          <b>{locating ? t("getting_location") : saved ? t("oc_photo_saved") : t("oc_take_selfie")}</b>
          <span>
            <IoLocationOutline size={13} /> {t("photo_geotag_note")}
          </span>
        </button>
      )}
      {err && <ErrorBanner onClose={() => setErr(null)}>{err}</ErrorBanner>}

      {preview && pending && (
        <div className="two-btns">
          <Button variant="secondary" icon={<IoRefresh size={18} />} disabled={busy === "photo"} onClick={() => (setPreview(null), void open())}>
            {t("oc_retake")}
          </Button>
          <Button loading={busy === "photo"} icon={<IoImageOutline size={18} />} onClick={() => onSave(preview.blob)}>
            {t("use_photo")}
          </Button>
        </div>
      )}
      {saved && (
        <>
          <Button variant="secondary" icon={<IoRefresh size={18} />} disabled={!!busy} onClick={() => (setPreview(null), void open())}>
            {t("oc_retake")}
          </Button>
          <Button loading={busy === "finish"} onClick={onFinish}>
            {t("oc_finish")}
          </Button>
        </>
      )}
    </>
  );
}
