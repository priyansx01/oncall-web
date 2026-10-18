import { IoAddCircleOutline, IoDownloadOutline, IoEllipsisVertical, IoShareOutline } from "react-icons/io5";
import { useLang } from "../i18n";
import type { InstallState } from "../install";
import { Button, Card, IconCircle, Sheet } from "../ui";

/** What "Save app on phone" does when the browser gives no install dialog of its own. */
export function InstallSheet({ open, onClose, install }: { open: boolean; onClose: () => void; install: InstallState }) {
  const { t } = useLang();
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="sheet-head">
        <IconCircle size={64}>
          <IoDownloadOutline size={30} />
        </IconCircle>
        <h3>{t("install_title")}</h3>
        <p className="muted">{t("install_body")}</p>
      </div>
      {install.ios ? (
        <ol className="steps">
          <li>{t("ios_step1")}</li>
          <li>
            <span>
              <IoShareOutline className="inline-icon" /> {t("ios_step2")}
            </span>
          </li>
          <li>
            <span>
              <IoAddCircleOutline className="inline-icon" /> {t("ios_step3")}
            </span>
          </li>
        </ol>
      ) : (
        <ol className="steps">
          <li>
            <span>
              <IoEllipsisVertical className="inline-icon" /> {t("android_step1")}
            </span>
          </li>
          <li>{t("android_step2")}</li>
          <li>{t("android_step3")}</li>
        </ol>
      )}
      {!install.ios && (
        <Card className="note">
          <span className="muted small">{t("install_chrome_hint")}</span>
        </Card>
      )}
      <Button onClick={onClose}>{t("got_it")}</Button>
    </Sheet>
  );
}
