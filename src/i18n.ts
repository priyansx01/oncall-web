import { useEffect, useState } from "react";
import en from "./locales/en.json";

// Same 13 languages, in the same order, as the iSmart mobile app's language picker.
export const LANGS = [
  { code: "en", native: "English", english: "English", locale: "en-IN" },
  { code: "hi", native: "हिन्दी", english: "Hindi", locale: "hi-IN" },
  { code: "mr", native: "मराठी", english: "Marathi", locale: "mr-IN" },
  { code: "bn", native: "বাংলা", english: "Bengali", locale: "bn-IN" },
  { code: "ta", native: "தமிழ்", english: "Tamil", locale: "ta-IN" },
  { code: "te", native: "తెలుగు", english: "Telugu", locale: "te-IN" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", locale: "kn-IN" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", locale: "gu-IN" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia", locale: "or-IN" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", locale: "ml-IN" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", locale: "pa-IN" },
  { code: "as", native: "অসমীয়া", english: "Assamese", locale: "as-IN" },
  { code: "raj", native: "राजस्थानी", english: "Rajasthani", locale: "hi-IN" },
] as const;

export type LangCode = (typeof LANGS)[number]["code"];
export type TKey = keyof typeof en;

const KEY = "oncall_lang_v1";
// English ships in the main bundle; every other language is its own small chunk.
const loaders = import.meta.glob<{ default: Record<string, string> }>(["./locales/*.json", "!./locales/en.json"]);

let lang: LangCode = "en";
let dict: Record<string, string> = en;
const bus = new EventTarget();

function saved(): LangCode | null {
  try {
    const v = localStorage.getItem(KEY);
    return LANGS.some((l) => l.code === v) ? (v as LangCode) : null;
  } catch {
    return null;
  }
}

/** True once the person has picked a language (the first-launch picker is skipped after). */
export function hasChosenLang(): boolean {
  return saved() != null;
}

async function load(code: LangCode): Promise<Record<string, string>> {
  if (code === "en") return en;
  const loader = loaders[`./locales/${code}.json`];
  return loader ? (await loader()).default : en;
}

export async function setLang(code: LangCode): Promise<void> {
  try {
    dict = await load(code);
    lang = code;
  } catch {
    dict = en; // offline and the chunk isn't cached yet: English until it loads
    lang = "en";
  }
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* private mode: this visit only */
  }
  document.documentElement.lang = code === "raj" ? "hi" : code;
  bus.dispatchEvent(new Event("change"));
}

/** Loads the saved language before the first render. */
export async function initLang(): Promise<void> {
  const s = saved();
  if (s) {
    if (s !== "en") await setLang(s);
    return;
  }
  // Opened from the iSmart app (?lang=hi): start in the app's language, no picker.
  try {
    const fromApp = new URLSearchParams(location.search).get("lang");
    if (fromApp && LANGS.some((l) => l.code === fromApp)) await setLang(fromApp as LangCode);
  } catch {
    /* ignore */
  }
}

export function currentLang() {
  return LANGS.find((l) => l.code === lang) ?? LANGS[0];
}

/** Intl locale with Latin digits, so times and amounts read the same in every language. */
export function intlLocale(): string {
  return `${currentLang().locale}-u-nu-latn`;
}

export function t(key: TKey, vars?: Record<string, string | number | null | undefined>): string {
  let s = dict[key] ?? (en as Record<string, string>)[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v == null ? "" : String(v));
  return s;
}

/** Re-renders the caller when the language changes. */
export function useLang() {
  const [, bump] = useState(0);
  useEffect(() => {
    const on = () => bump((n) => n + 1);
    bus.addEventListener("change", on);
    return () => bus.removeEventListener("change", on);
  }, []);
  return { lang: currentLang(), setLang, t };
}
