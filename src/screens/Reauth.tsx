import { useEffect, useState } from "react";
import { IoShieldCheckmarkOutline } from "react-icons/io5";
import { api, type Session } from "../api";
import { useLang } from "../i18n";
import { message } from "../lib";
import { Button, ErrorBanner, IconCircle, Sheet } from "../ui";
import { OtpInput } from "./SignIn";

/**
 * The sign-in ran out (it lasts a day) in the middle of something — say a check-out with the
 * photo already taken. The code is asked for again over the current screen, so nothing on it
 * is lost; Cancel goes back to sign-in.
 */
export function ReauthSheet({ mobile, onDone, onCancel }: { mobile: string; onDone: (s: Session) => void; onCancel: () => void }) {
  const { t } = useLang();
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.sendOtp(mobile);
      setSent(true);
      setOtp("");
      setCooldown(30);
    } catch (e) {
      setError(message(e, t("err_send_otp")));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code = otp) => {
    if (!/^\d{6}$/.test(code)) return setError(t("err_otp"));
    setBusy(true);
    setError(null);
    try {
      const r = await api.verifyOtp(mobile, code);
      onDone({ token: r.onboardingToken, mobile: r.mobile || mobile, exp: Date.now() + (Number(r.expiresIn) || 3600) * 1000 });
    } catch (e) {
      setError(message(e, t("err_otp_wrong")));
      setOtp("");
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={() => !busy && onCancel()}>
      <div className="sheet-head">
        <IconCircle size={64}>
          <IoShieldCheckmarkOutline size={30} />
        </IconCircle>
        <h3>{t("reauth_title")}</h3>
        <p className="muted">{sent ? t("otp_sent_to", { mobile: `+91 ${mobile}` }) : t("reauth_body", { mobile: `+91 ${mobile}` })}</p>
      </div>
      {sent && <OtpInput value={otp} onChange={setOtp} onDone={(code) => !busy && void verify(code)} label={t("otp_title")} />}
      {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
      <div className="sheet-actions">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {t("sign_out")}
        </Button>
        {sent ? (
          <Button loading={busy} disabled={otp.length !== 6} onClick={() => void verify()}>
            {t("verify_continue")}
          </Button>
        ) : (
          <Button loading={busy} onClick={() => void send()}>
            {t("send_otp")}
          </Button>
        )}
      </div>
      {sent && (
        <p className="muted small center-text">
          {cooldown > 0 ? (
            t("otp_resend_in", { s: cooldown })
          ) : (
            <button className="text-btn" onClick={() => void send()} disabled={busy}>
              {t("otp_resend")}
            </button>
          )}
        </p>
      )}
    </Sheet>
  );
}
