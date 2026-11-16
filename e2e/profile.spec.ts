import { test, expect } from '@playwright/test';
import { setupApp } from './fixtures';

test('guarda avatar y apariencia y los recupera tras recargar',async({page},testInfo)=>{
 await setupApp(page);await page.getByRole('button',{name:'Abrir perfil de Alex',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Perfil',exact:true});
 await dialog.getByRole('radio',{name:'Limón',exact:true}).check();
 await dialog.getByRole('radio',{name:'Azul',exact:true}).check();
 await dialog.getByRole('switch',{name:'Modo oscuro'}).check();
 await expect(page.locator('html')).toHaveAttribute('data-theme','blue');
 await expect(dialog).toHaveCSS('background-color','rgb(29, 39, 32)');
 await expect(dialog.getByRole('button',{name:'Guardar perfil',exact:true})).toHaveCSS('background-color','rgb(168, 199, 255)');
 await page.screenshot({path:testInfo.outputPath('perfil-oscuro.png'),fullPage:true});
 await dialog.getByRole('button',{name:'Guardar perfil',exact:true}).click();
 await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'Abrir perfil de Alex'})).toContainText('🍋');
 await page.reload();
 await expect(page.getByRole('button',{name:'Abrir perfil de Alex'})).toBeEnabled();
 await expect(page.locator('html')).toHaveAttribute('data-theme','blue');await expect(page.locator('html')).toHaveAttribute('data-mode','dark');
 await expect(page.getByRole('button',{name:'Abrir perfil de Alex'})).toContainText('🍋');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('previsualiza doce combinaciones y Escape cancela y devuelve el foco',async({page})=>{
 await page.emulateMedia({colorScheme:'light',reducedMotion:'no-preference'});
 await setupApp(page);const trigger=page.getByRole('button',{name:'Abrir perfil de Alex'});await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Perfil'}),save=dialog.getByRole('button',{name:'Guardar perfil'});
 const cases=[
  {value:'white',label:'Blanco',light:'rgb(46, 81, 69)',dark:'rgb(177, 212, 188)'},
  {value:'blue',label:'Azul',light:'rgb(36, 87, 166)',dark:'rgb(168, 199, 255)'},
  {value:'red',label:'Rojo',light:'rgb(150, 59, 52)',dark:'rgb(255, 181, 172)'},
  {value:'pink',label:'Rosa',light:'rgb(145, 62, 108)',dark:'rgb(245, 182, 215)'},
  {value:'green',label:'Verde',light:'rgb(46, 100, 69)',dark:'rgb(164, 221, 177)'},
  {value:'yellow',label:'Amarillo',light:'rgb(120, 87, 0)',dark:'rgb(235, 208, 113)'},
 ];
 for(const mode of ['light','dark'] as const){
  const backgrounds=new Set<string>();await dialog.getByRole('switch',{name:'Modo oscuro'}).setChecked(mode==='dark');
  for(const theme of cases){
   await dialog.getByRole('radio',{name:theme.label,exact:true}).check();
   await expect(page.locator('html')).toHaveAttribute('data-theme',theme.value);await expect(page.locator('html')).toHaveAttribute('data-mode',mode);
   // The data attribute changes before the button's CSS transition finishes.
   await expect(save).toHaveCSS('background-color',theme[mode]);
   backgrounds.add(await save.evaluate(element=>getComputedStyle(element).backgroundColor));
  }
  expect(backgrounds.size).toBe(6);
 }
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
 await expect(page.locator('html')).toHaveAttribute('data-theme','white');await expect(page.locator('html')).toHaveAttribute('data-mode','light');
 await expect(page.locator('.brand-mark')).toHaveCSS('background-color','rgb(46, 81, 69)');
});

test('respeta el sistema, permite fijar el modo y limpia preferencias al cerrar sesión',async({page})=>{
 await setupApp(page);await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-mode','dark');
 await page.getByRole('button',{name:'Abrir perfil de Alex'}).click();
 const dialog=page.getByRole('dialog',{name:'Perfil'});await dialog.getByRole('switch',{name:'Modo oscuro'}).uncheck();
 await dialog.getByRole('button',{name:'Guardar perfil'}).click();await expect(page.locator('html')).toHaveAttribute('data-mode','light');
 await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-mode','light');
 await page.getByRole('button',{name:'Abrir perfil de Alex',exact:true}).click();await page.getByRole('dialog',{name:'Perfil',exact:true}).getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 await expect(page.getByRole('heading',{name:"Olvida el 'qué comemos'"})).toBeVisible();
 await expect(page.locator('html')).not.toHaveAttribute('data-theme');await expect(page.locator('html')).not.toHaveAttribute('data-mode');
});

test('mantiene preferencias separadas entre usuarios',async({page,browser})=>{
 const state=await setupApp(page);const context=await browser.newContext({viewport:page.viewportSize()!});
 try{
  await page.getByRole('button',{name:'Abrir perfil de Alex'}).click();await page.getByRole('radio',{name:'Rojo',exact:true}).check();
  await page.getByRole('button',{name:'Guardar perfil'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','red');
  const other=await context.newPage();await setupApp(other,state,'00000000-0000-0000-0000-000000000002');
  await expect(other.locator('html')).toHaveAttribute('data-theme','white');await expect(page.locator('html')).toHaveAttribute('data-theme','red');
 }finally{await context.close();}
});
