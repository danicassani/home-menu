import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from './supabase';
export const HouseholdUpdates=createContext(0);
export function useRealtimeRefresh(paused:boolean,setRetry:Dispatch<SetStateAction<number>>) {
  const version=useContext(HouseholdUpdates);
  const seen=useRef(version);
  useEffect(()=>{if(!paused&&version!==seen.current){seen.current=version;setRetry(n=>n+1);}},[version,paused,setRetry]);
}
export function useHouseholdRealtime(houseId:string|null,online:boolean,userId?:string) {
  const [revision,setRevision]=useState(0);
  const [status,setStatus]=useState<'connecting'|'live'|'reconnecting'|'offline'>('connecting');
  useEffect(()=>{
    if((!houseId&&!userId)||!supabase)return;
    if(!online){setStatus('offline');return;}
    const client=supabase;
    let active=true,live=false;
    let pending:ReturnType<typeof setTimeout>|undefined;
    setStatus('connecting');
    const refresh=()=>{if(!active)return;clearTimeout(pending);pending=setTimeout(()=>{if(active)setRevision(n=>n+1);},120);};
    let channel=client.channel(`household:${houseId||'none'}:${crypto.randomUUID()}`);
    if(houseId)channel=channel
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'household_changes',filter:`household_id=eq.${houseId}`},refresh)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'household_changes',filter:`household_id=eq.${houseId}`},refresh);
    if(userId)channel=channel
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'user_household_changes',filter:`user_id=eq.${userId}`},refresh)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'user_household_changes',filter:`user_id=eq.${userId}`},refresh);
    channel=channel
      .subscribe(state=>{
        if(!active)return;
        live=state==='SUBSCRIBED';setStatus(live?'live':'reconnecting');
        if(live)refresh(); // Recupera también lo ocurrido durante una desconexión.
      });
    let checks=0;
    const poll=setInterval(()=>{if(active&&(!live||++checks%4===0))setRevision(n=>n+1);},15000);
    return ()=>{active=false;clearTimeout(pending);clearInterval(poll);void client.removeChannel(channel);};
  },[houseId,online,userId]);
  return {revision,status};
}
