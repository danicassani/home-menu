import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cachedIdentity, rememberIdentity, retainPrivateUser, type OfflineIdentity } from './offline';
import { hasRememberedSession, supabase } from './supabase';
import InstallApp from './InstallApp';
import Household from './Household';
import AccountProfile from './AccountProfile';

export default function App() {
  const [statusTarget,setStatusTarget]=useState<HTMLDivElement|null>(null);
  const [offlineIdentity,setOfflineIdentity]=useState<OfflineIdentity|null>(null);
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
    let authChanged = false,identityAllowed=true,authVersion=0;
    if(!navigator.onLine)void cachedIdentity().then(identity=>{
      if(active&&identityAllowed&&identity){if(!hasRememberedSession(identity.id)){void retainPrivateUser(null).catch(()=>{});return;}void retainPrivateUser(identity.id).catch(()=>{});setOfflineIdentity(identity);setLoading(false);}
    }).catch(()=>{});
    const accept=(next:Session|null)=>{
      void retainPrivateUser(next?.user.id||null).catch(()=>{});
      if(next)void rememberIdentity(next.user).catch(()=>{});
      setOfflineIdentity(null);setSession(next);setLoading(false);
    };
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      if (active) { authChanged = true;authVersion++;if(next||_event==='SIGNED_OUT'||navigator.onLine){identityAllowed=false;accept(next);} }
    });
    void client.auth.getSession().then(({ data, error: authError }) => {
      if (!active) return;
      if (!authChanged&&(data.session||navigator.onLine)) {identityAllowed=false;accept(data.session);}
      if (authError&&navigator.onLine) setError('No hemos podido recuperar tu sesión. Vuelve a intentarlo.');
      setLoading(false);
    }).catch(() => { if (active) { setError('No hemos podido conectar con el servicio de acceso.'); setLoading(false); } });
    const recover=()=>{const version=authVersion;void client.auth.getSession().then(({data})=>{if(active&&version===authVersion){identityAllowed=false;accept(data.session);}}).catch(()=>{});};
    window.addEventListener('online',recover);
    return () => { active = false; subscription.unsubscribe();window.removeEventListener('online',recover); };
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
    if (!supabase || busy) return 'No se ha podido cerrar la sesión.';
    setBusy(true); setError('');
    try {
      const { error: authError } = await supabase.auth.signOut(online?undefined:{scope:'local'});
      if (authError && online) throw authError;
      sessionStorage.removeItem('home-menu-invitation');
      await retainPrivateUser(null).catch(()=>{});setOfflineIdentity(null);setSession(null);return null;
    } catch { const message='No se ha podido cerrar la sesión. Inténtalo de nuevo.';setError(message);return message; }
    finally { setBusy(false); }
  }
  const account=session?.user||offlineIdentity;
  return <div className="app-shell">
    <a href="#contenido" className="skip-link">Saltar al contenido</a>
    <header><div className="brand-block"><a href="/" className="brand"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 11a8 8 0 0 1 16 0M3 15h18M6 19h12M12 3V1" strokeLinecap="round"/></svg></span>Home Menu</a>{account&&<div className="connection-status" ref={setStatusTarget}/>}</div>{account && <AccountProfile key={account.id} user={account} online={online&&Boolean(session)} onSignOut={signOut}/>}</header>
    <main id="contenido" className={account ? 'workspace' : 'login'}>
      {!account && <><div className="login-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="9"/><path d="M4 9v9m4-9v9m-4-3h4m-2 3v21M42 9c-4 5-4 12 0 14v16m0-30v14" strokeLinecap="round"/></svg></div><h1>Olvida el <span>'qué comemos'</span></h1></>}
      {!online && <p role="status">Sin conexión.</p>}
      {error && <p role="alert">{error}</p>}
      {loading&&!account ? <p role="status">Cargando…</p> : account ? <>
        <Household key={account.id} userId={account.id} online={online&&Boolean(session)} statusTarget={statusTarget}/>
      </> : <button onClick={() => void signIn()} disabled={!supabase || busy || !online}>{busy ? 'Conectando…' : 'Continuar con Google'}</button>}
      {!supabase && <p role="status">Falta conectar este entorno con Supabase.</p>}
    </main>
    <InstallApp/>
  </div>;
}
