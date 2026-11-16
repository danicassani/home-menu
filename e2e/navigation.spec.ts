import { test, expect } from '@playwright/test';
import { setupApp } from './fixtures';
test('navega con iconos en la barra fija y deja libres los controles inferiores',async({page},testInfo)=>{
 await setupApp(page);
 const nav=page.getByRole('navigation',{name:'Secciones'});
 await expect(nav.getByRole('button')).toHaveCount(4);
 await expect(nav.getByRole('button',{name:'Carta',exact:true})).toHaveAttribute('aria-pressed','true');
 expect((await nav.innerText()).trim()).toBe('');
 await expect(nav).toHaveCSS('position','fixed');
 for(const [name,region] of [['Semana','Menú semanal'],['Compra','Compra'],['Casa','Gestión de casa'],['Carta','Carta']]){
  const button=nav.getByRole('button',{name,exact:true});
  await button.focus();await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('region',{name:region,exact:true})).toBeVisible();
 }
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 const footer=page.getByRole('button',{name:/Pollo al horno/});
 await expect(footer).toBeInViewport();
 const [bar,button]=await Promise.all([nav.boundingBox(),footer.boundingBox()]);
 expect(button!.y+button!.height).toBeLessThanOrEqual(bar!.y);
 expect(bar!.y+bar!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:testInfo.outputPath('barra-inferior-clara.png')});
 await page.getByRole('button',{name:'Abrir perfil de Alex'}).click();
 const profile=page.getByRole('dialog',{name:'Perfil',exact:true});
 await profile.getByRole('switch',{name:'Modo oscuro'}).check();
 await profile.getByRole('button',{name:'Guardar perfil',exact:true}).click();
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 await expect(nav).toHaveCSS('background-color','rgb(29, 39, 32)');
 await page.screenshot({path:testInfo.outputPath('barra-inferior-oscura.png')});
});
