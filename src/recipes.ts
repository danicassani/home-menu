import { supabase } from './supabase';
export const categories = { breakfast: 'Desayuno', lunch: 'Comida', dinner: 'Cena' } as const;
export type Category = keyof typeof categories;
export type Ingredient = { id: string; name: string; kcal_per_100g: number | null };
export type Line = { id: string; ingredient_id: string; alternatives: string[] };
export type Recipe = { id: string; name: string; description: string; instructions: string; categories: Category[]; photo_path: string | null; archived: boolean; revision: number; lines: Line[]; photoUrl?: string };
export type Draft = Pick<Recipe, 'name'|'description'|'instructions'|'categories'|'photo_path'|'lines'>;
export const emptyDraft = (): Draft => ({ name: '', description: '', instructions: '', categories: ['lunch'], photo_path: null, lines: [] });
export function validatePhoto(file: File) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return 'Usa una imagen JPEG, PNG o WebP.';
  if (file.size > 5 * 1024 * 1024) return 'La foto no puede superar 5 MB.';
  return null;
}
export function filterRecipes(recipes: Recipe[], search: string, category: string, archived: boolean) {
  return recipes.filter(r => r.archived === archived && r.name.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')) && (!category || r.categories.includes(category as Category)));
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
  const mapped: Recipe[] = (recipes.data || []).map(r => ({...r, lines:(lines.data || []).filter(l=>l.recipe_id===r.id).map(l=>({ id:l.id, ingredient_id:l.ingredient_id, alternatives:(alternatives.data||[]).filter(a=>a.line_id===l.id).map(a=>a.ingredient_id) })) }));
  const paths = [...new Set(mapped.flatMap(r=>r.photo_path?[r.photo_path]:[]))];
  let photoError = false;
  if (paths.length) {
    const urls = await c.storage.from('recipe-photos').createSignedUrls(paths,3600);
    photoError = Boolean(urls.error || urls.data?.some(u=>u.error));
    for (const r of mapped) r.photoUrl = urls.data?.find(u=>u.path===r.photo_path)?.signedUrl || undefined;
  }
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
  const result=await client().rpc('save_recipe',{ p_id:original?.id || null, p_revision:original?.revision || null, p_name:draft.name, p_description:draft.description, p_instructions:draft.instructions, p_categories:draft.categories, p_photo_path:draft.photo_path, p_lines:draft.lines });
  if(result.error) throw result.error;
}
export async function archiveRecipe(recipe: Recipe) {
  const result=await client().rpc('set_recipe_archived',{p_id:recipe.id,p_revision:recipe.revision,p_archived:!recipe.archived});
  if(result.error) throw result.error;
}
