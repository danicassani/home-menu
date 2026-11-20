import { supabase } from './supabase';
export async function publicationRequest(body:Record<string,unknown>):Promise<unknown>{
 if(!supabase)throw new Error('Servicio no disponible');
 const result=await supabase.functions.invoke('catalog-publication',{body});
 if(result.error){
  const response=(result.error as {context?:Response}).context;
  if(response&&typeof response.clone==='function'){
   const data=await response.clone().json().catch(()=>null);
   if(typeof data?.error==='string')throw new Error(data.error);
   if(response.status===401)throw new Error('La función ha rechazado la sesión. Revisa su configuración JWT y vuelve a entrar.');
   if(response.status===404)throw new Error('No está desplegada la función catalog-publication.');
  }
  throw new Error('No se ha podido contactar con catalog-publication. Revisa su despliegue e inténtalo de nuevo.');
 }
 if(typeof result.data?.error==='string')throw new Error(result.data.error);
 return result.data?.data;
}
