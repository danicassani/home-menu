import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import RecipeBook from './RecipeBook';
import WeeklyMenu from './WeeklyMenu';
import ShoppingList from './ShoppingList';
import HouseholdSettings from './HouseholdSettings';
import type { House } from './householdManagement';
import { calendarDay, monday } from './menu';
import { HouseholdUpdates, useHouseholdRealtime } from './realtime';
export default function Household({userId,online}:{userId:string;online:boolean}) {
 const [tab,setTab]=useState<'recipes'|'week'|'shopping'|'house'>('recipes');
 const [week,setWeek]=useState(()=>monday(calendarDay(new Date())));
 const [house,setHouse]=useState<House|null>(null);
 const [name,setName]=useState(''),[loading,setLoading]=useState(true);
 const loaded=useRef(false),previousHouse=useRef<string|null>(null);
 const [loadError,setLoadError]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [token,setToken]=useState(()=>sessionStorage.getItem('home-menu-invitation')||'');
 const [retry,setRetry]=useState(0);
 const realtime=useHouseholdRealtime(house?.id||null,online,userId);
 useEffect(()=>{
  let active=true;if(!loaded.current)setLoading(true);
  void (async()=>{
   try{
    if(!supabase)return;
    const result=await supabase.from('households').select('id,name,owner_id,deletion_requested_at').maybeSingle();
    if(!active)return;
    if(result.error)throw result.error;
    if(!result.data&&previousHouse.current){sessionStorage.removeItem('home-menu-invitation');setToken('');setTab('recipes');setError('');}
    previousHouse.current=result.data?.id||null;
    setHouse(result.data);setLoadError('');loaded.current=true;
   }catch{if(active)setLoadError('No se ha podido cargar la casa.');}
   finally{if(active)setLoading(false);}
  })();
  return ()=>{active=false;};
 },[userId,retry,realtime.revision]);
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
 return <HouseholdUpdates.Provider value={realtime.revision}><section className="household" aria-label="Casa">
  {(error||loadError)&&<p role="alert">{error||loadError} <button onClick={()=>setRetry(n=>n+1)}>Reintentar</button></p>}
  {house?<>
   {!house.deletion_requested_at&&<nav className="house-tabs" aria-label="Secciones">{([['recipes','Carta'],['week','Semana'],['shopping','Compra'],['house','Casa']] as const).map(([key,label])=><button key={key} className={tab===key?'':'secondary'} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</nav>}
   <p className={realtime.status==='live'?'sync-status live':'sync-status'} role="status" aria-label={realtime.status==='live'?'Sincronización activa':'Estado de sincronización'}>{realtime.status==='live'?'En directo':realtime.status==='offline'?'Sin conexión':realtime.status==='connecting'?'Conectando…':'Reconectando…'}</p>
   {house.deletion_requested_at||tab==='house'?<HouseholdSettings key={house.id} house={house} userId={userId} online={online} onChanged={()=>setRetry(n=>n+1)}/>:tab==='recipes'?<RecipeBook key={house.id} houseId={house.id} online={online}/>:tab==='week'?<WeeklyMenu key={house.id} houseId={house.id} online={online} selectedWeek={week} onWeekChange={setWeek}/>:<ShoppingList key={house.id} houseId={house.id} week={week} onWeekChange={setWeek} online={online}/>}
  </>:token?<><h2>Unirte a una casa</h2><button disabled={busy||!online} onClick={()=>void action('accept')}>Aceptar invitación</button><button className="secondary" disabled={busy} onClick={()=>{sessionStorage.removeItem('home-menu-invitation');setToken('');}}>Descartar invitación</button></>:<form onSubmit={e=>{e.preventDefault();void action('create');}}><h2>Crear casa</h2><label>Nombre<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={busy||!online||!name.trim()}>Crear casa</button></form>}
 </section></HouseholdUpdates.Provider>;
}
