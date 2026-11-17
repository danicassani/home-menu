export default function CatalogViewToggle({layout,onChange}:{layout:'list'|'grid';onChange:(value:'list'|'grid')=>void}){
 return <div className="catalog-view-toggle" role="group" aria-label="Vista de Carta">
  <button type="button" aria-label="Modo lista" aria-pressed={layout==='list'} onClick={()=>onChange('list')}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/></svg></button>
  <button type="button" aria-label="Modo cuadrícula" aria-pressed={layout==='grid'} onClick={()=>onChange('grid')}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></button>
 </div>;
}
