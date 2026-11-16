// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { MenuWeek, MenuChange } from './menu';
let db:PGlite;
let chicken:string,tofu:string,foreign:string,dish:string,otherDish:string;
const uid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const user=async(n:number)=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid(n)}';`);
const get=async(week:string)=>(await db.query<{data:MenuWeek}>('select public.get_menu_week($1) as data',[week])).rows[0].data;
async function change(week:string,revision:number,change:Omit<MenuChange,'meal'>&{meal?:string}) {
 return (await db.query<{data:MenuWeek}>('select public.change_menu_week($1,$2,$3,$4,$5,$6,$7,$8::jsonb) as data',[week,revision,change.action,change.entry||null,change.day||null,change.meal||null,change.recipe||null,JSON.stringify(change.choices||[])])).rows[0].data;
}
async function copy(source:string,target:string,revision:number,overwrite=false) {
 return (await db.query<{data:MenuWeek}>('select public.copy_menu_week($1,$2,$3,$4) as data',[source,target,revision,overwrite])).rows[0].data;
}
const ingredient=async(name:string)=>(await db.query<{id:string}>('select * from public.create_ingredient($1)',[name])).rows[0].id;
async function save(id:string|null=null,revision:number|null=null,alternatives:string[]=[tofu]) {
 return (await db.query<{id:string;revision:number}>(`select * from public.save_recipe($1,$2,'Plato','','Cocinar',array['lunch'],null,$3::jsonb)`,[id,revision,JSON.stringify([{ingredient_id:chicken,alternatives}])])).rows[0];
}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth,storage to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 insert into auth.users values('${uid(1)}'),('${uid(2)}'),('${uid(3)}');`);
 for(const file of ['202611140001_households.sql','202611150001_recipes.sql','202611150002_weekly_menu.sql','202611160001_shopping_realtime.sql'])await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 await user(2);await db.query(`select public.create_household('B')`);foreign=await ingredient('Privado');
 await user(1);await db.query(`select public.create_household('A')`);chicken=await ingredient('Pollo');tofu=await ingredient('Tofu');
 dish=(await save()).id;otherDish=(await save()).id;
},30000);
afterAll(async()=>{await db?.close();});
// Historical contract before the recipe-tags migration; the new migration has its own tests.
it('añade repeticiones en tres turnos, sustituye y quita individualmente con control de revisión',async()=>{
 await user(1);const week='2026-12-28';
 expect(await get(week)).toEqual({revision:0,entries:[]});
 let data=await change(week,0,{action:'add',day:week,meal:'breakfast',recipe:dish});
 data=await change(week,data.revision,{action:'add',day:week,meal:'lunch',recipe:dish});
 data=await change(week,data.revision,{action:'add',day:'2027-01-03',meal:'dinner',recipe:dish});
 expect(data.entries.map(e=>e.meal)).toEqual(['breakfast','lunch','dinner']);
 await expect(change(week,0,{action:'remove',entry:data.entries[0].id})).rejects.toThrow('ha cambiado');
 await expect(change(week,data.revision,{action:'add',day:'2027-01-04',meal:'lunch',recipe:dish})).rejects.toThrow();
 await expect(get('2026-12-29')).rejects.toThrow('lunes');
 const first=data.entries[0];
 data=await change(week,data.revision,{action:'replace',entry:first.id,recipe:otherDish});
 expect(data.entries[0]).toMatchObject({id:first.id,planned_day:first.planned_day,meal:'breakfast',recipe_id:otherDish});
 data=await change(week,data.revision,{action:'remove',entry:data.entries[1].id});
 expect(data.entries).toHaveLength(2);
});
it('aísla semanas, referencias y escrituras entre casas y usuarios sin casa',async()=>{
 await user(1);const week='2027-02-01';
 const data=await change(week,0,{action:'add',day:week,meal:'lunch',recipe:dish});
 await user(2);
 expect(await get(week)).toEqual({revision:0,entries:[]});
 expect((await db.query('select * from public.menu_entries')).rows).toHaveLength(0);
 await expect(change(week,0,{action:'remove',entry:data.entries[0].id})).rejects.toThrow('no disponible');
 await expect(change(week,0,{action:'add',day:week,meal:'lunch',recipe:dish})).rejects.toThrow('no disponible');
 await expect(db.query('update public.menu_weeks set revision=5')).rejects.toThrow();
 await user(3);await expect(get(week)).rejects.toThrow('Casa requerida');
 await db.exec('reset role;set role anon;');await expect(get(week)).rejects.toThrow();
 await expect(db.query('select public.menu_house_lock()')).rejects.toThrow();
 await expect(save()).rejects.toThrow();
});
it('guarda alternativas por aparición y repara las que desaparecen al editar la receta',async()=>{
 await user(1);const week='2027-03-01';
 let data=await change(week,0,{action:'add',day:week,meal:'lunch',recipe:dish});
 data=await change(week,data.revision,{action:'add',day:week,meal:'dinner',recipe:dish});
 const entry=data.entries[0];
 data=await change(week,data.revision,{action:'choices',entry:entry.id,choices:[{ingredient_id:chicken,alternative_id:tofu}]});
 expect(data.entries[0].choices).toHaveLength(1);expect(data.entries[1].choices).toHaveLength(0);
 await expect(change(week,data.revision,{action:'choices',entry:entry.id,choices:[{ingredient_id:chicken,alternative_id:foreign}]})).rejects.toThrow('Alternativa');
 expect((await get(week)).entries[0].choices).toHaveLength(1);
 const edited=await save(dish,1);
 data=await get(week);expect(data.entries[0].choices).toHaveLength(1);
 await save(dish,edited.revision,[]);
 data=await get(week);
 expect(data.entries[0]).toMatchObject({choices:[],choices_reset:true});
 expect(data.entries[1].choices_reset).toBe(false);
 await expect(change(week,data.revision,{action:'choices',entry:entry.id,choices:[{ingredient_id:chicken,alternative_id:tofu}]})).rejects.toThrow();
 data=await change(week,data.revision,{action:'ack',entry:entry.id});
 expect(data.entries[0].choices_reset).toBe(false);
 await expect(db.query(`select public.save_recipe_content(null,null,'x','','y',array['lunch'],null,'[]'::jsonb)`)).rejects.toThrow();
});
it('copia de forma independiente, exige confirmación y conserva referencias archivadas',async()=>{
 await user(1);const source='2027-04-05',target='2027-04-12';
 let data=await change(source,0,{action:'add',day:'2027-04-11',meal:'dinner',recipe:otherDish});
 data=await change(source,data.revision,{action:'choices',entry:data.entries[0].id,choices:[{ingredient_id:chicken,alternative_id:tofu}]});
 const original=data.entries[0];
 await db.query('select public.set_recipe_archived($1,1,true)',[otherDish]);
 await expect(change(source,data.revision,{action:'add',day:source,meal:'lunch',recipe:otherDish})).rejects.toThrow();
 const copied=await copy(source,target,0);
 expect(copied.entries[0]).toMatchObject({planned_day:'2027-04-18',meal:'dinner',recipe_id:otherDish,choices:original.choices});
 expect(copied.entries[0].id).not.toBe(original.id);
 await expect(copy(source,target,copied.revision)).rejects.toThrow('Confirma');
 expect((await get(target)).revision).toBe(copied.revision);
 await expect(copy(source,target,0,true)).rejects.toThrow('ha cambiado');
 const overwritten=await copy(source,target,copied.revision,true);
 await change(target,overwritten.revision,{action:'choices',entry:overwritten.entries[0].id,choices:[]});
 expect((await get(source)).entries[0].choices).toEqual(original.choices);
 await expect(copy(source,source,data.revision,true)).rejects.toThrow('inválidas');
 await expect(copy('2028-01-03',target,0)).rejects.toThrow('vacía');
});
