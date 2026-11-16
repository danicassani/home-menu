import { test, expect } from '@playwright/test';
import { setupApp, currentWeek } from './fixtures';
const current=currentWeek();
test('instala el shell, recarga offline y no guarda respuestas privadas en Cache Storage',async({page,context},testInfo)=>{
 const state=await setupApp(page);
 state.week(current).entries.push({id:'entry',planned_day:current,meal:'lunch',recipe_id:state.recipes[0].id,choices:[],choices_reset:false});
 await page.getByRole('button',{name:'Compra',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Pollo',exact:true})).toBeVisible();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 const manifest=await page.evaluate(async()=>await (await fetch('/manifest.webmanifest')).json());expect(manifest.display).toBe('standalone');expect(manifest.icons).toHaveLength(3);
 const urls=await page.evaluate(async()=>{const result:string[]=[];for(const key of await caches.keys())for(const request of await (await caches.open(key)).keys())result.push(request.url);return result;});
 expect(urls.length).toBeGreaterThan(5);expect(urls.every(url=>new URL(url).origin===new URL(page.url()).origin&&!url.includes('supabase'))).toBe(true);
 state.networkOffline=true;await context.setOffline(true);await page.getByRole('checkbox',{name:'Pollo',exact:true}).click();await expect(page.getByText('1 marca pendiente')).toBeVisible();
 await page.addInitScript(()=>{if(!navigator.onLine){const raw=localStorage.getItem('sb-fixture-auth-token');if(raw){const session=JSON.parse(raw);session.expires_at=1;localStorage.setItem('sb-fixture-auth-token',JSON.stringify(session));}}});
 await page.reload();await expect(page.getByRole('heading',{name:'Carta',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Nuevo plato'})).toBeDisabled();
 await page.getByRole('button',{name:'Compra',exact:true}).click();await page.getByText('Comprados (1)').click();await expect(page.getByRole('checkbox',{name:'Pollo',exact:true})).toBeChecked();
 await page.screenshot({path:testInfo.outputPath('compra-offline.png'),fullPage:true});
 state.networkOffline=false;await context.setOffline(false);await expect(page.getByText('1 marca pendiente')).not.toBeVisible();await expect.poll(()=>state.reconcile(current)[0]?.purchased).toBe(true);
});
test('cerrar sesión offline elimina instantáneas y cola privadas',async({page,context})=>{
 const state=await setupApp(page);await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 state.networkOffline=true;await context.setOffline(true);await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 await expect(page.getByRole('button',{name:/Continuar con Google/})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>new Promise<number>((resolve,reject)=>{const r=indexedDB.open('home-menu-private');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const count=db.transaction('data').objectStore('data').count();count.onsuccess=()=>{resolve(count.result);db.close();};};}))).toBe(0);
});
