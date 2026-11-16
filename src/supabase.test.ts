import { expect, it } from 'vitest';
import { hasRememberedSession, readConfig } from './supabase';
it('no activa Supabase con configuración incompleta o URL inválida', () => {
  expect(readConfig({})).toBeNull();
  expect(readConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toBeNull();
  expect(readConfig({ VITE_SUPABASE_URL: 'javascript:alert(1)', VITE_SUPABASE_ANON_KEY: 'public-test-key' })).toBeNull();
  expect(readConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-test-key' })).toEqual({ url: 'https://example.supabase.co', key: 'public-test-key' });
});

it('solo permite recuperar identidad offline de una sesión recordada de la misma cuenta, aunque toque renovarla',()=>{
 localStorage.setItem('test-auth',JSON.stringify({user:{id:'u'},access_token:'test-access',refresh_token:'test-refresh',expires_at:1}));
 expect(hasRememberedSession('u','test-auth')).toBe(true);expect(hasRememberedSession('other','test-auth')).toBe(false);
 localStorage.removeItem('test-auth');expect(hasRememberedSession('u','test-auth')).toBe(false);
 localStorage.setItem('test-auth','invalid');expect(hasRememberedSession('u','test-auth')).toBe(false);localStorage.removeItem('test-auth');
});
