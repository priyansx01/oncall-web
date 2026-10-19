import { useCallback, useEffect, useState } from "react";
import { loadSession, onExpired, saveSession, setApiSession, type Session } from "./api";
import { hasChosenLang, useLang } from "./i18n";
import { notifyApp } from "./shell";
import { LanguageScreen } from "./screens/LanguagePicker";
import { Main } from "./screens/Main";
import { SignIn } from "./screens/SignIn";
import { ReauthSheet } from "./screens/Reauth";

export function App() {
  const { t } = useLang(); // the whole app re-renders in the new language when it changes
  const [langChosen, setLangChosen] = useState(hasChosenLang);
  const [session, setSession] = useState<Session | null>(() => {
    const s = loadSession();
    setApiSession(s);
    return s;
  });

  // The server refused the token: ask for the code again over the current screen.
  const [reauth, setReauth] = useState(false);
  const [signInNotice, setSignInNotice] = useState<string | null>(null);
  // Signed in from "Join": an unregistered number goes straight to Join, without the notice.
  const [joinIntent, setJoinIntent] = useState(false);
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
    const on = () => setReauth(true);
    onExpired.addEventListener("expired", on);
    return () => onExpired.removeEventListener("expired", on);
  }, []);

  // Already signed in when the page opens (the app was restarted): keep on-call mode on.
  useEffect(() => {
    if (session) notifyApp("signed_in");
  }, [session]);

  if (!langChosen) return <LanguageScreen onDone={() => setLangChosen(true)} />;
  if (!session) {
    return (
      <SignIn
        notice={signInNotice}
        onSignedIn={(s, joining) => {
          setSignInNotice(null);
          setJoinIntent(joining);
          saveSession(s);
          setApiSession(s);
          setSession(s);
        }}
      />
    );
  }
  return (
    <>
      <Main mobile={session.mobile} onSignOut={signOut} joinIntent={joinIntent} />
      {reauth && (
        <ReauthSheet
          mobile={session.mobile}
          onDone={(s) => {
            saveSession(s);
            setApiSession(s);
            setSession(s);
            setReauth(false);
          }}
          onCancel={() => {
            setReauth(false);
            setSignInNotice(t("err_session_expired"));
            dropSession();
          }}
        />
      )}
    </>
  );
}
