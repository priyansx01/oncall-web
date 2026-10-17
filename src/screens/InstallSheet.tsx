import { IoAddCircleOutline, IoDownloadOutline, IoEllipsisVertical, IoShareOutline } from "react-icons/io5";
import type { InstallState } from "../install";
import { Button, Card, IconCircle, Sheet } from "../ui";

/** What "Install" does when the browser gives no install dialog of its own. */
export function InstallSheet({ open, onClose, install }: { open: boolean; onClose: () => void; install: InstallState }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="sheet-head">
        <IconCircle size={64}>
          <IoDownloadOutline size={30} />
        </IconCircle>
        <h3>Install SmartFM Reliever</h3>
        <p className="muted">Add the app to your home screen. It opens full screen, like any other app.</p>
      </div>
      {install.ios ? (
        <ol className="steps">
          <li>
            Open this page in <b>Safari</b>.
          </li>
          <li>
            Tap <IoShareOutline className="inline-icon" /> <b>Share</b> at the bottom of the screen.
          </li>
          <li>
            Scroll down and tap <IoAddCircleOutline className="inline-icon" /> <b>Add to Home Screen</b>, then <b>Add</b>.
          </li>
        </ol>
      ) : (
        <ol className="steps">
          <li>
            Tap the browser menu <IoEllipsisVertical className="inline-icon" /> (top right).
          </li>
          <li>
            Tap <b>Install app</b> or <b>Add to Home screen</b>.
          </li>
          <li>
            Tap <b>Install</b>. The SmartFM Reliever icon appears on your home screen.
          </li>
        </ol>
      )}
      {!install.ios && (
        <Card className="note">
          <span className="muted small">Don&apos;t see it? Open oncall.ismartfacitech.com in Google Chrome and try again.</span>
        </Card>
      )}
      <Button onClick={onClose}>Got it</Button>
    </Sheet>
  );
}
