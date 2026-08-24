"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@/lib/schemas/user";
import type { OrgWithRole } from "@/lib/schemas/org";
import {
  getCurrentUserAction,
  logoutAction,
  refreshSessionAction,
} from "@/server/actions/authActions";
import { getMyOrgsAction } from "@/server/actions/orgActions";

interface AuthContextValue {
  user: User | null;
  orgs: OrgWithRole[];
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  refresh: () => Promise<void>;
  refreshOrgs: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_REFRESH_MS = 8 * 60 * 1000;

export function AuthProvider({
  initialUser,
  initialOrgs,
  children,
}: {
  initialUser: User | null;
  initialOrgs: OrgWithRole[];
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [orgs, setOrgs] = useState<OrgWithRole[]>(initialOrgs);

  const refreshOrgs = useCallback(async () => {
    const result = await getMyOrgsAction();
    if (result.ok) setOrgs(result.data);
  }, []);

  const refresh = useCallback(async () => {
    const result = await getCurrentUserAction();
    if (result.ok) setUser(result.data);
    await refreshOrgs();
  }, [refreshOrgs]);

  const logout = useCallback(async () => {
    await logoutAction();
    setUser(null);
    setOrgs([]);
  }, []);

  useEffect(() => {
    let active = true;
    const tick = () => {
      void refreshSessionAction().then((result) => {
        if (!active || !result.ok) return;
        if (result.data) setUser(result.data);
        else {
          setUser(null);
          setOrgs([]);
        }
      });
    };
    tick();
    const id = window.setInterval(tick, SESSION_REFRESH_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        orgs,
        isAuthenticated: user !== null,
        setUser,
        refresh,
        refreshOrgs,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
