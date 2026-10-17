import { useCallback, useEffect, useState } from "react";
import { loadSession, onExpired, saveSession, setApiSession, type Session } from "./api";
import { Main } from "./screens/Main";
import { Permissions } from "./screens/Permissions";
import { SignIn } from "./screens/SignIn";

const PERMS_KEY = "oncall_perms_v1";

export function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const s = loadSession();
    setApiSession(s);
    return s;
  });
  const [permsOk, setPermsOk] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PERMS_KEY) === "1";
    } catch {
      return false;
    }
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

  const permsDone = useCallback(() => {
    try {
      localStorage.setItem(PERMS_KEY, "1");
    } catch {
      /* ignore */
    }
    setPermsOk(true);
  }, []);

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
  if (!permsOk) return <Permissions onDone={permsDone} />;
  return <Main mobile={session.mobile} onSignOut={signOut} />;
}
