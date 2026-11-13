import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const supabaseReady = Boolean(url && key);

// No secret keys in browser code. Dashboard connection errors are visible to the user.
export const supabase = supabaseReady
  ? createClient(url!, key!, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } })
  : null;

export type ZavoBusiness = { id: string; owner_id: string; name: string; currency: string; country: string | null; created_at?: string };