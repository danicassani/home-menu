import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
const mock=vi.hoisted(()=>({channel:vi.fn(),removeChannel:vi.fn(),on:vi.fn(),subscribe:vi.fn(),handlers:[] as (()=>void)[],status:undefined as ((status:string)=>void)|undefined}));
vi.mock('./supabase',()=>({supabase:{channel:mock.channel,removeChannel:mock.removeChannel}}));
import { HouseholdUpdates, useHouseholdRealtime, useRealtimeRefresh } from './realtime';
beforeEach(()=>{
 vi.useFakeTimers();mock.handlers=[];
 const channel={on:mock.on,subscribe:mock.subscribe};
 mock.on.mockImplementation((_type,_filter,fn)=>{mock.handlers.push(fn);return channel;});
 mock.subscribe.mockImplementation(fn=>{mock.status=fn;return channel;});
 mock.channel.mockReturnValue(channel);mock.removeChannel.mockResolvedValue('ok');
});
afterEach(()=>vi.useRealTimers());
it('filtra por casa, agrupa eventos y recupera el estado al suscribirse',()=>{
 const {result,unmount}=renderHook(()=>useHouseholdRealtime('house',true));
 expect(mock.on).toHaveBeenCalledWith('postgres_changes',expect.objectContaining({event:'UPDATE',filter:'household_id=eq.house',table:'household_changes'}),expect.any(Function));
 act(()=>{mock.status!('SUBSCRIBED');vi.advanceTimersByTime(120);});
 expect(result.current).toEqual({revision:1,status:'live'});
 act(()=>{mock.handlers[0]();mock.handlers[0]();mock.handlers[1]();vi.advanceTimersByTime(119);});
 expect(result.current.revision).toBe(1);act(()=>vi.advanceTimersByTime(1));expect(result.current.revision).toBe(2);
 unmount();expect(mock.removeChannel).toHaveBeenCalled();
});
it('recarga durante fallos de transporte y después de reconectar',()=>{
 const {result,unmount}=renderHook(()=>useHouseholdRealtime('house',true));
 act(()=>{mock.status!('CHANNEL_ERROR');vi.advanceTimersByTime(15000);});
 expect(result.current).toEqual({revision:1,status:'reconnecting'});
 act(()=>{mock.status!('SUBSCRIBED');vi.advanceTimersByTime(120);});
 expect(result.current).toEqual({revision:2,status:'live'});unmount();
});
it('retira el canal al desconectar y al cambiar de casa',()=>{
 const {result,rerender,unmount}=renderHook(({house,online})=>useHouseholdRealtime(house,online),{initialProps:{house:'A',online:true}});
 rerender({house:'A',online:false});expect(result.current.status).toBe('offline');expect(mock.removeChannel).toHaveBeenCalledTimes(1);
 rerender({house:'B',online:true});expect(mock.channel).toHaveBeenLastCalledWith(expect.stringContaining('household:B:'));
 unmount();expect(mock.removeChannel).toHaveBeenCalledTimes(2);
});
it('aplaza la actualización mientras hay un borrador y aplica solo una al terminar',()=>{
 function Consumer({paused}:{paused:boolean}){const [count,setCount]=useState(0);useRealtimeRefresh(paused,setCount);return <span>{count}</span>;}
 const {rerender}=render(<HouseholdUpdates.Provider value={0}><Consumer paused/></HouseholdUpdates.Provider>);
 rerender(<HouseholdUpdates.Provider value={1}><Consumer paused/></HouseholdUpdates.Provider>);
 rerender(<HouseholdUpdates.Provider value={2}><Consumer paused/></HouseholdUpdates.Provider>);
 expect(screen.getByText('0')).toBeInTheDocument();
 rerender(<HouseholdUpdates.Provider value={2}><Consumer paused={false}/></HouseholdUpdates.Provider>);
 expect(screen.getByText('1')).toBeInTheDocument();
});
it('mantiene avisos del usuario sin casa para recibir la pérdida de pertenencia',()=>{
 const {unmount}=renderHook(()=>useHouseholdRealtime(null,true,'user'));
 expect(mock.on).toHaveBeenCalledWith('postgres_changes',expect.objectContaining({table:'user_household_changes',filter:'user_id=eq.user'}),expect.any(Function));
 expect(mock.on.mock.calls.every(call=>call[1].table==='user_household_changes')).toBe(true);unmount();
});
