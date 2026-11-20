import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({loadRecipeBook:vi.fn(),saveRecipe:vi.fn(),archiveRecipe:vi.fn(),addIngredient:vi.fn(),uploadPhoto:vi.fn()}));
vi.mock('./recipes',async importOriginal=>({...await importOriginal<typeof import('./recipes')>(),...api}));
import { OfflineContext, OfflineWorkspace } from './offline';
vi.mock('./publicCatalog',()=>({publishRecipe:vi.fn()}));
import { publishRecipe } from './publicCatalog';
import RecipeBook from './RecipeBook';
import { HouseholdUpdates } from './realtime';
import type { Recipe } from './recipes';
const ingredients=[{id:'chicken',name:'Pollo',kcal_per_100g:null},{id:'tofu',name:'Tofu',kcal_per_100g:80}];
const recipe:Recipe={id:'dish',name:'Pollo al horno',description:'Con verduras',instructions:'Hornear 30 minutos.',tags:['Al horno'],photo_path:null,revision:3,archived:false,lines:[{id:'line',ingredient_id:'chicken',alternatives:['tofu']}]};
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
 api.loadRecipeBook.mockResolvedValue({recipes:[recipe],ingredients,photoError:false});
 api.saveRecipe.mockResolvedValue(undefined);api.archiveRecipe.mockResolvedValue(undefined);
});
it('filtra por nombre y etiqueta y abre la ficha con alternativas',async()=>{
 render(<RecipeBook houseId="house" online/>);
 fireEvent.click(await screen.findByRole('button',{name:/Pollo al horno/}));
 expect(screen.getByRole('heading',{name:'Ingredientes'})).toBeInTheDocument();
 expect(screen.getByText('Alternativas: Tofu')).toBeInTheDocument();
 expect(screen.getByText('Hornear 30 minutos.')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Volver a carta'}));
 fireEvent.change(screen.getByLabelText('Buscar plato'),{target:{value:'sin coincidencias'}});
 expect(screen.getByText('No hay platos con estos filtros.')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Al horno'}));
 expect(screen.getByRole('button',{name:'Al horno'})).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByRole('button',{name:'Limpiar filtros'}));
 fireEvent.change(screen.getByLabelText('Buscar plato'),{target:{value:'POLLO'}});
 expect(screen.getByRole('button',{name:/Pollo al horno/})).toBeInTheDocument();
});
it('crea un plato con un ingrediente reutilizado y una alternativa',async()=>{
 render(<RecipeBook houseId="house" online/>);
 fireEvent.click(await screen.findByRole('button',{name:'Nuevo plato'}));
 fireEvent.change(screen.getByLabelText('Nombre del plato'),{target:{value:'Pollo nuevo'}});
 fireEvent.change(screen.getByLabelText('Receta'),{target:{value:'Cocinar.'}});
 fireEvent.click(screen.getByRole('button',{name:'Añadir ingrediente'}));
 fireEvent.click(screen.getByRole('button',{name:'Pollo'}));
 fireEvent.click(screen.getByRole('button',{name:'Añadir alternativa'}));
 fireEvent.click(screen.getByRole('button',{name:'Tofu'}));
 fireEvent.click(screen.getByRole('button',{name:'Guardar plato'}));
 await waitFor(()=>expect(api.saveRecipe).toHaveBeenCalledWith(null,expect.objectContaining({name:'Pollo nuevo',instructions:'Cocinar.',lines:[expect.objectContaining({ingredient_id:'chicken',alternatives:['tofu']})]})));
});
it('conserva el borrador ante un conflicto de revisión',async()=>{
 api.saveRecipe.mockRejectedValue(new Error('stale'));
 render(<RecipeBook houseId="house" online/>);
 fireEvent.click(await screen.findByRole('button',{name:/Pollo al horno/}));
 fireEvent.click(screen.getByRole('button',{name:'Editar plato'}));
 fireEvent.change(screen.getByLabelText('Nombre del plato'),{target:{value:'Cambio sin guardar'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar plato'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar');
 expect(screen.getByLabelText('Nombre del plato')).toHaveValue('Cambio sin guardar');
 expect(api.saveRecipe).toHaveBeenCalledWith(expect.objectContaining({revision:3}),expect.anything());
});
it('rechaza una foto incompatible antes de subirla',async()=>{
 render(<RecipeBook houseId="house" online/>);
 fireEvent.click(await screen.findByRole('button',{name:'Nuevo plato'}));
 fireEvent.change(screen.getByLabelText('Foto (opcional)'),{target:{files:[new File(['x'],'x.svg',{type:'image/svg+xml'})]}});
 expect(screen.getByRole('alert')).toHaveTextContent('JPEG');expect(api.uploadPhoto).not.toHaveBeenCalled();
});
it('solo archiva tras confirmación y admite restaurar desde Archivados',async()=>{
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
 render(<RecipeBook houseId="house" online/>);
 fireEvent.click(await screen.findByRole('button',{name:/Pollo al horno/}));
 fireEvent.click(screen.getByRole('button',{name:'Archivar plato'}));expect(api.archiveRecipe).not.toHaveBeenCalled();
 confirm.mockReturnValue(true);
 api.loadRecipeBook.mockResolvedValue({recipes:[{...recipe,archived:true}],ingredients,photoError:false});
 fireEvent.click(screen.getByRole('button',{name:'Archivar plato'}));
 fireEvent.click(await screen.findByRole('button',{name:'Ver archivados'}));
 const dialog=await screen.findByRole('dialog',{name:'Archivados'});
 api.loadRecipeBook.mockResolvedValue({recipes:[recipe],ingredients,photoError:false});
 fireEvent.click(within(dialog).getByRole('button',{name:'Desarchivar Pollo al horno'}));
 await waitFor(()=>expect(api.archiveRecipe).toHaveBeenLastCalledWith(expect.objectContaining({id:'dish',archived:true})));
 await within(dialog).findByText('No hay platos archivados.');
 fireEvent.click(within(dialog).getByRole('button',{name:'Cerrar archivados'}));
 expect(await screen.findByRole('button',{name:/Pollo al horno/})).toBeInTheDocument();confirm.mockRestore();
});
it('permite reintentar un fallo de carga y desactiva edición offline',async()=>{
 api.loadRecipeBook.mockRejectedValueOnce(new Error('offline'));
 const workspace=new OfflineWorkspace('recipe-offline','house');
 const {rerender}=render(<OfflineContext.Provider value={workspace}><RecipeBook houseId="house" online/></OfflineContext.Provider>);
 const alert=await screen.findByRole('alert');
 fireEvent.click(within(alert).getByRole('button',{name:'Reintentar'}));
 await screen.findByRole('button',{name:/Pollo al horno/});
 rerender(<OfflineContext.Provider value={workspace}><RecipeBook houseId="house" online={false}/></OfflineContext.Provider>);
 expect(await screen.findByRole('button',{name:'Nuevo plato'})).toBeDisabled();
});

it('una actualización recibida al abrir el editor no sustituye la revisión del borrador',async()=>{
 let resolve!:(value:{recipes:Recipe[];ingredients:typeof ingredients;photoError:boolean})=>void;
 const {rerender}=render(<HouseholdUpdates.Provider value={0}><RecipeBook houseId="house" online/></HouseholdUpdates.Provider>);
 await screen.findByRole('button',{name:/Pollo al horno/});
 api.loadRecipeBook.mockReturnValueOnce(new Promise(r=>{resolve=r;}));
 rerender(<HouseholdUpdates.Provider value={1}><RecipeBook houseId="house" online/></HouseholdUpdates.Provider>);
 fireEvent.click(screen.getByRole('button',{name:/Pollo al horno/}));
 fireEvent.click(screen.getByRole('button',{name:'Editar plato'}));
 fireEvent.change(screen.getByLabelText('Nombre del plato'),{target:{value:'Mi borrador'}});
 await act(async()=>resolve({recipes:[{...recipe,revision:4,name:'Cambio ajeno'}],ingredients,photoError:false}));
 api.saveRecipe.mockRejectedValue(new Error('stale'));
 fireEvent.click(screen.getByRole('button',{name:'Guardar plato'}));
 await screen.findByRole('alert');
 expect(api.saveRecipe).toHaveBeenCalledWith(expect.objectContaining({revision:3}),expect.objectContaining({name:'Mi borrador'}));
 expect(screen.getByLabelText('Nombre del plato')).toHaveValue('Mi borrador');
});
it('guarda etiquetas opcionales y añade el texto pendiente al guardar el plato',async()=>{
 render(<RecipeBook houseId="house" online/>);fireEvent.click(await screen.findByRole('button',{name:/Pollo al horno/}));fireEvent.click(screen.getByRole('button',{name:'Editar plato'}));
 expect(screen.queryByLabelText('Categorías')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Quitar etiqueta Al horno'}));
 fireEvent.change(screen.getByLabelText('Nueva etiqueta'),{target:{value:'  Muy   rápido '}});
 fireEvent.keyDown(screen.getByLabelText('Nueva etiqueta'),{key:'Enter'});
 fireEvent.change(screen.getByLabelText('Nueva etiqueta'),{target:{value:'Vegetariano'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar plato'}));
 await waitFor(()=>expect(api.saveRecipe).toHaveBeenCalledWith(expect.objectContaining({id:'dish'}),expect.objectContaining({tags:['Muy rápido','Vegetariano']})));
});
it('conserva el archivado y permite reintentar si desarchivar falla',async()=>{
 api.loadRecipeBook.mockResolvedValue({recipes:[{...recipe,archived:true}],ingredients,photoError:false});
 api.archiveRecipe.mockRejectedValueOnce(new Error('conflicto'));
 render(<RecipeBook houseId="house" online/>);
 fireEvent.click(await screen.findByRole('button',{name:'Ver archivados'}));
 const dialog=await screen.findByRole('dialog',{name:'Archivados'});
 fireEvent.click(within(dialog).getByRole('button',{name:'Desarchivar Pollo al horno'}));
 expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se ha podido desarchivar');
 expect(within(dialog).getByRole('button',{name:'Desarchivar Pollo al horno'})).toBeEnabled();
 expect(screen.queryByRole('button',{name:/^Pollo al horno/})).not.toBeInTheDocument();
});
it('combina varias etiquetas, limpia su selección y se actualiza sin botón Actualizar',async()=>{
 const other={...recipe,id:'other',name:'Pasta',tags:['Rápido']};
 api.loadRecipeBook.mockResolvedValue({recipes:[{...recipe,tags:['Al horno','Rápido']},other],ingredients,photoError:false});
 const {rerender}=render(<HouseholdUpdates.Provider value={0}><RecipeBook houseId="house" online/></HouseholdUpdates.Provider>);
 const quick=await screen.findByRole('button',{name:'Rápido'});fireEvent.click(quick);
 fireEvent.click(screen.getByRole('button',{name:'Al horno'}));
 expect(screen.queryByRole('button',{name:/^Pasta/})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:/^Pollo al horno/})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Limpiar filtros'}));expect(screen.getByRole('button',{name:/^Pasta/})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Actualizar'})).not.toBeInTheDocument();
 api.loadRecipeBook.mockResolvedValue({recipes:[other],ingredients,photoError:false});
 rerender(<HouseholdUpdates.Provider value={1}><RecipeBook houseId="house" online/></HouseholdUpdates.Provider>);
 await waitFor(()=>expect(screen.queryByRole('button',{name:/^Pollo al horno/})).not.toBeInTheDocument());
});

it('mantiene visible un error de publicación tras una recarga Realtime',async()=>{
 vi.spyOn(window,'confirm').mockReturnValue(true);vi.mocked(publishRecipe).mockRejectedValueOnce(new Error('La función ha rechazado la sesión.'));
 const {rerender}=render(<HouseholdUpdates.Provider value={0}><RecipeBook houseId="house" online/></HouseholdUpdates.Provider>);
 fireEvent.click(await screen.findByRole('button',{name:/Pollo al horno/}));fireEvent.click(screen.getByRole('button',{name:'Publicar'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('La función ha rechazado la sesión.');
 rerender(<HouseholdUpdates.Provider value={1}><RecipeBook houseId="house" online/></HouseholdUpdates.Provider>);
 await waitFor(()=>expect(api.loadRecipeBook).toHaveBeenCalledTimes(2));expect(screen.getByRole('alert')).toHaveTextContent('La función ha rechazado la sesión.');
});
