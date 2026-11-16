// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
let db:PGlite;
let membership:string;
const uid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const user=async(n:number)=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid(n)}';`);
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public,storage to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
 for(let n=1;n<=20;n++)await db.query('insert into auth.users values($1,$2::jsonb,$3)',[uid(n),JSON.stringify({full_name:'Persona '+n}),`person${n}@example.com`]);
 for(const name of ['202611140001_households.sql','202611150001_recipes.sql','202611150002_weekly_menu.sql','202611160001_shopping_realtime.sql','202611160002_household_management.sql','202611160003_profile_preferences.sql','202611160004_offline_shopping.sql'])await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
},30000);
afterAll(async()=>{await db?.close();});

let house:string,item:string,ingredient:string;
const week='2026-11-16';
const mark=async(operation:number,purchased:boolean,product=item,h=house,w=week)=>(await db.query<{value:string}>('select public.apply_shopping_mark($1,$2,$3,$4,$5,$6) as value',[uid(operation),h,membership,w,product,purchased])).rows[0].value;
const bought=async()=>(await db.query<{purchased:boolean}>('select purchased from public.shopping_items where id=$1',[item])).rows[0].purchased;
it('aplica una marca una sola vez aunque se reintente tras otra escritura aceptada',async()=>{
 await user(1);house=(await db.query<{id:string}>("select public.create_household('Casa') as id")).rows[0].id;
 membership=(await db.query<{membership_id:string}>('select membership_id from public.household_members where user_id=auth.uid()')).rows[0].membership_id;
 ingredient=(await db.query<{id:string}>("select * from public.create_ingredient('Arroz')")).rows[0].id;
 item=(await db.query<{value:{id:string}[]}>("select public.set_manual_shopping($1,$2,true) as value",[week,ingredient])).rows[0].value[0].id;
 expect(await mark(101,true)).toBe('applied');expect(await bought()).toBe(true);
 expect(await mark(102,false)).toBe('applied');expect(await bought()).toBe(false);
 expect(await mark(101,true)).toBe('applied');expect(await bought()).toBe(false);
 await expect(mark(101,false)).rejects.toThrow('reutilizado');
});
it('rechaza reutilizar identificadores, semanas inválidas y acceso directo a recibos',async()=>{
 await expect(mark(101,true,item,house,'2026-11-23')).rejects.toThrow('reutilizado');
 await expect(mark(103,true,item,house,'2026-11-17')).rejects.toThrow('inválida');
 await expect(db.query('select * from public.shopping_mark_receipts')).rejects.toThrow();
 await expect(db.query('delete from public.shopping_mark_receipts')).rejects.toThrow();
});
it('una generación borrada no marca el producto reintroducido',async()=>{
 await db.query('select public.set_manual_shopping($1,$2,false)',[week,ingredient]);
 const fresh=(await db.query<{value:{id:string;purchased:boolean}[]}>('select public.set_manual_shopping($1,$2,true) as value',[week,ingredient])).rows[0].value[0];
 expect(fresh.id).not.toBe(item);expect(await mark(104,true)).toBe('stale');expect(await mark(104,true)).toBe('stale');
 expect((await db.query<{purchased:boolean}>('select purchased from public.shopping_items where id=$1',[fresh.id])).rows[0].purchased).toBe(false);
 item=fresh.id;
});
it('aísla casas, exige pertenencia actual y deniega acceso anónimo',async()=>{
 const token=(await db.query<{token:string}>('select public.create_household_invitation() as token')).rows[0].token;
 await user(2);await db.query('select public.accept_household_invitation($1)',[token]);membership=(await db.query<{membership_id:string}>('select membership_id from public.household_members where user_id=auth.uid()')).rows[0].membership_id;expect(await mark(105,true)).toBe('applied');
 await user(1);await db.query('select public.remove_household_member($1)',[uid(2)]);
 await user(2);await expect(mark(106,false)).rejects.toThrow();await db.query("select public.create_household('Otra')");
 await expect(mark(106,false)).rejects.toThrow('Casa no disponible');
 await user(1);expect(await bought()).toBe(true);
 await db.exec('reset role;set role anon;');await expect(mark(107,false)).rejects.toThrow();
});
it('rechaza marcas de una pertenencia anterior aunque el usuario vuelva a la misma casa',async()=>{
 await user(1);let token=(await db.query<{token:string}>('select public.create_household_invitation() as token')).rows[0].token;
 await user(3);await db.query('select public.accept_household_invitation($1)',[token]);
 membership=(await db.query<{membership_id:string}>('select membership_id from public.household_members where user_id=auth.uid()')).rows[0].membership_id;
 const old=membership;await user(1);await db.query('select public.remove_household_member($1)',[uid(3)]);
 token=(await db.query<{token:string}>('select public.create_household_invitation() as token')).rows[0].token;
 await user(3);await db.query('select public.accept_household_invitation($1)',[token]);
 await expect(mark(108,false)).rejects.toThrow('Pertenencia caducada');
 membership=(await db.query<{membership_id:string}>('select membership_id from public.household_members where user_id=auth.uid()')).rows[0].membership_id;
 expect(membership).not.toBe(old);expect(await mark(109,false)).toBe('applied');
});
