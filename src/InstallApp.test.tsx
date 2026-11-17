import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import InstallApp from './InstallApp';
const registration=vi.fn();
const worker=()=>({state:'installed',postMessage:vi.fn()} as unknown as ServiceWorker);
function announce(worker:ServiceWorker){window.dispatchEvent(new CustomEvent('home-menu-update',{detail:worker}));}
beforeEach(()=>{
 Object.defineProperty(window,'matchMedia',{configurable:true,value:vi.fn(()=>({matches:false}))});
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:registration,controller:{}}});
 registration.mockResolvedValue(undefined);
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
});
it('anuncia una actualización pendiente con popup y solo activa al aceptar',async()=>{
 const waiting=worker();registration.mockResolvedValue({waiting});render(<InstallApp/>);
 const dialog=await screen.findByRole('dialog',{name:'Actualización disponible'});
 expect(dialog).toBeVisible();expect(screen.getByRole('button',{name:'Más tarde'})).toBeInTheDocument();
 expect(waiting.postMessage).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Actualizar app'}));expect(waiting.postMessage).toHaveBeenCalledExactlyOnceWith('ACTIVATE');
});
it('Más tarde no recarga, ignora avisos repetidos y permite avisar de una nueva versión',async()=>{
 const first=worker(),second=worker();render(<InstallApp/>);announce(first);
 fireEvent.click(await screen.findByRole('button',{name:'Más tarde'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(first.postMessage).not.toHaveBeenCalled();
 announce(first);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();announce(second);
 expect(await screen.findByRole('dialog',{name:'Actualización disponible'})).toBeVisible();
});
it('aplaza el popup mientras hay otro diálogo abierto y Escape lo descarta sin activar',async()=>{
 const other=document.createElement('dialog');document.body.append(other);other.showModal();
 const waiting=worker();const {unmount}=render(<InstallApp/>);announce(waiting);
 expect(screen.queryByRole('dialog',{name:'Actualización disponible'})).not.toBeInTheDocument();other.close();
 const popup=await screen.findByRole('dialog',{name:'Actualización disponible'});fireEvent(popup,new Event('cancel',{cancelable:true}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Actualización disponible'})).not.toBeInTheDocument());expect(waiting.postMessage).not.toHaveBeenCalled();unmount();other.remove();
});
it('conserva el popup con un error si la activación falla',async()=>{
 const waiting=worker();vi.mocked(waiting.postMessage).mockImplementation(()=>{throw new Error('worker perdido');});
 render(<InstallApp/>);announce(waiting);fireEvent.click(await screen.findByRole('button',{name:'Actualizar app'}));
 expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido actualizar');expect(screen.getByRole('button',{name:'Más tarde'})).toBeEnabled();
});
it('conserva la instalación de la app sin añadir un botón de actualización al pie',async()=>{
 const prompt=vi.fn().mockResolvedValue(undefined),event=new Event('beforeinstallprompt',{cancelable:true});
 Object.assign(event,{prompt,userChoice:Promise.resolve({outcome:'accepted'})});
 render(<InstallApp/>);window.dispatchEvent(event);fireEvent.click(await screen.findByRole('button',{name:'Instalar app'}));
 await waitFor(()=>expect(prompt).toHaveBeenCalledTimes(1));expect(event.defaultPrevented).toBe(true);
 window.dispatchEvent(new Event('appinstalled'));await waitFor(()=>expect(screen.queryByRole('button',{name:'Instalar app'})).not.toBeInTheDocument());
 expect(screen.queryByRole('button',{name:'Actualizar app'})).not.toBeInTheDocument();
});
