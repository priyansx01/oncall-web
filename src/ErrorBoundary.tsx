import { Component, type ReactNode } from "react";
import { IoRefresh, IoWarningOutline } from "react-icons/io5";
import { reportError } from "./crash";
import { t } from "./i18n";

/** Instead of a blank page: a short message, a reload button, and a report to Crash reports. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError(error, "react");
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flow">
        <div className="flow-body center-text">
          <div className="icon-circle danger" style={{ width: 84, height: 84 }}>
            <IoWarningOutline size={38} />
          </div>
          <h2 className="hero-title">{t("crash_title")}</h2>
          <p className="muted">{t("crash_body")}</p>
        </div>
        <div className="flow-footer">
          <button className="btn primary" onClick={() => location.reload()}>
            <IoRefresh size={18} />
            <span>{t("reload")}</span>
          </button>
        </div>
      </div>
    );
  }
}
