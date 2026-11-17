import { supabase } from './supabase';
export type Ingredient = { id: string; name: string; kcal_per_100g: number | null; revision?:number };
export type Line = { id: string; ingredient_id: string; alternatives: string[] };
export type Recipe = { id: string; name: string; description: string; instructions: string; tags: string[]; photo_path: string | null; archived: boolean; revision: number; lines: Line[]; publication_id?:string|null; catalog_imported?:boolean; catalog_photo_path?:string|null; photoUrl?: string };
export type Draft = Pick<Recipe, 'name'|'description'|'instructions'|'tags'|'photo_path'|'lines'> & {clearPhoto?:boolean};
export const emptyDraft = (): Draft => ({ name: '', description: '', instructions: '', tags: [], photo_path: null, lines: [] });
export function validatePhoto(file: File) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return 'Usa una imagen JPEG, PNG o WebP.';
  if (file.size > 5 * 1024 * 1024) return 'La foto no puede superar 5 MB.';
  return null;
}
export const normalizeTag=(tag:string)=>tag.normalize('NFC').trim().replace(/\s+/gu,' ');
export const tagKey=(tag:string)=>normalizeTag(tag).toLocaleLowerCase('es');
const searchKey=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es');
export function cleanTags(tags:string[]){return tags.map(normalizeTag).filter((tag,index,all)=>tag&&all.findIndex(value=>tagKey(value)===tagKey(tag))===index);}
export function validateTags(tags:string[]){
 if(tags.length>20)return 'Máximo 20 etiquetas por receta.';
 if(tags.some(tag=>!normalizeTag(tag)||[...normalizeTag(tag)].length>40))return 'Cada etiqueta debe tener entre 1 y 40 caracteres.';
 return null;
}
export function recipeTags(recipes:Recipe[]){return cleanTags(recipes.flatMap(recipe=>recipe.tags)).sort((a,b)=>a.localeCompare(b,'es'));}
export function filterRecipes(recipes:Recipe[],search:string,tag:string|string[],archived:boolean){
 const tags=typeof tag==='string'?(tag?[tag]:[]):tag;
 const words=searchKey(search).trim().split(/\s+/u).filter(Boolean);
 return recipes.filter(recipe=>recipe.archived===archived&&tags.every(tag=>recipe.tags.some(value=>tagKey(value)===tagKey(tag)))&&words.every(word=>searchKey([recipe.name,...recipe.tags].join(' ')).includes(word)));
}
function client() { if (!supabase) throw new Error('Supabase no configurado'); return supabase; }
export async function loadRecipeBook(houseId: string) {
  const c = client();
  const [recipes, ingredients, lines, alternatives] = await Promise.all([
    c.from('recipes').select('*').eq('household_id',houseId).order('name'),
    c.from('ingredients').select('id,name,kcal_per_100g').eq('household_id',houseId).order('name'),
    c.from('recipe_ingredients').select('id,recipe_id,ingredient_id,position').eq('household_id',houseId).order('position'),
    c.from('recipe_alternatives').select('line_id,ingredient_id').eq('household_id',houseId),
  ]);
  for (const result of [recipes,ingredients,lines,alternatives]) if (result.error) throw result.error;
  if((recipes.data||[]).some(recipe=>!Array.isArray(recipe.tags)))throw new Error('Datos de recetas no compatibles');
  const mapped: Recipe[] = (recipes.data || []).map(r => ({...r, lines:(lines.data || []).filter(l=>l.recipe_id===r.id).map(l=>({ id:l.id, ingredient_id:l.ingredient_id, alternatives:(alternatives.data||[]).filter(a=>a.line_id===l.id).map(a=>a.ingredient_id) })) }));
  const paths = [...new Set(mapped.flatMap(r=>r.photo_path?[r.photo_path]:[]))];
  let photoError = false;
  if (paths.length) {
    const urls = await c.storage.from('recipe-photos').createSignedUrls(paths,3600);
    photoError = Boolean(urls.error || urls.data?.some(u=>u.error));
    for (const r of mapped) r.photoUrl = urls.data?.find(u=>u.path===r.photo_path)?.signedUrl || undefined;
  }
  const snapshots=[...new Set(mapped.flatMap(recipe=>recipe.catalog_photo_path?[recipe.catalog_photo_path]:[]))];
  if(snapshots.length){const urls=await c.storage.from('catalog-photos').createSignedUrls(snapshots,900);photoError=photoError||Boolean(urls.error||urls.data?.some(url=>url.error));for(const recipe of mapped)if(recipe.catalog_photo_path)recipe.photoUrl=urls.data?.find(url=>url.path===recipe.catalog_photo_path)?.signedUrl||undefined;}
  return { recipes: mapped, ingredients:(ingredients.data || []) as Ingredient[], photoError };
}
export async function addIngredient(name: string, kcal: string): Promise<Ingredient> {
  const result=await client().rpc('create_ingredient',{p_name:name,p_kcal:kcal.trim()?Number(kcal):null}).single<Ingredient>();
  if (result.error) throw result.error;
  return result.data;
}
export async function uploadPhoto(houseId: string, file: File) {
  const error = validatePhoto(file); if(error) throw new Error(error);
  const extension = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  const path=`${houseId}/${crypto.randomUUID()}.${extension}`;
  const result=await client().storage.from('recipe-photos').upload(path,file,{contentType:file.type,upsert:false});
  if(result.error) throw result.error;
  return path;
}
export async function saveRecipe(original: Recipe | null, draft: Draft) {
  if(original?.publication_id&&!original.catalog_imported){const result=await client().functions.invoke('catalog-publication',{body:{action:'save',recipe:original.id,revision:original.revision,draft}});if(result.error||result.data?.error)throw new Error(result.data?.error||'No se ha podido publicar');return;}
  const result=await client().rpc('save_recipe',{ p_id:original?.id || null, p_revision:original?.revision || null, p_name:draft.name, p_description:draft.description, p_instructions:draft.instructions, p_tags:draft.tags, p_photo_path:draft.photo_path, p_lines:draft.lines,p_clear_photo:Boolean(draft.clearPhoto) });
  if(result.error) throw result.error;
}
export async function archiveRecipe(recipe: Recipe) {
  const result=await client().rpc('set_recipe_archived',{p_id:recipe.id,p_revision:recipe.revision,p_archived:!recipe.archived});
  if(result.error) throw result.error;
}
