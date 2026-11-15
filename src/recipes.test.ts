import { expect, it } from 'vitest';
import { emptyDraft, filterRecipes, validatePhoto, type Recipe } from './recipes';
const dish = (id:string,categories:Recipe['categories'],archived=false):Recipe=>({id,name:id,description:'',instructions:'Pasos',categories,photo_path:null,archived,revision:1,lines:[]});
it('busca sin distinguir mayúsculas y combina categoría y archivo',()=>{
 const dishes=[dish('Arroz',['lunch','dinner']),dish('Tostada',['breakfast']),dish('Arroz antiguo',['lunch'],true)];
 expect(filterRecipes(dishes,' ARROZ ','dinner',false).map(r=>r.id)).toEqual(['Arroz']);
 expect(filterRecipes(dishes,'arroz','',true).map(r=>r.id)).toEqual(['Arroz antiguo']);
 expect(filterRecipes(dishes,'arroz','breakfast',false)).toEqual([]);
});
it('valida tipo y tamaño de fotos antes de subirlas',()=>{
 expect(validatePhoto(new File(['x'],'x.svg',{type:'image/svg+xml'}))).toContain('JPEG');
 expect(validatePhoto(new File([new Uint8Array(5242881)],'x.png',{type:'image/png'}))).toContain('5 MB');
 expect(validatePhoto(new File(['x'],'x.webp',{type:'image/webp'}))).toBeNull();
});
it('cada borrador tiene sus propias listas',()=>{
 const a=emptyDraft(),b=emptyDraft();a.categories.push('dinner');a.lines.push({id:'x',ingredient_id:'y',alternatives:[]});
 expect(b.categories).toEqual(['lunch']);expect(b.lines).toEqual([]);
});
