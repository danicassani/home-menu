import { useEffect, useRef, useState } from 'react';
import { useOffline } from './offline';
import { readBook } from './offlineResources';
import RecipeEditor from './RecipeEditor';
import CatalogViewToggle from './CatalogViewToggle';
import PublicCatalog from './PublicCatalog';
import { publishRecipe } from './publicCatalog';
import RecipeFilters from './RecipeFilters';
import ArchivedRecipes from './ArchivedRecipes';
import { useRealtimeRefresh } from './realtime';
import { archiveRecipe, filterRecipes, recipeTags, type Ingredient, type Recipe } from './recipes';
export default function RecipeBook({ houseId, online }: {houseId:string; online:boolean}) {
  const workspace=useOffline();
  const [publicView,setPublicView]=useState(false);
  const [recipes,setRecipes]=useState<Recipe[]>([]);
  const [ingredients,setIngredients]=useState<Ingredient[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [publicationError,setPublicationError]=useState(''),[publicationSuccess,setPublicationSuccess]=useState(false);
  const [photoError,setPhotoError]=useState(false);
  const [search,setSearch]=useState('');
  const [layout,setLayout]=useState<'list'|'grid'>(()=>{try{return localStorage.getItem('home-menu-catalog-layout')==='grid'?'grid':'list';}catch{return 'list';}});
  useEffect(()=>{try{localStorage.setItem('home-menu-catalog-layout',layout);}catch{/* Visual preference only; the view remains usable. */}},[layout]);
  const [tags,setTags]=useState<string[]>([]);
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
    const refresh=()=>{if(document.visibilityState==='visible'&&!editing&&!busy)setRetry(n=>n+1);};
    document.addEventListener('visibilitychange',refresh);
    return ()=>document.removeEventListener('visibilitychange',refresh);
  },[editing,busy]);
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
  async function restore(archivedRecipe:Recipe){
    if(!online||busy)throw new Error('No disponible');
    generation.current++;setBusy(true);
    try{await archiveRecipe(archivedRecipe);setRecipes(list=>list.map(value=>value.id===archivedRecipe.id?{...value,archived:false,revision:value.revision+1}:value));setRetry(n=>n+1);}
    finally{setBusy(false);}
  }
  async function publish(){
    if(!recipe||busy||!online||recipe.catalog_imported)return;
    if(!window.confirm('¿Publicar receta, foto, ingredientes y alternativas para todos los usuarios?'))return;
    setBusy(true);setPublicationError('');setPublicationSuccess(false);try{const id=await publishRecipe(recipe);setRecipes(list=>list.map(item=>item.id===recipe.id?{...item,publication_id:id}:item));setPublicationSuccess(true);setRetry(value=>value+1);}catch(error){setPublicationError(error instanceof Error?error.message:'No se ha podido publicar.');}finally{setBusy(false);}
  }
  async function editPublic(id:string){
    const data=await readBook(workspace,houseId,online);const original=data.recipes.find(recipe=>recipe.id===id);if(!original)throw new Error('Receta no disponible');
    setIngredients(data.ingredients);setRecipes(data.recipes);setEditingRecipe(original);setPublicView(false);setEditing(true);
  }
  const visible=filterRecipes(recipes,search,tags,false);
  if(editing)return <RecipeEditor key={editingRecipe?.id||'new'} original={editingRecipe} houseId={houseId} ingredients={ingredients} availableTags={recipeTags(recipes)} online={online} onCreated={i=>setIngredients(list=>[...list.filter(x=>x.id!==i.id),i].sort((a,b)=>a.name.localeCompare(b.name,'es')))} onCancel={()=>setEditing(false)} onSaved={()=>{setEditing(false);setSelected(null);setRetry(n=>n+1);}}/>;
  if(publicView)return <PublicCatalog online={online} layout={layout} onLayoutChange={setLayout} onClose={()=>{setPublicView(false);setRetry(value=>value+1);}} onChanged={()=>setRetry(value=>value+1)} onEdit={editPublic}/>;
  return <section aria-label="Carta" className="recipe-book">
    {publicationError&&<p role="alert">{publicationError}</p>}
    {publicationSuccess&&<p role="status">Receta publicada.</p>}
    {error&&<p role="alert">{error} <button className="secondary compact" onClick={()=>setRetry(n=>n+1)}>Reintentar</button></p>}
    {loading?<p role="status">Cargando carta…</p>:recipe?<>
      <button className="secondary" onClick={()=>{setSelected(null);setError('');setPublicationError('');setPublicationSuccess(false);}}>Volver a carta</button>
      <article className="recipe-detail">
        {recipe.photoUrl&&<img className="detail-photo" src={recipe.photoUrl} alt={recipe.name}/>}
        <h2>{recipe.name}</h2>
        <p className="tag-badges">{recipe.tags.map(tag=><span key={tag}>{tag}</span>)}</p>
        {recipe.description&&<p>{recipe.description}</p>}
        <h3>Ingredientes</h3><ul className="detail-ingredients">{recipe.lines.map(l=><li key={l.id}>{name(l.ingredient_id)}{l.alternatives.length>0&&<span className="alternatives-label">Alternativas: {l.alternatives.map(name).join(', ')}</span>}</li>)}</ul>
        <h3>Receta</h3><p className="instructions">{recipe.instructions}</p>
        <div className="recipe-actions">{!recipe.archived&&!recipe.catalog_imported&&<button disabled={!online||busy} onClick={()=>{setEditingRecipe(recipe);setEditing(true);}}>Editar plato</button>}<button className="secondary" disabled={!online||busy} onClick={()=>void archive()}>{recipe.archived?'Restaurar plato':'Archivar plato'}</button>{!recipe.archived&&!recipe.catalog_imported&&!recipe.publication_id&&<button className="secondary" disabled={!online||busy} onClick={()=>void publish()}>{busy?'Publicando…':'Publicar'}</button>}{recipe.publication_id&&<button className="secondary" disabled={!online||busy} onClick={()=>setPublicView(true)}>Ver en carta pública</button>}</div>
      </article>
    </>:<>
      <div className="section-heading catalog-heading"><div className="catalog-heading-start"><h2>Carta</h2><CatalogViewToggle layout={layout} onChange={setLayout}/></div><button disabled={!online||Boolean(error)} onClick={()=>{setSelected(null);setEditingRecipe(null);setEditing(true);}}>Nuevo plato</button></div>
      <RecipeFilters search={search} onSearch={setSearch} tags={recipeTags(recipes.filter(recipe=>!recipe.archived))} selected={tags} onSelect={setTags}/>
      {photoError&&<p role="status">Algunas fotos no se han podido cargar. <button className="secondary compact" onClick={()=>setRetry(n=>n+1)}>Reintentar fotos</button></p>}
      <div className="recipe-grid" data-layout={layout}>{visible.map(r=><button className="recipe-card" key={r.id} onClick={()=>{setSelected(r.id);setPublicationError('');setPublicationSuccess(false);}}>
        {r.photoUrl?<img src={r.photoUrl} alt="" loading="lazy"/>:<div className="recipe-photo-empty" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="10"/></svg></div>}
        <div className="recipe-card-body"><h3>{r.name}</h3>{r.description&&<p>{r.description}</p>}</div>
      </button>)}</div>
      {!visible.length&&!error&&<p className="empty-state">{search||tags.length?'No hay platos con estos filtros.':'Aún no hay platos.'}</p>}
      <div className="catalog-footer"><button type="button" className="archive-link" onClick={()=>setArchived(true)}>Ver archivados</button><button type="button" className="archive-link" disabled={!online} onClick={()=>{setSelected(null);setPublicView(true);}}>Carta pública</button></div>
      {archived&&<ArchivedRecipes recipes={recipes.filter(recipe=>recipe.archived)} online={online} onRestore={restore} onClose={()=>setArchived(false)}/>}
    </>}
  </section>;
}
