import { test, expect } from '@playwright/test';
import { setupApp } from './fixtures';
test.use({timezoneId:'America/Los_Angeles'});
test('resalta el día local, cambia a medianoche y no marca fechas de otras semanas',async({page},testInfo)=>{
 // En UTC ya es martes; en esta zona todavía es lunes.
 await page.clock.install({time:new Date('2026-11-17T07:59:30Z')});
 await setupApp(page);await page.getByRole('button',{name:'Semana',exact:true}).click();
 const today=page.locator('.menu-day[aria-current="date"]');
 await expect(today).toHaveCount(1);await expect(today.getByRole('heading').first()).toHaveText(/lunes.*16.*nov/i);
 await expect(today).toHaveCSS('border-top-color','rgb(46, 81, 69)');
 await expect(today).toHaveCSS('background-color','rgb(237, 242, 231)');
 await page.clock.fastForward(60000);await expect(today.getByRole('heading').first()).toHaveText(/martes.*17.*nov/i);
 await today.screenshot({path:testInfo.outputPath('dia-actual.png')});
 await page.getByRole('button',{name:'Semana siguiente',exact:true}).click();await expect(today).toHaveCount(0);
 await page.getByRole('button',{name:'Semana anterior',exact:true}).click();await expect(today).toHaveCount(1);
 await page.getByRole('button',{name:'Abrir perfil de Alex',exact:true}).click();const profile=page.getByRole('dialog',{name:'Perfil',exact:true});
 await profile.getByRole('radio',{name:'Azul',exact:true}).check();await profile.getByRole('switch',{name:'Modo oscuro'}).check();await profile.getByRole('button',{name:'Guardar perfil',exact:true}).click();
 await expect(today).toHaveCSS('border-top-color','rgb(168, 199, 255)');
 await today.screenshot({path:testInfo.outputPath('dia-actual-oscuro.png')});
});
