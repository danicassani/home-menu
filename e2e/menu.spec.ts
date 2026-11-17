import { test, expect } from '@playwright/test';
import { setupApp } from './fixtures';
test.beforeEach(async({page})=>{
 await setupApp(page);
 await page.getByRole('button',{name:'Semana',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Semana',exact:true})).toBeVisible();
 await page.getByLabel('Semana del',{exact:true}).fill('2026-12-28');
 await expect(page.getByRole('button',{name:'Añadir comida del 2026-12-28'})).toBeEnabled();
});

test('añade varias apariciones, elige alternativas y sustituye solo una',async({page},testInfo)=>{
 const slot=page.getByRole('region',{name:'2026-12-28 Comida',exact:true});
 for(let i=0;i<2;i++){
  await slot.getByRole('button',{name:'Añadir comida del 2026-12-28'}).click();
  await page.getByRole('button',{name:/Pollo al horno Con verduras/}).click();
 }
 await expect(slot.getByRole('article')).toHaveCount(2);
 const first=slot.getByRole('article').first();
 await first.getByRole('button',{name:'Abrir Pollo al horno',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'Pollo al horno',exact:true});
 await detail.getByRole('combobox',{name:'Pollo',exact:true}).selectOption({label:'Tofu'});
 await expect(detail.getByRole('combobox',{name:'Pollo',exact:true})).toHaveValue('00000000-0000-0000-0000-000000000022');
 await detail.getByRole('button',{name:'Cerrar plato',exact:true}).click();
 await slot.getByRole('article').nth(1).getByRole('button',{name:'Abrir Pollo al horno',exact:true}).click();
 await expect(detail.getByRole('combobox',{name:'Pollo',exact:true})).toHaveValue('00000000-0000-0000-0000-000000000021');
 await detail.getByRole('button',{name:'Cerrar plato',exact:true}).click();
 await first.getByRole('button',{name:'Sustituir'}).click();
 await page.getByRole('button',{name:/Pollo al horno Con verduras/}).click();
 await expect(slot.getByRole('article')).toHaveCount(2);
 await first.getByRole('button',{name:'Abrir Pollo al horno',exact:true}).click();
 await expect(detail.getByRole('combobox',{name:'Pollo',exact:true})).toHaveValue('00000000-0000-0000-0000-000000000021');
 await detail.getByRole('button',{name:'Cerrar plato',exact:true}).click();
 await first.getByRole('button',{name:'Quitar'}).click();
 await expect(slot.getByRole('article')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:testInfo.outputPath('semana.png'),fullPage:true});
});

test('copia entre años y mantiene independientes origen y destino',async({page})=>{
 await page.getByRole('button',{name:'Añadir cena del 2027-01-03'}).click();
 await page.getByRole('button',{name:/Pollo al horno Con verduras/}).click();
 await page.getByRole('button',{name:'Semana siguiente'}).click();
 await expect(page.getByLabel('Semana del',{exact:true})).toHaveValue('2027-01-04');
 await expect(page.getByRole('button',{name:'Copiar semana'})).toBeEnabled();
 await page.getByRole('button',{name:'Copiar semana'}).click();
 const sunday=page.getByRole('region',{name:'2027-01-10 Cena',exact:true});
 await expect(sunday.getByRole('article',{name:'Pollo al horno'})).toBeVisible();
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'Copiar semana'}).click();
 await expect(sunday.getByRole('article')).toHaveCount(1);
 await sunday.getByRole('button',{name:'Quitar'}).click();
 await expect(sunday.getByRole('article')).toHaveCount(0);
 await page.getByRole('button',{name:'Semana anterior'}).click();
 await expect(page.getByRole('region',{name:'2027-01-03 Cena',exact:true}).getByRole('article')).toHaveCount(1);
});
