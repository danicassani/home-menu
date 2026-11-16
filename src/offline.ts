import { createContext, useContext } from 'react';
import { supabase } from './supabase';
import type { House } from './householdManagement';
import type { ShoppingItem } from './shopping';

// Only structured, account-scoped snapshots live here. Never cache tokens, signed URLs or photos.
type RecordData={key:string;user:string;house:string;value:unknown};
export type Mark={operation:string;item:string;week:string;purchased:boolean};
type Queue={marks:Mark[];discarded:number};
let database:Promise<IDBDatabase>|undefined;
function db(){
 if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('home-menu-private',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('data',{keyPath:'key'});
  request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();database=undefined;};resolve(request.result);};
  request.onerror=()=>reject(request.error);
 }).catch(error=>{database=undefined;throw error;});
 return database;
}
async function transaction<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore,done:(value:T)=>void)=>void):Promise<T>{
 const database=await db();return new Promise((resolve,reject)=>{
  const tx=database.transaction('data',mode);let value:T;
  tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Almacenamiento cancelado'));
  try{run(tx.objectStore('data'),v=>{value=v;});}catch(error){tx.abort();reject(error);}
 });
}
let activeUser:string|null|undefined;
function guardUser(user:string){if(activeUser!==undefined&&activeUser!==user)throw new Error('Sesión cambiada');}
const instances=new Set<OfflineWorkspace>();
const accessEpoch=new Map<string,number>();
const epoch=(user:string,house:string)=>accessEpoch.get(user+'/'+house)||0;
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('home-menu-private'):null;
export const OfflineContext=createContext<OfflineWorkspace|null>(null);
export const useOffline=()=>useContext(OfflineContext);
function notify(broadcast=true){window.dispatchEvent(new Event('home-menu-offline-change'));if(broadcast)channel?.postMessage({kind:'changed'});}
function invalidate(user:string,house?:string){
 if(house)accessEpoch.set(user+'/'+house,epoch(user,house)+1);
 for(const workspace of instances)if(workspace.user===user&&(!house||workspace.house===house))workspace.close();
 window.dispatchEvent(new CustomEvent('home-menu-access-cleared',{detail:{user,house}}));
}
channel?.addEventListener('message',event=>{const {user,house,kind}=event.data||{};if(kind==='changed')notify(false);else if(typeof user==='string')invalidate(user,house);});
export async function forgetPrivate(user:string,house?:string){
 invalidate(user,house);channel?.postMessage({user,house});
 await transaction<void>('readwrite',(store,done)=>{
  const request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor){done();return;}
   const row=cursor.value as RecordData;if(row.user===user&&(!house||row.house===house))cursor.delete();cursor.continue();};
 });notify();
}
export async function retainPrivateUser(user:string|null){
 activeUser=user;
 for(const workspace of instances)if(workspace.user!==user)workspace.close();
 await transaction<void>('readwrite',(store,done)=>{
  const request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor){done();return;}
   if(activeUser===user&&cursor.value.user!==user)cursor.delete();cursor.continue();};
 });
}
export async function cachedHouse(user:string):Promise<House|null>{
 guardUser(user);return transaction('readonly',(store,done)=>{guardUser(user);const r=store.get(`${user}/membership`);r.onsuccess=()=>done(r.result?.value||null);});
}
export async function rememberHouse(user:string,house:House){
 const expected=epoch(user,house.id);guardUser(user);await transaction<void>('readwrite',(store,done)=>{guardUser(user);if(epoch(user,house.id)!==expected)throw new Error('Acceso retirado');store.put({key:`${user}/membership`,user,house:house.id,value:house});done();});
}
export type OfflineIdentity={id:string;user_metadata:{full_name?:string;name?:string}};
export async function cachedIdentity():Promise<OfflineIdentity|null>{
 return transaction('readonly',(store,done)=>{const r=store.get('identity');r.onsuccess=()=>done(r.result?.value||null);});
}
export async function rememberIdentity(user:OfflineIdentity){
 guardUser(user.id);await transaction<void>('readwrite',(store,done)=>{
  guardUser(user.id);store.put({key:'identity',user:user.id,house:'',value:{id:user.id,user_metadata:{full_name:user.user_metadata.full_name,name:user.user_metadata.name}}});done();
 });
}
export class OfflineWorkspace {
 closed=false;
 storageError=false;
 constructor(readonly user:string,readonly house:string,readonly membership=''){instances.add(this);}
 close(){this.closed=true;instances.delete(this);notify();}
 private key(name:string){return `${this.user}/${this.house}/${this.membership}/${name}`;}
 private check(){guardUser(this.user);if(this.closed)throw new Error('Acceso retirado');}
 async read<T>(name:string):Promise<T|null>{
  this.check();try{return await transaction('readonly',(store,done)=>{this.check();const r=store.get(this.key(name));r.onsuccess=()=>done(r.result?.value??null);});}
  catch(error){if(!this.storageError){this.storageError=true;notify();}throw error;}
 }
 async update<T>(name:string,change:(old:T|null)=>T):Promise<T>{
  this.check();try{return await transaction('readwrite',(store,done)=>{
   this.check();const r=store.get(this.key(name));r.onsuccess=()=>{
    try{this.check();const value=change(r.result?.value??null);store.put({key:this.key(name),user:this.user,house:this.house,value});done(value);}
    catch{store.transaction.abort();}
   };
  });}catch(error){if(!this.storageError){this.storageError=true;notify();}throw error;}
 }
 async cache<T>(name:string,value:T){try{await this.update(name,()=>value);}catch{/* Online data remains usable; the UI reports unavailable local storage. */}}
 async queue(){return await this.read<Queue>('queue')||{marks:[],discarded:0};}
 async mark(week:string,item:string,purchased:boolean){
  const operation=crypto.randomUUID();
  await this.update<Queue>('queue',old=>({marks:[...(old?.marks||[]).filter(m=>m.item!==item),{operation,item,week,purchased}],discarded:old?.discarded||0}));notify();
 }
 async overlay(week:string,items:ShoppingItem[]){
  const queue=await this.queue();return items.map(item=>{
   const mark=queue.marks.find(m=>m.week===week&&m.item===item.id);return mark?{...item,purchased:mark.purchased}:item;
  });
 }
 async sync(){
  this.check();if(!navigator.onLine)return;
  // Serialize sends across tabs; transactions keep queue edits and acknowledgements atomic.
  if(!navigator.locks)throw new Error('Sincronización no disponible en este navegador');
  await navigator.locks.request('home-menu-sync:'+this.user+'/'+this.house,async()=>{
   this.check();if(!navigator.onLine)return;
   const membership=await supabase!.from('households').select('id,deletion_requested_at').maybeSingle();
   this.check();if(membership.error)throw membership.error;
   if(membership.data?.id!==this.house||membership.data.deletion_requested_at){await forgetPrivate(this.user,this.house);return;}
   const member=await supabase!.from('household_members').select('membership_id').eq('user_id',this.user).maybeSingle();
   this.check();if(member.error)throw member.error;
   if(member.data?.membership_id!==this.membership){await forgetPrivate(this.user,this.house);return;}
   while(navigator.onLine&&!this.closed){
    const queue=await this.queue();const mark=queue.marks[0];if(!mark)break;
    const result=await supabase!.rpc('apply_shopping_mark',{p_operation:mark.operation,p_house:this.house,p_membership:this.membership,p_week:mark.week,p_item:mark.item,p_purchased:mark.purchased});
    this.check();if(result.error)throw result.error;
    if(result.data!=='applied'&&result.data!=='stale')throw new Error('Respuesta no válida');
    await transaction<void>('readwrite',(store,done)=>{
     this.check();const queued=store.get(this.key('queue'));
     queued.onsuccess=()=>{
      if(this.closed){store.transaction.abort();return;}
      const old=queued.result?.value as Queue|undefined;
      store.put({key:this.key('queue'),user:this.user,house:this.house,value:{marks:(old?.marks||[]).filter(m=>m.operation!==mark.operation),discarded:(old?.discarded||0)+(result.data==='stale'?1:0)}});
      const snapshot=store.get(this.key('shopping:'+mark.week));snapshot.onsuccess=()=>{
       if(snapshot.result){const row=snapshot.result;row.value.list=result.data==='stale'?row.value.list.filter((i:ShoppingItem)=>i.id!==mark.item):row.value.list.map((i:ShoppingItem)=>i.id===mark.item?{...i,purchased:mark.purchased}:i);store.put(row);}done();
      };
     };
    });
    notify();
   }
  });
 }
}
