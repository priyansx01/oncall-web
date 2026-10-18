import { useCallback, useEffect, useState } from "react";
import { loadSession, onExpired, saveSession, setApiSession, type Session } from "./api";
import { hasChosenLang, useLang } from "./i18n";
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

  const signOut = useCallback(() => {
    saveSession(null);
    setApiSession(null);
    setSession(null);
  }, []);

  useEffect(() => {
    onExpired.addEventListener("expired", signOut);
    return () => onExpired.removeEventListener("expired", signOut);
  }, [signOut]);

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
