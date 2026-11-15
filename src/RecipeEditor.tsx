import { useEffect, useRef, useState } from 'react';
import IngredientPicker from './IngredientPicker';
import { categories, emptyDraft, saveRecipe, uploadPhoto, validatePhoto, type Category, type Draft, type Ingredient, type Recipe } from './recipes';
export default function RecipeEditor({ original, houseId, ingredients, online, onCreated, onCancel, onSaved }: {
  original:Recipe|null; houseId:string; ingredients:Ingredient[]; online:boolean;
  onCreated:(ingredient:Ingredient)=>void; onCancel:()=>void; onSaved:()=>void;
}) {
  const [draft,setDraft]=useState<Draft>(()=>original?{...original,lines:original.lines.map(l=>({...l,alternatives:[...l.alternatives]}))}:emptyDraft());
  const [picker,setPicker]=useState<'ingredient'|number|null>(null);
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const upload=useRef<{file:File;path:string}|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!file){setPreview('');return;}
    const url=URL.createObjectURL(file);setPreview(url);
    return ()=>URL.revokeObjectURL(url);
  },[file]);
  const ingredientName=(id:string)=>ingredients.find(i=>i.id===id)?.name||'Ingrediente';
  function choose(id:string) {
    if(picker==='ingredient')setDraft(d=>({...d,lines:[...d.lines,{id:crypto.randomUUID(),ingredient_id:id,alternatives:[]}]}));
    else if(typeof picker==='number')setDraft(d=>({...d,lines:d.lines.map((l,index)=>index===picker?{...l,alternatives:[...l.alternatives,id]}:l)}));
    setPicker(null);
  }
  async function submit(e:React.FormEvent) {
    e.preventDefault();if(busy||!online)return;
    if(!draft.name.trim()||!draft.instructions.trim()||!draft.lines.length||!draft.categories.length){setError('Completa nombre, categoría, ingredientes y receta.');return;}
    setBusy(true);setError('');
    try {
      let photo=draft.photo_path;
      if(file){
        if(upload.current?.file!==file)upload.current={file,path:await uploadPhoto(houseId,file)};
        photo=upload.current.path;
      }
      await saveRecipe(original,{...draft,photo_path:photo});
      onSaved();
    }catch{setError('No se ha podido guardar. Si otra persona ha editado el plato, vuelve a cargar la carta.');}
    finally{setBusy(false);}
  }
  return <form className="recipe-editor" onSubmit={e=>void submit(e)}>
    <div className="section-heading"><h2>{original?'Editar plato':'Nuevo plato'}</h2><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancelar</button></div>
    {error&&<p role="alert">{error}</p>}
    <fieldset disabled={busy||!online} className="editor-fields">
      <label>Nombre del plato<input required maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label>Descripción<textarea maxLength={500} rows={2} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
      <fieldset className="category-options"><legend>Categorías</legend>{Object.entries(categories).map(([value,label])=><label key={value}><input type="checkbox" checked={draft.categories.includes(value as Category)} onChange={e=>setDraft(d=>({...d,categories:e.target.checked?[...d.categories,value as Category]:d.categories.filter(c=>c!==value)}))}/>{label}</label>)}</fieldset>
      <label>Foto (opcional)<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{
        const selected=e.target.files?.[0];if(!selected)return;
        const problem=validatePhoto(selected);if(problem){setError(problem);e.target.value='';return;}
        setError('');setFile(selected);
      }}/></label>
      {(preview||draft.photo_path)&&<div className="photo-preview">{(preview||original?.photoUrl)&&<img src={preview||original?.photoUrl} alt="Foto del plato"/>}<button type="button" className="secondary" onClick={()=>{setFile(null);upload.current=null;setDraft({...draft,photo_path:null});if(fileInput.current)fileInput.current.value='';}}>Quitar foto</button></div>}
      <fieldset className="ingredient-fields"><legend>Ingredientes</legend>
        <button type="button" className="secondary" aria-label="Añadir ingrediente" disabled={picker!==null} onClick={()=>setPicker('ingredient')}>+</button>
        <ul className="ingredient-lines">{draft.lines.map((line,index)=><li key={line.id}>
          <div className="section-heading"><strong>{ingredientName(line.ingredient_id)}</strong><button type="button" className="secondary compact" disabled={picker!==null} aria-label={`Quitar ${ingredientName(line.ingredient_id)}`} onClick={()=>setDraft(d=>({...d,lines:d.lines.filter(l=>l.id!==line.id)}))}>Quitar</button></div>
          <div className="alternative-chips">{line.alternatives.map(id=><button type="button" key={id} className="secondary compact" aria-label={`Quitar alternativa ${ingredientName(id)}`} onClick={()=>setDraft(d=>({...d,lines:d.lines.map(l=>l.id===line.id?{...l,alternatives:l.alternatives.filter(a=>a!==id)}:l)}))}>{ingredientName(id)} ×</button>)}</div>
          <button type="button" className="secondary compact" disabled={picker!==null} onClick={()=>setPicker(index)}>Añadir alternativa</button>
        </li>)}</ul>
        {picker!==null&&<IngredientPicker ingredients={ingredients} excluded={picker==='ingredient'?draft.lines.map(l=>l.ingredient_id):[draft.lines[picker].ingredient_id,...draft.lines[picker].alternatives]} onChoose={choose} onCreated={onCreated} onClose={()=>setPicker(null)}/>}
      </fieldset>
      <label>Receta<textarea required maxLength={20000} rows={8} value={draft.instructions} onChange={e=>setDraft({...draft,instructions:e.target.value})}/></label>
      <button disabled={busy||!online||picker!==null} type="submit">{busy?'Guardando…':'Guardar plato'}</button>
    </fieldset>
  </form>;
}
