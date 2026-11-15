import { supabase } from './supabase';
import type { Category } from './recipes';
export type Choice = { ingredient_id:string; alternative_id:string };
export type MenuEntry = { id:string; planned_day:string; meal:Category; recipe_id:string; choices_reset:boolean; choices:Choice[] };
export type MenuWeek = { revision:number; entries:MenuEntry[] };
// Las fechas se calculan como días de calendario. No se usan toISOString ni milisegundos entre días.
function parseDay(day:string) {
  const [year,month,date]=day.split('-').map(Number);
  return new Date(year,month-1,date,12);
}
export function calendarDay(date:Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(day:string,amount:number) {
  const date=parseDay(day);date.setDate(date.getDate()+amount);return calendarDay(date);
}
export function monday(day:string) {
  const date=parseDay(day);return addDays(day,-((date.getDay()+6)%7));
}
export function dayLabel(day:string) {
  return parseDay(day).toLocaleDateString('es',{weekday:'long',day:'numeric',month:'short'});
}
export function weekLabel(week:string) {
  return `${parseDay(week).toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})} — ${parseDay(addDays(week,6)).toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})}`;
}
function client(){if(!supabase)throw new Error('Supabase no configurado');return supabase;}
export async function loadMenuWeek(week:string):Promise<MenuWeek> {
  const r=await client().rpc('get_menu_week',{p_week:week});if(r.error)throw r.error;return r.data;
}
export type MenuChange = { action:'add'|'replace'|'remove'|'choices'|'ack'; entry?:string; day?:string; meal?:Category; recipe?:string; choices?:Choice[] };
export async function changeMenuWeek(week:string,revision:number,change:MenuChange):Promise<MenuWeek> {
  const r=await client().rpc('change_menu_week',{p_week:week,p_revision:revision,p_action:change.action,p_entry:change.entry||null,p_day:change.day||null,p_meal:change.meal||null,p_recipe:change.recipe||null,p_choices:change.choices||[]});
  if(r.error)throw r.error;return r.data;
}
export async function copyMenuWeek(source:string,target:string,revision:number,overwrite:boolean):Promise<MenuWeek> {
  const r=await client().rpc('copy_menu_week',{p_source:source,p_target:target,p_revision:revision,p_overwrite:overwrite});if(r.error)throw r.error;return r.data;
}
