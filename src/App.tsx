import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import Household from './Household';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const connected = () => setOnline(navigator.onLine);
    window.addEventListener('online', connected);
    window.addEventListener('offline', connected);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', connected); };
  }, []);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let authChanged = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      if (active) { authChanged = true; setSession(next); setLoading(false); }
    });
    void client.auth.getSession().then(({ data, error: authError }) => {
      if (!active) return;
      if (!authChanged) setSession(data.session);
      if (authError) setError('No hemos podido recuperar tu sesión. Vuelve a intentarlo.');
      setLoading(false);
    }).catch(() => { if (active) { setError('No hemos podido conectar con el servicio de acceso.'); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  async function signIn() {
    if (!supabase || busy || !online) return;
    setBusy(true); setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
      if (authError) throw authError;
    } catch { setError('No se ha podido abrir Google. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true); setError('');
    try {
      const { error: authError } = await supabase.auth.signOut();
      if (authError) throw authError;
      sessionStorage.removeItem('home-menu-invitation');
      setSession(null);
    } catch { setError('No se ha podido cerrar la sesión. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  const name = String(session?.user.user_metadata.full_name || 'Tu perfil');
  return <div className="app-shell">
    <a href="#contenido" className="skip-link">Saltar al contenido</a>
    <header><a href="/" className="brand">Home Menu</a>{session && <span>{name}</span>}</header>
    <main id="contenido">
      {!session && <h1>Olvida el 'qué comemos'</h1>}
      {!online && <p role="status">Sin conexión.</p>}
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Cargando…</p> : session ? <>
        <h1>Hola, {name}</h1>
        <Household key={session.user.id} userId={session.user.id} online={online}/>
        <button onClick={() => void signOut()} disabled={busy || !online}>Cerrar sesión</button>
      </> : <button onClick={() => void signIn()} disabled={!supabase || busy || !online}>{busy ? 'Conectando…' : 'Continuar con Google'}</button>}
      {!supabase && <p role="status">Falta conectar este entorno con Supabase.</p>}
    </main>
  </div>;
}
