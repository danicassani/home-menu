import { useEffect, useRef, useState } from 'react';
export default function AppUpdatePrompt({worker,onLater}:{worker:ServiceWorker;onLater:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),later=useRef<HTMLButtonElement>(null),dismissed=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const current=dialog.current;if(!current)return;
  // Let profile/photo dialogs finish before taking focus for an update.
  const show=()=>{if(!dismissed.current&&current.isConnected&&!current.open&&!document.querySelector('dialog[open]')){current.showModal();later.current?.focus();}};
  const observer=new MutationObserver(show);
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});show();
  return()=>{observer.disconnect();current.close();};
 },[]);
 function dismiss(){dismissed.current=true;dialog.current?.close();onLater();}
 function update(){
  if(busy)return;setError('');
  try{if(worker.state!=='installed')throw new Error('Actualización no disponible');setBusy(true);worker.postMessage('ACTIVATE');}
  catch{setBusy(false);setError('No se ha podido actualizar. Inténtalo de nuevo.');}
 }
 return <dialog ref={dialog} className="update-dialog" aria-labelledby="update-title" aria-describedby="update-description" onCancel={event=>{event.preventDefault();if(!busy)dismiss();}}>
  <h2 id="update-title">Actualización disponible</h2>
  <p id="update-description">Guarda tus cambios antes de actualizar.</p>
  {error&&<p role="alert">{error}</p>}
  <div className="update-actions"><button type="button" disabled={busy} onClick={update}>{busy?'Actualizando…':'Actualizar app'}</button><button type="button" className="secondary" ref={later} disabled={busy} onClick={dismiss}>Más tarde</button></div>
 </dialog>;
}
