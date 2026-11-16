import { useEffect, useRef, useState } from 'react';
import { useOffline } from './offline';
import { readShopping } from './offlineResources';
import IngredientPicker from './IngredientPicker';
import WeekNavigation from './WeekNavigation';
import type { Ingredient } from './recipes';
import { setManualItem, setPurchased, type ShoppingItem } from './shopping';
import { useRealtimeRefresh } from './realtime';
export default function ShoppingList({houseId,week,onWeekChange,online}:{houseId:string;week:string;onWeekChange:(week:string)=>void;online:boolean}) {
 const workspace=useOffline();
 const [items,setItems]=useState<ShoppingItem[]>([]);
 const [ingredients,setIngredients]=useState<Ingredient[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [picker,setPicker]=useState(false);
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const generation=useRef(0),loaded=useRef('');
 useRealtimeRefresh(busy||picker,setRetry);
 useEffect(()=>{
  const ticket=++generation.current;let active=true;
  const key=houseId+week;if(loaded.current!==key)setLoading(true);
  void readShopping(workspace,houseId,week,online).then(data=>{
   if(active&&ticket===generation.current){setItems(data.list);setIngredients(data.ingredients);setError('');loaded.current=key;}
  }).catch(()=>{if(active&&ticket===generation.current){setItems([]);setError(online?'No se ha podido cargar la compra.':'No hay compra guardada para esta semana.');}}).finally(()=>{if(active&&ticket===generation.current)setLoading(false);});
  return ()=>{active=false;};
 },[houseId,week,retry,online,workspace]);
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==='visible'&&!busy&&!picker)setRetry(n=>n+1);};
  document.addEventListener('visibilitychange',refresh);return()=>document.removeEventListener('visibilitychange',refresh);
 },[busy,picker]);
 useEffect(()=>{const refresh=()=>{if(!busy&&!picker)setRetry(n=>n+1);};window.addEventListener('home-menu-shopping-synced',refresh);window.addEventListener('home-menu-offline-change',refresh);return()=>{window.removeEventListener('home-menu-shopping-synced',refresh);window.removeEventListener('home-menu-offline-change',refresh);};},[busy,picker]);
 async function mark(item:ShoppingItem,purchased:boolean){
  if(busy||loading||Boolean(error))return;
  if(!workspace){await action(()=>setPurchased(item.id,purchased));return;}
  generation.current++;setBusy(true);setError('');
  try{await workspace.mark(week,item.id,purchased);setItems(list=>list.map(row=>row.id===item.id?{...row,purchased}:row));}
  catch{setError('No se ha guardado la marca en este dispositivo.');}
  finally{setBusy(false);}
 }
 async function action(operation:()=>Promise<ShoppingItem[]>) {
  if(busy||loading||!online)return;generation.current++;setBusy(true);setError('');
  try{const result=await operation();await workspace?.cache('shopping:'+week,{list:result,ingredients});setItems(workspace?await workspace.overlay(week,result):result);setPicker(false);}
  catch{setError('No se ha podido guardar. Actualiza la compra y reintenta.');}
  finally{setBusy(false);}
 }
 const disabled=busy||loading||!online;
 function row(item:ShoppingItem) {
  return <li key={item.id} className={item.purchased?'shopping-row purchased':'shopping-row'}>
   <label><input type="checkbox" checked={item.purchased} disabled={busy||loading||(!online&&!workspace)||Boolean(error)} onChange={e=>void mark(item,e.target.checked)}/><span>{item.name}</span></label>
   {item.manual&&<button className="secondary compact" disabled={disabled||Boolean(error)} aria-label={`Quitar producto manual ${item.name}`} onClick={()=>void action(()=>setManualItem(week,item.ingredient_id,false))}>Quitar</button>}
  </li>;
 }
 return <section className="shopping-list" aria-label="Compra">
  <div className="section-heading"><h2>Compra</h2><button className="secondary compact" disabled={busy||loading||picker} onClick={()=>setRetry(n=>n+1)}>Actualizar compra</button></div>
  <WeekNavigation week={week} disabled={busy||loading||picker} onChange={onWeekChange}/>
  {error&&<p role="alert">{error}</p>}
  {loading?<p role="status">Cargando compra…</p>:<>
   <button disabled={disabled||Boolean(error)||picker} onClick={()=>setPicker(true)}>Añadir producto</button>
   {picker&&<fieldset disabled={disabled}><IngredientPicker ingredients={ingredients} excluded={items.filter(i=>i.manual).map(i=>i.ingredient_id)} onChoose={id=>void action(()=>setManualItem(week,id,true))} onCreated={i=>setIngredients(list=>[...list.filter(x=>x.id!==i.id),i])} onClose={()=>setPicker(false)}/></fieldset>}
   <ul className="shopping-items" aria-label="Pendientes">{items.filter(i=>!i.purchased).map(row)}</ul>
   {!items.some(i=>!i.purchased)&&!error&&<p className="empty-state">{items.length?'Todo comprado.':'La lista está vacía.'}</p>}
   <details className="purchased-items"><summary>Comprados ({items.filter(i=>i.purchased).length})</summary><ul className="shopping-items" aria-label="Comprados">{items.filter(i=>i.purchased).map(row)}</ul></details>
  </>}
 </section>;
}
