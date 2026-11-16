import { useEffect, useRef, useState } from 'react';
import AppUpdatePrompt from './AppUpdatePrompt';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function InstallApp(){
 const [install,setInstall]=useState<InstallEvent|null>(null),[help,setHelp]=useState(false),[update,setUpdate]=useState<{worker:ServiceWorker;id:number}|null>(null);
 const offered=useRef(new WeakSet<ServiceWorker>()),sequence=useRef(0);
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
 const [installed,setInstalled]=useState(standalone);
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
 useEffect(()=>{
  let active=true;
  const announce=(worker:ServiceWorker)=>{if(active&&worker.state==='installed'&&!offered.current.has(worker)){offered.current.add(worker);setUpdate({worker,id:++sequence.current});}};
  if('serviceWorker' in navigator)void navigator.serviceWorker.getRegistration().then(registration=>{if(registration?.waiting&&navigator.serviceWorker.controller)announce(registration.waiting);}).catch(()=>{});
  const before=(event:Event)=>{event.preventDefault();setInstall(event as InstallEvent);};
  const done=()=>{setInstalled(true);setInstall(null);};
  const available=(event:Event)=>announce((event as CustomEvent<ServiceWorker>).detail);
  window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',done);window.addEventListener('home-menu-update',available);
  return()=>{active=false;window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done);window.removeEventListener('home-menu-update',available);};
 },[]);
 async function prompt(){if(!install)return;await install.prompt();await install.userChoice;setInstall(null);}
 return <><div className="pwa-actions">
  {!installed&&(install?<button className="secondary compact" onClick={()=>void prompt()}>Instalar app</button>:ios?<><button className="secondary compact" onClick={()=>setHelp(value=>!value)} aria-expanded={help}>Instalar app</button>{help&&<p>En Safari: Compartir → Añadir a pantalla de inicio.</p>}</>:null)}
 </div>{update&&<AppUpdatePrompt key={update.id} worker={update.worker} onLater={()=>setUpdate(null)}/>}</>;
}
