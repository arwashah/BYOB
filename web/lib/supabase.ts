"use client";

import { createClient } from "@supabase/supabase-js";

// Public keys only (web/.env.local). Never put the service_role / secret key in the app:
// row-level security on public.profiles is what keeps each user to their own row.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// null when the keys aren't set: the app then runs guest-only, exactly as before.
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

// Only show "Continue with Google" once that provider is set up in Supabase.
export const googleEnabled = process.env.NEXT_PUBLIC_SUPABASE_GOOGLE === "on";
