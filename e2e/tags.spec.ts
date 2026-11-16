import { test, expect } from '@playwright/test';
import { setupApp, currentWeek } from './fixtures';
test('añade etiquetas libres, las busca, las edita y usa cualquier receta en comida o cena',async({page},testInfo)=>{
 await setupApp(page);await page.getByRole('button',{name:'Nuevo plato',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Desayuno',exact:true})).toHaveCount(0);await expect(page.getByRole('checkbox',{name:'Comida',exact:true})).toHaveCount(0);await expect(page.getByRole('checkbox',{name:'Cena',exact:true})).toHaveCount(0);
 await page.getByLabel('Nombre del plato').fill('Garbanzos de casa');await page.getByLabel('Receta',{exact:true}).fill('Cocer y servir.');
 const input=page.getByLabel('Nueva etiqueta',{exact:true});
 await input.fill('  Rápido   y fácil ');await input.press('Enter');
 await input.fill('RÁPIDO Y FÁCIL');await page.getByRole('button',{name:'Añadir etiqueta',exact:true}).click();
 await expect(page.getByRole('button',{name:/Quitar etiqueta/})).toHaveCount(1);
 await input.fill('Vegetariano'); // Guardar incorpora también la etiqueta escrita sin confirmar con +.
 await page.getByRole('button',{name:'Añadir ingrediente',exact:true}).click();await page.getByRole('button',{name:'Tofu',exact:true}).click();
 await page.getByRole('button',{name:'Guardar plato',exact:true}).click();await expect(page.getByRole('button',{name:/Garbanzos de casa/})).toBeVisible();
 await page.reload();await page.getByRole('searchbox',{name:'Buscar plato',exact:true}).fill('garbanzos rapido');
 await page.getByRole('combobox',{name:'Etiqueta',exact:true}).selectOption('Vegetariano');await expect(page.getByRole('button',{name:/Garbanzos de casa/})).toBeVisible();await expect(page.getByRole('button',{name:/Pollo al horno/})).toHaveCount(0);
 await page.screenshot({path:testInfo.outputPath('etiquetas-carta.png'),fullPage:true});
 await page.getByRole('button',{name:/Garbanzos de casa/}).click();await page.getByRole('button',{name:'Editar plato',exact:true}).click();
 await page.getByRole('button',{name:'Quitar etiqueta Vegetariano',exact:true}).click();await page.getByRole('button',{name:'Guardar plato',exact:true}).click();
 await page.getByRole('button',{name:'Semana',exact:true}).click();await expect(page.getByRole('heading',{name:'Desayuno',exact:true})).toHaveCount(0);
 const day=await page.getByLabel('Semana del',{exact:true}).inputValue();
 for(const meal of ['comida','cena']){
  await page.getByRole('button',{name:`Añadir ${meal} del ${day}`,exact:true}).click();
  await page.getByRole('combobox',{name:'Etiqueta',exact:true}).selectOption('Rápido y fácil');
  await page.getByRole('searchbox',{name:'Buscar plato',exact:true}).fill('rapido');await page.getByRole('button',{name:/Garbanzos de casa/}).click();
 }
 await expect(page.getByRole('article',{name:'Garbanzos de casa',exact:true})).toHaveCount(2);
 await page.getByRole('button',{name:'Compra',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Tofu',exact:true})).toBeVisible();
});
test('conserva búsqueda por etiquetas y solo dos turnos sin conexión',async({page,context})=>{
 const state=await setupApp(page);await page.getByRole('button',{name:'Semana',exact:true}).click();await expect(page.getByRole('button',{name:`Añadir comida del ${currentWeek()}`,exact:true})).toBeEnabled();
 state.networkOffline=true;await context.setOffline(true);await page.getByRole('button',{name:'Carta',exact:true}).click();
 await page.getByRole('searchbox',{name:'Buscar plato',exact:true}).fill('horno');await expect(page.getByRole('button',{name:/Pollo al horno/})).toBeVisible();
 await page.getByRole('button',{name:'Semana',exact:true}).click();await expect(page.getByRole('heading',{name:'Desayuno',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:`Añadir comida del ${currentWeek()}`,exact:true})).toBeDisabled();
});
