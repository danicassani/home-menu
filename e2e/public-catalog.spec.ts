import { test, expect, type Page } from '@playwright/test';
import { setupApp } from './fixtures';
async function fixture(page:Page,admin=false){
 const state=await setupApp(page);
 const publicIngredients=[{id:crypto.randomUUID(),name:'Tomate',kcal_per_100g:20,revision:1}];
 const publicRecipes:any[]=[{id:crypto.randomUUID(),name:'Ensalada pública',description:'Tomate fresco',instructions:'Cortar y servir.',tags:['Rápido'],photo_path:null,revision:1,owned:false,lines:[{id:crypto.randomUUID(),ingredient_id:publicIngredients[0].id,alternatives:[]}]}];
 state.ingredients.forEach(ingredient=>Object.assign(ingredient,{revision:1}));
 let failIngredient=false;
 await page.route('https://fixture.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),name=url.pathname.split('/').pop();let body:unknown;
  const data=route.request().method()==='POST'?route.request().postDataJSON():null;
  const notify=()=>{state.revision++;for(const callback of state.notifiers)callback();};
  if(name==='get_public_catalog')body=publicRecipes.map(recipe=>{const local=state.recipes.find((local:any)=>local.publication_id===recipe.id);return {...recipe,incorporated:Boolean(local&&!local.archived),local_recipe_id:local?.id||null};});
  else if(name==='public_ingredients')body=publicIngredients;
  else if(name==='is_catalog_admin')body=admin;
  else if(name==='recipes'&&route.request().headers().accept?.includes('application/vnd.pgrst.object'))body=state.recipes.find(recipe=>recipe.id===url.searchParams.get('id')?.slice(3));
  else if(name==='update_ingredient'){
   if(failIngredient||data.p_public&&!admin){await route.fulfill({status:409,json:{message:'Revisión cambiada'}});return;}
   const list=data.p_public?publicIngredients:state.ingredients;const ingredient=list.find((ingredient:any)=>ingredient.id===data.p_id)!;Object.assign(ingredient,{name:data.p_name.trim(),kcal_per_100g:data.p_kcal,revision:data.p_revision+1});body=null;notify();
  }else if(name==='incorporate_public_recipe'){
   const publication=publicRecipes.find(recipe=>recipe.id===data.p_public),old=state.recipes.find((recipe:any)=>recipe.publication_id===publication.id);
   if(old){old.archived=false;body=old.id;}else{
    const local={...publication,id:crypto.randomUUID(),archived:false,publication_id:publication.id,catalog_imported:true,photo_path:null};state.recipes.push(local);body=local.id;
    publication.lines.forEach((line:any,position:number)=>{const global=publicIngredients.find(ingredient=>ingredient.id===line.ingredient_id)!;let ingredient=state.ingredients.find(ingredient=>ingredient.name===global.name);if(!ingredient){ingredient={id:crypto.randomUUID(),name:global.name,kcal_per_100g:global.kcal_per_100g};state.ingredients.push(ingredient);}
     state.lines.push({id:crypto.randomUUID(),recipe_id:local.id,ingredient_id:ingredient.id,position});
    });
   }notify();
  }else if(name==='catalog-publication'){
   const source=state.recipes.find(recipe=>recipe.id===data.recipe)!;
   if(data.action==='save'){Object.assign(source,{name:data.draft.name,description:data.draft.description,instructions:data.draft.instructions,tags:data.draft.tags,revision:source.revision+1});Object.assign(publicRecipes.find(recipe=>recipe.id===(source as any).publication_id),{...data.draft,revision:source.revision});}
   else {const pub={...source,id:crypto.randomUUID(),owned:true,lines:[]};publicRecipes.push(pub);Object.assign(source,{publication_id:pub.id,catalog_imported:false,revision:source.revision+1});}
   body={data:data.action==='save'?source:(source as any).publication_id};notify();
  }else if(name==='unpublish_recipe'){
   const index=publicRecipes.findIndex(recipe=>recipe.id===data.p_public);publicRecipes.splice(index,1);state.recipes.forEach((recipe:any)=>{if(recipe.publication_id===data.p_public){recipe.publication_id=null;recipe.catalog_imported=false;}});body=null;notify();
  }else {await route.fallback();return;}
  await route.fulfill({status:200,json:body});
 });
 return {state,publicRecipes,setIngredientFailure:(value:boolean)=>{failIngredient=value;}};
}
test('incorpora, muestra Ya la tienes y quita únicamente de la carta de la casa',async({page},testInfo)=>{
 const {state}=await fixture(page);await page.getByRole('button',{name:'Carta pública',exact:true}).click();
 await page.getByRole('button',{name:/Ensalada pública/}).click();await expect(page.getByText('Cortar y servir.')).toBeVisible();
 await page.getByRole('button',{name:'Añadir a mi carta',exact:true}).click();await expect(page.getByRole('button',{name:'Quitar de la carta',exact:true})).toBeVisible();
 expect(state.recipes.filter(recipe=>recipe.name==='Ensalada pública')).toHaveLength(1);
 await page.getByRole('button',{name:'Volver a carta pública',exact:true}).click();const card=page.locator('.public-recipe-card').filter({hasText:'Ensalada pública'});
 await expect(card).toHaveClass(/incorporated/);await expect(card.getByText('Ya la tienes',{exact:true})).toBeVisible();await page.screenshot({path:testInfo.outputPath('carta-publica.png'),fullPage:true});
 await page.getByRole('button',{name:'Volver a mi carta',exact:true}).click();await page.locator('.recipe-card').filter({hasText:'Ensalada pública'}).click();
 await expect(page.getByRole('button',{name:'Editar plato',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Ver en carta pública',exact:true}).click();
 await page.getByRole('button',{name:/Ensalada pública/}).click();await page.getByRole('button',{name:'Quitar de la carta',exact:true}).click();await expect(page.getByRole('button',{name:'Añadir a mi carta',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Añadir a mi carta',exact:true}).click();await expect(page.getByRole('button',{name:'Quitar de la carta',exact:true})).toBeVisible();expect(state.recipes.filter(recipe=>recipe.name==='Ensalada pública')).toHaveLength(1);
});
test('publica, guarda cambios publicados y permite dejar de publicar',async({page})=>{
 await fixture(page);page.on('dialog',dialog=>dialog.accept());await page.locator('.recipe-card').filter({hasText:'Pollo al horno'}).click();await page.getByRole('button',{name:'Publicar',exact:true}).click();
 await expect(page.getByText('Receta publicada.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Ver en carta pública',exact:true})).toBeVisible();await page.getByRole('button',{name:'Editar plato',exact:true}).click();await page.getByLabel('Nombre del plato').fill('Pollo compartido');await page.getByRole('button',{name:'Guardar plato',exact:true}).click();
 await page.getByRole('button',{name:'Carta pública',exact:true}).click();await page.getByRole('button',{name:/Pollo compartido/}).click();await expect(page.getByRole('button',{name:'Editar receta',exact:true})).toBeVisible();await page.getByRole('button',{name:'Dejar de publicar',exact:true}).click();
 await expect(page.getByRole('button',{name:/Pollo compartido/})).toHaveCount(0);await page.getByRole('button',{name:'Volver a mi carta',exact:true}).click();await expect(page.locator('.recipe-card').filter({hasText:'Pollo compartido'})).toBeVisible();
});
test('el perfil permite editar ingredientes privados y conserva el borrador si hay conflicto',async({page},testInfo)=>{
 const fixtureState=await fixture(page);await page.getByRole('button',{name:'Abrir perfil de Alex',exact:true}).click();await page.getByRole('button',{name:'Ingredientes',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Ingredientes',exact:true});await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Públicos',exact:true})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Editar Pollo',exact:true}).click();await dialog.getByLabel('Nombre',{exact:true}).fill('Pollo de casa');fixtureState.setIngredientFailure(true);await dialog.getByRole('button',{name:'Guardar ingrediente',exact:true}).click();
 await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByLabel('Nombre',{exact:true})).toHaveValue('Pollo de casa');fixtureState.setIngredientFailure(false);await dialog.getByRole('button',{name:'Guardar ingrediente',exact:true}).click();await expect(dialog.getByRole('button',{name:'Editar Pollo de casa',exact:true})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('ingredientes.png')});await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'Abrir perfil de Alex',exact:true})).toBeFocused();
});
test('el administrador puede revisar y editar los ingredientes públicos',async({page},testInfo)=>{
 await fixture(page,true);await page.getByRole('button',{name:'Abrir perfil de Alex',exact:true}).click();await page.getByRole('button',{name:'Ingredientes',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Ingredientes',exact:true});
 await dialog.getByRole('button',{name:'Públicos',exact:true}).click();await dialog.getByRole('button',{name:'Editar Tomate',exact:true}).click();await dialog.getByLabel('Nombre',{exact:true}).fill('Tomate corregido');await dialog.getByLabel('Kilocalorías por 100 g').fill('22');await dialog.getByRole('button',{name:'Guardar ingrediente',exact:true}).click();await expect(dialog.getByRole('button',{name:'Editar Tomate corregido',exact:true})).toBeVisible();await page.screenshot({path:testInfo.outputPath('ingredientes-publicos.png')});
});
test('permite consultar la carta pública sin casa, pero exige una casa para incorporar',async({page})=>{
 const {state}=await fixture(page);state.members.length=0;for(const notify of state.userNotifiers)notify();
 await expect(page.getByRole('heading',{name:'Crear casa',exact:true})).toBeVisible();await page.getByRole('button',{name:'Carta pública',exact:true}).click();await page.getByRole('button',{name:/Ensalada pública/}).click();await expect(page.getByText('Cortar y servir.')).toBeVisible();await expect(page.getByRole('button',{name:'Añadir a mi carta',exact:true})).toBeDisabled();
});

test('no oculta un fallo de publicación tras una actualización automática',async({page})=>{
 const {state}=await fixture(page);await page.route('https://fixture.supabase.co/functions/v1/catalog-publication',route=>route.fulfill({json:{message:'Hello World'}}));
 page.on('dialog',dialog=>dialog.accept());await page.locator('.recipe-card').filter({hasText:'Pollo al horno'}).click();await page.getByRole('button',{name:'Publicar',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('respuesta inesperada');for(const notify of state.notifiers)notify();
 await expect(page.getByRole('button',{name:'Publicar',exact:true})).toBeEnabled();await expect(page.getByRole('alert')).toContainText('respuesta inesperada');await expect(page.getByText('Receta publicada.',{exact:true})).toHaveCount(0);
});
