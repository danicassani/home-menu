import { useEffect, useState } from 'react';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function InstallApp(){
 const [install,setInstall]=useState<InstallEvent|null>(null),[help,setHelp]=useState(false),[update,setUpdate]=useState<ServiceWorker|null>(null);
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
 const [installed,setInstalled]=useState(standalone);
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
 useEffect(()=>{
  if('serviceWorker' in navigator)void navigator.serviceWorker.getRegistration().then(registration=>{if(registration?.waiting&&navigator.serviceWorker.controller)setUpdate(registration.waiting);}).catch(()=>{});
  const before=(event:Event)=>{event.preventDefault();setInstall(event as InstallEvent);};
  const done=()=>{setInstalled(true);setInstall(null);};
  const available=(event:Event)=>setUpdate((event as CustomEvent<ServiceWorker>).detail);
  window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',done);window.addEventListener('home-menu-update',available);
  return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done);window.removeEventListener('home-menu-update',available);};
 },[]);
 async function prompt(){if(!install)return;await install.prompt();await install.userChoice;setInstall(null);}
 return <div className="pwa-actions">
  {!installed&&(install?<button className="secondary compact" onClick={()=>void prompt()}>Instalar app</button>:ios?<><button className="secondary compact" onClick={()=>setHelp(value=>!value)} aria-expanded={help}>Instalar app</button>{help&&<p>En Safari: Compartir → Añadir a pantalla de inicio.</p>}</>:null)}
  {update&&<button className="secondary compact" onClick={()=>update.postMessage('ACTIVATE')}>Actualizar app</button>}
 </div>;
}
