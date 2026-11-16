// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { MenuWeek } from './menu';
import type { ShoppingItem } from './shopping';
let db:PGlite,house:string,coffee:string,milk:string,bread:string,rice:string,dish:string,breakfast:string,oldProduct:string,oldRevision:number,menuRevision:number;
const week='2026-11-16',uid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const user=async(n:number)=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid(n)}';`);
const ingredients=(ids:string[])=>ids.map(ingredient_id=>({ingredient_id,alternatives:[]}));
const list=async()=>(await db.query<{data:ShoppingItem[]}>('select public.get_shopping_week($1) as data',[week])).rows[0].data;
const menu=async()=>(await db.query<{data:MenuWeek}>('select public.get_menu_week($1) as data',[week])).rows[0].data;
async function save(tags:unknown,id:string|null=null,revision:number|null=null,lines:unknown=ingredients([rice,bread])){
 return (await db.query<{id:string;tags:string[];revision:number}>(`select * from public.save_recipe($1,$2,'Plato','','Cocinar',$3::text[],null,$4::jsonb)`,[id,revision,tags,JSON.stringify(lines)])).rows[0];
}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public,storage to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 insert into auth.users values('${uid(1)}','{}','a@example.com'),('${uid(2)}','{}','b@example.com'),('${uid(3)}','{}','c@example.com');`);
 for(const file of ['202611140001_households.sql','202611150001_recipes.sql','202611150002_weekly_menu.sql','202611160001_shopping_realtime.sql','202611160002_household_management.sql','202611160003_profile_preferences.sql','202611160004_offline_shopping.sql'])await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 await user(2);await db.query("select public.create_household('Otra')");
 await user(1);house=(await db.query<{id:string}>("select public.create_household('Casa') as id")).rows[0].id;
 const ids:string[]=[];for(const name of ['Café','Leche','Pan','Arroz'])ids.push((await db.query<{id:string}>('select * from public.create_ingredient($1)',[name])).rows[0].id);
 [coffee,milk,bread,rice]=ids;
 breakfast=(await save(['breakfast'],null,null,ingredients([coffee,milk,bread]))).id;
 const main=await save(['lunch','dinner']);dish=main.id;oldRevision=main.revision;
 let current=await menu();
 for(const [meal,recipe] of [['breakfast',breakfast],['lunch',dish],['dinner',dish]]){await db.query('select public.change_menu_week($1,$2,\'add\',null,$1,$3,$4)',[week,current.revision,meal,recipe]);current=await menu();}
 menuRevision=current.revision;
 await db.query('select public.set_manual_shopping($1,$2,true)',[week,milk]);
 for(const item of await list()){await db.query('select public.set_shopping_purchased($1,true)',[item.id]);if(item.ingredient_id===coffee)oldProduct=item.id;}
 await db.exec('reset role;');await db.exec(readFileSync('supabase/migrations/202611160005_recipe_tags.sql','utf8'));await user(1);
},30000);
afterAll(async()=>{await db?.close();});
it('conserva recetas, elimina desayunos y recalcula la compra sin perder aportaciones manuales ni marcas vigentes',async()=>{
 const recipes=(await db.query<{id:string;tags:string[];revision:number}>('select id,tags,revision from public.recipes')).rows;
 expect(recipes).toHaveLength(2);expect(recipes.every(recipe=>recipe.tags.length===0)).toBe(true);
 expect(recipes.find(recipe=>recipe.id===dish)?.revision).toBe(oldRevision+1);expect(recipes.some(recipe=>recipe.id===breakfast)).toBe(true);
 const current=await menu();expect(current.revision).toBe(menuRevision+1);expect(current.entries.map(entry=>entry.meal)).toEqual(['lunch','dinner']);
 const shopping=await list();expect(shopping.some(item=>item.ingredient_id===coffee)).toBe(false);expect(shopping.every(item=>item.purchased)).toBe(true);
 expect(shopping.find(item=>item.ingredient_id===milk)).toMatchObject({manual:true,from_menu:false});
 expect(shopping.find(item=>item.ingredient_id===bread)).toMatchObject({from_menu:true});
 const membership=(await db.query<{membership_id:string}>('select membership_id from public.household_members')).rows[0].membership_id;
 expect((await db.query<{result:string}>('select public.apply_shopping_mark($1,$2,$3,$4,$5,false) as result',[uid(101),house,membership,week,oldProduct])).rows[0].result).toBe('stale');
 await expect(save([],dish,oldRevision)).rejects.toThrow('ha cambiado');
});
it('normaliza y deduplica etiquetas libres, admite recetas sin etiquetas y protege los límites',async()=>{
 const saved=await save(['  Rápido   y fácil ','VEGANO','vegano','Rápido y fácil']);expect(saved.tags).toEqual(['Rápido y fácil','VEGANO']);
 expect((await save([])).tags).toEqual([]);
 for(const tags of [null,[''],['x'.repeat(41)],Array.from({length:21},(_,n)=>String(n)),[null],[['a'],['b']]])await expect(save(tags)).rejects.toThrow();
 await db.exec('reset role;');
 for(const tags of [[' repetida '],['A','a'],[''],Array.from({length:21},(_,n)=>String(n))])await expect(db.query('update public.recipes set tags=$1 where id=$2',[tags,saved.id])).rejects.toThrow();
 await user(1);
});
it('rechaza nuevos desayunos en el servidor y copia únicamente comidas y cenas',async()=>{
 const before=await menu();await expect(db.query('select public.change_menu_week($1,$2,\'add\',null,$1,\'breakfast\',$3)',[week,before.revision,dish])).rejects.toThrow();expect((await menu()).revision).toBe(before.revision);
 const copied=(await db.query<{data:MenuWeek}>('select public.copy_menu_week($1,$2,0,false) as data',[week,'2026-11-23'])).rows[0].data;expect(copied.entries.map(entry=>entry.meal)).toEqual(['lunch','dinner']);
});
it('mantiene alternativas por aparición, revisiones y compra al editar una receta con etiquetas',async()=>{
 let saved=await save(['Vegetariano'],null,null,[{ingredient_id:bread,alternatives:[milk]}]);
 let current=await menu();await db.query('select public.change_menu_week($1,$2,\'add\',null,$1,\'lunch\',$3)',[week,current.revision,saved.id]);current=await menu();const entry=current.entries.find(entry=>entry.recipe_id===saved.id)!;
 await db.query('select public.change_menu_week($1,$2,\'choices\',$3,null,null,null,$4::jsonb)',[week,current.revision,entry.id,JSON.stringify([{ingredient_id:bread,alternative_id:milk}])]);
 saved=await save(['Rápido'],saved.id,saved.revision,[{ingredient_id:rice,alternatives:[]}]);current=await menu();
 expect(current.entries.find(value=>value.id===entry.id)).toMatchObject({choices:[],choices_reset:true});expect((await list()).some(item=>item.ingredient_id===rice&&item.from_menu)).toBe(true);
});
it('mantiene aislamiento por casa y rechaza escritura directa, anónimos y los antiguos auxiliares',async()=>{
 await user(2);expect((await db.query('select * from public.recipes')).rows).toHaveLength(0);await expect(save(['Ajeno'],dish,oldRevision+1)).rejects.toThrow();await expect(save(['Ajeno'])).rejects.toThrow();
 await expect(db.query('update public.recipes set tags=array[\'invasión\']')).rejects.toThrow();
 await expect(db.query('select public.valid_recipe_tags(array[\'a\'])')).rejects.toThrow();
 await expect(db.query('select public.save_recipe_content(null,null,\'x\',\'\',\'x\',array[\'lunch\'],null,\'[]\')')).rejects.toThrow();
 await user(3);await expect(save([])).rejects.toThrow('Casa requerida');
 await db.exec('reset role;set role anon;');await expect(save([])).rejects.toThrow();
});
it('al editar una receta sigue reparando alternativas y reconciliando la compra de sus menús',async()=>{
 await user(1);
 const created=await save(['Vegetariano'],null,null,[{ingredient_id:rice,alternatives:[milk]},{ingredient_id:bread,alternatives:[]}]);
 const current=await menu();await db.query("select public.change_menu_week($1,$2,'add',null,$1,'dinner',$3)",[week,current.revision,created.id]);
 const planned=await menu(),entry=planned.entries.find(value=>value.recipe_id===created.id)!;
 await db.query("select public.change_menu_week($1,$2,'choices',$3,null,null,null,$4::jsonb)",[week,planned.revision,entry.id,JSON.stringify([{ingredient_id:rice,alternative_id:milk}])]);
 await save(['Modificada'],created.id,created.revision);
 const repaired=(await menu()).entries.find(value=>value.id===entry.id)!;expect(repaired.choices_reset).toBe(true);expect(repaired.choices).toEqual([]);
 expect((await list()).find(item=>item.ingredient_id===milk)).toMatchObject({manual:true,from_menu:false,purchased:true});
});
