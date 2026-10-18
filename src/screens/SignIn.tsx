import { useEffect, useRef, useState } from "react";
import { IoArrowBack, IoCallOutline, IoChatbubbleEllipsesOutline, IoDownloadOutline, IoPersonAddOutline, IoShieldCheckmarkOutline } from "react-icons/io5";
import { api, type Session } from "../api";
import { crumb } from "../crash";
import { useLang } from "../i18n";
import { useInstall } from "../install";
import { message } from "../lib";
import { Button, ErrorBanner } from "../ui";
import { InstallSheet } from "./InstallSheet";
import { LanguageButton } from "./LanguagePicker";

/** Six boxes over one real input, so SMS auto-fill and paste still work. */
function OtpInput({ value, onChange, onDone, label }: { value: string; onChange: (v: string) => void; onDone: (code: string) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(true);
  return (
    <div className="otp" onClick={() => ref.current?.focus()}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={`otp-box${value[i] ? " filled" : ""}${focused && i === Math.min(value.length, 5) ? " active" : ""}`}>
          {value[i] ?? ""}
        </div>
      ))}
      <input
        ref={ref}
        className="otp-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={label}
        autoFocus
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(v);
          if (v.length === 6) onDone(v);
        }}
      />
    </div>
  );
}

/**
 * Mobile + SMS code. The same sign-in serves people who are registered and people who
 * are joining: after the code, the server says which, and the app opens Home or Join.
 */
export function SignIn({ onSignedIn }: { onSignedIn: (s: Session) => void }) {
  const { t } = useLang();
  const install = useInstall();
  const [mode, setMode] = useState<"signin" | "join">("signin");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [installOpen, setInstallOpen] = useState(false);

  useEffect(() => {
    crumb(`screen:signin/${sent ? "otp" : mode}`);
  }, [sent, mode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) return setError(t("err_mobile"));
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
      onSignedIn({ token: r.onboardingToken, mobile: r.mobile || mobile, exp: Date.now() + (Number(r.expiresIn) || 3600) * 1000 });
    } catch (e) {
      setError(message(e, t("err_otp_wrong")));
      setOtp("");
      setBusy(false);
    }
  };

  const saveApp = async () => {
    if (install.canPrompt) await install.prompt();
    else setInstallOpen(true);
  };

  if (sent) {
    return (
      <div className="flow">
        <div className="flow-header">
          <button className="flow-back" onClick={() => (setSent(false), setError(null))} aria-label={t("change_number")} disabled={busy}>
            <IoArrowBack size={22} />
          </button>
          <h1>{t("verify_mobile")}</h1>
          <span className="flow-back ghost" />
        </div>
        <div className="flow-body center-text">
          <div className="icon-circle green" style={{ width: 84, height: 84 }}>
            <IoChatbubbleEllipsesOutline size={36} />
          </div>
          <h2 className="hero-title">{t("otp_title")}</h2>
          <p className="muted">{t("otp_sent_to", { mobile: `+91 ${mobile}` })}</p>
          <OtpInput value={otp} onChange={setOtp} onDone={(code) => !busy && void verify(code)} label={t("otp_title")} />
          {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
          <p className="muted small">
            {cooldown > 0 ? (
              t("otp_resend_in", { s: cooldown })
            ) : (
              <>
                {t("otp_not_received")}{" "}
                <button className="text-btn" onClick={() => void send()} disabled={busy}>
                  {t("otp_resend")}
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flow-footer">
          <Button loading={busy} disabled={otp.length !== 6} onClick={() => void verify()}>
            {t("verify_continue")}
          </Button>
        </div>
      </div>
    );
  }

  const joining = mode === "join";
  return (
    <div className="login">
      <div className="login-hero">
        <span className="circle one" />
        <span className="circle two" />
        <div className="hero-lang">
          <LanguageButton light />
        </div>
        <div className="logo-circle">
          <img src="/logo-white.png" alt="" />
        </div>
        <div className="login-brand">iSmart Facitech</div>
        <div className="login-pill">{t("role_title")}</div>
      </div>

      <div className="login-card">
        <h1>{joining ? t("join_title") : t("welcome")}</h1>
        <p className="muted">{joining ? t("join_intro") : t("signin_intro")}</p>

        <label className="field">
          <span>{t("mobile_label")}</span>
          <div className="input-wrap">
            <IoCallOutline size={20} />
            <b className="prefix">+91</b>
            <input
              inputMode="numeric"
              autoComplete="tel-national"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value.replace(/\D/g, "").slice(-10));
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && void send()}
              placeholder={t("mobile_placeholder")}
            />
          </div>
        </label>

        {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

        <Button loading={busy} disabled={mobile.length !== 10} onClick={() => void send()}>
          {t("send_otp")}
        </Button>

        <div className="secure-note">
          <IoShieldCheckmarkOutline size={16} />
          <span>{t("otp_note")}</span>
        </div>
      </div>

      <div className="login-actions">
        {joining ? (
          <button className="text-btn center" onClick={() => (setMode("signin"), setError(null))}>
            {t("have_account")}
          </button>
        ) : (
          <Button variant="secondary" icon={<IoPersonAddOutline size={18} />} onClick={() => (setMode("join"), setError(null))}>
            {t("join_cta")}
          </Button>
        )}

        {install.show && (
          <div className="save-app">
            <Button variant="ghost" icon={<IoDownloadOutline size={18} />} onClick={() => void saveApp()}>
              {t("save_app")}
            </Button>
            <span>{t("save_app_hint")}</span>
          </div>
        )}
      </div>

      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} install={install} />
    </div>
  );
}
