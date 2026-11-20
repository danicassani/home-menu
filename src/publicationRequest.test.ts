import { beforeEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({invoke:vi.fn(),rpc:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{functions:{invoke:api.invoke},rpc:api.rpc}}));
import { publishRecipe } from './publicCatalog';
import type { Recipe } from './recipes';
const recipe={id:'00000000-0000-0000-0000-000000000001',revision:1} as Recipe;
const id='00000000-0000-0000-0000-000000000002';
beforeEach(()=>{api.invoke.mockResolvedValue({data:{data:id},error:null});api.rpc.mockResolvedValue({data:[{id,local_recipe_id:recipe.id,owned:true}],error:null});});
it('rechaza un Hello World HTTP 200 sin dar la receta por publicada',async()=>{
 api.invoke.mockResolvedValue({data:{message:'Hello World'},error:null});await expect(publishRecipe(recipe)).rejects.toThrow('respuesta inesperada');expect(api.rpc).not.toHaveBeenCalled();
});
it('solo confirma si la publicación corresponde a esa receta y casa',async()=>{
 await expect(publishRecipe(recipe)).resolves.toBe(id);
 api.rpc.mockResolvedValue({data:[],error:null});await expect(publishRecipe(recipe)).rejects.toThrow('No se ha podido confirmar');
 api.rpc.mockResolvedValue({data:[{id,local_recipe_id:'other',owned:true}],error:null});await expect(publishRecipe(recipe)).rejects.toThrow('No se ha podido confirmar');
});
it('conserva el mensaje útil de error enviado por la función',async()=>{
 api.invoke.mockResolvedValue({data:null,error:{context:new Response(JSON.stringify({error:'Falta la migración del catálogo público.'}),{status:409})}});
 await expect(publishRecipe(recipe)).rejects.toThrow('Falta la migración');
});
it('identifica el rechazo JWT de la pasarela y la función no desplegada',async()=>{
 for(const [status,message] of [[401,'configuración JWT'],[404,'No está desplegada']] as const){api.invoke.mockResolvedValue({data:null,error:{context:new Response('{}',{status})}});await expect(publishRecipe(recipe)).rejects.toThrow(message);}
});
it('acepta el registro compuesto de PostgreSQL como objeto o array al guardar',async()=>{
 const {saveRecipe,emptyDraft}=await import('./recipes');
 for(const response of [{id:recipe.id,revision:2},[{id:recipe.id,revision:2}]]){
  api.invoke.mockResolvedValue({data:{data:response},error:null});await expect(saveRecipe({...recipe,publication_id:id},emptyDraft())).resolves.toBeUndefined();
 }
 api.invoke.mockResolvedValue({data:{message:'Hello World'},error:null});await expect(saveRecipe({...recipe,publication_id:id},emptyDraft())).rejects.toThrow('no ha confirmado');
});
