import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
 state.networkOffline=true;await context.setOffline(true);await page.getByRole('button',{name:'Abrir perfil de Alex',exact:true}).click();await page.getByRole('dialog',{name:'Perfil',exact:true}).getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 await expect(page.getByRole('button',{name:/Continuar con Google/})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>new Promise<number>((resolve,reject)=>{const r=indexedDB.open('home-menu-private');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const count=db.transaction('data').objectStore('data').count();count.onsuccess=()=>{resolve(count.result);db.close();};};}))).toBe(0);
});

test('no restaura datos offline si otra versión ya eliminó la sesión recordada',async({page,context})=>{
 const state=await setupApp(page);await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 state.networkOffline=true;await context.setOffline(true);
 await page.addInitScript(()=>localStorage.removeItem('sb-fixture-auth-token'));
 await page.reload();await expect(page.getByRole('button',{name:/Continuar con Google/})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Secciones'})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>new Promise<number>((resolve,reject)=>{const r=indexedDB.open('home-menu-private');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,count=db.transaction('data').objectStore('data').count();count.onsuccess=()=>{resolve(count.result);db.close();};};}))).toBe(0);
});

// This test changes only the built worker, with one worker in this test suite to avoid version races.
test('avisa por popup, permite posponer y recarga solo tras aceptar una actualización real',async({page},testInfo)=>{
 await setupApp(page);await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 const workerPath=resolve('dist/sw.js'),original=readFileSync(workerPath,'utf8');
 const update=async(revision:string)=>{
  writeFileSync(workerPath,original+'\n// e2e-update-'+testInfo.project.name+'-'+revision+'-'+Date.now());
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration!.update();});
  await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true);
 };
 try{
  const trigger=page.getByRole('button',{name:'Abrir perfil de Alex',exact:true});await trigger.click();
  await update('deferred');
  const popup=page.getByRole('dialog',{name:'Actualización disponible',exact:true});
  await expect(popup).not.toBeVisible();await page.getByRole('button',{name:'Cerrar perfil',exact:true}).click();
  await expect(popup).toBeVisible();await expect(popup.getByRole('button',{name:'Más tarde',exact:true})).toBeFocused();
  await page.screenshot({path:testInfo.outputPath('actualizacion.png')});
  await popup.getByRole('button',{name:'Más tarde',exact:true}).click();await expect(popup).not.toBeVisible();await expect(trigger).toBeFocused();
  await expect(page.locator('.pwa-actions').getByRole('button',{name:'Actualizar app',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Nuevo plato',exact:true}).click();await page.getByLabel('Nombre del plato').fill('Borrador conservado');
  await update('draft');await expect(popup).toBeVisible();await page.keyboard.press('Escape');
  await expect(popup).not.toBeVisible();await expect(page.getByLabel('Nombre del plato')).toHaveValue('Borrador conservado');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await update('accept');await expect(popup).toBeVisible();
  const loaded=page.waitForEvent('load');await popup.getByRole('button',{name:'Actualizar app',exact:true}).click();await loaded;
  await expect(page.getByRole('heading',{name:'Carta',exact:true})).toBeVisible();await expect(popup).not.toBeVisible();
  await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(false);
 }finally{writeFileSync(workerPath,original);}
});
