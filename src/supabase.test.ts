import { expect, it } from 'vitest';
import { readConfig } from './supabase';
it('no activa Supabase con configuración incompleta o URL inválida', () => {
  expect(readConfig({})).toBeNull();
  expect(readConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toBeNull();
  expect(readConfig({ VITE_SUPABASE_URL: 'javascript:alert(1)', VITE_SUPABASE_ANON_KEY: 'public-test-key' })).toBeNull();
  expect(readConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-test-key' })).toEqual({ url: 'https://example.supabase.co', key: 'public-test-key' });
});
