import { test, expect } from '@playwright/test';
import { createFixtureState, setupApp } from './fixtures';
test('expulsa y retira la casa del otro miembro sin recargar',async({page,browser},testInfo)=>{
 const state=await setupApp(page);const context=await browser.newContext({viewport:page.viewportSize()!});
 try{
  const other=await context.newPage();await setupApp(other,state,'00000000-0000-0000-0000-000000000002');
  await page.getByRole('button',{name:'Casa',exact:true}).click();
  await expect(page.getByText('Sam',{exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('miembros.png'),fullPage:true});
  await page.getByRole('button',{name:'Quitar a Sam',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(other.getByRole('heading',{name:'Crear casa',exact:true})).toBeVisible();
  await expect(other.getByRole('navigation',{name:'Secciones'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Quitar a Sam',exact:true})).toHaveCount(0);
 }finally{await context.close();}
});
test('transfiere la propiedad y permite salir al propietario anterior',async({page,browser})=>{
 const state=await setupApp(page);const context=await browser.newContext({viewport:page.viewportSize()!});
 try{
  const other=await context.newPage();await setupApp(other,state,'00000000-0000-0000-0000-000000000002');
  await page.getByRole('button',{name:'Casa',exact:true}).click();
  await other.getByRole('button',{name:'Casa',exact:true}).click();
  await expect(other.getByRole('button',{name:'Salir de la casa',exact:true})).toBeVisible();
  await expect(other.getByRole('button',{name:'Eliminar casa',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Transferir propiedad a Sam',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(other.getByRole('button',{name:'Eliminar casa',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Salir de la casa',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Crear casa',exact:true})).toBeVisible();
  await expect(other.getByRole('heading',{name:'Casa de prueba',exact:true})).toBeVisible();
 }finally{await context.close();}
});
test('reanuda la eliminación si falla Storage y borra las fotos antes de la casa',async({page})=>{
 const state=createFixtureState();state.files.add(state.house.id+'/photo.jpg');state.files.add(state.house.id+'/old/old.png');
 await setupApp(page,state);await page.getByRole('button',{name:'Casa',exact:true}).click();
 let fail=true;
 await page.route('https://fixture.supabase.co/storage/v1/object/recipe-photos',async route=>{
  if(route.request().method()==='DELETE'&&fail){fail=false;await route.fulfill({status:503,json:{message:'Temporal'}});}else await route.fallback();
 });
 await page.getByRole('button',{name:'Eliminar casa',exact:true}).click();
 await expect(page.getByRole('button',{name:'Confirmar',exact:true})).toBeDisabled();
 await page.getByLabel('Escribe Casa de prueba',{exact:true}).fill('Casa de prueba');
 await page.getByRole('button',{name:'Confirmar',exact:true}).click();
 await page.getByRole('button',{name:'Completar eliminación',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Crear casa',exact:true})).toBeVisible();
 expect(state.files.size).toBe(0);expect(state.house.deleted).toBe(true);
});
