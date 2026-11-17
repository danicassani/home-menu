import { useEffect, useRef } from 'react';
import type { Choice, MenuEntry } from './menu';
import type { Ingredient, Recipe } from './recipes';
export default function PlannedRecipeDetails({entry,recipe,ingredients,disabled,error,onChoices,onClose}:{entry:MenuEntry;recipe:Recipe;ingredients:Ingredient[];disabled:boolean;error:string;onChoices:(choices:Choice[])=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const current=dialog.current;if(!current)return;current.showModal();closeButton.current?.focus();return()=>current.close();},[]);
 const name=(id:string)=>ingredients.find(ingredient=>ingredient.id===id)?.name||'Ingrediente';
 function close(){dialog.current?.close();onClose();}
 return <dialog ref={dialog} className="planned-recipe-dialog" aria-labelledby="planned-recipe-title" onCancel={event=>{event.preventDefault();close();}}>
  <div className="section-heading"><h2 id="planned-recipe-title">{recipe.name}</h2><button ref={closeButton} type="button" className="secondary dialog-close" aria-label="Cerrar plato" onClick={close}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
  {error&&<p role="alert">{error}</p>}
  <h3>Ingredientes</h3><ul className="menu-ingredients">{recipe.lines.map(line=><li key={line.id}>{line.alternatives.length?<label>{name(line.ingredient_id)}<select disabled={disabled} value={entry.choices.find(choice=>choice.ingredient_id===line.ingredient_id)?.alternative_id||line.ingredient_id} onChange={event=>{
   const choices=entry.choices.filter(choice=>choice.ingredient_id!==line.ingredient_id);
   if(event.target.value!==line.ingredient_id)choices.push({ingredient_id:line.ingredient_id,alternative_id:event.target.value});
   onChoices(choices);
  }}><option value={line.ingredient_id}>{name(line.ingredient_id)}</option>{line.alternatives.map(id=><option key={id} value={id}>{name(id)}</option>)}</select></label>:name(line.ingredient_id)}</li>)}</ul>
 </dialog>;
}
