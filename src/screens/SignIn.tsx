import { useEffect, useRef, useState } from "react";
import { IoArrowBack, IoCallOutline, IoChatbubbleEllipsesOutline, IoShieldCheckmarkOutline } from "react-icons/io5";
import { api, type Session } from "../api";
import { message } from "../lib";
import { Button, ErrorBanner } from "../ui";

/** Six boxes over one real input, so SMS auto-fill and paste still work. */
function OtpInput({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: (code: string) => void }) {
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
        aria-label="6-digit code"
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

export function SignIn({ onSignedIn }: { onSignedIn: (s: Session) => void }) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) return setError("Enter your 10-digit mobile number.");
    setBusy(true);
    setError(null);
    try {
      await api.sendOtp(mobile);
      setSent(true);
      setOtp("");
      setCooldown(30);
    } catch (e) {
      setError(message(e, "Couldn't send the code."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code = otp) => {
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from the SMS.");
    setBusy(true);
    setError(null);
    try {
      const r = await api.verifyOtp(mobile, code);
      onSignedIn({ token: r.onboardingToken, mobile: r.mobile || mobile, exp: Date.now() + (r.expiresIn || 3600) * 1000 });
    } catch (e) {
      setError(message(e, "That code didn't work."));
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="flow">
        <div className="flow-header">
          <button className="flow-back" onClick={() => (setSent(false), setError(null))} aria-label="Change number" disabled={busy}>
            <IoArrowBack size={22} />
          </button>
          <h1>Verify mobile</h1>
          <span className="flow-back ghost" />
        </div>
        <div className="flow-body center-text">
          <div className="icon-circle green" style={{ width: 84, height: 84 }}>
            <IoChatbubbleEllipsesOutline size={36} />
          </div>
          <h2 className="hero-title">Enter verification code</h2>
          <p className="muted">
            We sent a 6-digit code to <b className="ink">+91 {mobile}</b>
          </p>
          <OtpInput value={otp} onChange={setOtp} onDone={(code) => !busy && void verify(code)} />
          {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}
          <p className="muted small">
            {cooldown > 0 ? (
              <>
                Resend code in <b className="green-text">{cooldown}s</b>
              </>
            ) : (
              <>
                Didn&apos;t get it?{" "}
                <button className="text-btn" onClick={() => void send()} disabled={busy}>
                  Resend code
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flow-footer">
          <Button loading={busy} disabled={otp.length !== 6} onClick={() => void verify()}>
            Verify &amp; Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <div className="login-hero">
        <span className="circle one" />
        <span className="circle two" />
        <div className="logo-circle">
          <img src="/logo-white.png" alt="" />
        </div>
        <div className="login-brand">SmartFM</div>
        <div className="login-tag">Safe People · Smart Buildings</div>
        <div className="login-pill">On-call Reliever</div>
      </div>

      <div className="login-card">
        <h1>Welcome Back</h1>
        <p className="muted">Sign in with the mobile number you registered with as an on-call reliever.</p>

        <label className="field">
          <span>Mobile number</span>
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
              placeholder="10-digit mobile number"
            />
          </div>
        </label>

        {error && <ErrorBanner onClose={() => setError(null)}>{error}</ErrorBanner>}

        <Button loading={busy} disabled={mobile.length !== 10} onClick={() => void send()}>
          Send OTP
        </Button>

        <div className="secure-note">
          <IoShieldCheckmarkOutline size={16} />
          <span>We&apos;ll send a one-time code by SMS. No password needed.</span>
        </div>
      </div>
      <p className="login-foot">Not registered? Open the iSmart app and tap On-call, or ask the operations team.</p>
    </div>
  );
}
