import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase.generated';

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// Both values are browser-safe configuration. Never put a service-role/secret
// key here: the database enforces tenant membership with Row Level Security.
export const supabase =
  projectUrl && publishableKey
    ? createClient<Database>(projectUrl, publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
