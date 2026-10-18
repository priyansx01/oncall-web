import { useCallback, useEffect, useState } from "react";
import { loadSession, onExpired, saveSession, setApiSession, type Session } from "./api";
import { hasChosenLang, useLang } from "./i18n";
import { notifyApp } from "./shell";
import { LanguageScreen } from "./screens/LanguagePicker";
import { Main } from "./screens/Main";
import { SignIn } from "./screens/SignIn";

export function App() {
  useLang(); // the whole app re-renders in the new language when it changes
  const [langChosen, setLangChosen] = useState(hasChosenLang);
  const [session, setSession] = useState<Session | null>(() => {
    const s = loadSession();
    setApiSession(s);
    return s;
  });

  // Token expired: back to sign-in, but the iSmart app stays in on-call mode.
  const dropSession = useCallback(() => {
    saveSession(null);
    setApiSession(null);
    setSession(null);
  }, []);
  // The person chose to leave (Sign out, close Join): the app goes back to its own login.
  const signOut = useCallback(() => {
    dropSession();
    notifyApp("signed_out");
  }, [dropSession]);

  useEffect(() => {
    onExpired.addEventListener("expired", dropSession);
    return () => onExpired.removeEventListener("expired", dropSession);
  }, [dropSession]);

  // Already signed in when the page opens (the app was restarted): keep on-call mode on.
  useEffect(() => {
    if (session) notifyApp("signed_in");
  }, [session]);

  if (!langChosen) return <LanguageScreen onDone={() => setLangChosen(true)} />;
  if (!session) {
    return (
      <SignIn
        onSignedIn={(s) => {
          saveSession(s);
          setApiSession(s);
          setSession(s);
        }}
      />
    );
  }
  return <Main mobile={session.mobile} onSignOut={signOut} />;
}
