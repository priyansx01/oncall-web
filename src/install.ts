import { useEffect, useState } from "react";
import { inApp } from "./shell";

// Chrome / Brave / Edge / Samsung fire `beforeinstallprompt` once the page is installable.
// It can fire before React mounts, so it is caught here at import time and kept.
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: PromptEvent | null = null;
let installedNow = false;
const bus = new EventTarget();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    bus.dispatchEvent(new Event("change"));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    bus.dispatchEvent(new Event("change"));
  });
}

export function isStandalone(): boolean {
  return (
    installedNow ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export type InstallState = {
  /** false once running as the installed app */
  show: boolean;
  /** the browser's own install dialog is available */
  canPrompt: boolean;
  ios: boolean;
  prompt: () => Promise<boolean>;
};

export function useInstall(): InstallState {
  const [, bump] = useState(0);
  useEffect(() => {
    const on = () => bump((n) => n + 1);
    bus.addEventListener("change", on);
    return () => bus.removeEventListener("change", on);
  }, []);
  return {
    // Inside the iSmart app there is nothing to install.
    show: !isStandalone() && !inApp(),
    canPrompt: !!deferred,
    ios: isIOS(),
    prompt: async () => {
      const p = deferred;
      if (!p) return false;
      deferred = null;
      await p.prompt();
      const { outcome } = await p.userChoice;
      bus.dispatchEvent(new Event("change"));
      return outcome === "accepted";
    },
  };
}
