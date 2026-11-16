import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const mock=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn()}));
vi.mock('./supabase',()=>({supabase:mock}));
vi.mock('./realtime',async original=>({...await original<typeof import('./realtime')>(),useHouseholdRealtime:()=>({revision:0,status:'live'})}));
vi.mock('./realtime',async original=>({...await original<typeof import('./realtime')>(),useHouseholdRealtime:()=>({revision:0,status:'live'})}));
import Household from './Household';
beforeEach(()=>{
 sessionStorage.clear();
 mock.from.mockReturnValue({select:()=>({maybeSingle:async()=>({data:null,error:null})})});
 mock.rpc.mockResolvedValue({data:'house-id',error:null});
});
it('crea una casa con nombre y vuelve a consultar el estado',async()=>{
 render(<Household userId="user" online/>);
 fireEvent.change(await screen.findByLabelText('Nombre'),{target:{value:'Casa'}});
 fireEvent.click(screen.getByRole('button',{name:'Crear casa'}));
 await waitFor(()=>expect(mock.rpc).toHaveBeenCalledWith('create_household',{house_name:'Casa'}));
});
it('exige confirmación antes de aceptar una invitación',async()=>{
 sessionStorage.setItem('home-menu-invitation','token');
 render(<Household userId="user" online/>);
 const button=await screen.findByRole('button',{name:'Aceptar invitación'});
 expect(mock.rpc).not.toHaveBeenCalled();
 fireEvent.click(button);
 await waitFor(()=>expect(mock.rpc).toHaveBeenCalledWith('accept_household_invitation',{token:'token'}));
 await waitFor(()=>expect(sessionStorage.getItem('home-menu-invitation')).toBeNull());
});
it('informa de fallos sin borrar la invitación pendiente',async()=>{
 sessionStorage.setItem('home-menu-invitation','token');
 mock.rpc.mockResolvedValue({error:new Error('expired')});
 render(<Household userId="user" online/>);
 fireEvent.click(await screen.findByRole('button',{name:'Aceptar invitación'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('No se puede aceptar');
 expect(sessionStorage.getItem('home-menu-invitation')).toBe('token');
});
