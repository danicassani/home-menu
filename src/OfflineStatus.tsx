import { useEffect, useRef, useState } from 'react';
import type { OfflineWorkspace } from './offline';
export default function OfflineStatus({workspace,online}:{workspace:OfflineWorkspace;online:boolean}){
 const [pending,setPending]=useState(0),[discarded,setDiscarded]=useState(0),[failed,setFailed]=useState(false),[busy,setBusy]=useState(false);
 const refresh=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let active=true,running=false;
  const update=async()=>{
   if(running||workspace.closed)return;running=true;
   try{
    const before=await workspace.queue();if(active){setPending(before.marks.length);setDiscarded(before.discarded);}
    if(online&&navigator.onLine&&before.marks.length){
     if(active)setBusy(true);await workspace.sync();
     if(workspace.closed)return;
     const after=await workspace.queue();if(active){setPending(after.marks.length);setDiscarded(after.discarded);setFailed(false);}
     window.dispatchEvent(new Event('home-menu-shopping-synced'));
    }
   }catch{if(active)setFailed(true);}
   finally{running=false;if(active)setBusy(false);}
  };
  refresh.current=()=>{void update();};
  const changed=()=>{void update();};const visible=()=>{if(document.visibilityState==='visible')changed();};
  changed();window.addEventListener('home-menu-offline-change',changed);document.addEventListener('visibilitychange',visible);
  const timer=setInterval(changed,15000);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('home-menu-offline-change',changed);document.removeEventListener('visibilitychange',visible);};
 },[workspace,online]);
 return <>
  {!online&&<p className="offline-notice" role="status">Sin conexión · Datos guardados</p>}
  {pending>0&&<p role="status">{busy?'Sincronizando…':`${pending} ${pending===1?'marca pendiente':'marcas pendientes'}`}</p>}
  {discarded>0&&<p role="status">{discarded} {discarded===1?'marca descartada: el producto ya no existe.':'marcas descartadas: los productos ya no existen.'}</p>}
  {(failed||workspace.storageError)&&<p role="alert">{workspace.storageError?'No se pueden guardar datos en este dispositivo.':'No se han sincronizado las marcas.'}{online&&<button className="secondary compact" disabled={busy} onClick={()=>refresh.current()}>Reintentar sincronización</button>}</p>}
 </>;
}
