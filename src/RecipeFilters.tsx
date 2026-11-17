import { useEffect } from 'react';
import { tagKey } from './recipes';
export default function RecipeFilters({search,onSearch,tags,selected,onSelect}:{search:string;onSearch:(value:string)=>void;tags:string[];selected:string[];onSelect:(tags:string[])=>void}){
 useEffect(()=>{
  const canonical=selected.flatMap(tag=>{const value=tags.find(value=>tagKey(value)===tagKey(tag));return value?[value]:[];});
  if(JSON.stringify(canonical)!==JSON.stringify(selected))onSelect(canonical);
 },[tags,selected,onSelect]);
 return <div className="catalog-filters">
  <label>Buscar plato<input type="search" value={search} onChange={event=>onSearch(event.target.value)}/></label>
  {tags.length>0&&<div className="tag-filter-strip" role="group" aria-label="Filtrar por etiquetas" tabIndex={0}>{tags.map(tag=>{
   const active=selected.some(value=>tagKey(value)===tagKey(tag));
   return <button type="button" className="tag-filter" key={tag} aria-pressed={active} onClick={()=>onSelect(active?selected.filter(value=>tagKey(value)!==tagKey(tag)):[...selected,tag])}>{tag}</button>;
  })}</div>}
  {selected.length>0&&<button type="button" className="clear-filters" onClick={()=>onSelect([])}>Limpiar filtros</button>}
 </div>;
}
