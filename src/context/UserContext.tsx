"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as fbSignOut, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  group_id?: string;
  role?: "admin" | "member";
}

interface UserContextType {
  user: FirebaseUser | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  forceRefreshProfile?: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch latest profile
  const fetchProfile = async (uid: string) => {
    const { data, error } = await supabase.from("profiles").select().eq("id", uid).single();
    if (!error) setProfile(data);
    else { setProfile(null); }
    return { data, error };
  };

  // Expose a way to force refresh profile (for workspace setup, etc.)
  const forceRefreshProfile = async () => {
    if (user?.uid) await fetchProfile(user.uid);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Upsert profile in Supabase
        await supabase
          .from("profiles")
          .upsert({
            id: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || "",
            avatar_url: firebaseUser.photoURL || null,
          });
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await fbSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  return (
    <UserContext.Provider value={{ user, profile, loading, signOut, forceRefreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
} 