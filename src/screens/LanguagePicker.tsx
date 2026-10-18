import { useState } from "react";
import { IoCheckmarkCircle, IoLanguage } from "react-icons/io5";
import { LANGS, setLang, useLang, type LangCode } from "../i18n";
import { Button, IconCircle, Sheet } from "../ui";

function Grid({ value, onPick }: { value: LangCode | null; onPick: (c: LangCode) => void }) {
  return (
    <div className="lang-grid">
      {LANGS.map((l) => (
        <button key={l.code} className={`lang-tile${value === l.code ? " selected" : ""}`} onClick={() => onPick(l.code)}>
          <b>{l.native}</b>
          <span>{l.english}</span>
          {value === l.code && <IoCheckmarkCircle size={20} className="lang-check" />}
        </button>
      ))}
    </div>
  );
}

/** First launch: the language is chosen before anything else is shown. */
export function LanguageScreen({ onDone }: { onDone: () => void }) {
  const { t } = useLang();
  const [pick, setPick] = useState<LangCode | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flow">
      <div className="flow-body">
        <div className="center-text lang-head">
          <IconCircle size={76}>
            <IoLanguage size={36} />
          </IconCircle>
          <h2 className="hero-title">{t("lang_choose")}</h2>
          <p className="muted">भाषा चुनें · ভাষা বেছে নিন · மொழியைத் தேர்ந்தெடுக்கவும்</p>
        </div>
        <Grid
          value={pick}
          onPick={async (c) => {
            setPick(c);
            await setLang(c); // the button below already reads in the chosen language
          }}
        />
      </div>
      <div className="flow-footer">
        <Button
          disabled={!pick}
          loading={busy}
          onClick={async () => {
            if (!pick) return;
            setBusy(true);
            await setLang(pick);
            setBusy(false);
            onDone();
          }}
        >
          {t("continue")}
        </Button>
      </div>
    </div>
  );
}

/** Globe button showing the current language; opens the picker as a sheet. */
export function LanguageButton({ light }: { light?: boolean }) {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`lang-btn${light ? " light" : ""}`} onClick={() => setOpen(true)} aria-label={t("language")}>
        <IoLanguage size={16} />
        <span>{lang.native}</span>
      </button>
      <LanguageSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, t } = useLang();
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="sheet-head">
        <h3>{t("lang_choose")}</h3>
      </div>
      <Grid
        value={lang.code}
        onPick={async (c) => {
          await setLang(c);
          onClose();
        }}
      />
    </Sheet>
  );
}
