import { useEffect, useRef, useState } from 'react';
import { categories, filterRecipes, type Category, type Ingredient, type Recipe } from './recipes';
import { addDays, calendarDay, changeMenuWeek, copyMenuWeek, dayLabel, monday, weekLabel, type MenuChange, type MenuWeek } from './menu';
import { useOffline } from './offline';
import { readBook, readMenu } from './offlineResources';
import WeekNavigation from './WeekNavigation';
import { useRealtimeRefresh } from './realtime';
type Selection = { day:string; meal:Category; entry?:string; revision:number };
export default function WeeklyMenu({houseId,online,selectedWeek,onWeekChange}:{houseId:string;online:boolean;selectedWeek?:string;onWeekChange?:(week:string)=>void}) {
  const workspace=useOffline();
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
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('');
  const generation=useRef(0),loaded=useRef('');
  useRealtimeRefresh(busy||Boolean(selection),setRetry);
  useEffect(()=>{setSource(addDays(week,-7));},[week]);
  useEffect(()=>{
    let active=true;const ticket=++generation.current;const key=houseId+week;
    if(loaded.current!==key)setLoading(true);setError('');
    void Promise.all([readMenu(workspace,week,online),readBook(workspace,houseId,online)]).then(([menu,book])=>{
      if(active&&ticket===generation.current){setData(menu);setRecipes(book.recipes);setIngredients(book.ingredients);loaded.current=key;}
    }).catch(()=>{if(active&&ticket===generation.current){setData({revision:0,entries:[]});setRecipes([]);setIngredients([]);setError(online?'No se ha podido cargar la semana.':'No hay datos guardados para esta semana.');}}).finally(()=>{if(active&&ticket===generation.current)setLoading(false);});
    return ()=>{active=false;};
  },[houseId,week,retry,online,workspace]);
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==='visible'&&!busy&&!selection)setRetry(n=>n+1);};
    document.addEventListener('visibilitychange',refresh);return()=>document.removeEventListener('visibilitychange',refresh);
  },[busy,selection]);
  const disabled=busy||loading||!online;
  const name=(id:string)=>ingredients.find(i=>i.id===id)?.name||'Ingrediente';
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
  function choose(day:string,meal:Category,entry?:string){setSelection({day,meal,entry,revision:data.revision});setSearch('');setFilter(meal);}
  return <section className="weekly-menu" aria-label="Menú semanal">
    <div className="section-heading"><h2>Semana</h2><button className="secondary compact" disabled={busy||loading} onClick={()=>{setSelection(null);setRetry(n=>n+1);}}>Actualizar semana</button></div>
    <WeekNavigation week={week} disabled={busy||loading||Boolean(selection)} onChange={setWeek}/>
    {error&&<p role="alert">{error}</p>}
    {loading?<p role="status">Cargando semana…</p>:selection?<section className="menu-picker" aria-label="Elegir plato">
      <div className="section-heading"><h3>{selection.entry?'Sustituir plato':'Añadir plato'}</h3><button className="secondary" disabled={busy} onClick={()=>setSelection(null)}>Cancelar selección</button></div>
      <p>{dayLabel(selection.day)} · {categories[selection.meal]}</p>
      <div className="recipe-filters"><label>Buscar plato<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Categoría<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todas</option>{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
      <ul className="menu-picker-list">{filterRecipes(recipes,search,filter,false).map(recipe=><li key={recipe.id}><button className="secondary menu-picker-item" disabled={disabled} onClick={()=>void change({action:selection.entry?'replace':'add',entry:selection.entry,day:selection.day,meal:selection.meal,recipe:recipe.id},selection.revision)}>
        {recipe.photoUrl&&<img src={recipe.photoUrl} alt=""/>}<span><strong>{recipe.name}</strong>{recipe.description&&<span>{recipe.description}</span>}</span>
      </button></li>)}</ul>
      {!filterRecipes(recipes,search,filter,false).length&&<p className="empty-state">No hay platos con estos filtros.</p>}
    </section>:<>
      <div className="copy-week"><label>Copiar desde<input type="date" value={source} disabled={disabled} onChange={e=>{if(e.target.value)setSource(monday(e.target.value));}}/></label><button className="secondary" disabled={disabled||Boolean(error)||source===week} onClick={()=>void copy()}>Copiar semana</button></div>
      <div className="week-grid">{Array.from({length:7},(_,index)=>addDays(week,index)).map(day=><section className="menu-day" key={day} aria-label={dayLabel(day)}>
        <h3>{dayLabel(day)}</h3>
        {(Object.entries(categories) as [Category,string][]).map(([meal,label])=><section key={meal} className="meal-slot" aria-label={`${day} ${label}`}>
          <div className="section-heading"><h4>{label}</h4><button className="secondary compact" disabled={disabled||Boolean(error)} aria-label={`Añadir ${label.toLowerCase()} del ${day}`} onClick={()=>choose(day,meal)}>+</button></div>
          {data.entries.filter(e=>e.planned_day===day&&e.meal===meal).map(entry=>{
            const recipe=recipes.find(r=>r.id===entry.recipe_id);
            return <article className="planned-recipe" key={entry.id} aria-label={recipe?.name||'Plato no disponible'}>
              <h5>{recipe?.name||'Plato no disponible'}</h5>{recipe?.archived&&<span className="archived-label">Archivado</span>}
              {entry.choices_reset&&<div className="menu-notice"><p role="status">La receta cambió. Revisa los ingredientes y sus alternativas.</p><button className="secondary compact" disabled={disabled} onClick={()=>void change({action:'ack',entry:entry.id})}>Entendido</button></div>}
              {recipe&&<details><summary>Ingredientes</summary><ul className="menu-ingredients">{recipe.lines.map(line=><li key={line.id}>{line.alternatives.length?<label>{name(line.ingredient_id)}<select disabled={disabled||Boolean(error)} value={entry.choices.find(c=>c.ingredient_id===line.ingredient_id)?.alternative_id||line.ingredient_id} onChange={e=>{
                const choices=entry.choices.filter(c=>c.ingredient_id!==line.ingredient_id);
                if(e.target.value!==line.ingredient_id)choices.push({ingredient_id:line.ingredient_id,alternative_id:e.target.value});
                void change({action:'choices',entry:entry.id,choices});
              }}><option value={line.ingredient_id}>{name(line.ingredient_id)}</option>{line.alternatives.map(id=><option key={id} value={id}>{name(id)}</option>)}</select></label>:name(line.ingredient_id)}</li>)}</ul></details>}
              <div className="planned-actions"><button className="secondary compact" disabled={disabled||Boolean(error)} onClick={()=>choose(day,meal,entry.id)}>Sustituir</button><button className="secondary compact" disabled={disabled||Boolean(error)} onClick={()=>void change({action:'remove',entry:entry.id})}>Quitar</button></div>
            </article>;
          })}
        </section>)}
      </section>)}</div>
    </>}
  </section>;
}
