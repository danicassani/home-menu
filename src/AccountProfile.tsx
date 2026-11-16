import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { applyAppearance, avatars, clearAppearance, defaultPreferences, loadPreferences, savePreferences, themes, type Preferences, type Theme } from './preferences';
export default function AccountProfile({user,online}:{user:User;online:boolean}) {
 const name=String(user.user_metadata.full_name||user.user_metadata.name||'Tu perfil');
 const [saved,setSaved]=useState(defaultPreferences),[draft,setDraft]=useState(defaultPreferences);
 const [open,setOpen]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[readError,setReadError]=useState(false),[retry,setRetry]=useState(0);
 const [systemDark,setSystemDark]=useState(()=>window.matchMedia('(prefers-color-scheme: dark)').matches);
 const dialog=useRef<HTMLDialogElement>(null),dirty=useRef(false);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-color-scheme: dark)');const changed=()=>setSystemDark(media.matches);
  media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);
 },[]);
 useEffect(()=>()=>clearAppearance(),[]);
 useEffect(()=>{applyAppearance(open?draft:saved,systemDark);},[saved,draft,open,systemDark]);
 useEffect(()=>{
  let active=true;setLoading(true);
  void loadPreferences(user.id).then(value=>{
   if(active){setSaved(value);if(!dirty.current)setDraft(value);setReadError(false);setError('');}
  }).catch(()=>{if(active){setReadError(true);setError('No se ha podido cargar el perfil.');}}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[user.id,retry]);
 useEffect(()=>{
  const current=dialog.current;if(!current)return;
  if(open&&!current.open)current.showModal();else if(!open&&current.open)current.close();
 },[open]);
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==='visible'&&!open&&!busy)setRetry(n=>n+1);};
  document.addEventListener('visibilitychange',refresh);return()=>document.removeEventListener('visibilitychange',refresh);
 },[open,busy]);
 function change(patch:Partial<Preferences>){dirty.current=true;setDraft(p=>({...p,...patch}));}
 function close(){if(busy)return;dirty.current=false;setDraft(saved);setOpen(false);}
 async function save(){
  if(busy||loading||readError||!online)return;setBusy(true);setError('');
  try{
   const result=await savePreferences(user.id,draft);setSaved(result);setDraft(result);dirty.current=false;setOpen(false);
  }catch{setError('No se han guardado los cambios. Inténtalo de nuevo.');}
  finally{setBusy(false);}
 }
 return <>
  <button className="identity profile-trigger" aria-label={`Abrir perfil de ${name}`} disabled={loading} onClick={()=>{dirty.current=false;setDraft(saved);setOpen(true);}}><span className="avatar" aria-hidden="true">{saved.avatar||Array.from(name)[0]?.toUpperCase()}</span><span>{name}</span></button>
  <dialog ref={dialog} className="profile-dialog" aria-labelledby="profile-title" onCancel={e=>{e.preventDefault();close();}} onClose={()=>{if(!busy)setOpen(false);}}>
   <div className="section-heading"><h2 id="profile-title">Perfil</h2><button type="button" className="secondary compact" disabled={busy} onClick={close}>Cerrar perfil</button></div>
   <p className="profile-name">{name}</p>
   {error&&<p role="alert">{error}</p>}
   {readError&&<button className="secondary" disabled={loading||!online} onClick={()=>setRetry(n=>n+1)}>Reintentar perfil</button>}
   {loading&&<p role="status">Cargando perfil…</p>}
   <form onSubmit={e=>{e.preventDefault();void save();}}>
    <fieldset disabled={loading||busy||readError||!online}>
     <fieldset><legend>Avatar</legend><div className="emoji-options">
      <label className="avatar-option"><input type="radio" name="avatar" value="" checked={draft.avatar===null} onChange={()=>change({avatar:null})}/><span aria-hidden="true">{Array.from(name)[0]?.toUpperCase()}</span><span className="sr-only">Inicial</span></label>
      {avatars.map(([emoji,label])=><label className="avatar-option" key={emoji}><input type="radio" name="avatar" value={emoji} checked={draft.avatar===emoji} onChange={()=>change({avatar:emoji})}/><span aria-hidden="true">{emoji}</span><span className="sr-only">{label}</span></label>)}
     </div></fieldset>
     <fieldset><legend>Tema</legend><div className="theme-options">{Object.entries(themes).map(([value,theme])=><label className="theme-option" key={value} style={{'--swatch':theme.swatch} as CSSProperties}><input type="radio" name="theme" value={value} checked={draft.theme===value} onChange={()=>change({theme:value as Theme})}/><span className="theme-swatch" aria-hidden="true"/><span className="theme-check" aria-hidden="true">{draft.theme===value?'✓':''}</span><span className="sr-only">{theme.label}</span></label>)}</div></fieldset>
     <label className="mode-control"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" strokeLinecap="round"/></svg><span>Modo oscuro</span><input className="mode-switch" type="checkbox" role="switch" checked={draft.mode==='dark'||(draft.mode==='system'&&systemDark)} onChange={e=>change({mode:e.target.checked?'dark':'light'})}/></label>
    </fieldset>
    {!online&&<p role="status">Conéctate para cambiar el perfil.</p>}
    <div className="profile-actions"><button type="submit" disabled={loading||busy||readError||!online}>{busy?'Guardando…':'Guardar perfil'}</button><button type="button" className="secondary" disabled={busy} onClick={close}>Cancelar</button></div>
   </form>
  </dialog>
 </>;
}
