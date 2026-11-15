import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({loadRecipeBook:vi.fn(),saveRecipe:vi.fn(),archiveRecipe:vi.fn(),addIngredient:vi.fn(),uploadPhoto:vi.fn()}));
vi.mock('./recipes',async importOriginal=>({...await importOriginal<typeof import('./recipes')>(),...api}));
import RecipeBook from './RecipeBook';
import type { Recipe } from './recipes';
const ingredients=[{id:'chicken',name:'Pollo',kcal_per_100g:null},{id:'tofu',name:'Tofu',kcal_per_100g:80}];
const recipe:Recipe={id:'dish',name:'Pollo al horno',description:'Con verduras',instructions:'Hornear 30 minutos.',categories:['lunch'],photo_path:null,revision:3,archived:false,lines:[{id:'line',ingredient_id:'chicken',alternatives:['tofu']}]};
beforeEach(()=>{
 api.loadRecipeBook.mockResolvedValue({recipes:[recipe],ingredients,photoError:false});
 api.saveRecipe.mockResolvedValue(undefined);api.archiveRecipe.mockResolvedValue(undefined);
});
it('filtra por nombre y categoría y abre la ficha con alternativas',async()=>{
 render(<RecipeBook houseId="house" online/>);
 fireEvent.click(await screen.findByRole('button',{name:/Pollo al horno/}));
 expect(screen.getByRole('heading',{name:'Ingredientes'})).toBeInTheDocument();
 expect(screen.getByText('Alternativas: Tofu')).toBeInTheDocument();
 expect(screen.getByText('Hornear 30 minutos.')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Volver a carta'}));
 fireEvent.change(screen.getByLabelText('Categoría'),{target:{value:'breakfast'}});
 expect(screen.getByText('No hay platos con estos filtros.')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Categoría'),{target:{value:''}});
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
 await screen.findByLabelText('Archivados');
 fireEvent.click(screen.getByLabelText('Archivados'));
 fireEvent.click(screen.getByRole('button',{name:/Pollo al horno/}));
 expect(screen.getByRole('button',{name:'Restaurar plato'})).toBeInTheDocument();confirm.mockRestore();
});
it('permite reintentar un fallo de carga y desactiva edición offline',async()=>{
 api.loadRecipeBook.mockRejectedValueOnce(new Error('offline'));
 render(<RecipeBook houseId="house" online={false}/>);
 const alert=await screen.findByRole('alert');
 fireEvent.click(within(alert).getByRole('button',{name:'Reintentar'}));
 expect(await screen.findByRole('button',{name:'Nuevo plato'})).toBeDisabled();
});
