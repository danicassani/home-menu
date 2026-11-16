import { test, expect } from '@playwright/test';
import { setupApp } from './fixtures';

test('genera la compra, combina productos manuales y separa comprados',async({page},testInfo)=>{
 await setupApp(page);await page.getByRole('button',{name:'Semana',exact:true}).click();
 await page.getByLabel('Semana del',{exact:true}).fill('2026-12-28');
 await page.getByRole('button',{name:'Añadir comida del 2026-12-28'}).click();
 await page.getByRole('button',{name:/Pollo al horno Con verduras/}).click();
 await page.getByRole('button',{name:'Compra',exact:true}).click();
 await expect(page.getByLabel('Semana del',{exact:true})).toHaveValue('2026-12-28');
 const pending=page.getByRole('list',{name:'Pendientes',exact:true});
 await expect(pending.getByRole('checkbox',{name:'Pollo',exact:true})).toBeVisible();
 await pending.getByRole('checkbox',{name:'Pollo',exact:true}).click();
 await expect(page.getByText('Todo comprado.',{exact:true})).toBeVisible();
 await page.getByText('Comprados (1)',{exact:true}).click();
 await page.getByRole('list',{name:'Comprados',exact:true}).getByRole('checkbox',{name:'Pollo',exact:true}).click();
 await expect(pending.getByRole('checkbox',{name:'Pollo',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Añadir producto',exact:true}).click();
 await page.getByRole('button',{name:'Pollo',exact:true}).click();
 await expect(pending.getByRole('checkbox',{name:'Pollo',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Añadir producto',exact:true}).click();
 await page.getByRole('button',{name:'Nuevo ingrediente',exact:true}).click();
 await page.getByLabel('Nombre del ingrediente',{exact:true}).fill('Jabón');
 await page.getByRole('button',{name:'Añadir ingrediente',exact:true}).click();
 await expect(pending.getByRole('checkbox',{name:'Jabón',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:testInfo.outputPath('compra.png'),fullPage:true});
});

test('sincroniza menú, alternativas y marcas entre dos miembros sin recargar',async({page,browser})=>{
 const state=await setupApp(page);
 const otherContext=await browser.newContext({viewport:page.viewportSize()!});
 try{
  const other=await otherContext.newPage();await setupApp(other,state,'00000000-0000-0000-0000-000000000002');
  await other.getByRole('button',{name:'Compra',exact:true}).click();
  await expect(other.getByText('La lista está vacía.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Semana',exact:true}).click();
  const day=await page.getByLabel('Semana del',{exact:true}).inputValue();
  await page.getByRole('button',{name:`Añadir comida del ${day}`}).click();
  await page.getByRole('button',{name:/Pollo al horno Con verduras/}).click();
  await expect(other.getByRole('checkbox',{name:'Pollo',exact:true})).toBeVisible();
  const entry=page.getByRole('article',{name:'Pollo al horno',exact:true});
  await entry.getByText('Ingredientes',{exact:true}).click();
  await entry.getByRole('combobox',{name:'Pollo',exact:true}).selectOption({label:'Tofu'});
  await expect(other.getByRole('checkbox',{name:'Tofu',exact:true})).toBeVisible();
  await expect(other.getByRole('checkbox',{name:'Pollo',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Compra',exact:true}).click();
  await other.getByRole('checkbox',{name:'Tofu',exact:true}).click();
  await expect(page.getByText('Todo comprado.',{exact:true})).toBeVisible();
  await page.getByText('Comprados (1)',{exact:true}).click();
  await page.getByRole('checkbox',{name:'Tofu',exact:true}).click();
  await expect(other.getByRole('list',{name:'Pendientes',exact:true}).getByRole('checkbox',{name:'Tofu',exact:true})).toBeVisible();
 }finally{await otherContext.close();}
});

test('actualiza la carta entre miembros y conserva un borrador en conflicto',async({page,browser})=>{
 const state=await setupApp(page);
 const context=await browser.newContext({viewport:page.viewportSize()!});
 try{
  const other=await context.newPage();await setupApp(other,state,'00000000-0000-0000-0000-000000000002');
  await other.getByRole('button',{name:/Pollo al horno/}).click();
  await other.getByRole('button',{name:'Editar plato'}).click();
  await other.getByLabel('Nombre del plato').fill('Borrador del segundo miembro');
  await page.getByRole('button',{name:/Pollo al horno/}).click();
  await page.getByRole('button',{name:'Editar plato'}).click();
  await page.getByLabel('Nombre del plato').fill('Plato actualizado');
  await page.getByRole('button',{name:'Guardar plato'}).click();
  await expect(page.getByRole('button',{name:/Plato actualizado/})).toBeVisible();
  await other.getByRole('button',{name:'Guardar plato'}).click();
  await expect(other.getByRole('alert')).toContainText('No se ha podido guardar');
  await expect(other.getByLabel('Nombre del plato')).toHaveValue('Borrador del segundo miembro');
  await other.getByRole('button',{name:'Cancelar',exact:true}).click();
  await other.getByRole('button',{name:'Volver a carta'}).click();
  await expect(other.getByRole('button',{name:/Plato actualizado/})).toBeVisible();
 }finally{await context.close();}
});
