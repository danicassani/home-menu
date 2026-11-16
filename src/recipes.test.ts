import { expect, it } from 'vitest';
import { cleanTags, validateTags, emptyDraft, filterRecipes, validatePhoto, type Recipe } from './recipes';
const dish = (id:string,tags:Recipe['tags'],archived=false):Recipe=>({id,name:id,description:'',instructions:'Pasos',tags,photo_path:null,archived,revision:1,lines:[]});
it('busca sin distinguir mayúsculas y combina etiqueta y archivo',()=>{
 const dishes=[dish('Arroz',['Rápido','Vegetariano']),dish('Tostada',['Al horno']),dish('Arroz antiguo',['Rápido'],true)];
 expect(filterRecipes(dishes,' ARROZ ','Vegetariano',false).map(r=>r.id)).toEqual(['Arroz']);
 expect(filterRecipes(dishes,'arroz','',true).map(r=>r.id)).toEqual(['Arroz antiguo']);
 expect(filterRecipes(dishes,'arroz','Al horno',false)).toEqual([]);
});
it('valida tipo y tamaño de fotos antes de subirlas',()=>{
 expect(validatePhoto(new File(['x'],'x.svg',{type:'image/svg+xml'}))).toContain('JPEG');
 expect(validatePhoto(new File([new Uint8Array(5242881)],'x.png',{type:'image/png'}))).toContain('5 MB');
 expect(validatePhoto(new File(['x'],'x.webp',{type:'image/webp'}))).toBeNull();
});
it('cada borrador tiene sus propias listas',()=>{
 const a=emptyDraft(),b=emptyDraft();a.tags.push('Vegetariano');a.lines.push({id:'x',ingredient_id:'y',alternatives:[]});
 expect(b.tags).toEqual([]);expect(b.lines).toEqual([]);
});

it('busca por varias palabras del nombre y las etiquetas sin distinguir acentos',()=>{
 const dishes=[dish('Arroz',['Rápido','Vegetariano']),dish('Pasta',[])];
 expect(filterRecipes(dishes,' arroz RAPIDO vegetariano ','',false).map(recipe=>recipe.id)).toEqual(['Arroz']);
 expect(filterRecipes(dishes,'rapido','vegetariano',false).map(recipe=>recipe.id)).toEqual(['Arroz']);
 expect(filterRecipes(dishes,'pasta','',false).map(recipe=>recipe.id)).toEqual(['Pasta']);
});
it('normaliza espacios, Unicode y duplicados sin imponer etiquetas predefinidas',()=>{
 expect(cleanTags(['  Rápido   y fácil ','VEGANO','vegano','Rápido y fácil'])).toEqual(['Rápido y fácil','VEGANO']);
 expect(validateTags([])).toBeNull();expect(validateTags(['🥕'.repeat(40)])).toBeNull();
 expect(validateTags(['x'.repeat(41)])).not.toBeNull();expect(validateTags(Array.from({length:21},(_,i)=>String(i)))).not.toBeNull();
});

it('limita el número y longitud de etiquetas contando caracteres Unicode',()=>{
 expect(validateTags(['🍅'.repeat(40)])).toBeNull();
 expect(validateTags(['🍅'.repeat(41)])).toContain('40');
 expect(validateTags(Array.from({length:21},(_,index)=>String(index)))).toContain('20');
 expect(validateTags(['   '])).toContain('40');
});
