import { test, expect } from '@playwright/test';

// Respuestas de prueba, sin credenciales ni conexión a un proyecto real.
test.beforeEach(async ({page})=>{
 const userId='00000000-0000-0000-0000-000000000001';
 const houseId='00000000-0000-0000-0000-000000000010';
 const expires=Math.floor(Date.now()/1000)+3600;
 const user={id:userId,aud:'authenticated',role:'authenticated',email:'test@example.com',created_at:'2026-01-01',user_metadata:{full_name:'Alex'}};
 const session={access_token:`e30.${Buffer.from(JSON.stringify({sub:userId,exp:expires})).toString('base64url')}.test`,refresh_token:'test-refresh',expires_at:expires,expires_in:3600,token_type:'bearer',user};
 await page.addInitScript(data=>localStorage.setItem('sb-fixture-auth-token',JSON.stringify(data)),session);
 const ingredients=[{id:'00000000-0000-0000-0000-000000000021',name:'Pollo',kcal_per_100g:null},{id:'00000000-0000-0000-0000-000000000022',name:'Tofu',kcal_per_100g:80}];
 type Dish={id:string;name:string;description:string;instructions:string;categories:string[];photo_path:string|null;revision:number;archived:boolean};
 const recipes:Dish[]=[{id:'00000000-0000-0000-0000-000000000030',name:'Pollo al horno',description:'Con verduras',instructions:'Hornear 30 minutos.',categories:['lunch'],photo_path:null,revision:1,archived:false}];
 const lines=[{id:'00000000-0000-0000-0000-000000000040',recipe_id:recipes[0].id,ingredient_id:ingredients[0].id,position:0}];
 const alternatives=[{line_id:lines[0].id,ingredient_id:ingredients[1].id}];
 await page.route('https://fixture.supabase.co/**',async route=>{
  const url=new URL(route.request().url());
  const name=url.pathname.split('/').pop();
  if(url.pathname.startsWith('/storage/v1/object/sign/recipe-photos/') && route.request().method()==='GET') {
   await route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});return;
  }
  let body:unknown=[];
  if(url.pathname==='/storage/v1/object/sign/recipe-photos') {
   body=route.request().postDataJSON().paths.map((path:string)=>({path,signedURL:'/object/sign/recipe-photos/'+path+'?token=test',error:null}));
  }else if(url.pathname.startsWith('/storage/v1/object/recipe-photos/')) {
   body={Key:'recipe-photos/'+url.pathname.split('/recipe-photos/')[1]};
  }else if(url.pathname==='/auth/v1/user')body=user;
  else if(name==='households')body=[{id:houseId,name:'Casa de prueba',owner_id:userId}];
  else if(name==='recipes')body=recipes;
  else if(name==='ingredients')body=ingredients;
  else if(name==='recipe_ingredients')body=lines;
  else if(name==='recipe_alternatives')body=alternatives;
  else if(name==='create_ingredient'){
   const data=route.request().postDataJSON();
   const existing=ingredients.find(i=>i.name.toLowerCase()===data.p_name.toLowerCase());
   const ingredient=existing||{id:crypto.randomUUID(),name:data.p_name,kcal_per_100g:data.p_kcal};
   if(!existing)ingredients.push(ingredient);
   body=ingredient;
  }else if(name==='save_recipe'){
   const data=route.request().postDataJSON();
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
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Carta',exact:true})).toBeVisible();
});

test('crea, consulta y edita un plato con alternativas e ingrediente nuevo',async({page},testInfo)=>{
 await page.screenshot({path:testInfo.outputPath('carta.png'),fullPage:true});
 await page.getByRole('button',{name:'Nuevo plato'}).click();
 await page.getByLabel('Nombre del plato').fill('Arroz de casa');
 await page.getByLabel('Descripción',{exact:true}).fill('Con verduras');
 await page.getByLabel('Receta',{exact:true}).fill('Cocer y servir.');
 await page.getByRole('button',{name:'Añadir ingrediente',exact:true}).click();
 await page.getByLabel('Buscar ingrediente').fill('Arroz');
 await page.getByRole('button',{name:'Nuevo ingrediente',exact:true}).click();
 await page.getByLabel('kcal por 100 g (opcional)').fill('130');
 await page.getByRole('button',{name:'Añadir ingrediente',exact:true}).last().click();
 await expect(page.getByText('Arroz',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Añadir alternativa'}).click();
 await page.getByRole('button',{name:'Tofu',exact:true}).click();
 await page.getByRole('button',{name:'Guardar plato'}).click();
 await page.getByRole('button',{name:/Arroz de casa/}).click();
 await expect(page.getByText('Alternativas: Tofu')).toBeVisible();
 await expect(page.getByText('Cocer y servir.')).toBeVisible();
 await page.getByRole('button',{name:'Editar plato'}).click();
 await page.getByLabel('Nombre del plato').fill('Arroz editado');
 await page.getByRole('button',{name:'Guardar plato'}).click();
 await expect(page.getByRole('button',{name:/Arroz editado/})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('archiva y restaura un plato sin eliminarlo',async({page})=>{
 await page.getByRole('button',{name:/Pollo al horno/}).click();
 page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Archivar plato'}).click();
 await expect(page.getByText('Aún no hay platos.')).toBeVisible();
 await page.getByLabel('Archivados',{exact:true}).check();
 await page.getByRole('button',{name:/Pollo al horno/}).click();
 await page.getByRole('button',{name:'Restaurar plato'}).click();
 await page.getByLabel('Archivados',{exact:true}).uncheck();
 await expect(page.getByRole('button',{name:/Pollo al horno/})).toBeVisible();
});


test('sube una foto, la muestra en la ficha y permite quitarla',async({page})=>{
 await page.getByRole('button',{name:'Nuevo plato'}).click();
 await page.getByLabel('Nombre del plato').fill('Plato con foto');
 await page.getByLabel('Receta',{exact:true}).fill('Cocinar.');
 await page.getByLabel('Foto (opcional)').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
 await page.getByRole('button',{name:'Añadir ingrediente',exact:true}).click();
 await page.getByRole('button',{name:'Pollo',exact:true}).click();
 await page.getByRole('button',{name:'Guardar plato'}).click();
 await page.getByRole('button',{name:/Plato con foto/}).click();
 const photo=page.getByRole('img',{name:'Plato con foto',exact:true});
 await expect(photo).toBeVisible();
 await expect.poll(()=>photo.evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Editar plato'}).click();
 await page.getByRole('button',{name:'Quitar foto'}).click();
 await page.getByRole('button',{name:'Guardar plato'}).click();
 await page.getByRole('button',{name:/Plato con foto/}).click();
 await expect(page.getByRole('img',{name:'Plato con foto',exact:true})).toHaveCount(0);
});
