import { useState, type ReactNode } from "react";
import { IoCallOutline, IoCardOutline, IoChevronForward, IoDownloadOutline, IoHelpCircleOutline, IoLanguage, IoLogOutOutline } from "react-icons/io5";
import type { Reliever } from "../api";
import type { InstallState } from "../install";
import { useLang } from "../i18n";
import { initials } from "../lib";
import { LanguageSheet } from "./LanguagePicker";
import { Button, IconCircle, Sheet, Shell } from "../ui";

function Row({ icon, label, value, onClick, danger }: { icon: ReactNode; label: string; value?: string; onClick?: () => void; danger?: boolean }) {
  const body = (
    <>
      <div className={`row-icon${danger ? " danger" : ""}`}>{icon}</div>
      <div className="grow">
        <b className={danger ? "danger-text" : ""}>{label}</b>
        {value && <span>{value}</span>}
      </div>
      {onClick && <IoChevronForward size={18} className="chev" />}
    </>
  );
  return onClick ? (
    <button className="menu-row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="menu-row">{body}</div>
  );
}

export function ProfileTab({
  reliever,
  mobile,
  install,
  onInstall,
  onSignOut,
}: {
  reliever: Reliever;
  mobile: string;
  install: InstallState;
  onInstall: () => void;
  onSignOut: () => void;
}) {
  const { t, lang } = useLang();
  const [confirm, setConfirm] = useState(false);
  const [help, setHelp] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  return (
    <Shell
      tall
      header={
        <div className="profile-head">
          <div className="avatar-lg">{initials(reliever.name)}</div>
          <h1>{reliever.name ?? t("role_title")}</h1>
          <div className="id-row center">
            <i className="live-dot" />
            {reliever.oncallCode} · {t("role_title")}
          </div>
        </div>
      }
    >
      <div className="menu-card">
        <Row icon={<IoCardOutline size={20} />} label={t("your_oncall_id")} value={reliever.oncallCode ?? "—"} />
        <Row icon={<IoCallOutline size={20} />} label={t("mobile_label")} value={`+91 ${mobile}`} />
      </div>

      <div className="menu-card">
        <Row icon={<IoLanguage size={20} />} label={t("language")} value={lang.native} onClick={() => setLangOpen(true)} />
        {install.show && <Row icon={<IoDownloadOutline size={20} />} label={t("save_app")} value={t("save_app_hint")} onClick={onInstall} />}
        <Row icon={<IoHelpCircleOutline size={20} />} label={t("how_it_works")} value={t("how_it_works_sub")} onClick={() => setHelp(true)} />
      </div>

      <div className="menu-card">
        <Row icon={<IoLogOutOutline size={20} />} label={t("sign_out")} onClick={() => setConfirm(true)} danger />
      </div>

      <p className="foot-note">iSmart Facitech · {t("role_title")}</p>

      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} />

      <Sheet open={help} onClose={() => setHelp(false)}>
        <div className="sheet-head">
          <IconCircle size={64}>
            <IoHelpCircleOutline size={32} />
          </IconCircle>
          <h3>{t("how_it_works")}</h3>
        </div>
        <ol className="steps">
          <li>{t("help_1")}</li>
          <li>{t("help_2")}</li>
          <li>{t("help_3")}</li>
        </ol>
        <Button onClick={() => setHelp(false)}>{t("got_it")}</Button>
      </Sheet>

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <div className="sheet-head">
          <IconCircle tone="danger" size={64}>
            <IoLogOutOutline size={30} />
          </IconCircle>
          <h3>{t("sign_out_title")}</h3>
          <p className="muted">{t("sign_out_body")}</p>
        </div>
        <div className="sheet-actions">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={onSignOut}>
            {t("sign_out")}
          </Button>
        </div>
      </Sheet>
    </Shell>
  );
}
