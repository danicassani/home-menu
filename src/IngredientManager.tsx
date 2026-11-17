import { useEffect, useRef, useState } from 'react';
import { editIngredient, ingredientCatalog, isCatalogAdmin } from './publicCatalog';
import type { Ingredient } from './recipes';
export default function IngredientManager({online,onClose}:{online:boolean;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const [admin,setAdmin]=useState(false),[global,setGlobal]=useState(false),[ingredients,setIngredients]=useState<Ingredient[]>([]),[search,setSearch]=useState('');
 const [selected,setSelected]=useState<Ingredient|null>(null),[name,setName]=useState(''),[kcal,setKcal]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const current=dialog.current;if(!current)return;current.showModal();closeButton.current?.focus();return()=>current.close();},[]);
 useEffect(()=>{let active=true;if(!online){setLoading(false);return;}setLoading(true);
  void Promise.all([isCatalogAdmin(),ingredientCatalog(global)]).then(([allowed,list])=>{if(active){setAdmin(allowed);setIngredients(list);setError('');}}).catch(()=>{if(active)setError('No se han podido cargar los ingredientes.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[global,retry,online]);
 function close(){if(busy)return;dialog.current?.close();onClose();}
 async function save(){if(!selected||busy||!online)return;
  if(!name.trim()||[...name.trim()].length>120||kcal.trim()&&(!Number.isFinite(Number(kcal))||Number(kcal)<0)){setError('Revisa el nombre y las kilocalorías.');return;}
  setBusy(true);setError('');try{await editIngredient(selected,name,kcal,global);setSelected(null);setRetry(value=>value+1);}catch{setError('No se ha podido guardar. Puede haber cambiado o existir otro con ese nombre.');}finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="ingredient-manager" aria-labelledby="ingredients-title" onCancel={event=>{event.preventDefault();close();}}>
  <div className="section-heading"><h2 id="ingredients-title">Ingredientes</h2><button ref={closeButton} className="secondary dialog-close" aria-label="Cerrar ingredientes" disabled={busy} onClick={close}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
  {error&&<p role="alert">{error} {!selected&&<button className="secondary compact" onClick={()=>setRetry(value=>value+1)}>Reintentar</button>}</p>}
  {!online&&<p role="status">Conéctate para gestionar ingredientes.</p>}
  {selected?<form onSubmit={event=>{event.preventDefault();void save();}}><label>Nombre<input maxLength={120} required value={name} disabled={busy||!online} onChange={event=>setName(event.target.value)}/></label><label>Kilocalorías por 100 g<input type="number" min="0" step="any" value={kcal} disabled={busy||!online} onChange={event=>setKcal(event.target.value)}/></label><button disabled={busy||!online}>Guardar ingrediente</button><button type="button" className="secondary" disabled={busy} onClick={()=>{setSelected(null);setError('');}}>Cancelar</button></form>:<>
   {admin&&<div className="ingredient-scope" role="group" aria-label="Catálogo de ingredientes"><button className="secondary compact" aria-pressed={!global} onClick={()=>setGlobal(false)}>Mi casa</button><button className="secondary compact" aria-pressed={global} onClick={()=>setGlobal(true)}>Públicos</button></div>}
   <label>Buscar ingrediente<input type="search" value={search} onChange={event=>setSearch(event.target.value)}/></label>
   {loading?<p role="status">Cargando ingredientes…</p>:<ul className="ingredient-management-list">{ingredients.filter(ingredient=>ingredient.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).map(ingredient=><li key={ingredient.id}><span>{ingredient.name}{ingredient.kcal_per_100g!==null&&<small>{ingredient.kcal_per_100g} kcal / 100 g</small>}</span><button className="secondary compact" disabled={!online} aria-label={`Editar ${ingredient.name}`} onClick={()=>{setSelected(ingredient);setName(ingredient.name);setKcal(ingredient.kcal_per_100g?.toString()||'');setError('');}}>Editar</button></li>)}</ul>}
  </>}
 </dialog>;
}
