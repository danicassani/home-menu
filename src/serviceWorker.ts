export function registerServiceWorker(){
 if(!import.meta.env.PROD||!('serviceWorker' in navigator))return;
 let refreshing=false,controlled=Boolean(navigator.serviceWorker.controller);
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled&&!refreshing){refreshing=true;location.reload();}controlled=true;});
 void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>{
  const ready=()=>{if(registration.waiting&&navigator.serviceWorker.controller)window.dispatchEvent(new CustomEvent('home-menu-update',{detail:registration.waiting}));};
  ready();registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',ready));
 }).catch(()=>{/* Online app remains usable if service workers are unavailable. */});
}
