import { beforeEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),house:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{rpc:api.rpc,from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{membership_id:''},error:null})}),maybeSingle:api.house})})}}));
import { OfflineWorkspace, cachedIdentity, rememberIdentity, cachedHouse, forgetPrivate, rememberHouse, retainPrivateUser } from './offline';
import { offlineResource } from './offlineResources';
const week='2026-11-16',house={id:'home',owner_id:'u',name:'Casa',deletion_requested_at:null};
const item={id:'item-generation',ingredient_id:'rice',name:'Arroz',manual:true,from_menu:false,purchased:false};
beforeEach(async()=>{
 Object.defineProperty(navigator,'onLine',{value:true,configurable:true});
 Object.defineProperty(navigator,'locks',{value:{request:async(_key:string,callback:()=>Promise<void>)=>callback()},configurable:true});
 await retainPrivateUser('u');await forgetPrivate('u');
 api.house.mockResolvedValue({data:house,error:null});api.rpc.mockResolvedValue({data:'applied',error:null});
});
it('recupera una instantánea solo de la cuenta, casa y semana correspondientes',async()=>{
 const workspace=new OfflineWorkspace('u','home'),other=new OfflineWorkspace('u','another');
 await workspace.cache('shopping:'+week,{list:[item]});await rememberHouse('u',house);
 expect(await cachedHouse('u')).toEqual(house);expect(await other.read('shopping:'+week)).toBeNull();
 const load=vi.fn();expect(await offlineResource(workspace,'shopping:'+week,false,load)).toEqual({list:[item]});expect(load).not.toHaveBeenCalled();
 await expect(offlineResource(workspace,'shopping:2026-11-23',false,load)).rejects.toThrow('Sin datos');
 await retainPrivateUser('another-user');expect(await cachedHouse('another-user')).toBeNull();
 await expect(workspace.read('shopping:'+week)).rejects.toThrow();
});
it('persiste y compacta las marcas sin conexión y las superpone sin declararlas sincronizadas',async()=>{
 const workspace=new OfflineWorkspace('u','home');await workspace.mark(week,item.id,true);await workspace.mark(week,item.id,false);
 workspace.close();const reopened=new OfflineWorkspace('u','home');
 expect((await reopened.queue()).marks).toEqual([expect.objectContaining({item:item.id,purchased:false})]);
 expect(await reopened.overlay(week,[item])).toEqual([item]);
 expect(api.rpc).not.toHaveBeenCalled();
});
it('conserva el identificador tras fallo de red y actualiza la instantánea al confirmar',async()=>{
 const workspace=new OfflineWorkspace('u','home');await workspace.cache('shopping:'+week,{list:[item]});await workspace.mark(week,item.id,true);
 const operation=(await workspace.queue()).marks[0].operation;
 api.rpc.mockResolvedValueOnce({error:{message:'red'}});await expect(workspace.sync()).rejects.toBeDefined();
 expect((await workspace.queue()).marks[0].operation).toBe(operation);
 await workspace.sync();expect(api.rpc.mock.calls.map(call=>call[1].p_operation)).toEqual([operation,operation]);
 expect((await workspace.queue()).marks).toHaveLength(0);
 expect(await workspace.read('shopping:'+week)).toEqual({list:[{...item,purchased:true}]});
});
it('no elimina una nueva marca creada mientras se confirma la anterior',async()=>{
 const workspace=new OfflineWorkspace('u','home');await workspace.mark(week,item.id,true);
 let resolve!:(value:unknown)=>void;api.rpc.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 const sending=workspace.sync();await vi.waitFor(()=>expect(api.rpc).toHaveBeenCalledTimes(1));
 await workspace.mark(week,item.id,false);resolve({data:'applied',error:null});await sending;
 expect(api.rpc.mock.calls.map(call=>call[1].p_purchased)).toEqual([true,false]);expect((await workspace.queue()).marks).toHaveLength(0);
});
it('descarta una generación eliminada y conserva otros productos y semanas',async()=>{
 const workspace=new OfflineWorkspace('u','home');await workspace.cache('shopping:'+week,{list:[item,{...item,id:'new-generation'}]});await workspace.mark(week,item.id,true);
 api.rpc.mockResolvedValue({data:'stale',error:null});await workspace.sync();
 expect(await workspace.queue()).toMatchObject({marks:[],discarded:1});
 expect(await workspace.read('shopping:'+week)).toEqual({list:[{...item,id:'new-generation'}]});
});
it('borra datos y pendientes antes de enviar si se ha perdido la pertenencia',async()=>{
 const workspace=new OfflineWorkspace('u','home');await rememberHouse('u',house);await workspace.cache('book',{name:'privado'});await workspace.mark(week,item.id,true);
 api.house.mockResolvedValue({data:null,error:null});await workspace.sync();
 expect(workspace.closed).toBe(true);expect(api.rpc).not.toHaveBeenCalled();expect(await cachedHouse('u')).toBeNull();
 const reopened=new OfflineWorkspace('u','home');expect(await reopened.read('book')).toBeNull();expect((await reopened.queue()).marks).toHaveLength(0);
});
it('impide que respuestas antiguas repueblen una casa borrada o una sesión cerrada',async()=>{
 const workspace=new OfflineWorkspace('u','home');await workspace.cache('book',{name:'privado'});await forgetPrivate('u','home');
 await workspace.cache('book',{name:'respuesta tardía'});expect(await new OfflineWorkspace('u','home').read('book')).toBeNull();
 await retainPrivateUser(null);await expect(rememberHouse('u',house)).rejects.toThrow('Sesión cambiada');
 await retainPrivateUser('u');expect(await cachedHouse('u')).toBeNull();
});

it('guarda solo la identidad mínima y la elimina al cerrar sesión',async()=>{
 const account={id:'u',user_metadata:{full_name:'Alex',secret:'no guardar'},access_token:'no guardar'};
 await rememberIdentity(account);expect(await cachedIdentity()).toEqual({id:'u',user_metadata:{full_name:'Alex',name:undefined}});
 await retainPrivateUser(null);expect(await cachedIdentity()).toBeNull();
});
it('no declara una marca guardada si falla IndexedDB',async()=>{
 const workspace=new OfflineWorkspace('u','home');
 const put=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementationOnce(()=>{throw new DOMException('Sin espacio','QuotaExceededError');});
 await expect(workspace.mark(week,item.id,true)).rejects.toBeDefined();put.mockRestore();
 expect(workspace.storageError).toBe(true);expect((await workspace.queue()).marks).toHaveLength(0);expect(api.rpc).not.toHaveBeenCalled();
});

it('no restaura la pertenencia si se revoca mientras espera a guardar',async()=>{
 const pending=rememberHouse('u',house);
 const clearing=forgetPrivate('u',house.id);
 await expect(pending).rejects.toThrow('Acceso retirado');await clearing;
 expect(await cachedHouse('u')).toBeNull();
});
