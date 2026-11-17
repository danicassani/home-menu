import { useEffect, useRef, useState } from 'react';
import type { Recipe } from './recipes';
export default function ArchivedRecipes({recipes,online,onRestore,onClose}:{recipes:Recipe[];online:boolean;onRestore:(recipe:Recipe)=>Promise<void>;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const [pending,setPending]=useState<string|null>(null),[error,setError]=useState('');
 useEffect(()=>{const current=dialog.current;if(!current)return;current.showModal();closeButton.current?.focus();return()=>current.close();},[]);
 function close(){if(pending)return;dialog.current?.close();onClose();}
 async function restore(recipe:Recipe){
  if(pending||!online)return;setPending(recipe.id);setError('');
  try{await onRestore(recipe);}catch{setError('No se ha podido desarchivar. Inténtalo de nuevo.');}finally{setPending(null);}
 }
 return <dialog ref={dialog} className="archive-dialog" aria-labelledby="archive-title" onCancel={event=>{event.preventDefault();close();}}>
  <div className="section-heading"><h2 id="archive-title">Archivados</h2><button ref={closeButton} type="button" className="secondary dialog-close" aria-label="Cerrar archivados" disabled={Boolean(pending)} onClick={close}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
  {error&&<p role="alert">{error}</p>}
  {!online&&<p role="status">Conéctate para desarchivar platos.</p>}
  {recipes.length?<ul className="archive-list">{recipes.map(recipe=><li key={recipe.id}>
   {recipe.photoUrl&&<img src={recipe.photoUrl} alt=""/>}<span className="archive-recipe-name">{recipe.name}</span>
   <button type="button" className="secondary compact" aria-label={`Desarchivar ${recipe.name}`} disabled={!online||Boolean(pending)} onClick={()=>void restore(recipe)}>{pending===recipe.id?'Desarchivando…':'Desarchivar'}</button>
  </li>)}</ul>:<p>No hay platos archivados.</p>}
 </dialog>;
}
