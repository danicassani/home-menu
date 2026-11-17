import { useEffect, useRef, useState } from 'react';
import { filterRecipes, recipeTags, type Ingredient, type Recipe } from './recipes';
import { addDays, calendarDay, changeMenuWeek, copyMenuWeek, dayLabel, monday, weekLabel, type MenuChange, type MenuWeek, meals, type Meal } from './menu';
import { useOffline } from './offline';
import { readBook, readMenu } from './offlineResources';
import WeekNavigation from './WeekNavigation';
import PlannedRecipeDetails from './PlannedRecipeDetails';
import RecipeFilters from './RecipeFilters';
import { useRealtimeRefresh } from './realtime';
type Selection = { day:string; meal:Meal; entry?:string; revision:number };
export default function WeeklyMenu({houseId,online,selectedWeek,onWeekChange}:{houseId:string;online:boolean;selectedWeek?:string;onWeekChange?:(week:string)=>void}) {
  const workspace=useOffline();
  const [today,setToday]=useState(()=>calendarDay(new Date()));
  useEffect(()=>{
    const refresh=()=>setToday(calendarDay(new Date()));
    const timer=setInterval(refresh,60000);
    document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};
  },[]);
  const [localWeek,setLocalWeek]=useState(()=>monday(calendarDay(new Date())));
  const week=selectedWeek??localWeek;
  const setWeek=onWeekChange??setLocalWeek;
  const [source,setSource]=useState(()=>addDays(monday(calendarDay(new Date())),-7));
  const [data,setData]=useState<MenuWeek>({revision:0,entries:[]});
  const [recipes,setRecipes]=useState<Recipe[]>([]);
  const [ingredients,setIngredients]=useState<Ingredient[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [selection,setSelection]=useState<Selection|null>(null);
  const [preview,setPreview]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState<string[]>([]);
  const generation=useRef(0),loaded=useRef('');
  useRealtimeRefresh(busy||Boolean(selection)||Boolean(preview),setRetry);
  useEffect(()=>{setSource(addDays(week,-7));setPreview(null);},[week]);
  useEffect(()=>{
    let active=true;const ticket=++generation.current;const key=houseId+week;
    if(loaded.current!==key)setLoading(true);setError('');
    void Promise.all([readMenu(workspace,week,online),readBook(workspace,houseId,online)]).then(([menu,book])=>{
      if(active&&ticket===generation.current){setData(menu);setRecipes(book.recipes);setIngredients(book.ingredients);loaded.current=key;}
    }).catch(()=>{if(active&&ticket===generation.current){setData({revision:0,entries:[]});setRecipes([]);setIngredients([]);setError(online?'No se ha podido cargar la semana.':'No hay datos guardados para esta semana.');}}).finally(()=>{if(active&&ticket===generation.current)setLoading(false);});
    return ()=>{active=false;};
  },[houseId,week,retry,online,workspace]);
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==='visible'&&!busy&&!selection&&!preview)setRetry(n=>n+1);};
    document.addEventListener('visibilitychange',refresh);return()=>document.removeEventListener('visibilitychange',refresh);
  },[busy,selection,preview]);
  const disabled=busy||loading||!online;
  const previewEntry=data.entries.find(entry=>entry.id===preview);
  const previewRecipe=recipes.find(recipe=>recipe.id===previewEntry?.recipe_id);
  async function change(change:MenuChange,expectedRevision=data.revision) {
    if(disabled)return;generation.current++;setBusy(true);setError('');
    try{const result=await changeMenuWeek(week,expectedRevision,change);setData(result);await workspace?.cache('menu:'+week,result);setSelection(null);}
    catch{setError('No se ha podido guardar. Actualiza la semana y reintenta.');}
    finally{setBusy(false);}
  }
  async function copy() {
    if(disabled||!source||source===week)return;
    const overwrite=data.entries.length>0;
    if(overwrite&&!window.confirm('¿Sustituir todos los platos de esta semana?'))return;
    generation.current++;setBusy(true);setError('');
    try{const result=await copyMenuWeek(source,week,data.revision,overwrite);setData(result);await workspace?.cache('menu:'+week,result);}
    catch{setError('No se ha podido copiar. Comprueba que la semana de origen tenga platos y actualiza.');}
    finally{setBusy(false);}
  }
  function choose(day:string,meal:Meal,entry?:string){setSelection({day,meal,entry,revision:data.revision});setSearch('');setFilter([]);}
  return <section className="weekly-menu" aria-label="Menú semanal">
    <div className="section-heading"><h2>Semana</h2><button className="secondary compact" disabled={busy||loading} onClick={()=>{setSelection(null);setRetry(n=>n+1);}}>Actualizar semana</button></div>
    <WeekNavigation week={week} disabled={busy||loading||Boolean(selection)} onChange={setWeek}/>
    {error&&<p role="alert">{error}</p>}
    {loading?<p role="status">Cargando semana…</p>:selection?<section className="menu-picker" aria-label="Elegir plato">
      <div className="section-heading"><h3>{selection.entry?'Sustituir plato':'Añadir plato'}</h3><button className="secondary" disabled={busy} onClick={()=>setSelection(null)}>Cancelar selección</button></div>
      <p>{dayLabel(selection.day)} · {meals[selection.meal]}</p>
      <RecipeFilters search={search} onSearch={setSearch} tags={recipeTags(recipes.filter(recipe=>!recipe.archived))} selected={filter} onSelect={setFilter}/>
      <ul className="menu-picker-list">{filterRecipes(recipes,search,filter,false).map(recipe=><li key={recipe.id}><button className="secondary menu-picker-item" disabled={disabled} onClick={()=>void change({action:selection.entry?'replace':'add',entry:selection.entry,day:selection.day,meal:selection.meal,recipe:recipe.id},selection.revision)}>
        {recipe.photoUrl&&<img src={recipe.photoUrl} alt=""/>}<span><strong>{recipe.name}</strong>{recipe.description&&<span>{recipe.description}</span>}{recipe.tags.length>0&&<span className="tag-badges">{recipe.tags.map(tag=><span key={tag}>{tag}</span>)}</span>}</span>
      </button></li>)}</ul>
      {!filterRecipes(recipes,search,filter,false).length&&<p className="empty-state">No hay platos con estos filtros.</p>}
    </section>:<>
      <div className="copy-week"><label>Copiar desde<input type="date" value={source} disabled={disabled} onChange={e=>{if(e.target.value)setSource(monday(e.target.value));}}/></label><button className="secondary" disabled={disabled||Boolean(error)||source===week} onClick={()=>void copy()}>Copiar semana</button></div>
      <div className="week-grid">{Array.from({length:7},(_,index)=>addDays(week,index)).map(day=><section className="menu-day" key={day} aria-label={dayLabel(day)} aria-current={day===today?'date':undefined}>
        <h3>{dayLabel(day)}</h3>
        {(Object.entries(meals) as [Meal,string][]).map(([meal,label])=><section key={meal} className="meal-slot" aria-label={`${day} ${label}`}>
          <div className="section-heading"><h4>{label}</h4><button className="secondary compact" disabled={disabled||Boolean(error)} aria-label={`Añadir ${label.toLowerCase()} del ${day}`} onClick={()=>choose(day,meal)}>+</button></div>
          {data.entries.filter(e=>e.planned_day===day&&e.meal===meal).map(entry=>{
            const recipe=recipes.find(r=>r.id===entry.recipe_id);
            return <article className="planned-recipe" key={entry.id} aria-label={recipe?.name||'Plato no disponible'}>
              <button type="button" className="planned-cover" aria-label={`Abrir ${recipe?.name||'plato'}`} disabled={!recipe} onClick={()=>setPreview(entry.id)}>
                {recipe?.photoUrl?<img src={recipe.photoUrl} alt="" loading="lazy"/>:<div className="recipe-photo-empty" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="10"/></svg></div>}
                <div className="planned-title"><h5>{recipe?.name||'Plato no disponible'}</h5>{recipe?.archived&&<span>Archivado</span>}</div>
              </button>
              <div className="planned-actions">
                <button type="button" aria-label="Sustituir" title="Sustituir" disabled={disabled||Boolean(error)} onClick={()=>choose(day,meal,entry.id)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/></svg></button>
                <button type="button" aria-label="Quitar" title="Quitar" disabled={disabled||Boolean(error)} onClick={()=>void change({action:'remove',entry:entry.id})}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg></button>
              </div>
              {entry.choices_reset&&<div className="menu-notice"><p role="status">La receta cambió. Revisa los ingredientes y sus alternativas.</p><button className="secondary compact" disabled={disabled} onClick={()=>void change({action:'ack',entry:entry.id})}>Entendido</button></div>}
            </article>;
          })}
        </section>)}
      </section>)}</div>
    </>}
    {previewEntry&&previewRecipe&&<PlannedRecipeDetails entry={previewEntry} recipe={previewRecipe} ingredients={ingredients} disabled={disabled||Boolean(error)} error={error} onChoices={choices=>void change({action:'choices',entry:previewEntry.id,choices})} onClose={()=>setPreview(null)}/>}
  </section>;
}
