import { expect, type Page } from '@playwright/test';
import type { MenuWeek } from '../src/menu';
import type { ShoppingItem } from '../src/shopping';
import type { Preferences } from '../src/preferences';

export function createFixtureState() {
 const preferences=new Map<string,Preferences>();
 const house={id:'00000000-0000-0000-0000-000000000010',name:'Casa de prueba',owner_id:'00000000-0000-0000-0000-000000000001',deletion_requested_at:null as string|null,deleted:false};
 const members=[{user_id:house.owner_id,display_name:'Alex'},{user_id:'00000000-0000-0000-0000-000000000002',display_name:'Sam'}];
 const files=new Set<string>();
 const ingredients=[{id:'00000000-0000-0000-0000-000000000021',name:'Pollo',kcal_per_100g:null},{id:'00000000-0000-0000-0000-000000000022',name:'Tofu',kcal_per_100g:80}];
 type Dish={id:string;name:string;description:string;instructions:string;categories:string[];photo_path:string|null;revision:number;archived:boolean};
 const recipes:Dish[]=[{id:'00000000-0000-0000-0000-000000000030',name:'Pollo al horno',description:'Con verduras',instructions:'Hornear 30 minutos.',categories:['lunch'],photo_path:null,revision:1,archived:false}];
 const lines=[{id:'00000000-0000-0000-0000-000000000040',recipe_id:recipes[0].id,ingredient_id:ingredients[0].id,position:0}];
 const alternatives=[{line_id:lines[0].id,ingredient_id:ingredients[1].id}];
 const weeks=new Map<string,MenuWeek>();
 const week=(day:string):MenuWeek=>{if(!weeks.has(day))weeks.set(day,{revision:0,entries:[]});return weeks.get(day)!;};

 const shopping=new Map<string,ShoppingItem[]>();
 function reconcile(day:string) {
  const required=new Set<string>();
  for(const entry of week(day).entries)for(const line of lines.filter(l=>l.recipe_id===entry.recipe_id))required.add(entry.choices.find(c=>c.ingredient_id===line.ingredient_id)?.alternative_id||line.ingredient_id);
  const items=(shopping.get(day)||[]).filter(i=>i.manual||required.has(i.ingredient_id));
  for(const item of items)item.from_menu=required.has(item.ingredient_id);
  for(const id of required)if(!items.some(i=>i.ingredient_id===id))items.push({id:crypto.randomUUID(),ingredient_id:id,name:ingredients.find(i=>i.id===id)!.name,from_menu:true,manual:false,purchased:false});
  items.sort((a,b)=>a.name.localeCompare(b.name,'es'));shopping.set(day,items);return items;
 }
 return {preferences,house,members,files,userNotifiers:new Set<()=>void>(),ingredients,recipes,lines,alternatives,weeks,week,shopping,reconcile,notifiers:new Set<()=>void>(),revision:0};
}

