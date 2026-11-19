import { supabase } from './supabase';
import type { Recipe, Ingredient } from './recipes';
export type PublicRecipe=Recipe&{owned:boolean;incorporated:boolean;local_recipe_id:string|null};
const client=()=>{if(!supabase)throw new Error('Servicio no disponible');return supabase;};
export async function loadPublicCatalog():Promise<{recipes:PublicRecipe[];ingredients:Ingredient[]}>{
 const c=client(),[catalog,ingredients]=await Promise.all([c.rpc('get_public_catalog'),c.from('public_ingredients').select('*').order('name')]);
 if(catalog.error||ingredients.error)throw catalog.error||ingredients.error;
 const recipes=(catalog.data||[]).map((recipe:PublicRecipe)=>({...recipe,archived:false}));
 const paths=[...new Set<string>(recipes.flatMap((recipe:PublicRecipe)=>recipe.photo_path?[recipe.photo_path]:[]))];
 if(paths.length){const urls=await c.storage.from('catalog-photos').createSignedUrls(paths,900);if(urls.error)throw urls.error;for(const recipe of recipes)recipe.photoUrl=urls.data?.find(url=>url.path===recipe.photo_path)?.signedUrl;}
 return {recipes,ingredients:ingredients.data||[]};
}
export async function publishRecipe(recipe:Recipe){const result=await client().functions.invoke('catalog-publication',{body:{action:'publish',recipe:recipe.id,revision:recipe.revision}});if(result.error||result.data?.error)throw new Error(result.data?.error||'No se ha podido publicar');}
export async function incorporateRecipe(id:string){const result=await client().rpc('incorporate_public_recipe',{p_public:id});if(result.error)throw result.error;}
export async function unpublishRecipe(recipe:PublicRecipe){const result=await client().rpc('unpublish_recipe',{p_public:recipe.id,p_revision:recipe.revision});if(result.error)throw result.error;}
export async function removePublicRecipe(recipe:PublicRecipe){if(!recipe.local_recipe_id)throw new Error('No incorporada');const current=await client().from('recipes').select('revision').eq('id',recipe.local_recipe_id).single();if(current.error)throw current.error;const result=await client().rpc('set_recipe_archived',{p_id:recipe.local_recipe_id,p_revision:current.data.revision,p_archived:true});if(result.error)throw result.error;}
export async function ingredientCatalog(global=false):Promise<Ingredient[]>{const result=await client().from(global?'public_ingredients':'ingredients').select('*').order('name');if(result.error)throw result.error;return result.data||[];}
export async function isCatalogAdmin(){const result=await client().rpc('is_catalog_admin');if(result.error)throw result.error;return result.data===true;}
export async function editIngredient(ingredient:Ingredient,name:string,kcal:string,global:boolean){const result=await client().rpc('update_ingredient',{p_id:ingredient.id,p_revision:ingredient.revision,p_name:name,p_kcal:kcal.trim()?Number(kcal):null,p_public:global});if(result.error)throw result.error;}
