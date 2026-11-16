import { createClient } from '@supabase/supabase-js';

export function readConfig(env: Record<string, string | undefined>) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  try { if (new URL(url).protocol !== 'https:') return null; } catch { return null; }
  return { url, key };
}
const config = readConfig(import.meta.env);
const authStorageKey=config?`sb-${new URL(config.url).hostname.split('.')[0]}-auth-token`:null;
export function hasRememberedSession(userId:string,key=authStorageKey){
 if(!key)return false;
 try{const value=JSON.parse(localStorage.getItem(key)||'null');return value?.user?.id===userId&&typeof value.access_token==='string'&&Boolean(value.access_token)&&typeof value.refresh_token==='string'&&Boolean(value.refresh_token);}
 catch{return false;}
}
export const supabase = config ? createClient(config.url, config.key, {
  auth: { storageKey:authStorageKey!, flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
}) : null;
