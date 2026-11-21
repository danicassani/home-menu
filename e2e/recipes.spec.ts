import { test, expect } from '@playwright/test';
import { setupApp } from './fixtures';
test.beforeEach(async({page})=>setupApp(page));


test('crea, consulta y edita un plato con alternativas e ingrediente nuevo',async({page},testInfo)=>{
 await page.screenshot({path:testInfo.outputPath('carta.png'),fullPage:true});
 await page.getByRole('button',{name:'Nuevo plato'}).click();
 await page.getByLabel('Nombre del plato').fill('Arroz de casa');
 await page.getByLabel('Descripción',{exact:true}).fill('Con verduras');
 await page.getByLabel('Receta',{exact:true}).fill('Cocer y servir.');
 await page.getByRole('button',{name:'Añadir ingrediente',exact:true}).click();
 await page.getByLabel('Buscar ingrediente').fill('Arroz');
 await page.getByRole('button',{name:'Nuevo ingrediente',exact:true}).click();
 await page.getByLabel('kcal por 100 g (opcional)').fill('130');
 await page.getByRole('button',{name:'Añadir ingrediente',exact:true}).last().click();
 await expect(page.getByText('Arroz',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Añadir alternativa'}).click();
 await page.getByRole('button',{name:'Tofu',exact:true}).click();
 await page.getByRole('button',{name:'Guardar plato'}).click();
 await page.getByRole('button',{name:/Arroz de casa/}).click();
 await expect(page.getByText('Alternativas: Tofu')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('acciones-plato.png')});
 await expect(page.getByText('Cocer y servir.')).toBeVisible();
 await page.getByRole('button',{name:'Editar plato'}).click();
 await page.getByLabel('Nombre del plato').fill('Arroz editado');
 await page.getByRole('button',{name:'Guardar plato'}).click();
 await expect(page.getByRole('button',{name:/Arroz editado/})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('archiva y restaura un plato sin eliminarlo',async({page})=>{
 await page.getByRole('button',{name:/Pollo al horno/}).click();
 page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Archivar plato'}).click();
 await expect(page.getByText('Aún no hay platos.')).toBeVisible();
 const trigger=page.getByRole('button',{name:'Ver archivados',exact:true});await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Archivados',exact:true});
 await dialog.getByRole('button',{name:'Desarchivar Pollo al horno',exact:true}).click();
 await expect(dialog.getByText('No hay platos archivados.')).toBeVisible();
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
 await expect(page.getByRole('button',{name:/Pollo al horno/})).toBeVisible();
});


test('sube una foto, la muestra en la ficha y permite quitarla',async({page})=>{
 await page.getByRole('button',{name:'Nuevo plato'}).click();
 await page.getByLabel('Nombre del plato').fill('Plato con foto');
 await page.getByLabel('Receta',{exact:true}).fill('Cocinar.');
 await page.getByLabel('Foto (opcional)').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
 await page.getByRole('dialog',{name:'Encuadrar foto'}).getByRole('button',{name:'Usar foto'}).click();
 await page.getByRole('button',{name:'Añadir ingrediente',exact:true}).click();
 await page.getByRole('button',{name:'Pollo',exact:true}).click();
 await page.getByRole('button',{name:'Guardar plato'}).click();
 await page.getByRole('button',{name:/Plato con foto/}).click();
 const photo=page.getByRole('img',{name:'Plato con foto',exact:true});
 await expect(photo).toBeVisible();
 await expect.poll(()=>photo.evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Editar plato'}).click();
 await page.getByRole('button',{name:'Quitar foto'}).click();
 await page.getByRole('button',{name:'Guardar plato'}).click();
 await page.getByRole('button',{name:/Plato con foto/}).click();
 await expect(page.getByRole('img',{name:'Plato con foto',exact:true})).toHaveCount(0);
});
