import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({loadMenuWeek:vi.fn(),changeMenuWeek:vi.fn(),copyMenuWeek:vi.fn(),loadRecipeBook:vi.fn()}));
vi.mock('./menu',async original=>({...await original<typeof import('./menu')>(),loadMenuWeek:api.loadMenuWeek,changeMenuWeek:api.changeMenuWeek,copyMenuWeek:api.copyMenuWeek}));
vi.mock('./recipes',async original=>({...await original<typeof import('./recipes')>(),loadRecipeBook:api.loadRecipeBook}));
import { OfflineContext, OfflineWorkspace } from './offline';
import WeeklyMenu from './WeeklyMenu';
import { calendarDay, monday } from './menu';
const current=monday(calendarDay(new Date()));
const recipe={id:'dish',name:'Pollo',description:'',instructions:'Cocinar',tags:['Al horno'],archived:false,photo_path:null,revision:1,lines:[{id:'line',ingredient_id:'chicken',alternatives:['tofu']}]};
const entry={id:'entry',planned_day:current,meal:'lunch',recipe_id:'dish',choices_reset:false,choices:[]};
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
 api.loadMenuWeek.mockResolvedValue({revision:2,entries:[entry]});
 api.loadRecipeBook.mockResolvedValue({recipes:[recipe],ingredients:[{id:'chicken',name:'Pollo'},{id:'tofu',name:'Tofu'}],photoError:false});
 api.changeMenuWeek.mockResolvedValue({revision:3,entries:[entry]});
 api.copyMenuWeek.mockResolvedValue({revision:3,entries:[entry]});
});
it('elige una alternativa solo para esa aparición y conserva revisión',async()=>{
 render(<WeeklyMenu houseId="house" online/>);
 const article=await screen.findByRole('article',{name:'Pollo'});
 expect(within(article).queryByText('Ingredientes')).not.toBeInTheDocument();
 fireEvent.click(within(article).getByRole('button',{name:'Abrir Pollo'}));
 fireEvent.change(within(screen.getByRole('dialog',{name:'Pollo'})).getByLabelText('Pollo'),{target:{value:'tofu'}});
 await waitFor(()=>expect(api.changeMenuWeek).toHaveBeenCalledWith(current,2,{action:'choices',entry:'entry',choices:[{ingredient_id:'chicken',alternative_id:'tofu'}]}));
});
it('abre la carta para sustituir conservando el identificador de aparición',async()=>{
 render(<WeeklyMenu houseId="house" online/>);
 fireEvent.click(await screen.findByRole('button',{name:'Sustituir'}));
 fireEvent.click(screen.getByRole('button',{name:/^Pollo/}));
 await waitFor(()=>expect(api.changeMenuWeek).toHaveBeenCalledWith(current,2,expect.objectContaining({action:'replace',entry:'entry',day:current,meal:'lunch',recipe:'dish'})));
});
it('no sobrescribe una semana si se cancela la confirmación',async()=>{
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
 render(<WeeklyMenu houseId="house" online/>);
 fireEvent.click(await screen.findByRole('button',{name:'Copiar semana'}));
 expect(confirm).toHaveBeenCalled();expect(api.copyMenuWeek).not.toHaveBeenCalled();confirm.mockRestore();
});
it('mantiene datos y ofrece actualizar tras un conflicto de revisión',async()=>{
 api.changeMenuWeek.mockRejectedValue(new Error('stale'));
 render(<WeeklyMenu houseId="house" online/>);
 fireEvent.click(await screen.findByRole('button',{name:'Quitar'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Actualiza la semana');
 expect(screen.getByRole('article',{name:'Pollo'})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Actualizar semana'}));
 await waitFor(()=>expect(api.loadMenuWeek).toHaveBeenCalledTimes(2));
});
it('desactiva cambios sin conexión',async()=>{
 const workspace=new OfflineWorkspace('weekly-offline','house');
 await workspace.cache('menu:'+current,{revision:2,entries:[entry]});
 await workspace.cache('book',{recipes:[recipe],ingredients:[{id:'chicken',name:'Pollo'},{id:'tofu',name:'Tofu'}],photoError:false});
 render(<OfflineContext.Provider value={workspace}><WeeklyMenu houseId="house" online={false}/></OfflineContext.Provider>);
 expect(await screen.findByRole('button',{name:'Quitar'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Copiar semana'})).toBeDisabled();
});
it('muestra dentro del diálogo los errores al cambiar alternativas sin retirar el plato',async()=>{
 api.changeMenuWeek.mockRejectedValueOnce(new Error('stale'));
 render(<WeeklyMenu houseId="house" online/>);
 fireEvent.click(await screen.findByRole('button',{name:'Abrir Pollo'}));
 const dialog=screen.getByRole('dialog',{name:'Pollo'});
 fireEvent.change(within(dialog).getByRole('combobox',{name:'Pollo'}),{target:{value:'tofu'}});
 expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se ha podido guardar');
 expect(screen.getByRole('article',{name:'Pollo'})).toBeInTheDocument();
 expect(within(dialog).getByRole('combobox',{name:'Pollo'})).toHaveValue('chicken');
});
