import { supabase } from './supabase';
export type House={id:string;name:string;owner_id:string;deletion_requested_at:string|null;membership_id?:string};
export type Member={user_id:string;display_name:string;is_owner:boolean};
function client(){if(!supabase)throw new Error('Supabase no configurado');return supabase;}
export async function getMembers():Promise<Member[]>{const r=await client().rpc('get_household_members');if(r.error)throw r.error;return r.data;}
export async function manageMember(action:'remove'|'transfer'|'leave',user?:string){
 const c=client();const r=action==='leave'?await c.rpc('leave_household'):await c.rpc(action==='remove'?'remove_household_member':'transfer_household',{p_user:user});if(r.error)throw r.error;
}
export async function deleteHousehold(house:House,confirmation:string) {
 const c=client();
 const begin=await c.rpc('begin_household_deletion',{p_house:house.id,p_confirmation:confirmation});if(begin.error)throw begin.error;
 const bucket=c.storage.from('recipe-photos');
 async function emptyFolder(prefix:string):Promise<void> {
  let previous='';
  for(;;){
   const result=await bucket.list(prefix,{limit:100,offset:0,sortBy:{column:'name',order:'asc'}});if(result.error)throw result.error;
   if(!result.data?.length)return;
   const signature=JSON.stringify(result.data.map(e=>[e.id,e.name]));
   if(signature===previous)throw new Error('No se ha podido avanzar en la limpieza de fotos');
   previous=signature;
   const files:string[]=[];
   for(const entry of result.data){
    if(!entry.name||entry.name.includes('/')||entry.name==='.'||entry.name==='..')throw new Error('Ruta de foto inválida');
    const path=prefix+'/'+entry.name;
    if(entry.id)files.push(path);else await emptyFolder(path);
   }
   if(files.length){const removed=await bucket.remove(files);if(removed.error)throw removed.error;}
  }
 }
 await emptyFolder(house.id);
 const finish=await c.rpc('finish_household_deletion',{p_house:house.id});if(finish.error)throw finish.error;
}