// Auth y HTTP simulados; sin credenciales ni acceso a Supabase remoto.
export async function setupApp(page:Page,state=createFixtureState(),userId='00000000-0000-0000-0000-000000000001') {
 const houseId='00000000-0000-0000-0000-000000000010';
 const expires=Math.floor(Date.now()/1000)+3600;
 const user={id:userId,aud:'authenticated',role:'authenticated',email:'test@example.com',created_at:'2026-01-01',user_metadata:{full_name:'Alex'}};
 const session={access_token:`e30.${Buffer.from(JSON.stringify({sub:userId,exp:expires})).toString('base64url')}.test`,refresh_token:'test-refresh',expires_at:expires,expires_in:3600,token_type:'bearer',user};
 await page.addInitScript(data=>localStorage.setItem('sb-fixture-auth-token',JSON.stringify(data)),session);
 const {ingredients,recipes,lines,alternatives,week,shopping,reconcile}=state;
 await page.routeWebSocket('wss://fixture.supabase.co/realtime/v1/**',ws=>{
  let notifyHouse:(()=>void)|undefined,notifyUser:(()=>void)|undefined;
  ws.onMessage(raw=>{
   const [join,ref,topic,event,payload]=JSON.parse(typeof raw==='string'?raw:raw.toString());
   if(event==='phx_join'){
    const filters=payload.config.postgres_changes.map((f:Record<string,unknown>,i:number)=>({...f,id:i+1}));
    ws.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:filters}}]));
    const send=(table:string,filter:string,record:Record<string,unknown>)=>{
     const ids=filters.filter((f:Record<string,unknown>)=>f.event==='UPDATE'&&f.table===table&&f.filter===filter).map((f:Record<string,unknown>)=>f.id);
     if(ids.length)ws.send(JSON.stringify([join,null,topic,'postgres_changes',{ids,data:{schema:'public',table,type:'UPDATE',commit_timestamp:new Date().toISOString(),columns:Object.keys(record).map(name=>({name,type:name==='revision'?'int8':'uuid'})),record,old_record:{},errors:[]}}]));
    };
    notifyHouse=()=>{if(state.members.some(m=>m.user_id===userId)&&!state.house.deleted&&!state.house.deletion_requested_at)send('household_changes',`household_id=eq.${houseId}`,{household_id:houseId,revision:state.revision});};
    notifyUser=()=>send('user_household_changes',`user_id=eq.${userId}`,{user_id:userId,revision:state.revision});
    state.notifiers.add(notifyHouse);state.userNotifiers.add(notifyUser);
   }else if(event==='heartbeat'||event==='phx_leave'){
    ws.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:{}}]));
    if(event==='phx_leave'){if(notifyHouse)state.notifiers.delete(notifyHouse);if(notifyUser)state.userNotifiers.delete(notifyUser);}
   }
  });
  ws.onClose(()=>{if(notifyHouse)state.notifiers.delete(notifyHouse);if(notifyUser)state.userNotifiers.delete(notifyUser);});
 });
 await page.route('https://fixture.supabase.co/**' ,async route=>{
  const url=new URL(route.request().url());
  const name=url.pathname.split('/').pop();
  if(url.pathname.startsWith('/storage/v1/object/sign/recipe-photos/') && route.request().method()==='GET') {
   await route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});return;
  }
  let body:unknown=[];
  if(url.pathname==='/storage/v1/object/list/recipe-photos'){
   const data=route.request().postDataJSON();const found=new Map<string,{id:string|null;name:string}>();
   for(const path of state.files)if(path.startsWith(data.prefix+'/')){
    const rest=path.slice(data.prefix.length+1).split('/');found.set(rest[0],{id:rest.length>1?null:path,name:rest[0]});
   }
   body=[...found.values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(data.offset||0,(data.offset||0)+(data.limit||100));
  }else if(url.pathname==='/storage/v1/object/recipe-photos'&&route.request().method()==='DELETE'){
   for(const path of route.request().postDataJSON().prefixes)state.files.delete(path);body=[];
  }else if(url.pathname==='/storage/v1/object/sign/recipe-photos') {
   body=route.request().postDataJSON().paths.map((path:string)=>({path,signedURL:'/object/sign/recipe-photos/'+path+'?token=test',error:null}));
  }else if(url.pathname.startsWith('/storage/v1/object/recipe-photos/')) {
   state.files.add(url.pathname.split('/recipe-photos/')[1]);
   body={Key:'recipe-photos/'+url.pathname.split('/recipe-photos/')[1]};
  }else if(url.pathname==='/auth/v1/user')body=user;
  else if(name==='user_preferences'){
   if(route.request().method()==='POST'){
    const data=route.request().postDataJSON();
    if(data.user_id!==userId){await route.fulfill({status:403,json:{message:'Forbidden'}});return;}
    const value={theme:data.theme,mode:data.mode,avatar:data.avatar};state.preferences.set(userId,value);body=value;
   }else{
    const value=state.preferences.get(userId);body=value?[value]:[];
   }
  }
  else if(name==='households')body=state.members.some(m=>m.user_id===userId)&&!state.house.deleted&&(!state.house.deletion_requested_at||state.house.owner_id===userId)?[state.house]:[];
  else if(name==='get_household_members')body=state.members.map(m=>({...m,is_owner:m.user_id===state.house.owner_id}));
  else if(name==='remove_household_member'||name==='transfer_household'||name==='leave_household'){
   const data=route.request().postDataJSON()||{};
   if(name==='leave_household')state.members.splice(state.members.findIndex(m=>m.user_id===userId),1);
   else if(name==='remove_household_member')state.members.splice(state.members.findIndex(m=>m.user_id===data.p_user),1);
   else state.house.owner_id=data.p_user;
   body=null;
  }else if(name==='begin_household_deletion'){
   state.house.deletion_requested_at ||= new Date().toISOString();
   state.members.splice(0,state.members.length,...state.members.filter(m=>m.user_id===state.house.owner_id));body=null;
  }else if(name==='finish_household_deletion'){
   if(state.files.size){await route.fulfill({status:400,json:{message:'Faltan fotos'}});return;}
   state.house.deleted=true;state.members.length=0;recipes.length=0;ingredients.length=0;lines.length=0;alternatives.length=0;state.weeks.clear();shopping.clear();body=null;
  }
  else if(name==='recipes')body=recipes;
  else if(name==='ingredients')body=ingredients;
  else if(name==='recipe_ingredients')body=lines;
  else if(name==='recipe_alternatives')body=alternatives;
  else if(name==='get_shopping_week')body=reconcile(route.request().postDataJSON().p_week);
  else if(name==='set_shopping_purchased'){
   const data=route.request().postDataJSON();let found=false;
   for(const [day,items] of shopping){const item=items.find(i=>i.id===data.p_item);if(item){item.purchased=data.p_purchased;body=reconcile(day);found=true;break;}}
   if(!found){await route.fulfill({status:409,json:{message:'Producto no disponible'}});return;}
  }else if(name==='set_manual_shopping'){
   const data=route.request().postDataJSON();const items=reconcile(data.p_week);const item=items.find(i=>i.ingredient_id===data.p_ingredient);
   if(data.p_present){if(item)item.manual=true;else items.push({id:crypto.randomUUID(),ingredient_id:data.p_ingredient,name:ingredients.find(i=>i.id===data.p_ingredient)!.name,manual:true,from_menu:false,purchased:false});}
   else if(item)item.manual=false;
   body=reconcile(data.p_week);
  }
  else if(name==='get_menu_week')body=week(route.request().postDataJSON().p_week);
  else if(name==='change_menu_week'){
   const data=route.request().postDataJSON();const menu=week(data.p_week);
   if(data.p_revision!==menu.revision){await route.fulfill({status:409,json:{message:'El menú ha cambiado'}});return;}
   if(data.p_action==='add')menu.entries.push({id:crypto.randomUUID(),planned_day:data.p_day,meal:data.p_meal,recipe_id:data.p_recipe,choices:[],choices_reset:false});
   else {
    const entry=menu.entries.find(e=>e.id===data.p_entry)!;
    if(data.p_action==='remove')menu.entries=menu.entries.filter(e=>e.id!==data.p_entry);
    if(data.p_action==='replace'){entry.recipe_id=data.p_recipe;entry.choices=[];entry.choices_reset=false;}
    if(data.p_action==='choices'){entry.choices=data.p_choices;entry.choices_reset=false;}
    if(data.p_action==='ack')entry.choices_reset=false;
   }
   menu.revision++;body=menu;
  }else if(name==='copy_menu_week'){
   const data=route.request().postDataJSON();const menu=week(data.p_target);const original=week(data.p_source);
   if(data.p_revision!==menu.revision||(!data.p_overwrite&&menu.entries.length)||!original.entries.length){await route.fulfill({status:409,json:{message:'No se puede copiar'}});return;}
   menu.entries=structuredClone(original.entries).map(e=>{
    const offset=Math.round((Date.parse(e.planned_day)-Date.parse(data.p_source))/86400000);
    const day=new Date(data.p_target+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+offset);
    return {...e,id:crypto.randomUUID(),planned_day:day.toISOString().slice(0,10)};
   });menu.revision++;body=menu;
  }else if(name==='create_ingredient'){
   const data=route.request().postDataJSON();
   const existing=ingredients.find(i=>i.name.toLowerCase()===data.p_name.toLowerCase());
   const ingredient=existing||{id:crypto.randomUUID(),name:data.p_name,kcal_per_100g:data.p_kcal};
   if(!existing)ingredients.push(ingredient);
   body=ingredient;
  }else if(name==='save_recipe'){
   const data=route.request().postDataJSON();
   if(data.p_id&&recipes.find(r=>r.id===data.p_id)?.revision!==data.p_revision){await route.fulfill({status:409,json:{message:'El plato ha cambiado'}});return;}
   if(data.p_id&&recipes.find(r=>r.id===data.p_id)?.revision!==data.p_revision){await route.fulfill({status:409,json:{message:'El plato ha cambiado'}});return;}
   const recipe={id:data.p_id||crypto.randomUUID(),name:data.p_name,description:data.p_description,instructions:data.p_instructions,categories:data.p_categories,photo_path:data.p_photo_path,revision:(data.p_revision||0)+1,archived:false};
   const index=recipes.findIndex(r=>r.id===recipe.id);
   if(index>=0)recipes.splice(index,1,recipe);else recipes.push(recipe);
   for(let i=lines.length-1;i>=0;i--)if(lines[i].recipe_id===recipe.id)lines.splice(i,1);
   data.p_lines.forEach((l:{id:string;ingredient_id:string;alternatives:string[]},position:number)=>{
    lines.push({id:l.id,recipe_id:recipe.id,ingredient_id:l.ingredient_id,position});
    for(let i=alternatives.length-1;i>=0;i--)if(alternatives[i].line_id===l.id)alternatives.splice(i,1);
    l.alternatives.forEach(id=>alternatives.push({line_id:l.id,ingredient_id:id}));
   });
   body=[recipe];
  }else if(name==='set_recipe_archived'){
   const data=route.request().postDataJSON();
   const recipe=recipes.find(r=>r.id===data.p_id)!;recipe.archived=data.p_archived;recipe.revision++;
   body=null;
  }
  const mutation=['create_ingredient','save_recipe','set_recipe_archived','change_menu_week','copy_menu_week','set_shopping_purchased','set_manual_shopping','remove_household_member','transfer_household','leave_household','begin_household_deletion','finish_household_deletion'].includes(name||'');
  if(mutation)for(const day of new Set([...state.weeks.keys(),...shopping.keys()]))reconcile(day);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  if(mutation){state.revision++;for(const notify of state.notifiers)notify();if(['remove_household_member','transfer_household','leave_household','begin_household_deletion','finish_household_deletion'].includes(name||''))for(const notify of state.userNotifiers)notify();}
 });
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Carta',exact:true})).toBeVisible();
 await expect(page.getByRole('status',{name:'Sincronización activa'})).toBeVisible();
 return state;
}
