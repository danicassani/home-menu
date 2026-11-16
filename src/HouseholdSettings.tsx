import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { deleteHousehold, getMembers, manageMember, type House, type Member } from './householdManagement';
import { useRealtimeRefresh } from './realtime';
type Confirmation={kind:'remove'|'transfer'|'leave'|'delete';member?:Member};
type Invite={id:string;expires_at:string;revoked_at:string|null};
export default function HouseholdSettings({house,userId,online,onChanged}:{house:House;userId:string;online:boolean;onChanged:()=>void}) {
 const [members,setMembers]=useState<Member[]>([]),[invites,setInvites]=useState<Invite[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[link,setLink]=useState(''),[name,setName]=useState('');
 const [confirm,setConfirm]=useState<Confirmation|null>(null);
 const [retry,setRetry]=useState(0);
 const owner=house.owner_id===userId;
 useRealtimeRefresh(busy||Boolean(confirm),setRetry);
 useEffect(()=>{
  if(!online){setLoading(false);return;}
  if(house.deletion_requested_at){setMembers([]);setInvites([]);setLoading(false);return;}
  let active=true;
  void (async()=>{
   try{
    const list=await getMembers();
    const invitations=owner?await supabase!.from('household_invitations').select('id,expires_at,revoked_at').order('expires_at',{ascending:false}):{data:[],error:null};
    if(invitations.error)throw invitations.error;
    if(active){setMembers(list);setInvites(invitations.data||[]);setError('');}
   }catch{if(active)setError('No se han podido cargar los miembros.');}
   finally{if(active)setLoading(false);}
  })();
  return ()=>{active=false;};
 },[house.id,house.deletion_requested_at,owner,retry,online]);
 useEffect(()=>{setLink('');if(!owner)setConfirm(null);},[owner]);
 async function invitation(id?:string){
  if(busy||!online)return;setBusy(true);setError('');
  try{
   const r=id?await supabase!.rpc('revoke_household_invitation',{invitation_id:id}):await supabase!.rpc('create_household_invitation');
   if(r.error)throw r.error;
   setLink(id?'':`${location.origin}/#invite=${encodeURIComponent(r.data)}`);setRetry(n=>n+1);
  }catch{setError('No se ha podido guardar la invitación.');}
  finally{setBusy(false);}
 }
 async function submit(){
  if(busy||!online||!confirm)return;setBusy(true);setError('');
  try{
   if(confirm.kind==='delete')await deleteHousehold(house,name);
   else await manageMember(confirm.kind,confirm.member?.user_id);
   if(confirm.kind==='leave'||confirm.kind==='delete')sessionStorage.removeItem('home-menu-invitation');
   setConfirm(null);setName('');onChanged();
  }catch{setError(confirm.kind==='delete'?'No se ha completado la eliminación. Puedes reintentar para terminar.':'No se ha podido guardar. Actualiza la casa y reintenta.');if(confirm.kind==='delete')onChanged();}
  finally{setBusy(false);}
 }
 async function resume(){
  if(busy||!online)return;setBusy(true);setError('');
  try{await deleteHousehold(house,house.name);sessionStorage.removeItem('home-menu-invitation');onChanged();}
  catch{setError('No se ha completado la eliminación. Reintenta para terminar.');}
  finally{setBusy(false);}
 }
 if(house.deletion_requested_at)return <section aria-label="Eliminación de casa"><h2>{house.name}</h2><p>Eliminación iniciada.</p>{error&&<p role="alert">{error}</p>}<button className="danger" disabled={busy||!online} onClick={()=>void resume()}>{busy?'Eliminando…':'Completar eliminación'}</button></section>;
 return <section aria-label="Gestión de casa">
  <div className="section-heading"><h2>{house.name}</h2><button className="secondary compact" disabled={busy} onClick={()=>setRetry(n=>n+1)}>Actualizar casa</button></div>
  {!online&&<p role="status">Conéctate para gestionar la casa.</p>}
  {error&&<p role="alert">{error}</p>}
  {loading?<p role="status">Cargando miembros…</p>:<ul className="member-list">{members.map(member=><li key={member.user_id}>
   <div className="member-name"><strong>{member.display_name}{member.user_id===userId?' (Tú)':''}</strong><span>{member.is_owner?'Propietario':'Miembro'}</span></div>
   {owner&&member.user_id!==userId&&<div className="member-actions"><button className="secondary compact" disabled={busy||!online||Boolean(confirm)} onClick={()=>setConfirm({kind:'transfer',member})}>Transferir propiedad a {member.display_name}</button><button className="secondary compact" disabled={busy||!online||Boolean(confirm)} onClick={()=>setConfirm({kind:'remove',member})}>Quitar a {member.display_name}</button></div>}
  </li>)}</ul>}
  {confirm?<form className="house-confirmation" onSubmit={e=>{e.preventDefault();void submit();}}>
   <h3>{confirm.kind==='delete'?'Eliminar casa':confirm.kind==='leave'?'Salir de la casa':confirm.kind==='remove'?`Quitar a ${confirm.member?.display_name}`:`Transferir a ${confirm.member?.display_name}`}</h3>
   {confirm.kind==='delete'?<><p>Se eliminarán los platos, menús, compras y fotos de la casa.</p><label>Escribe {house.name}<input autoFocus required value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label></>:<p>{confirm.kind==='leave'?'Perderás el acceso a los datos de esta casa.':confirm.kind==='transfer'?'Pasarás a ser miembro. Se revocarán las invitaciones activas.':'Se revocarán las invitaciones activas.'}</p>}
   <button className={confirm.kind==='delete'?'danger':''} disabled={busy||!online||(confirm.kind==='delete'&&name.trim()!==house.name)}>{busy?'Guardando…':'Confirmar'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>{setConfirm(null);setName('');}}>Cancelar</button>
  </form>:owner?<button className="secondary danger-text" disabled={busy||!online} onClick={()=>setConfirm({kind:'delete'})}>Eliminar casa</button>:<button className="secondary" disabled={busy||!online} onClick={()=>setConfirm({kind:'leave'})}>Salir de la casa</button>}
  {owner&&<section className="house-invitations" aria-label="Invitaciones"><h3>Invitaciones</h3><button disabled={busy||!online||Boolean(confirm)} onClick={()=>void invitation()}>Crear enlace de invitación</button>
   {link&&<label>Enlace válido durante 7 días<input readOnly value={link} onFocus={e=>e.target.select()}/></label>}
   <ul className="invites">{invites.filter(i=>!i.revoked_at&&new Date(i.expires_at)>new Date()).map(i=><li key={i.id}>Hasta {new Date(i.expires_at).toLocaleDateString('es')}<button className="secondary compact" disabled={busy||!online||Boolean(confirm)} onClick={()=>void invitation(i.id)}>Revocar</button></li>)}</ul>
  </section>}
 </section>;
}
