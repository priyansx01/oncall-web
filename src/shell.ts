import { useEffect, useRef } from "react";

// Inside the iSmart mobile app the on-call screens run in a WebView. The app adds
// `?app=android|ios&lang=..` to the first URL and a `OncallApp` JavaScript channel:
// the page tells it when someone signs in / out (so the app opens straight into on-call
// mode next launch) and answers the Android back button. In a browser none of this runs.

declare global {
  interface Window {
    OncallApp?: { postMessage: (message: string) => void };
  }
}

const KEY = "oncall_app_shell";
let shell: string | null = null;
try {
  const p = new URLSearchParams(location.search).get("app");
  if (p) sessionStorage.setItem(KEY, p);
  shell = p ?? sessionStorage.getItem(KEY);
} catch {
  /* storage blocked: the channel check below still works */
}

export function inApp(): boolean {
  return !!shell || typeof window.OncallApp !== "undefined";
}

export type AppMessage = "signed_in" | "signed_out" | "exit";

export function notifyApp(type: AppMessage): void {
  try {
    window.OncallApp?.postMessage(JSON.stringify({ type }));
  } catch {
    /* not in the app */
  }
}

// Back button: the newest open thing (sheet, camera, flow, tab) closes first; with nothing
// open the app is told to leave the screen.
const stack: Array<{ current: () => void }> = [];

if (typeof window !== "undefined") {
  window.addEventListener("oncall-app-back", () => {
    const top = stack[stack.length - 1];
    if (top) top.current();
    else notifyApp("exit");
  });
}

/** While `active`, the app's back button calls `handler` (latest version) instead of leaving. */
export function useBack(handler: () => void, active = true): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const entry = { current: () => ref.current() };
    stack.push(entry);
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}
