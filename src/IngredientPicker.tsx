import { useState } from 'react';
import { addIngredient, type Ingredient } from './recipes';
export default function IngredientPicker({ ingredients, excluded, onChoose, onCreated, onClose }: {
  ingredients: Ingredient[]; excluded: string[]; onChoose: (id:string)=>void;
  onCreated: (ingredient:Ingredient)=>void; onClose: ()=>void;
}) {
  const [query,setQuery]=useState('');
  const [creating,setCreating]=useState(false);
  const [name,setName]=useState('');
  const [kcal,setKcal]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function create() {
    if(busy || !name.trim()) return;
    if(kcal.trim() && (!Number.isFinite(Number(kcal)) || Number(kcal)<0)) {setError('Introduce unas kilocalorías válidas.');return;}
    setBusy(true);setError('');
    try {
      const ingredient=await addIngredient(name,kcal);
      onCreated(ingredient);
      if(excluded.includes(ingredient.id)) {setError('Este ingrediente ya está seleccionado.');return;}
      onChoose(ingredient.id);
    }catch{setError('No se ha podido crear el ingrediente.');}
    finally{setBusy(false);}
  }
  return <section className="ingredient-picker" aria-label="Seleccionar ingrediente">
    <div className="section-heading"><h3>{creating?'Nuevo ingrediente':'Seleccionar ingrediente'}</h3><button type="button" className="secondary compact" disabled={busy} onClick={onClose}>Cerrar</button></div>
    {error&&<p role="alert">{error}</p>}
    {creating?<>
      <label>Nombre del ingrediente<input autoFocus value={name} maxLength={120} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
      <label>kcal por 100 g (opcional)<input type="number" min="0" step="any" value={kcal} disabled={busy} onChange={e=>setKcal(e.target.value)}/></label>
      <button type="button" disabled={busy||!name.trim()} onClick={()=>void create()}>{busy?'Guardando…':'Añadir ingrediente'}</button>
      <button type="button" className="secondary" disabled={busy} onClick={()=>setCreating(false)}>Volver al buscador</button>
    </>:<>
      <label>Buscar ingrediente<input autoFocus value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <ul className="picker-results">{ingredients.filter(i=>!excluded.includes(i.id)&&i.name.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))).map(i=><li key={i.id}><button type="button" className="secondary" onClick={()=>onChoose(i.id)}>{i.name}</button></li>)}</ul>
      <button type="button" className="secondary" onClick={()=>{setName(query);setCreating(true);}}>Nuevo ingrediente</button>
    </>}
  </section>;
}
