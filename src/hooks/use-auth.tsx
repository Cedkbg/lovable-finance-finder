import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  company: string | null;
  preferred_theme: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authUser: User) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Failed to fetch profile:", error.message);
      setProfile(null);
      return;
    }

    if (data) {
      setProfile(data as Profile);
      return;
    }

    const fallbackName =
      typeof authUser.user_metadata?.full_name === "string"
        ? authUser.user_metadata.full_name
        : authUser.email ?? null;

    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert({
        user_id: authUser.id,
        display_name: fallbackName,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Failed to create profile:", insertError.message);
      setProfile(null);
      return;
    }

    setProfile(inserted as Profile);
  };

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    await fetchProfile(user);
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setTimeout(() => fetchProfile(nextSession.user), 0);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        fetchProfile(currentSession.user);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
