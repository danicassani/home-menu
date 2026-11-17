import type { createClient } from '@supabase/supabase-js';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
export function createPublicationHandler(factory:typeof createClient,env:{url:string;anon:string;key:string}){const createClient=factory;return async(request:Request)=>{
 if(request.method==='OPTIONS')return new Response(null,{headers});
 const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json'}});
 if(request.method!=='POST')return reply(405,{error:'Método no permitido'});
 try{
  const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply(401,{error:'Sesión requerida'});
  const {url,anon,key}=env;if(!url||!anon||!key)return reply(503,{error:'Servicio no configurado'});
  const client=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const input=await request.json();
  const scheduled=authorization==='Bearer '+key&&input.action==='cleanup';
  if(!scheduled){const identity=await client.auth.getUser(authorization.slice(7));if(identity.error||!identity.data.user)return reply(401,{error:'Sesión no válida'});}
  if(!['publish','save','cleanup'].includes(input.action))return reply(400,{error:'Operación no válida'});
  const service=createClient(url,key,{auth:{persistSession:false}});
  if(input.action==='cleanup'){
   const admin=scheduled?{data:true,error:null}:await client.rpc('is_catalog_admin');if(admin.error||admin.data!==true)return reply(403,{error:'Solo administradores'});
   const unused=await service.rpc('catalog_unused_photos');if(unused.error)throw unused.error;
   for(let index=0;index<(unused.data||[]).length;index+=100){const result=await service.storage.from('catalog-photos').remove(unused.data.slice(index,index+100).map((row:{name:string})=>row.name));if(result.error)throw result.error;const finished=await service.rpc('catalog_finish_photo_gc',{p_names:unused.data.slice(index,index+100).map((row:{name:string})=>row.name)});if(finished.error)throw finished.error;}
   return reply(200,{removed:unused.data?.length||0});
  }
  const source=await client.from('recipes').select('id,household_id,photo_path,catalog_imported').eq('id',input.recipe).single();
  if(source.error||source.data?.catalog_imported)return reply(403,{error:'Receta no disponible para publicar'});
  const path=input.action==='save'?input.draft?.photo_path:source.data.photo_path;
  if(path!==null&&path!==undefined){
   if(typeof path!=='string'||path.split('/')[0]!==source.data.household_id||path.split('/').length!==2||!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(path.split('/')[1]))return reply(400,{error:'Foto no válida'});
   const original=await client.storage.from('recipe-photos').download(path);if(original.error)throw original.error;
   const copy=await service.storage.from('catalog-photos').upload(path,original.data,{contentType:original.data.type,upsert:false});
   if(copy.error){
    const existing=await service.storage.from('catalog-photos').download(path);if(existing.error)throw existing.error;
    const digest=async(blob:Blob)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).join(',');
    if(await digest(existing.data)!==await digest(original.data))throw new Error('La foto preparada no coincide');
   }
  }
  const draft=input.draft;
  const result=input.action==='publish'?await client.rpc('publish_recipe',{p_recipe:source.data.id,p_revision:input.revision}):await client.rpc('save_recipe',{
   p_id:source.data.id,p_revision:input.revision,p_name:draft.name,p_description:draft.description,p_instructions:draft.instructions,p_tags:draft.tags,p_photo_path:draft.photo_path,p_lines:draft.lines,p_clear_photo:Boolean(draft.clearPhoto)
  });
  if(result.error)return reply(409,{error:'El plato ha cambiado o no se ha podido publicar. Recarga e inténtalo de nuevo.'});
  return reply(200,{data:result.data});
 }catch{return reply(400,{error:'No se ha podido preparar la publicación. Inténtalo de nuevo.'});}
};}
