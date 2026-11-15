import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import RecipeBook from './RecipeBook';
import WeeklyMenu from './WeeklyMenu';
type House = { id: string; name: string; owner_id: string };
type Invitation = { id: string; expires_at: string; revoked_at: string | null };
export default function Household({ userId, online }: { userId: string; online: boolean }) {
 const [tab,setTab]=useState<'recipes'|'week'|'house'>('recipes');
 const [house,setHouse]=useState<House|null>(null);
 const [invites,setInvites]=useState<Invitation[]>([]);
 const [name,setName]=useState(''); const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [link,setLink]=useState('');
 const [token,setToken]=useState(()=>sessionStorage.getItem('home-menu-invitation')||'');
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  async function load(){
   if(!supabase) return;
   setLoading(true);setError('');
   try {
    const result=await supabase.from('households').select('id,name,owner_id').maybeSingle();
    if(result.error) throw result.error;
    if(!active) return;
    setHouse(result.data);
    if(result.data?.owner_id===userId){
     const list=await supabase.from('household_invitations').select('id,expires_at,revoked_at').order('expires_at',{ascending:false});
     if(list.error) throw list.error;
     if(active) setInvites(list.data||[]);
    }
   }catch{if(active)setError('No se ha podido cargar la casa.');}
   finally{if(active)setLoading(false);}
  }
  void load(); return ()=>{active=false;};
 },[userId,retry]);
 async function action(kind:'create'|'accept'|'invite'|'revoke', id?:string){
  if(!supabase||busy||!online)return;
  setBusy(true);setError('');
  try{
   const result=kind==='create'?await supabase.rpc('create_household',{house_name:name}):kind==='accept'?await supabase.rpc('accept_household_invitation',{token}):kind==='invite'?await supabase.rpc('create_household_invitation'):await supabase.rpc('revoke_household_invitation',{invitation_id:id});
   if(result.error)throw result.error;
   if(kind==='invite')setLink(`${location.origin}/#invite=${encodeURIComponent(result.data)}`);
   if(kind==='accept'){sessionStorage.removeItem('home-menu-invitation');setToken('');}
   if(kind==='revoke')setLink('');
   setRetry(x=>x+1);
  }catch{setError(kind==='accept'?'No se puede aceptar: comprueba que la invitación siga vigente y que no pertenezcas a otra casa.':'No se ha podido guardar. Inténtalo de nuevo.');}
  finally{setBusy(false);}
 }
 if(loading)return <p role="status">Cargando casa…</p>;
 return <section className="household" aria-label="Casa">
  {error&&<p role="alert">{error} <button onClick={()=>setRetry(x=>x+1)}>Reintentar</button></p>}
  {house?<><nav className="house-tabs" aria-label="Secciones"><button className={tab==='recipes'?'':'secondary'} aria-pressed={tab==='recipes'} onClick={()=>setTab('recipes')}>Carta</button><button className={tab==='week'?'':'secondary'} aria-pressed={tab==='week'} onClick={()=>setTab('week')}>Semana</button><button className={tab==='house'?'':'secondary'} aria-pressed={tab==='house'} onClick={()=>setTab('house')}>Casa</button></nav>{tab==='recipes'?<RecipeBook key={house.id} houseId={house.id} online={online}/>:tab==='week'?<WeeklyMenu key={house.id} houseId={house.id} online={online}/>:<><h2>{house.name}</h2>{token&&<p>Ya perteneces a una casa. No puedes aceptar otra invitación.</p>}
   {house.owner_id===userId&&<><button disabled={busy||!online} onClick={()=>void action('invite')}>Crear enlace de invitación</button>
    {link&&<label>Enlace válido durante 7 días<input readOnly value={link} onFocus={e=>e.target.select()}/></label>}
    <ul className="invites">{invites.filter(i=>!i.revoked_at&&new Date(i.expires_at)>new Date()).map(i=><li key={i.id}>Invitación hasta {new Date(i.expires_at).toLocaleDateString('es')} <button className="secondary" disabled={busy||!online} onClick={()=>void action('revoke',i.id)}>Revocar</button></li>)}</ul>
   </>}
  </>}</>:<>{token?<><h2>Unirte a una casa</h2><button disabled={busy||!online} onClick={()=>void action('accept')}>Aceptar invitación</button><button className="secondary" disabled={busy} onClick={()=>{sessionStorage.removeItem('home-menu-invitation');setToken('');}}>Descartar invitación</button></>:<form onSubmit={e=>{e.preventDefault();void action('create');}}><h2>Crear casa</h2><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80}/></label><button disabled={busy||!online||!name.trim()}>Crear casa</button></form>}</>}
 </section>;
}
