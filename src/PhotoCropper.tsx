import { useEffect, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { cropPhoto } from './cropPhoto';
export default function PhotoCropper({source,online,onApply,onCancel}:{source:File|string;online:boolean;onApply:(file:File)=>void;onCancel:()=>void}){
 const [url,setUrl]=useState(''),[crop,setCrop]=useState({x:0,y:0}),[zoom,setZoom]=useState(1);
 const [area,setArea]=useState<Area|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),active=useRef(true);
 useEffect(()=>{active.current=true;const current=dialog.current;current?.showModal();return()=>{active.current=false;current?.close();};},[]);
 useEffect(()=>{
  const url=typeof source==='string'?source:URL.createObjectURL(source);setUrl(url);
  return()=>{if(typeof source!=='string')URL.revokeObjectURL(url);};
 },[source]);
 async function apply(){
  if(!area||!ready||busy||!online)return;setBusy(true);setError('');
  try{const file=await cropPhoto(url,area);if(active.current)onApply(file);}
  catch{if(active.current)setError('No se ha podido preparar la foto. Reintenta o elige otra imagen.');}
  finally{if(active.current)setBusy(false);}
 }
 return <dialog className="crop-dialog" ref={dialog} aria-labelledby="crop-title" onCancel={event=>{event.preventDefault();if(!busy)onCancel();}}>
  <h2 id="crop-title">Encuadrar foto</h2>
  <div className="crop-stage">
   {url&&<Cropper image={url} crop={crop} zoom={zoom} aspect={4/3} minZoom={1} maxZoom={3} onCropChange={value=>{if(!busy)setCrop(value);}} keyboardStep={10} onZoomChange={value=>{if(!busy)setZoom(value);}} onCropComplete={(_relative,pixels)=>setArea(pixels)} onMediaLoaded={()=>setReady(true)} disableAutomaticStylesInjection mediaProps={{alt:'Foto a encuadrar',crossOrigin:'anonymous',onError:()=>{setReady(false);setError('No se ha podido abrir la imagen. Elige otra foto.');}}} cropperProps={{tabIndex:0,role:'group','aria-label':'Mover imagen','aria-describedby':'crop-help'}}/>}
  </div>
  <p id="crop-help" className="crop-help">Arrastra para encuadrar.<span className="sr-only"> Usa las flechas del teclado para mover la imagen y el control Zoom para ampliarla.</span></p>
  <label className="crop-zoom">Zoom<input type="range" min="1" max="3" step="0.01" value={zoom} disabled={!ready||busy} onChange={event=>setZoom(Number(event.target.value))}/></label>
  {error&&<p role="alert">{error}</p>}
  <div className="crop-actions"><button type="button" disabled={!ready||!area||busy||!online} onClick={()=>void apply()}>{busy?'Preparando…':'Usar foto'}</button><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancelar</button></div>
 </dialog>;
}
