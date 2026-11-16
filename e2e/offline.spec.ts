import { test, expect, type Page } from '@playwright/test';
import { setupApp, currentWeek } from './fixtures';
const current=currentWeek();
async function seed(page:Page){
 const state=await setupApp(page);
 state.week(current).entries.push({id:'offline-entry',planned_day:current,meal:'lunch',recipe_id:state.recipes[0].id,choices:[],choices_reset:false});
 await page.getByRole('button',{name:'Semana',exact:true}).click();await expect(page.getByRole('article',{name:'Pollo al horno'})).toBeVisible();
 await page.getByRole('button',{name:'Compra',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Pollo',exact:true})).toBeVisible();
 return state;
}
test('consulta datos guardados y conserva marcas al cambiar de pestaña sin conexión',async({page,context})=>{
 const state=await seed(page);state.networkOffline=true;await context.setOffline(true);
 await expect(page.getByText('Sin conexión',{exact:true})).toBeVisible();
 await page.getByRole('checkbox',{name:'Pollo',exact:true}).click();await expect(page.getByText('1 marca pendiente')).toBeVisible();
 await page.getByRole('button',{name:'Carta',exact:true}).click();await page.getByRole('button',{name:/Pollo al horno/}).click();await expect(page.getByText('Hornear 30 minutos.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Editar plato'})).toBeDisabled();
 await page.getByRole('button',{name:'Semana',exact:true}).click();await expect(page.getByRole('article',{name:'Pollo al horno'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Sustituir',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Compra',exact:true}).click();await page.getByText('Comprados (1)').click();await expect(page.getByRole('checkbox',{name:'Pollo',exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Semana siguiente'}).click();await expect(page.getByRole('alert')).toContainText('No hay compra guardada');
 await page.getByRole('button',{name:'Semana anterior'}).click();await expect(page.getByText('Comprados (1)')).toBeVisible();
 state.networkOffline=false;await context.setOffline(false);await expect(page.getByText('1 marca pendiente')).not.toBeVisible();
 await expect.poll(()=>state.reconcile(current)[0]?.purchased).toBe(true);
});
test('descarta una marca antigua si el producto se elimina y se reintroduce',async({page,context})=>{
 const state=await seed(page);const original=state.reconcile(current)[0].id;
 state.networkOffline=true;await context.setOffline(true);await page.getByRole('checkbox',{name:'Pollo',exact:true}).click();
 state.week(current).entries=[];state.reconcile(current);
 state.week(current).entries.push({id:'fresh',planned_day:current,meal:'lunch',recipe_id:state.recipes[0].id,choices:[],choices_reset:false});
 expect(state.reconcile(current)[0].id).not.toBe(original);
 state.networkOffline=false;await context.setOffline(false);
 await expect(page.getByText('1 marca descartada: el producto ya no existe.')).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'Pollo',exact:true})).not.toBeChecked();expect(state.reconcile(current)[0].purchased).toBe(false);
});
test('retira la caché y no envía marcas tras perder pertenencia',async({page,context})=>{
 const state=await seed(page);state.networkOffline=true;await context.setOffline(true);await page.getByRole('checkbox',{name:'Pollo',exact:true}).click();
 await expect(page.getByText('1 marca pendiente')).toBeVisible();state.members.length=0;
 state.networkOffline=false;await context.setOffline(false);
 await expect(page.getByRole('heading',{name:'Crear casa'})).toBeVisible();expect(state.markRequests).toHaveLength(0);
 state.networkOffline=true;await context.setOffline(true);await expect(page.getByText('Conéctate para cargar tu casa.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Compra',exact:true})).not.toBeVisible();
});
test('reintenta con el mismo identificador si se pierde una respuesta confirmada',async({page})=>{
 const state=await seed(page);state.dropNextMarkResponse=true;
 await page.getByRole('checkbox',{name:'Pollo',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('No se han sincronizado');
 expect(state.reconcile(current)[0].purchased).toBe(true);
 state.reconcile(current)[0].purchased=false; // Otra escritura aceptada después de perder la respuesta.
 await page.getByRole('button',{name:'Reintentar sincronización'}).click();
 await expect.poll(()=>state.markRequests.length).toBe(2);
 expect(state.markRequests[0].p_operation).toBe(state.markRequests[1].p_operation);
 expect(state.reconcile(current)[0].purchased).toBe(false);
 await expect(page.getByText('1 marca pendiente')).not.toBeVisible();
});
test('no recupera marcas de una pertenencia anterior al volver a la misma casa',async({page,context})=>{
 const state=await seed(page);state.networkOffline=true;await context.setOffline(true);
 await page.getByRole('checkbox',{name:'Pollo',exact:true}).click();await expect(page.getByText('1 marca pendiente')).toBeVisible();
 state.members[0].membership_id=crypto.randomUUID(); // Expulsión y nueva invitación mientras este dispositivo estaba desconectado.
 state.networkOffline=false;await context.setOffline(false);
 await expect(page.getByText('1 marca pendiente')).not.toBeVisible();
 expect(state.markRequests).toHaveLength(0);expect(state.reconcile(current)[0].purchased).toBe(false);
});
test('comparte la cola entre pestañas y sincroniza solo la última marca local',async({page,context})=>{
 const state=await seed(page);const other=await context.newPage();await setupApp(other,state);
 await other.getByRole('button',{name:'Compra',exact:true}).click();await expect(other.getByRole('checkbox',{name:'Pollo',exact:true})).toBeVisible();
 state.networkOffline=true;await context.setOffline(true);await page.getByRole('checkbox',{name:'Pollo',exact:true}).click();
 await expect(other.getByText('Comprados (1)')).toBeVisible();await other.getByText('Comprados (1)').click();await other.getByRole('checkbox',{name:'Pollo',exact:true}).click();
 await expect(page.getByText('Comprados (0)')).toBeVisible();state.networkOffline=false;await context.setOffline(false);
 await expect(other.getByText('1 marca pendiente')).not.toBeVisible();await expect(page.getByText('1 marca pendiente')).not.toBeVisible();
 await expect.poll(()=>state.markRequests.length).toBe(1);expect(state.reconcile(current)[0].purchased).toBe(false);
});
