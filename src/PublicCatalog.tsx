import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { filterRecipes, recipeTags, type Ingredient } from './recipes';
import { incorporateRecipe, loadPublicCatalog, removePublicRecipe, unpublishRecipe, type PublicRecipe } from './publicCatalog';
import RecipeFilters from './RecipeFilters';
import CatalogViewToggle from './CatalogViewToggle';
export default function PublicCatalog({online,layout,onLayoutChange,onClose,onChanged,onEdit,canIncorporate=true}:{canIncorporate?:boolean;online:boolean;layout:'list'|'grid';onLayoutChange:(value:'list'|'grid')=>void;onClose:()=>void;onChanged:()=>void;onEdit:(id:string)=>Promise<void>}){
 const [recipes,setRecipes]=useState<PublicRecipe[]>([]),[ingredients,setIngredients]=useState<Ingredient[]>([]),[selected,setSelected]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[search,setSearch]=useState(''),[tags,setTags]=useState<string[]>([]);
 useEffect(()=>{
  if(!online){setLoading(false);return;}let active=true;
  void loadPublicCatalog().then(data=>{if(active){setRecipes(data.recipes);setIngredients(data.ingredients);setError('');}}).catch(()=>{if(active)setError('No se ha podido cargar la carta pública.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[retry,online]);
 useEffect(()=>{
  if(!online||busy)return;const refresh=()=>{if(document.visibilityState==='visible')setRetry(value=>value+1);};
  const timer=setInterval(refresh,15000),channel=supabase?.channel('catalog:'+crypto.randomUUID()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'catalog_changes'},refresh).subscribe();
  document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);if(channel)void supabase?.removeChannel(channel);};
 },[online,busy]);
 const recipe=recipes.find(recipe=>recipe.id===selected),name=(id:string)=>ingredients.find(ingredient=>ingredient.id===id)?.name||'Ingrediente';
 async function action(kind:'add'|'remove'|'withdraw'|'edit'){
  if(!recipe||busy||!online||!canIncorporate)return;
  if(kind==='withdraw'&&!window.confirm('¿Dejar de publicar? Las otras casas conservarán una copia privada.'))return;
  setBusy(true);setError('');
  try{
   if(kind==='add')await incorporateRecipe(recipe.id);
   if(kind==='remove')await removePublicRecipe(recipe);
   if(kind==='withdraw')await unpublishRecipe(recipe);
   if(kind==='edit'&&recipe.local_recipe_id){await incorporateRecipe(recipe.id);await onEdit(recipe.local_recipe_id);return;}
   setRetry(value=>value+1);onChanged();if(kind==='withdraw')setSelected(null);
  }catch{setError('No se ha podido guardar el cambio. Recarga e inténtalo de nuevo.');}finally{setBusy(false);}
 }
 if(!online)return <section aria-label="Carta pública"><button className="secondary" onClick={onClose}>Volver a mi carta</button><h2>Carta pública</h2><p role="status">Conéctate para consultar la carta pública.</p></section>;
 return <section aria-label="Carta pública">
  <button className="secondary" disabled={busy} onClick={recipe?()=>setSelected(null):onClose}>{recipe?'Volver a carta pública':'Volver a mi carta'}</button>
  {error&&<p role="alert">{error} <button className="secondary compact" disabled={busy} onClick={()=>setRetry(value=>value+1)}>Reintentar</button></p>}
  {loading?<p role="status">Cargando carta pública…</p>:recipe?<article className="recipe-detail">
   {recipe.photoUrl&&<img className="detail-photo" src={recipe.photoUrl} alt={recipe.name}/>}
   <h2>{recipe.name}</h2>{recipe.description&&<p>{recipe.description}</p>}
   <p className="tag-badges">{recipe.tags.map(tag=><span key={tag}>{tag}</span>)}</p>
   <h3>Ingredientes</h3><ul className="detail-ingredients">{recipe.lines.map(line=><li key={line.id}>{name(line.ingredient_id)}{line.alternatives.length>0&&<span className="alternatives-label">Alternativas: {line.alternatives.map(name).join(', ')}</span>}</li>)}</ul>
   <h3>Receta</h3><p className="instructions">{recipe.instructions}</p>
   {!canIncorporate&&<p role="status">Crea una casa para incorporar recetas.</p>}
   <div className="recipe-actions"><button disabled={busy||!canIncorporate} onClick={()=>void action(recipe.incorporated?'remove':'add')}>{recipe.incorporated?'Quitar de la carta':'Añadir a mi carta'}</button>
    {recipe.owned&&<><button className="secondary" disabled={busy} onClick={()=>void action('edit')}>Editar receta</button><button className="secondary" disabled={busy} onClick={()=>void action('withdraw')}>Dejar de publicar</button></>}
   </div>
  </article>:<>
   <div className="section-heading catalog-heading"><h2>Carta pública</h2><CatalogViewToggle layout={layout} onChange={onLayoutChange}/></div>
   <RecipeFilters search={search} onSearch={setSearch} tags={recipeTags(recipes)} selected={tags} onSelect={setTags}/>
   <div className="recipe-grid" data-layout={layout}>{(filterRecipes(recipes,search,tags,false) as PublicRecipe[]).map(recipe=><button key={recipe.id} className={'recipe-card public-recipe-card'+(recipe.incorporated?' incorporated':'')} onClick={()=>setSelected(recipe.id)}>
    {recipe.photoUrl?<img src={recipe.photoUrl} alt="" loading="lazy"/>:<div className="recipe-photo-empty" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="10"/></svg></div>}
    {recipe.incorporated&&<span className="owned-ribbon">Ya la tienes</span>}
    <div className="recipe-card-body"><h3>{recipe.name}</h3>{recipe.description&&<p>{recipe.description}</p>}</div>
   </button>)}</div>
   {!filterRecipes(recipes,search,tags,false).length&&<p className="empty-state">{search||tags.length?'No hay platos con estos filtros.':'No hay recetas publicadas.'}</p>}
  </>}
 </section>;
}
