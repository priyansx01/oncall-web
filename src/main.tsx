import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installGlobalHandlers } from "./crash";
import { ErrorBoundary } from "./ErrorBoundary";
import { initLang } from "./i18n";
import "./install"; // catches `beforeinstallprompt` before the app mounts
import "./styles.css";

installGlobalHandlers();

void initLang().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
