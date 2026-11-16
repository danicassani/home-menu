// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
let db:PGlite;
const uid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const user=async(n:number)=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid(n)}';`);
async function createHouse(owner:number,members:number[]=[]) {
 await user(owner);const h=(await db.query<{id:string}>('select public.create_household($1) as id',['Casa '+owner])).rows[0].id;
 for(const member of members){await user(owner);const token=(await db.query<{token:string}>('select public.create_household_invitation() as token')).rows[0].token;await user(member);await db.query('select public.accept_household_invitation($1)',[token]);}
 await user(owner);return h;
}
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
 for(const name of ['202611140001_households.sql','202611150001_recipes.sql','202611150002_weekly_menu.sql','202611160001_shopping_realtime.sql','202611160002_household_management.sql'])await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
it('lista únicamente los miembros de la casa y exige propietario para administrar',async()=>{
 const h=await createHouse(1,[2,3]);
 const members=await db.query<{user_id:string;display_name:string;is_owner:boolean}>('select * from public.get_household_members()');
 expect(members.rows).toHaveLength(3);expect(members.rows[0]).toMatchObject({user_id:uid(1),display_name:'Persona 1',is_owner:true});
 await expect(db.query('select public.leave_household()')).rejects.toThrow('Transfiere');
 await expect(db.query('select public.transfer_household($1)',[uid(4)])).rejects.toThrow();
 await expect(db.query('select public.remove_household_member($1)',[uid(1)])).rejects.toThrow();
 await user(2);expect((await db.query('select * from public.get_household_members()')).rows).toHaveLength(3);
 await expect(db.query('select public.remove_household_member($1)',[uid(3)])).rejects.toThrow('propietario');
 await expect(db.query('select public.transfer_household($1)',[uid(3)])).rejects.toThrow('propietario');
 await expect(db.query('select public.begin_household_deletion($1,$2)',[h,'Casa 1'])).rejects.toThrow('no disponible');
 await expect(db.query('delete from public.household_members')).rejects.toThrow();
 await user(4);await expect(db.query('select * from public.get_household_members()')).rejects.toThrow('Casa requerida');
});
it('expulsa, revoca enlaces y notifica al usuario que acaba de perder acceso',async()=>{
 const h=await createHouse(5,[6]);
 const token=(await db.query<{token:string}>('select public.create_household_invitation() as token')).rows[0].token;
 await db.query(`insert into storage.objects(bucket_id,name) values('recipe-photos',$1)`,[h+'/photo.jpg']);
 await user(6);const before=Number((await db.query<{revision:string}>('select revision from public.user_household_changes')).rows[0].revision);
 await user(5);await db.query('select public.remove_household_member($1)',[uid(6)]);
 await user(6);expect((await db.query('select * from public.households')).rows).toHaveLength(0);
 expect((await db.query('select * from storage.objects')).rows).toHaveLength(0);
 expect((await db.query('select * from public.household_changes')).rows).toHaveLength(0);
 const signals=await db.query<{user_id:string;revision:string}>('select * from public.user_household_changes');
 expect(signals.rows).toHaveLength(1);expect(signals.rows[0].user_id).toBe(uid(6));expect(Number(signals.rows[0].revision)).toBeGreaterThan(before);
 expect(Object.keys(signals.rows[0]).sort()).toEqual(['revision','user_id']);
 await expect(db.query('select public.accept_household_invitation($1)',[token])).rejects.toThrow('revocada');
 await db.query(`select public.create_household('Nueva casa')`);
});
it('transfiere la propiedad sin expulsar al anterior propietario y permite que salga después',async()=>{
 const h=await createHouse(7,[8]);
 const token=(await db.query<{token:string}>('select public.create_household_invitation() as token')).rows[0].token;
 await db.query('select public.transfer_household($1)',[uid(8)]);
 const members=await db.query<{user_id:string;is_owner:boolean}>('select * from public.get_household_members()');
 expect(members.rows.find(m=>m.user_id===uid(7))?.is_owner).toBe(false);
 expect(members.rows.find(m=>m.user_id===uid(8))?.is_owner).toBe(true);
 await expect(db.query('select public.remove_household_member($1)',[uid(8)])).rejects.toThrow();
 await db.query('select public.leave_household()');
 await user(8);expect((await db.query<{owner_id:string}>('select owner_id from public.households')).rows).toEqual([{owner_id:uid(8)}]);
 await expect(db.query('select public.leave_household()')).rejects.toThrow();
 await user(9);await expect(db.query('select public.accept_household_invitation($1)',[token])).rejects.toThrow('revocada');
 await expect(db.query('select public.finish_household_deletion($1)',[h])).rejects.toThrow();
});
it('salir elimina solo la pertenencia y conserva la casa del resto de miembros',async()=>{
 const h=await createHouse(10,[11]);await user(11);await db.query('select public.leave_household()');
 expect((await db.query('select * from public.households')).rows).toHaveLength(0);
 await db.query(`select public.create_household('Otra casa')`);
 await user(10);expect((await db.query<{id:string}>('select id from public.households')).rows).toEqual([{id:h}]);
 expect((await db.query('select * from public.get_household_members()')).rows).toHaveLength(1);
});
it('bloquea escrituras, permite reanudar el borrado de fotos y elimina datos sin borrar cuentas ni otras casas',async()=>{
 const other=await createHouse(15);await db.query(`insert into storage.objects(bucket_id,name) values('recipe-photos',$1)`,[other+'/keep.jpg']);
 const h=await createHouse(13,[14]);
 const ingredient=(await db.query<{id:string}>(`select * from public.create_ingredient('Arroz')`)).rows[0].id;
 const recipe=(await db.query<{id:string}>(`select * from public.save_recipe(null,null,'Arroz','','Cocer',array['lunch'],null,$1::jsonb)`,[JSON.stringify([{ingredient_id:ingredient,alternatives:[]}])])).rows[0].id;
 await db.query(`select public.change_menu_week('2026-11-16',0,'add',null,'2026-11-16','lunch',$1)`,[recipe]);
 await db.query(`insert into storage.objects(bucket_id,name) values('recipe-photos',$1),('recipe-photos',$2)`,[h+'/photo.jpg',h+'/nested/old.jpg']);
 await expect(db.query('select public.begin_household_deletion($1,$2)',[h,'Nombre incorrecto'])).rejects.toThrow('nombre');
 expect((await db.query('select * from public.get_household_members()')).rows).toHaveLength(2);
 await db.query('select public.begin_household_deletion($1,$2)',[h,'Casa 13']);
 expect((await db.query<{id:string;deletion_requested_at:string}>('select * from public.households')).rows[0].deletion_requested_at).toBeTruthy();
 await expect(db.query(`select public.create_ingredient('Nuevo')`)).rejects.toThrow('Casa requerida');
 await expect(db.query('select public.set_recipe_archived($1,1,true)',[recipe])).rejects.toThrow('Casa requerida');
 await expect(db.query('select public.create_household_invitation()')).rejects.toThrow('Casa requerida');
 await expect(db.query(`insert into storage.objects(bucket_id,name) values('recipe-photos',$1)`,[h+'/new.jpg'])).rejects.toThrow();
 await expect(db.query('select public.finish_household_deletion($1)',[h])).rejects.toThrow('fotos');
 await user(14);expect((await db.query('select * from storage.objects')).rows).toHaveLength(0);
 await db.query(`select public.create_household('Casa independiente')`);
 await expect(db.query('select public.finish_household_deletion($1)',[h])).rejects.toThrow();
 await user(13);await db.query('select public.begin_household_deletion($1,$2)',[h,'Casa 13']);
 // Simula la eliminación autorizada de metadatos del servicio Storage en la base de prueba.
 await db.query(`delete from storage.objects where bucket_id='recipe-photos' and split_part(name,'/',1)=$1`,[h]);
 await db.query('select public.finish_household_deletion($1)',[h]);
 expect((await db.query('select * from public.households')).rows).toHaveLength(0);
 await db.exec('reset role;');
 for(const table of ['households','household_members','household_invitations','ingredients','recipes','recipe_ingredients','recipe_alternatives','menu_weeks','menu_entries','menu_choices','shopping_items','household_changes']){
  const field=table==='households'?'id':'household_id';
  expect((await db.query(`select * from public.${table} where ${field}=$1`,[h])).rows,table).toHaveLength(0);
 }
 expect((await db.query('select * from auth.users where id in ($1,$2)',[uid(13),uid(14)])).rows).toHaveLength(2);
 expect((await db.query('select * from storage.objects where name=$1',[other+'/keep.jpg'])).rows).toHaveLength(1);
 await db.exec('set role anon;');await expect(db.query('select * from public.get_household_members()')).rejects.toThrow();
});
