import { expect, it } from 'vitest';
import { cachedIdentity, cachedHouse, OfflineWorkspace } from './offline';
it('descarta snapshots con categorías/desayunos antiguos y conserva identidad, pertenencia y marcas pendientes',async()=>{
 const identity={id:'u',user_metadata:{full_name:'Alex'}};
 const house={id:'h',name:'Casa',owner_id:'u',membership_id:'m',deletion_requested_at:null};
 const mark={operation:'operation',item:'generation',week:'2026-11-16',purchased:true};
 await new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('home-menu-private',1);request.onupgradeneeded=()=>request.result.createObjectStore('data',{keyPath:'key'});request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('data','readwrite'),store=tx.objectStore('data');
   for(const [key,value] of [['identity',identity],['u/membership',house],['u/h/m/queue',{marks:[mark],discarded:0}],['u/h/m/book',{recipes:[{categories:['breakfast']}]}],['u/h/m/menu:2026-11-16',{entries:[{meal:'breakfast'}]}],['u/h/m/shopping:2026-11-16',{list:[{id:'breakfast-product'}]}]])store.put({key,user:'u',house:'h',value});
   tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
  };
 });
 expect(await cachedIdentity()).toEqual(identity);expect(await cachedHouse('u')).toEqual(house);
 const workspace=new OfflineWorkspace('u','h','m');expect((await workspace.queue()).marks).toEqual([mark]);
 expect(await workspace.read('book')).toBeNull();expect(await workspace.read('menu:2026-11-16')).toBeNull();expect(await workspace.read('shopping:2026-11-16')).toBeNull();
});
