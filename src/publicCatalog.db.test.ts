// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, expect, it } from 'vitest';
let db:PGlite,houseA:string,houseB:string,recipe:string,publication:string,imported:string,ingredient:string,publicIngredient:string;
const uid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const user=async(n:number)=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid(n)}'`);
const catalog=async()=>(await db.query<{data:any[]}>('select public.get_public_catalog() as data')).rows[0].data;
const current=async(id=recipe)=>(await db.query<any>('select * from public.recipes where id=$1',[id])).rows[0];
async function save(id:string|null,revision:number|null,name='Plato',ingredients:{ingredient_id:string;alternatives:string[]}[]=[{ingredient_id:ingredient,alternatives:[]}]){
 return (await db.query<any>(`select * from public.save_recipe($1,$2,$3,'Con verduras','Cocinar',array['Rápido'],null,$4::jsonb)`,[id,revision,name,JSON.stringify(ingredients)])).rows[0];
}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage,public to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());
 alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 insert into auth.users values('${uid(1)}','{}','a@example.com'),('${uid(2)}','{}','b@example.com'),('${uid(3)}','{}','c@example.com');`);
 for(const file of readdirSync('supabase/migrations').filter(file=>file.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 await user(1);houseA=(await db.query<any>(`select public.create_household('Casa A') id`)).rows[0].id;
 ingredient=(await db.query<any>(`select * from public.create_ingredient('Tomate',20)`)).rows[0].id;
 recipe=(await save(null,null)).id;await db.query("select public.create_ingredient('Privado sin publicar',1)");
 await user(2);houseB=(await db.query<any>(`select public.create_household('Casa B') id`)).rows[0].id;
 await db.query(`select public.create_ingredient('Tomate',99)`);
},30000);
afterAll(async()=>db?.close());
it('publica solo lo seleccionado y rechaza publicación ajena o anónima',async()=>{
 await expect(db.query('select public.publish_recipe($1,1)',[recipe])).rejects.toThrow();
 await user(1);publication=(await db.query<any>('select public.publish_recipe($1,1) id',[recipe])).rows[0].id;
 const list=await catalog();expect(list).toHaveLength(1);expect(list[0]).toMatchObject({id:publication,owned:true,incorporated:true,name:'Plato'});
 expect(list[0]).not.toHaveProperty('author_household_id');
 const exposed=(await db.query<any>('select * from public.public_ingredients')).rows;expect(exposed).toHaveLength(1);expect(exposed[0].name).toBe('Tomate');publicIngredient=exposed[0].id;
 await db.exec('reset role;set role anon');await expect(catalog()).rejects.toThrow();await expect(db.query('select * from public.public_ingredients')).rejects.toThrow();
 await user(2);await expect(db.query('select * from public.public_recipes')).rejects.toThrow();await expect(db.query("select public.catalog_withdraw($1)",[publication])).rejects.toThrow();
});
it('incorpora una sola vez, conserva ingredientes privados y bloquea edición de la copia',async()=>{
 imported=(await db.query<any>('select public.incorporate_public_recipe($1) id',[publication])).rows[0].id;
 expect((await db.query<any>('select public.incorporate_public_recipe($1) id',[publication])).rows[0].id).toBe(imported);
 expect((await db.query<any>('select * from public.ingredients')).rows).toHaveLength(1);
 expect(Number((await db.query<any>('select * from public.ingredients')).rows[0].kcal_per_100g)).toBe(99);
 expect((await catalog())[0]).toMatchObject({incorporated:true,owned:false,local_recipe_id:imported});
 const copy=await current(imported);await expect(save(imported,copy.revision,'Invadida')).rejects.toThrow('solo puede editarla');
 await expect(db.query('select * from public.save_recipe_private(null,null,\'x\',\'\',\'x\',array[]::text[],null,\'[]\'::jsonb)')).rejects.toThrow();
});
it('sincroniza contenido, conserva compra e IDs y permite quitar y restaurar',async()=>{
 await db.query(`select public.change_menu_week('2026-11-16',0,'add',null,'2026-11-16','lunch',$1)`,[imported]);
 let list=(await db.query<any>(`select public.get_shopping_week('2026-11-16') data`)).rows[0].data;const product=list[0].id;
 await db.query('select public.set_shopping_purchased($1,true)',[product]);
 await user(1);await save(recipe,(await current()).revision,'Plato actualizado');
 await user(2);expect((await current(imported)).name).toBe('Plato actualizado');
 list=(await db.query<any>(`select public.get_shopping_week('2026-11-16') data`)).rows[0].data;expect(list[0]).toMatchObject({id:product,purchased:true});
 let copy=await current(imported);await db.query('select public.set_recipe_archived($1,$2,true)',[imported,copy.revision]);expect((await catalog())[0].incorporated).toBe(false);
 await user(1);await save(recipe,(await current()).revision,'Versión nueva');await user(2);expect((await current(imported)).name).toBe('Plato actualizado');
 await db.query('select public.incorporate_public_recipe($1)',[publication]);expect((await current(imported))).toMatchObject({name:'Versión nueva',archived:false});
});
it('solo administradores editan el catálogo global y los privados conservan sus valores',async()=>{
 await expect(db.query('select public.update_ingredient($1,1,\'Tomates\',25,true)',[publicIngredient])).rejects.toThrow('administradores');
 await expect(db.query('insert into public.catalog_admins values($1)',[uid(2)])).rejects.toThrow();
 await db.exec('reset role');await db.query('insert into public.catalog_admins values($1)',[uid(3)]);await user(3);
 await db.query('select public.update_ingredient($1,1,\'Tomates\',25,true)',[publicIngredient]);
 await expect(db.query('select public.update_ingredient($1,1,\'Viejo\',25,true)',[publicIngredient])).rejects.toThrow('ha cambiado');
 await user(2);expect((await db.query<any>('select * from public.ingredients')).rows[0]).toMatchObject({name:'Tomate'});
 await expect(db.query('select public.update_ingredient($1,1,\'Ajeno\',20,false)',[ingredient])).rejects.toThrow();
});
it('retirar conserva recetas, fotos y menús y permite editar la copia',async()=>{
 await user(1);const pub=(await catalog())[0];await db.query('select public.unpublish_recipe($1,$2)',[publication,pub.revision]);
 expect(await catalog()).toHaveLength(0);await user(2);const copy=await current(imported);expect(copy).toMatchObject({publication_id:null,catalog_imported:false});
 const ownIngredient=(await db.query<any>('select * from public.ingredients')).rows[0].id;
 await save(imported,copy.revision,'Mi receta',[{ingredient_id:ownIngredient,alternatives:[]}]);
 expect((await db.query<any>(`select public.get_menu_week('2026-11-16') data`)).rows[0].data.entries[0].recipe_id).toBe(imported);
});
it('repara alternativas invalidadas por el autor y reconcilia la compra de la casa receptora',async()=>{
 await user(1);const tofu=(await db.query<any>("select * from public.create_ingredient('Tofu',80)")).rows[0].id;
 let source=await save(recipe,(await current()).revision,'Con alternativas',[{ingredient_id:ingredient,alternatives:[tofu]}]);
 const pub=(await db.query<any>('select public.publish_recipe($1,$2) id',[recipe,source.revision])).rows[0].id;
 await user(2);const copy=(await db.query<any>('select public.incorporate_public_recipe($1) id',[pub])).rows[0].id;
 let menu=(await db.query<any>("select public.get_menu_week('2026-11-16') data")).rows[0].data;
 await db.query("select public.change_menu_week('2026-11-16',$1,'add',null,'2026-11-16','dinner',$2)",[menu.revision,copy]);
 menu=(await db.query<any>("select public.get_menu_week('2026-11-16') data")).rows[0].data;const entry=menu.entries.find((entry:any)=>entry.recipe_id===copy);
 const local=(await db.query<any>("select * from public.ingredients where name='Tofu'")).rows[0],base=(await db.query<any>('select * from public.recipe_ingredients where recipe_id=$1',[copy])).rows[0];
 await db.query("select public.change_menu_week('2026-11-16',$1,'choices',$2,null,null,null,$3::jsonb)",[menu.revision,entry.id,JSON.stringify([{ingredient_id:base.ingredient_id,alternative_id:local.id}])]);
 await user(1);await save(recipe,(await current()).revision,'Sin alternativas');await user(2);
 menu=(await db.query<any>("select public.get_menu_week('2026-11-16') data")).rows[0].data;expect(menu.entries.find((item:any)=>item.id===entry.id)).toMatchObject({choices:[],choices_reset:true});
 const shopping=(await db.query<any>("select public.get_shopping_week('2026-11-16') data")).rows[0].data;expect(shopping.some((item:any)=>item.ingredient_id===local.id)).toBe(false);
 await user(1);await db.query('select public.unpublish_recipe($1,$2)',[pub,(await catalog())[0].revision]);
});
it('valida la preparación de fotos y conserva el acceso privado al eliminar la casa autora',async()=>{
 await user(1);const photo=houseA+'/'+uid(909)+'.jpg';
 await db.exec('reset role');await db.query("insert into storage.objects(bucket_id,name) values('recipe-photos',$1)",[photo]);await user(1);
 const fresh=(await db.query<any>(`select * from public.save_recipe(null,null,'Con foto','','Cocinar',array[]::text[],$1,$2::jsonb)`,[photo,JSON.stringify([{ingredient_id:ingredient,alternatives:[]}])])).rows[0];
 await expect(db.query('select public.publish_recipe($1,$2)',[fresh.id,fresh.revision])).rejects.toThrow('Prepara la foto');
 await db.exec('reset role');await db.query("insert into storage.objects(bucket_id,name) values('catalog-photos',$1)",[photo]);await user(1);
 const pub=(await db.query<any>('select public.publish_recipe($1,$2) id',[fresh.id,fresh.revision])).rows[0].id;
 await user(3);expect((await db.query<any>("select * from storage.objects where bucket_id='catalog-photos' and name=$1",[photo])).rows).toHaveLength(1);
 await user(2);const id=(await db.query<any>('select public.incorporate_public_recipe($1) id',[pub])).rows[0].id;
 expect((await current(id)).catalog_photo_path).toBe(photo);
 await user(1);await db.query("select public.begin_household_deletion($1,'Casa A')",[houseA]);
 await user(3);expect((await db.query("select * from storage.objects where bucket_id='catalog-photos' and name=$1",[photo])).rows).toHaveLength(0);
 await user(2);expect((await current(id))).toMatchObject({catalog_photo_path:photo,publication_id:null,catalog_imported:false});
 expect((await db.query("select * from storage.objects where bucket_id='catalog-photos' and name=$1",[photo])).rows).toHaveLength(1);
 await expect(db.query("insert into storage.objects(bucket_id,name) values('catalog-photos','fake')")).rejects.toThrow();
 await db.exec('reset role');await db.query("delete from storage.objects where bucket_id='recipe-photos' and name=$1",[photo]);await user(1);await db.query('select public.finish_household_deletion($1)',[houseA]);
 await user(2);expect((await current(id)).name).toBe('Con foto');
});
it('propaga correcciones globales a ingredientes creados al importar y conserva ediciones locales',async()=>{
 await user(2);const original=(await db.query<any>("select * from public.ingredients where name='Tomate'")).rows[0];
 await db.query('select public.update_ingredient($1,$2,\'Mi tomate\',91,false)',[original.id,original.revision]);
 await user(3);const global=(await db.query<any>('select * from public.public_ingredients where id=$1',[publicIngredient])).rows[0];
 await db.query('select public.update_ingredient($1,$2,\'Tomate corregido\',22,true)',[global.id,global.revision]);
 await user(2);expect((await db.query<any>('select * from public.ingredients where id=$1',[original.id])).rows[0]).toMatchObject({name:'Mi tomate'});
 await expect(db.query('select public.catalog_project($1,$2,$3)',[publication,houseB,imported])).rejects.toThrow();
});
it('un ingrediente nuevo importado sigue correcciones globales hasta editarlo localmente',async()=>{
 await user(2);const carrot=(await db.query<any>("select * from public.create_ingredient('Zanahoria',40)")).rows[0].id;
 const source=await save(null,null,'Zanahorias',[{ingredient_id:carrot,alternatives:[]}]);
 const pub=(await db.query<any>('select public.publish_recipe($1,$2) id',[source.id,source.revision])).rows[0].id;
 await user(3);await db.query("select public.create_household('Casa C')");await db.query('select public.incorporate_public_recipe($1)',[pub]);
 const global=(await db.query<any>("select * from public.public_ingredients where name='Zanahoria'")).rows[0];
 await db.query('select public.update_ingredient($1,$2,\'Zanahoria nueva\',41,true)',[global.id,global.revision]);
 let local=(await db.query<any>("select * from public.ingredients where name='Zanahoria nueva'")).rows[0];expect(Number(local.kcal_per_100g)).toBe(41);
 await db.query('select public.update_ingredient($1,$2,\'Mi zanahoria\',42,false)',[local.id,local.revision]);
 await db.query('select public.update_ingredient($1,$2,\'Zanahoria corregida\',43,true)',[global.id,global.revision+1]);
 expect((await db.query<any>('select * from public.ingredients where id=$1',[local.id])).rows[0].name).toBe('Mi zanahoria');
});
it('la limpieza reclama archivos huérfanos sin borrar SQL ni permitir publicar fotos reclamadas',async()=>{
 await db.exec('reset role');const photo=houseB+'/'+uid(990)+'.jpg';
 await db.query("insert into storage.objects(bucket_id,name,created_at) values('catalog-photos',$1,now()-interval '2 days'),('recipe-photos',$1,now()-interval '2 days')",[photo]);
 await db.exec('set role service_role');const gc=(await db.query<any>('select * from public.catalog_unused_photos()')).rows;expect(gc.some(row=>row.name===photo)).toBe(true);
 await user(2);const localIngredient=(await db.query<any>('select id from public.ingredients limit 1')).rows[0].id;
 const source=(await db.query<any>(`select * from public.save_recipe(null,null,'En limpieza','','Cocinar',array[]::text[],$1,$2::jsonb)`,[photo,JSON.stringify([{ingredient_id:localIngredient,alternatives:[]}])])).rows[0];
 await expect(db.query('select public.publish_recipe($1,$2)',[source.id,source.revision])).rejects.toThrow('Prepara la foto');
 await expect(db.query('select * from public.catalog_unused_photos()')).rejects.toThrow();
});
it('retirar una publicación también detiene las correcciones de sus ingredientes importados',async()=>{
 await user(3);const list=await catalog();const pub=list.find(item=>item.name==='Zanahorias');
 const local=(await db.query<any>("select * from public.ingredients where name='Mi zanahoria'")).rows[0];
 // Recreate an automatically-managed state to verify withdrawal itself detaches it.
 await db.exec('reset role');await db.query('update public.catalog_ingredient_links set managed=true where ingredient_id=$1',[local.id]);await user(2);
 await db.query('select public.unpublish_recipe($1,$2)',[pub.id,pub.revision]);await user(3);
 const global=(await db.query<any>("select * from public.public_ingredients where name='Zanahoria corregida'")).rows[0];
 await db.query('select public.update_ingredient($1,$2,\'Zanahoria final\',44,true)',[global.id,global.revision]);
 expect((await db.query<any>('select * from public.ingredients where id=$1',[local.id])).rows[0].name).toBe('Mi zanahoria');
});
