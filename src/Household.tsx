import { useEffect, useRef, useState } from 'react';
import { cachedHouse, rememberHouse, forgetPrivate, OfflineContext, OfflineWorkspace } from './offline';
import OfflineStatus from './OfflineStatus';
import { supabase } from './supabase';
import RecipeBook from './RecipeBook';
import WeeklyMenu from './WeeklyMenu';
import ShoppingList from './ShoppingList';
import HouseholdSettings from './HouseholdSettings';
import type { House } from './householdManagement';
import { calendarDay, monday } from './menu';
import { HouseholdUpdates, useHouseholdRealtime } from './realtime';
export default function Household({userId,online}:{userId:string;online:boolean}) {
 const [workspace,setWorkspace]=useState<OfflineWorkspace|null>(null);
 const [validated,setValidated]=useState(false);
 const [tab,setTab]=useState<'recipes'|'week'|'shopping'|'house'>('recipes');
 const [week,setWeek]=useState(()=>monday(calendarDay(new Date())));
 const [house,setHouse]=useState<House|null>(null);
 const [name,setName]=useState(''),[loading,setLoading]=useState(true);
 const accessVersion=useRef(0);
 const loaded=useRef(false),previousHouse=useRef<string|null>(null);
 const [loadError,setLoadError]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [token,setToken]=useState(()=>sessionStorage.getItem('home-menu-invitation')||'');
 const [retry,setRetry]=useState(0);
 const realtime=useHouseholdRealtime(house?.id||null,online,userId);
 useEffect(()=>{
  if(!house||house.deletion_requested_at){setWorkspace(null);return;}
  const current=new OfflineWorkspace(userId,house.id,house.membership_id);setWorkspace(current);
  return()=>current.close();
 },[userId,house?.id,house?.deletion_requested_at,house?.membership_id]);
 useEffect(()=>{
  const removed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail.user===userId&&(!detail.house||detail.house===previousHouse.current)){accessVersion.current++;setLoading(true);setRetry(n=>n+1);sessionStorage.removeItem('home-menu-invitation');setToken('');setHouse(null);setValidated(false);setTab('recipes');previousHouse.current=null;}};
  window.addEventListener('home-menu-access-cleared',removed);return()=>window.removeEventListener('home-menu-access-cleared',removed);
 },[userId]);
 useEffect(()=>{
  let active=true;const version=accessVersion.current;const current=()=>active&&version===accessVersion.current;if(!loaded.current)setLoading(true);if(!online)setValidated(false);
  void (async()=>{
   try{
    if(!online){
     const saved=await cachedHouse(userId);if(current()){setHouse(saved);previousHouse.current=saved?.id||null;setLoadError(saved?'':'Conéctate para cargar tu casa.');loaded.current=true;}return;
    }
    if(!supabase)return;
    const result=await supabase.from('households').select('id,name,owner_id,deletion_requested_at').maybeSingle();
    if(!current())return;
    if(result.error)throw result.error;
    const currentHouse=result.data as House|null;
    let saved:House|null=null;try{saved=await cachedHouse(userId);}catch{/* No local snapshot. */}
    if(!current())return;
    if(currentHouse&&!currentHouse.deletion_requested_at){
     const membership=await supabase.from('household_members').select('household_id,membership_id').eq('user_id',userId).maybeSingle();
     if(!current())return;if(membership.error)throw membership.error;
     if(!membership.data||membership.data.household_id!==currentHouse.id||!membership.data.membership_id)throw new Error('No se ha podido verificar la pertenencia');
     currentHouse.membership_id=membership.data.membership_id;
    }
    const previous=previousHouse.current||saved?.id;
    if(previous&&(currentHouse?.id!==previous||(currentHouse?.deletion_requested_at&&Boolean(saved||(workspace&&!workspace.closed)))||(saved?.membership_id&&saved.membership_id!==currentHouse?.membership_id))){await forgetPrivate(userId,previous);if(!current())return;}
    if(!currentHouse&&previous){sessionStorage.removeItem('home-menu-invitation');setToken('');setTab('recipes');setError('');}
    previousHouse.current=currentHouse?.id||null;
    if(currentHouse&&!currentHouse.deletion_requested_at){try{await rememberHouse(userId,currentHouse);}catch{/* Online use does not depend on local storage. */}}
    if(!current())return;setHouse(currentHouse);setValidated(true);setLoadError('');loaded.current=true;
   }catch{if(current())setLoadError('No se ha podido cargar la casa.');}
   finally{if(current())setLoading(false);}
  })();
  return ()=>{active=false;};
 },[userId,retry,realtime.revision,online]);
 async function action(kind:'create'|'accept'){
  if(!supabase||busy||!online)return;setBusy(true);setError('');
  try{
   const result=kind==='create'?await supabase.rpc('create_household',{house_name:name}):await supabase.rpc('accept_household_invitation',{token});
   if(result.error)throw result.error;
   if(kind==='accept'){sessionStorage.removeItem('home-menu-invitation');setToken('');}
   setRetry(n=>n+1);
  }catch{setError(kind==='accept'?'No se puede aceptar: comprueba que la invitación siga vigente y que no pertenezcas a otra casa.':'No se ha podido crear la casa.');}
  finally{setBusy(false);}
 }
 if(loading)return <p role="status">Cargando casa…</p>;
 const canWrite=online&&validated;
 return <OfflineContext.Provider value={workspace&&!workspace.closed?workspace:null}><HouseholdUpdates.Provider value={realtime.revision}><section className="household" aria-label="Casa">
  {(error||loadError)&&<p role="alert">{error||loadError} <button onClick={()=>setRetry(n=>n+1)}>Reintentar</button></p>}
  {workspace&&!workspace.closed&&<OfflineStatus workspace={workspace} online={canWrite}/>}
  {house?<>
   {!house.deletion_requested_at&&<nav className="house-tabs" aria-label="Secciones">{([['recipes','Carta'],['week','Semana'],['shopping','Compra'],['house','Casa']] as const).map(([key,label])=><button key={key} className={tab===key?'':'secondary'} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</nav>}
   <p className={realtime.status==='live'?'sync-status live':'sync-status'} role="status" aria-label={realtime.status==='live'?'Sincronización activa':'Estado de sincronización'}>{realtime.status==='live'?'En directo':realtime.status==='offline'?'Sin conexión':realtime.status==='connecting'?'Conectando…':'Reconectando…'}</p>
   {!house.deletion_requested_at&&!workspace?<p role="status">Cargando datos…</p>:house.deletion_requested_at||tab==='house'?<HouseholdSettings key={house.id} house={house} userId={userId} online={canWrite} onChanged={()=>setRetry(n=>n+1)}/>:tab==='recipes'?<RecipeBook key={house.id} houseId={house.id} online={canWrite}/>:tab==='week'?<WeeklyMenu key={house.id} houseId={house.id} online={canWrite} selectedWeek={week} onWeekChange={setWeek}/>:<ShoppingList key={house.id} houseId={house.id} week={week} onWeekChange={setWeek} online={canWrite}/>}
  </>:token?<><h2>Unirte a una casa</h2><button disabled={busy||!online} onClick={()=>void action('accept')}>Aceptar invitación</button><button className="secondary" disabled={busy} onClick={()=>{sessionStorage.removeItem('home-menu-invitation');setToken('');}}>Descartar invitación</button></>:<form onSubmit={e=>{e.preventDefault();void action('create');}}><h2>Crear casa</h2><label>Nombre<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={busy||!online||!name.trim()}>Crear casa</button></form>}
 </section></HouseholdUpdates.Provider></OfflineContext.Provider>;
}
