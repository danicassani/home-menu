import { createClient } from '@supabase/supabase-js';

export function readConfig(env: Record<string, string | undefined>) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  try { if (new URL(url).protocol !== 'https:') return null; } catch { return null; }
  return { url, key };
}
const config = readConfig(import.meta.env);
export const supabase = config ? createClient(config.url, config.key, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
}) : null;
