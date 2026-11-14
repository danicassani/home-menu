import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

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
      setSession(null);
    } catch { setError('No se ha podido cerrar la sesión. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  const name = String(session?.user.user_metadata.full_name || 'Tu perfil');
  return <div className="app-shell">
    <a href="#contenido" className="skip-link">Saltar al contenido</a>
    <header><a href="/" className="brand" aria-label="Home Menu, inicio"><span aria-hidden="true">hm.</span> home menu</a><span className="header-note">Hecho para compartir</span></header>
    <main id="contenido">
      <section className="intro"><p className="eyebrow">EN CASA SABE MEJOR</p><h1>Menos «¿qué comemos?»<br /><em>Más disfrutar.</em></h1><p className="lead">Tus platos de siempre, una semana organizada y la compra de toda la casa. Todo en el mismo sitio.</p>
        <div className="steps"><article><span aria-hidden="true">01</span><h2>Vuestra carta</h2><p>Las recetas que os gustan, siempre a mano.</p></article><article><span aria-hidden="true">02</span><h2>La semana resuelta</h2><p>Un sitio para cada desayuno, comida y cena.</p></article><article><span aria-hidden="true">03</span><h2>Compra compartida</h2><p>Lo que hace falta, sin olvidos ni duplicados.</p></article></div>
      </section>
      <section className="access" aria-labelledby="access-title"><div className="plate" aria-hidden="true"><span>🍋</span><span>🥬</span><span>🍅</span></div>
        <p className="eyebrow">BIENVENIDO A TU MESA</p><h2 id="access-title">{session ? `Hola, ${name}` : 'Cada casa tiene su menú.'}</h2>
        {!online && <p role="status" className="notice">Estás sin conexión. Recupera la conexión para acceder o cerrar sesión.</p>}
        {error && <p role="alert" className="error">{error}</p>}
        {loading ? <p role="status">Comprobando tu sesión…</p> : session ? <><p>Tu sesión está iniciada. La creación de casas y las invitaciones estarán disponibles en la siguiente entrega.</p><button onClick={() => void signOut()} disabled={busy || !online}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</button></> : <><p>Entra con Google y empieza a organizaros juntos.</p><button onClick={() => void signIn()} disabled={!supabase || busy || !online}><span aria-hidden="true">G</span> {busy ? 'Conectando…' : 'Continuar con Google'}</button><p className="small">Una cuenta, una casa. Sin otra contraseña.</p></>}
        {!supabase && <p className="notice" role="status">El acceso todavía no está configurado. Falta conectar este entorno con Supabase.</p>}
      </section>
    </main><footer>Un poco de orden. Mucho sabor.</footer>
  </div>;
}
