import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
const api=vi.hoisted(()=>({loadPreferences:vi.fn(),savePreferences:vi.fn()}));
vi.mock('./preferences',async original=>({...await original<typeof import('./preferences')>(),...api}));
import AccountProfile from './AccountProfile';
const user={id:'user',user_metadata:{full_name:'Alex'},app_metadata:{},aud:'authenticated',created_at:'2026-11-16T00:00:00Z'} satisfies User;
beforeEach(()=>{
 Object.defineProperty(window,'matchMedia',{configurable:true,value:vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}))});
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
 api.loadPreferences.mockResolvedValue({theme:'white',mode:'system',avatar:null});
 api.savePreferences.mockResolvedValue({theme:'blue',mode:'dark',avatar:'🍋'});
});
async function open(){await waitFor(()=>expect(screen.getByRole('button',{name:'Abrir perfil de Alex'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Abrir perfil de Alex'}));}
it('previsualiza cambios y Cancelar restaura la apariencia guardada',async()=>{
 render(<AccountProfile user={user} online/>);await open();
 fireEvent.click(screen.getByRole('radio',{name:'Azul'}));
 fireEvent.change(screen.getByRole('combobox',{name:'Modo'}),{target:{value:'dark'}});
 expect(document.documentElement.dataset.theme).toBe('blue');expect(document.documentElement.dataset.mode).toBe('dark');
 fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));
 expect(document.documentElement.dataset.theme).toBe('white');expect(document.documentElement.dataset.mode).toBe('light');expect(api.savePreferences).not.toHaveBeenCalled();
});
it('guarda las preferencias de la cuenta y actualiza el avatar',async()=>{
 render(<AccountProfile user={user} online/>);await open();
 fireEvent.click(screen.getByRole('radio',{name:'Limón'}));fireEvent.click(screen.getByRole('radio',{name:'Azul'}));
 fireEvent.change(screen.getByRole('combobox',{name:'Modo'}),{target:{value:'dark'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar perfil'}));
 await waitFor(()=>expect(api.savePreferences).toHaveBeenCalledWith('user',{theme:'blue',mode:'dark',avatar:'🍋'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Abrir perfil de Alex'})).toHaveTextContent('🍋'));
});
it('no cierra ni pierde el borrador si falla el guardado',async()=>{
 api.savePreferences.mockRejectedValue(new Error('network'));
 render(<AccountProfile user={user} online/>);await open();fireEvent.click(screen.getByRole('radio',{name:'Rojo'}));
 fireEvent.click(screen.getByRole('button',{name:'Guardar perfil'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('No se han guardado');expect(screen.getByRole('radio',{name:'Rojo'})).toBeChecked();
});
it('permite reintentar la carga sin escribir valores por defecto sobre un perfil desconocido',async()=>{
 api.loadPreferences.mockRejectedValueOnce(new Error('network'));
 render(<AccountProfile user={user} online/>);await open();expect(screen.getByRole('button',{name:'Guardar perfil'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Reintentar perfil'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Guardar perfil'})).toBeEnabled());expect(api.savePreferences).not.toHaveBeenCalled();
});
it('limpia la apariencia al desmontar y desactiva el guardado offline',async()=>{
 api.loadPreferences.mockResolvedValue({theme:'green',mode:'dark',avatar:'🥑'});
 const {unmount}=render(<AccountProfile user={user} online={false}/>);await open();
 expect(screen.getByRole('button',{name:'Guardar perfil'})).toBeDisabled();unmount();
 expect(document.documentElement.dataset.theme).toBeUndefined();expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
});
