import { createClient } from "@supabase/supabase-js";

const env = import.meta.env as any;
const supabaseUrl =
  env?.VITE_SUPABASE_URL || "https://qzyvugztkndwpkghncbv.supabase.co";

// Check both key names to prevent passing an empty string
const supabaseAnonKey =
  env?.VITE_SUPABASE_ANON_KEY ||
  env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_xSYDtE0TD0gjRQEgg6z13w_NefjBR-Q";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = "user" | "operator";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

// Real Supabase Signup with Role Metadata
export async function signUpUser(email: string, pass: string, role: UserRole) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: { data: { user_role: role } },
  });
  return { data, error };
}

// Real Supabase Login
export async function signInUser(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  return { data, error };
}

// Fetch current user and role
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || "",
    role: ((user.user_metadata as any)?.user_role as UserRole) || "user",
  };
}

// Sign out
export async function signOutUser() {
  await supabase.auth.signOut();
}

// Real Supabase Google OAuth Login
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  return { data, error };
}