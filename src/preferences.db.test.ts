// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
let db:PGlite;
const uid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const user=async(n:number)=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid(n)}';`);
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;
 insert into auth.users values('${uid(1)}'),('${uid(2)}'),('${uid(3)}');`);
 await db.exec(readFileSync('supabase/migrations/202611160003_profile_preferences.sql','utf8'));
},30000);
afterAll(async()=>{await db?.close();});
it('guarda preferencias solo del usuario autenticado y las mantiene separadas',async()=>{
 await user(1);await db.query(`insert into public.user_preferences(user_id,theme,mode,avatar) values($1,'blue','dark','🍋')`,[uid(1)]);
 await user(2);expect((await db.query('select * from public.user_preferences')).rows).toHaveLength(0);
 await expect(db.query(`insert into public.user_preferences(user_id) values($1) on conflict(user_id) do update set theme='red'`,[uid(1)])).rejects.toThrow();
 expect((await db.query(`update public.user_preferences set theme='yellow' where user_id=$1 returning *`,[uid(1)])).rows).toHaveLength(0);
 await db.query(`insert into public.user_preferences(user_id,theme) values($1,'green')`,[uid(2)]);
 await user(1);expect((await db.query<{theme:string;avatar:string}>('select theme,avatar from public.user_preferences')).rows).toEqual([{theme:'blue',avatar:'🍋'}]);
 await expect(db.query('update public.user_preferences set user_id=$1',[uid(3)])).rejects.toThrow();
 await expect(db.query('delete from public.user_preferences')).rejects.toThrow();
});
it('valida temas, modos y emojis y admite volver a la inicial',async()=>{
 await user(1);
 for(const [field,value] of [['theme','purple'],['mode','invalid'],['avatar','texto']])await expect(db.query(`update public.user_preferences set ${field}=$1`,[value])).rejects.toThrow();
 await db.query(`update public.user_preferences set mode='system',avatar=null`);
 expect((await db.query<{mode:string;avatar:string|null}>('select mode,avatar from public.user_preferences')).rows).toEqual([{mode:'system',avatar:null}]);
 await db.exec('reset role;set role anon;');await expect(db.query('select * from public.user_preferences')).rejects.toThrow();
});
it('elimina las preferencias al borrar la cuenta, conservando las de los demás usuarios',async()=>{
 await db.exec('reset role;');await db.query('delete from auth.users where id=$1',[uid(1)]);
 expect((await db.query<{user_id:string}>('select user_id from public.user_preferences')).rows).toEqual([{user_id:uid(2)}]);
});
