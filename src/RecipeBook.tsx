import { useEffect, useRef, useState } from 'react';
import { useOffline } from './offline';
import { readBook } from './offlineResources';
import RecipeEditor from './RecipeEditor';
import { useRealtimeRefresh } from './realtime';
import { archiveRecipe, categories, filterRecipes, type Ingredient, type Recipe } from './recipes';
export default function RecipeBook({ houseId, online }: {houseId:string; online:boolean}) {
  const workspace=useOffline();
  const [recipes,setRecipes]=useState<Recipe[]>([]);
  const [ingredients,setIngredients]=useState<Ingredient[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [photoError,setPhotoError]=useState(false);
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('');
  const [archived,setArchived]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [editingRecipe,setEditingRecipe]=useState<Recipe|null>(null);
  const [editing,setEditing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [retry,setRetry]=useState(0);
  const loaded=useRef(''),generation=useRef(0);
  useRealtimeRefresh(editing||busy,setRetry);
  useEffect(()=>{
    let active=true;const ticket=++generation.current;
    if(loaded.current!==houseId)setLoading(true);setError('');
    void readBook(workspace,houseId,online).then(data=>{
      if(!active||ticket!==generation.current)return;
      loaded.current=houseId;
      setRecipes(data.recipes);setIngredients(data.ingredients);setPhotoError(data.photoError);
    }).catch(()=>{if(active&&ticket===generation.current){setRecipes([]);setIngredients([]);setError(online?'No se ha podido cargar la carta.':'No hay carta guardada en este dispositivo.');}}).finally(()=>{if(active&&ticket===generation.current)setLoading(false);});
    return ()=>{active=false;};
  },[houseId,retry,online,workspace]);
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==='visible'&&!editing)setRetry(n=>n+1);};
    document.addEventListener('visibilitychange',refresh);
    return ()=>document.removeEventListener('visibilitychange',refresh);
  },[editing]);
  const recipe=recipes.find(r=>r.id===selected)||null;
  const name=(id:string)=>ingredients.find(i=>i.id===id)?.name||'Ingrediente';
  async function archive() {
    if(!recipe||busy||!online)return;
    if(!window.confirm(recipe.archived?'¿Restaurar este plato?':'¿Archivar este plato?'))return;
    generation.current++;setBusy(true);setError('');
    try{await archiveRecipe(recipe);setSelected(null);setRetry(n=>n+1);}
    catch{setError('No se ha podido guardar el cambio. Recarga la carta.');}
    finally{setBusy(false);}
  }
  if(editing)return <RecipeEditor key={editingRecipe?.id||'new'} original={editingRecipe} houseId={houseId} ingredients={ingredients} online={online} onCreated={i=>setIngredients(list=>[...list.filter(x=>x.id!==i.id),i].sort((a,b)=>a.name.localeCompare(b.name,'es')))} onCancel={()=>setEditing(false)} onSaved={()=>{setEditing(false);setSelected(null);setRetry(n=>n+1);}}/>;
  return <section aria-label="Carta" className="recipe-book">
    {error&&<p role="alert">{error} <button className="secondary compact" onClick={()=>setRetry(n=>n+1)}>Reintentar</button></p>}
    {loading?<p role="status">Cargando carta…</p>:recipe?<>
      <button className="secondary" onClick={()=>{setSelected(null);setError('');}}>Volver a carta</button>
      <article className="recipe-detail">
        {recipe.photoUrl&&<img className="detail-photo" src={recipe.photoUrl} alt={recipe.name}/>}
        <h2>{recipe.name}</h2>
        <p className="category-badges">{recipe.categories.map(c=><span key={c}>{categories[c]}</span>)}</p>
        {recipe.description&&<p>{recipe.description}</p>}
        <h3>Ingredientes</h3><ul className="detail-ingredients">{recipe.lines.map(l=><li key={l.id}>{name(l.ingredient_id)}{l.alternatives.length>0&&<span className="alternatives-label">Alternativas: {l.alternatives.map(name).join(', ')}</span>}</li>)}</ul>
        <h3>Receta</h3><p className="instructions">{recipe.instructions}</p>
        <div className="recipe-actions">{!recipe.archived&&<button disabled={!online||busy} onClick={()=>{setEditingRecipe(recipe);setEditing(true);}}>Editar plato</button>}<button className="secondary" disabled={!online||busy} onClick={()=>void archive()}>{recipe.archived?'Restaurar plato':'Archivar plato'}</button></div>
      </article>
    </>:<>
      <div className="section-heading"><h2>Carta</h2><button disabled={!online||Boolean(error)} onClick={()=>{setSelected(null);setEditingRecipe(null);setEditing(true);}}>Nuevo plato</button></div>
      <div className="recipe-filters"><label>Buscar plato<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Categoría<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Todas</option>{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="section-heading"><label className="inline-check"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>Archivados</label><button className="secondary compact" disabled={!online} onClick={()=>setRetry(n=>n+1)}>Actualizar</button></div>
      {photoError&&<p role="status">Algunas fotos no se han podido cargar. Pulsa Actualizar para reintentarlo.</p>}
      <div className="recipe-grid">{filterRecipes(recipes,search,category,archived).map(r=><button className="recipe-card" key={r.id} onClick={()=>setSelected(r.id)}>
        {r.photoUrl?<img src={r.photoUrl} alt="" loading="lazy"/>:<div className="recipe-photo-empty" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="10"/></svg></div>}
        <div className="recipe-card-body"><h3>{r.name}</h3><span className="category-badges">{r.categories.map(c=><span key={c}>{categories[c]}</span>)}</span>{r.description&&<p>{r.description}</p>}</div>
      </button>)}</div>
      {!filterRecipes(recipes,search,category,archived).length&&!error&&<p className="empty-state">{search||category?'No hay platos con estos filtros.':archived?'No hay platos archivados.':'Aún no hay platos.'}</p>}
    </>}
  </section>;
}
