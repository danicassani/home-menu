import { useEffect, useId, useRef, useState } from 'react';
import PhotoCropper from './PhotoCropper';
import IngredientPicker from './IngredientPicker';
import { cleanTags, normalizeTag, tagKey, validateTags, emptyDraft, saveRecipe, uploadPhoto, validatePhoto, type Draft, type Ingredient, type Recipe } from './recipes';
export default function RecipeEditor({ original, houseId, ingredients, availableTags=[], online, onCreated, onCancel, onSaved }: {
  original:Recipe|null; houseId:string; ingredients:Ingredient[]; availableTags?:string[]; online:boolean;
  onCreated:(ingredient:Ingredient)=>void; onCancel:()=>void; onSaved:()=>void;
}) {
  const [draft,setDraft]=useState<Draft>(()=>original?{...original,lines:original.lines.map(l=>({...l,alternatives:[...l.alternatives]}))}:emptyDraft());
  const [tagText,setTagText]=useState('');
  const tagList=useId();
  const [tagsOpen,setTagsOpen]=useState(false),[activeTag,setActiveTag]=useState(-1);
  const searchTag=(value:string)=>tagKey(value).normalize('NFD').replace(/\p{M}/gu,'');
  const suggestedTags=cleanTags(availableTags).filter(tag=>!draft.tags.some(value=>tagKey(value)===tagKey(tag))&&searchTag(tag).includes(searchTag(tagText)));
  const showTags=tagsOpen&&suggestedTags.length>0;
  useEffect(()=>{if(showTags&&activeTag>=0)document.getElementById(tagList+'-option-'+activeTag)?.scrollIntoView?.({block:'nearest'});},[showTags,activeTag,tagList]);
  const [picker,setPicker]=useState<'ingredient'|number|null>(null);
  const [cropSource,setCropSource]=useState<File|string|null>(null);
  const [localSource,setLocalSource]=useState<File|null>(null);
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
  function addTag(value=tagText){
    value=availableTags.find(tag=>tagKey(tag)===tagKey(value))||value;
    if(!normalizeTag(value))return;const tags=cleanTags([...draft.tags,value]);const problem=validateTags(tags);
    if(problem){setError(problem);return;}setDraft(d=>({...d,tags}));setTagText('');setError('');setTagsOpen(false);setActiveTag(-1);
  }
  async function submit(e:React.FormEvent) {
    e.preventDefault();if(busy||!online||cropSource)return;
    if(!draft.name.trim()||!draft.instructions.trim()||!draft.lines.length){setError('Completa nombre, ingredientes y receta.');return;}
    const tags=cleanTags([...draft.tags,...(normalizeTag(tagText)?[tagText]:[])]);
    const tagError=validateTags(tags);if(tagError){setError(tagError);return;}
    setDraft(d=>({...d,tags}));setTagText('');setBusy(true);setError('');
    try {
      let photo=draft.photo_path;
      if(file){
        if(upload.current?.file!==file)upload.current={file,path:await uploadPhoto(houseId,file)};
        photo=upload.current.path;
      }
      await saveRecipe(original,{...draft,tags,photo_path:photo});
      onSaved();
    }catch{setError('No se ha podido guardar. Si otra persona ha editado el plato, vuelve a cargar la carta.');}
    finally{setBusy(false);}
  }
  return <><form className="recipe-editor" onSubmit={e=>void submit(e)}>
    <div className="section-heading"><h2>{original?'Editar plato':'Nuevo plato'}</h2><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancelar</button></div>
    {error&&<p role="alert">{error}</p>}
    <fieldset disabled={busy||!online} className="editor-fields">
      <label>Nombre del plato<input required maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label>Descripción<textarea maxLength={500} rows={2} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
      <fieldset className="recipe-tags"><legend>Etiquetas</legend>
       <div className="tag-selector" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setTagsOpen(false);setActiveTag(-1);}}}>
        <div className="tag-entry"><label className="sr-only" htmlFor={tagList}>Nueva etiqueta</label><input id={tagList} role="combobox" aria-autocomplete="list" aria-expanded={showTags} aria-controls={tagList+'-suggestions'} aria-activedescendant={showTags&&activeTag>=0&&activeTag<suggestedTags.length?tagList+'-option-'+activeTag:undefined} autoComplete="off" onClick={()=>{setTagsOpen(true);setActiveTag(-1);}} value={tagText} maxLength={160} onFocus={()=>{setTagsOpen(true);setActiveTag(-1);}} onChange={event=>{setTagText(event.target.value);setTagsOpen(true);setActiveTag(-1);}} onKeyDown={event=>{
         if(event.nativeEvent.isComposing)return;
         if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setTagsOpen(true);if(suggestedTags.length)setActiveTag(value=>event.key==='ArrowDown'?(value+1)%suggestedTags.length:(value<=0?suggestedTags.length-1:value-1));}
         else if(event.key==='Escape'){event.preventDefault();setTagsOpen(false);setActiveTag(-1);}
         else if(event.key==='Enter'){event.preventDefault();addTag(showTags&&activeTag>=0?suggestedTags[activeTag]:tagText);}
        }}/><button type="button" className="secondary compact" aria-label="Añadir etiqueta" disabled={!normalizeTag(tagText)} onClick={()=>addTag()}>+</button></div>
        {showTags&&<ul id={tagList+'-suggestions'} className="tag-suggestions" role="listbox" aria-label="Etiquetas existentes">{suggestedTags.map((tag,index)=><li key={tag} role="presentation"><button type="button" role="option" id={tagList+'-option-'+index} aria-selected={activeTag===index} tabIndex={-1} onPointerDown={event=>event.preventDefault()} onClick={()=>addTag(tag)}>{tag}</button></li>)}</ul>}
       </div>
       {draft.tags.length>0&&<ul className="tag-chips">{draft.tags.map(tag=><li key={tag}><button type="button" className="secondary compact" aria-label={`Quitar etiqueta ${tag}`} onClick={()=>setDraft(d=>({...d,tags:d.tags.filter(value=>value!==tag)}))}>{tag}<span aria-hidden="true"> ×</span></button></li>)}</ul>}
      </fieldset>
      <div className="photo-controls">
       <input className="photo-input" aria-label="Foto (opcional)" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{
        const selected=event.target.files?.[0];event.target.value='';if(!selected)return;
        const problem=validatePhoto(selected);if(problem){setError(problem);return;}
        setError('');setCropSource(selected);
       }}/>
       {(preview||((draft.photo_path||(!draft.clearPhoto&&original?.catalog_photo_path))&&original?.photoUrl))?<img className="editor-photo" src={preview||original?.photoUrl} alt="Foto del plato"/>:null}
       <div className="photo-tools">
        <button type="button" className="photo-icon secondary" aria-label="Añadir o cambiar foto" onClick={()=>fileInput.current?.click()}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 5 9.5 3h5L16 5h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></svg></button>
        {(file||draft.photo_path||(!draft.clearPhoto&&original?.catalog_photo_path))&&<>
         {(localSource||original?.photoUrl)&&<button type="button" className="photo-icon secondary" aria-label="Ajustar encuadre" onClick={()=>setCropSource(localSource||original!.photoUrl!)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v13a2 2 0 0 0 2 2h13M3 6h13a2 2 0 0 1 2 2v13"/></svg></button>}
         <button type="button" className="photo-icon secondary" aria-label="Quitar foto" onClick={()=>{setFile(null);setLocalSource(null);upload.current=null;setDraft({...draft,photo_path:null,clearPhoto:true});}}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg></button>
        </>}
       </div>
      </div>
      <fieldset className="ingredient-fields"><legend>Ingredientes</legend>
        <button type="button" className="secondary" aria-label="Añadir ingrediente" disabled={picker!==null} onClick={()=>setPicker('ingredient')}>+</button>
        <ul className="ingredient-lines">{draft.lines.map((line,index)=><li key={line.id}>
          <div className="ingredient-line-heading"><strong>{ingredientName(line.ingredient_id)}</strong><div className="ingredient-line-actions">
           <button type="button" className="secondary compact" disabled={picker!==null} onClick={()=>setPicker(index)}>Añadir alternativa</button>
           <button type="button" className="secondary ingredient-eraser" disabled={picker!==null} aria-label={`Quitar ${ingredientName(line.ingredient_id)}`} onClick={()=>setDraft(d=>({...d,lines:d.lines.filter(l=>l.id!==line.id)}))}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 3 6 6a2 2 0 0 1 0 3l-8 8H7l-5-5a2 2 0 0 1 0-3l10-9a2 2 0 0 1 3 0ZM7 8l9 9m-3 3h9"/></svg></button>
          </div></div>
          <div className="alternative-chips">{line.alternatives.map(id=><button type="button" key={id} className="secondary compact" aria-label={`Quitar alternativa ${ingredientName(id)}`} onClick={()=>setDraft(d=>({...d,lines:d.lines.map(l=>l.id===line.id?{...l,alternatives:l.alternatives.filter(a=>a!==id)}:l)}))}>{ingredientName(id)} ×</button>)}</div>
        </li>)}</ul>
        {picker!==null&&<IngredientPicker ingredients={ingredients} excluded={picker==='ingredient'?draft.lines.map(l=>l.ingredient_id):[draft.lines[picker].ingredient_id,...draft.lines[picker].alternatives]} onChoose={choose} onCreated={onCreated} onClose={()=>setPicker(null)}/>}
      </fieldset>
      <label>Receta<textarea required maxLength={20000} rows={8} value={draft.instructions} onChange={e=>setDraft({...draft,instructions:e.target.value})}/></label>
      <button disabled={busy||!online||picker!==null||Boolean(cropSource)} type="submit">{busy?'Guardando…':'Guardar plato'}</button>
    </fieldset>
  </form>{cropSource&&<PhotoCropper source={cropSource} online={online} onCancel={()=>setCropSource(null)} onApply={photo=>{setFile(photo);setLocalSource(typeof cropSource==='string'?null:cropSource);upload.current=null;setCropSource(null);}}/>}</>;
}
