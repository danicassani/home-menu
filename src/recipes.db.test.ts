// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
let db: PGlite;
const uid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const user=async(n:number)=>db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${uid(n)}';`);
async function ingredient(name:string,kcal:number|null=null) {
  return (await db.query<{id:string;name:string;kcal_per_100g:number}>('select * from public.create_ingredient($1,$2)',[name,kcal])).rows[0];
}
async function save(lines:unknown,id:string|null=null,revision:number|null=null,photo:string|null=null) {
  return (await db.query<{id:string;revision:number}>(`select * from public.save_recipe($1,$2,'Plato','Descripción','Paso 1',array['lunch'],$3,$4::jsonb)`,[id,revision,photo,JSON.stringify(lines)])).rows[0];
}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public,storage to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 insert into auth.users values('${uid(1)}'),('${uid(2)}'),('${uid(3)}');`);
 await db.exec(readFileSync('supabase/migrations/202611140001_households.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/202611150001_recipes.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/202611150002_weekly_menu.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/202611160001_shopping_realtime.sql','utf8'));
 await user(1);await db.query(`select public.create_household('Casa A')`);
 await user(2);await db.query(`select public.create_household('Casa B')`);
},30000);
afterAll(async()=>{await db?.close();});
it('normaliza el catálogo sin sobrescribir datos y valida kcal',async()=>{
 await user(1);
 const first=await ingredient('  Tomate  ',20);
 const same=await ingredient('tomate',99);
 expect(same.id).toBe(first.id);
 expect(Number(same.kcal_per_100g)).toBe(20);
 await expect(ingredient('')).rejects.toThrow();
 await expect(ingredient('inválido',-1)).rejects.toThrow();
 await user(2);
 expect((await db.query('select * from public.ingredients')).rows).toHaveLength(0);
 const own=await ingredient('Tomate',30);
 expect(own.id).not.toBe(first.id);
 await db.exec('reset role;set role anon;');
 await expect(ingredient('Anónimo')).rejects.toThrow();
});
it('guarda alternativas atómicamente, protege revisiones y archiva conservando el plato',async()=>{
 await user(1);
 const chicken=await ingredient('Pollo');const tofu=await ingredient('Tofu');
 const recipe=await save([{ingredient_id:chicken.id,alternatives:[tofu.id]}]);
 const lines=await db.query<{id:string}>('select id from public.recipe_ingredients where recipe_id=$1',[recipe.id]);
 expect((await db.query('select * from public.recipe_alternatives where line_id=$1',[lines.rows[0].id])).rows).toHaveLength(1);
 await expect(save([{ingredient_id:chicken.id,alternatives:[chicken.id]}],recipe.id,1)).rejects.toThrow();
 expect((await db.query('select revision from public.recipes where id=$1',[recipe.id])).rows).toEqual([{revision:1}]);
 expect((await db.query('select * from public.recipe_alternatives where line_id=$1',[lines.rows[0].id])).rows).toHaveLength(1);
 const edited=await save([{ingredient_id:tofu.id,alternatives:[]}],recipe.id,1);
 expect(edited.revision).toBe(2);
 await expect(save([{ingredient_id:chicken.id,alternatives:[]}],recipe.id,1)).rejects.toThrow('ha cambiado');
 await expect(save([])).rejects.toThrow();
 await db.query('select public.set_recipe_archived($1,2,true)',[recipe.id]);
 expect((await db.query('select archived from public.recipes where id=$1',[recipe.id])).rows).toEqual([{archived:true}]);
 await expect(save([{ingredient_id:tofu.id,alternatives:[]}],recipe.id,3)).rejects.toThrow();
 await db.query('select public.set_recipe_archived($1,3,false)',[recipe.id]);
});
it('impide usar ingredientes, alternativas y platos de otra casa',async()=>{
 await user(2);const foreign=await ingredient('Privado');const foreignRecipe=await save([{ingredient_id:foreign.id,alternatives:[]}]);
 await user(1);const own=await ingredient('Arroz');
 expect((await db.query('select * from public.recipes where id=$1',[foreignRecipe.id])).rows).toHaveLength(0);
 await expect(save([{ingredient_id:foreign.id,alternatives:[]}])).rejects.toThrow();
 await expect(save([{ingredient_id:own.id,alternatives:[foreign.id]}])).rejects.toThrow();
 await expect(save([{ingredient_id:own.id,alternatives:[]}],foreignRecipe.id,1)).rejects.toThrow();
 await expect(db.query('select public.set_recipe_archived($1,1,true)',[foreignRecipe.id])).rejects.toThrow();
 await expect(db.query('update public.recipes set archived=true')).rejects.toThrow();
 await user(3);await expect(ingredient('Sin casa')).rejects.toThrow('Casa requerida');
});
it('autoriza las fotos solo dentro de la casa y exige que existan antes de asociarlas',async()=>{
 await user(1);
 const h=(await db.query<{h:string}>('select public.my_household() as h')).rows[0].h;
 const path=`${h}/00000000-0000-0000-0000-000000000099.jpg`;
 const rice=await ingredient('Foto');
 await expect(save([{ingredient_id:rice.id,alternatives:[]}],null,null,path)).rejects.toThrow('Foto');
 await db.query(`insert into storage.objects(bucket_id,name) values('recipe-photos',$1)`,[path]);
 await save([{ingredient_id:rice.id,alternatives:[]}],null,null,path);
 await user(2);
 expect((await db.query('select * from storage.objects where name=$1',[path])).rows).toHaveLength(0);
 await expect(db.query(`insert into storage.objects(bucket_id,name) values('recipe-photos',$1)`,[`${h}/other.png`])).rejects.toThrow();
 expect((await db.query('delete from storage.objects where name=$1 returning *',[path])).rows).toHaveLength(0);
 const own=await ingredient('Mi foto');
 await expect(save([{ingredient_id:own.id,alternatives:[]}],null,null,path)).rejects.toThrow('Foto');
 await db.exec('reset role;');
 const bucket=(await db.query<{public:boolean;file_size_limit:number;allowed_mime_types:string[]}>('select * from storage.buckets')).rows[0];
 expect(bucket.public).toBe(false);
 expect(Number(bucket.file_size_limit)).toBe(5242880);
 expect(bucket.allowed_mime_types).toEqual(['image/jpeg','image/png','image/webp']);
});
