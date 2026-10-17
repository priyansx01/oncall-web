import type { ReactNode } from "react";
import { IoAlertCircle, IoCheckmark, IoClose, IoLocation } from "react-icons/io5";

// Primitives copied from the SmartFM Reliever app's design (src/components/primitives there).

export function Spinner({ dark }: { dark?: boolean }) {
  return <span className={`spin${dark ? " dark" : ""}`} aria-label="Loading" />;
}

type BtnVariant = "primary" | "secondary" | "danger" | "ghost" | "light";
export function Button({
  children,
  variant = "primary",
  loading,
  disabled,
  onClick,
  icon,
  small,
}: {
  children: ReactNode;
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  small?: boolean;
}) {
  return (
    <button className={`btn ${variant}${small ? " small" : ""}`} disabled={disabled || loading} onClick={onClick}>
      {loading ? <Spinner dark={variant === "secondary" || variant === "ghost"} /> : icon}
      <span>{children}</span>
    </button>
  );
}

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return onClick ? (
    <button className={`card press ${className}`} onClick={onClick}>
      {children}
    </button>
  ) : (
    <div className={`card ${className}`}>{children}</div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function StatusChip({ label, tone }: { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }) {
  return (
    <span className={`chip ${tone}`}>
      <i />
      {label}
    </span>
  );
}

export function ErrorBanner({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <IoAlertCircle size={20} />
      <div className="grow">{children}</div>
      {onClose && (
        <button className="icon-plain" onClick={onClose} aria-label="Dismiss">
          <IoClose size={18} />
        </button>
      )}
    </div>
  );
}

export function KeyValueRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="stepper">
      {steps.map((s, i) => (
        <div key={s} className={`step ${i < current ? "done" : i === current ? "active" : ""}`}>
          <div className="step-row">
            {i > 0 && <span className="bar left" />}
            <span className="dot">{i < current ? <IoCheckmark size={15} /> : i + 1}</span>
            {i < steps.length - 1 && <span className="bar right" />}
          </div>
          <span className="step-label">{s}</span>
        </div>
      ))}
    </div>
  );
}

export function LocationSummary({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="loc-summary">
      <IoLocation size={20} />
      <div className="grow">
        <b>{title}</b>
        <span>{sub}</span>
      </div>
    </div>
  );
}

export function IconCircle({ children, tone = "green", size = 72 }: { children: ReactNode; tone?: "green" | "danger" | "solid"; size?: number }) {
  return (
    <div className={`icon-circle ${tone}`} style={{ width: size, height: size }}>
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <IconCircle>{icon}</IconCircle>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

/** Bottom sheet with a dimmed backdrop (the reference ConfirmationSheet). */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        {children}
      </div>
    </div>
  );
}

/** Green header with the soft circles, and the white sheet that overlaps it. */
export function Shell({ header, children, tall }: { header: ReactNode; children: ReactNode; tall?: boolean }) {
  return (
    <div className="shell">
      <header className={`green-header${tall ? " tall" : ""}`}>
        <span className="circle one" />
        <span className="circle two" />
        {header}
      </header>
      <main className="sheet-body">{children}</main>
    </div>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <div className="brand-logo">
        <img src="/logo-white.png" alt="" />
      </div>
      <div>
        <div className="brand-name">SmartFM</div>
        <div className="brand-tag">Safe People · Smart Buildings</div>
      </div>
    </div>
  );
}

/** Top bar for full-screen flows: back/close + title. */
export function FlowHeader({ title, onBack, icon }: { title: string; onBack: () => void; icon: ReactNode }) {
  return (
    <div className="flow-header">
      <button className="flow-back" onClick={onBack} aria-label="Back">
        {icon}
      </button>
      <h1>{title}</h1>
      <span className="flow-back ghost" />
    </div>
  );
}
