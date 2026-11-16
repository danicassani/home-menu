import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({loadShoppingWeek:vi.fn(),setPurchased:vi.fn(),setManualItem:vi.fn()}));
vi.mock('./shopping',()=>api);
vi.mock('./supabase',()=>({supabase:{from:()=>({select:()=>({eq:()=>({order:async()=>({data:[],error:null})})})})}}));
import ShoppingList from './ShoppingList';
import { HouseholdUpdates } from './realtime';
const item={id:'generation',ingredient_id:'rice',name:'Arroz',from_menu:true,manual:false,purchased:false};
const props={houseId:'house',week:'2026-11-16',online:true,onWeekChange:vi.fn()};
beforeEach(()=>{api.loadShoppingWeek.mockResolvedValue([item]);api.setPurchased.mockResolvedValue([{...item,purchased:true}]);api.setManualItem.mockResolvedValue([{...item,manual:false}]);});
it('mueve un ingrediente a Comprados y permite desmarcarlo',async()=>{
 render(<ShoppingList {...props}/>);
 fireEvent.click(await screen.findByRole('checkbox',{name:'Arroz'}));
 await waitFor(()=>expect(api.setPurchased).toHaveBeenCalledWith('generation',true));
 fireEvent.click(screen.getByText('Comprados (1)'));
 const bought=within(screen.getByRole('list',{name:'Comprados'}));
 api.setPurchased.mockResolvedValue([item]);fireEvent.click(bought.getByRole('checkbox',{name:'Arroz'}));
 await waitFor(()=>expect(within(screen.getByRole('list',{name:'Pendientes'})).getByRole('checkbox',{name:'Arroz'})).toBeInTheDocument());
});
it('quita solo la aportación manual de un ingrediente que también viene del menú',async()=>{
 api.loadShoppingWeek.mockResolvedValue([{...item,manual:true}]);render(<ShoppingList {...props}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Quitar producto manual Arroz'}));
 await waitFor(()=>expect(api.setManualItem).toHaveBeenCalledWith('2026-11-16','rice',false));
 expect(screen.getByRole('checkbox',{name:'Arroz'})).toBeInTheDocument();
});
it('conserva el estado visible ante un fallo y no permite marcar sin conexión',async()=>{
 api.setPurchased.mockRejectedValue(new Error('stale'));
 const {rerender}=render(<ShoppingList {...props}/>);fireEvent.click(await screen.findByRole('checkbox',{name:'Arroz'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Actualiza la compra');
 expect(screen.getByRole('checkbox',{name:'Arroz'})).not.toBeChecked();
 rerender(<ShoppingList {...props} online={false}/>);expect(screen.getByRole('checkbox',{name:'Arroz'})).toBeDisabled();
});
it('una recarga antigua no sobrescribe una marca confirmada',async()=>{
 let resolve!:(value:typeof item[])=>void;
 const {rerender}=render(<HouseholdUpdates.Provider value={0}><ShoppingList {...props}/></HouseholdUpdates.Provider>);
 await screen.findByRole('checkbox',{name:'Arroz'});
 api.loadShoppingWeek.mockReturnValueOnce(new Promise<typeof item[]>(r=>{resolve=r;}));
 rerender(<HouseholdUpdates.Provider value={1}><ShoppingList {...props}/></HouseholdUpdates.Provider>);
 fireEvent.click(screen.getByRole('checkbox',{name:'Arroz'}));
 await screen.findByText('Todo comprado.');
 await act(async()=>resolve([item]));
 expect(screen.getByText('Comprados (1)')).toBeInTheDocument();
});
