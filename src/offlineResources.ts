import { loadRecipeBook } from './recipes';
import { loadMenuWeek } from './menu';
import { loadShoppingWeek } from './shopping';
import { supabase } from './supabase';
import type { Ingredient } from './recipes';
import type { OfflineWorkspace } from './offline';
export async function offlineResource<T>(workspace:OfflineWorkspace|null,key:string,online:boolean,load:()=>Promise<T>,sanitize:(value:T)=>T=value=>value):Promise<T>{
 if(!online){const saved=await workspace?.read<T>(key);if(saved)return saved;throw new Error('Sin datos guardados');}
 const value=await load();if(workspace)await workspace.cache(key,sanitize(value));return value;
}
export const readBook=(workspace:OfflineWorkspace|null,house:string,online:boolean)=>offlineResource(workspace,'book',online,()=>loadRecipeBook(house),book=>({...book,photoError:false,recipes:book.recipes.map(recipe=>({...recipe,photoUrl:undefined}))}));
export const readMenu=(workspace:OfflineWorkspace|null,week:string,online:boolean)=>offlineResource(workspace,'menu:'+week,online,()=>loadMenuWeek(week));
export async function readShopping(workspace:OfflineWorkspace|null,house:string,week:string,online:boolean){
 const data=await offlineResource(workspace,'shopping:'+week,online,async()=>{
  const [list,catalog]=await Promise.all([loadShoppingWeek(week),supabase!.from('ingredients').select('id,name,kcal_per_100g').eq('household_id',house).order('name')]);
  if(catalog.error)throw catalog.error;return {list,ingredients:(catalog.data||[]) as Ingredient[]};
 });
 try{return {...data,list:workspace?await workspace.overlay(week,data.list):data.list};}
 catch(error){if(!online)throw error;return data;}
}
