import { supabase } from './supabase';
export type ShoppingItem={id:string;ingredient_id:string;name:string;from_menu:boolean;manual:boolean;purchased:boolean};
function client(){if(!supabase)throw new Error('Supabase no configurado');return supabase;}
export async function loadShoppingWeek(week:string):Promise<ShoppingItem[]> {
 const result=await client().rpc('get_shopping_week',{p_week:week});if(result.error)throw result.error;return result.data;
}
export async function setPurchased(id:string,purchased:boolean):Promise<ShoppingItem[]> {
 const result=await client().rpc('set_shopping_purchased',{p_item:id,p_purchased:purchased});if(result.error)throw result.error;return result.data;
}
export async function setManualItem(week:string,ingredient:string,present:boolean):Promise<ShoppingItem[]> {
 const result=await client().rpc('set_manual_shopping',{p_week:week,p_ingredient:ingredient,p_present:present});if(result.error)throw result.error;return result.data;
}
