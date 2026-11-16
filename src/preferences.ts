import { supabase } from './supabase';
export const themes={
 white:{label:'Blanco',swatch:'#e6ebe4',primary:'#2e5145',hover:'#244336',soft:'#edf2e7',dark:'#b1d4bc',darkHover:'#c6e2cf',darkSoft:'#2a3a30'},
 blue:{label:'Azul',swatch:'#769fda',primary:'#2457a6',hover:'#1b4689',soft:'#edf3ff',dark:'#a8c7ff',darkHover:'#c3d8ff',darkSoft:'#26364d'},
 red:{label:'Rojo',swatch:'#d78379',primary:'#963b34',hover:'#7d302b',soft:'#fceeea',dark:'#ffb5ac',darkHover:'#ffcdc6',darkSoft:'#452e2c'},
 pink:{label:'Rosa',swatch:'#d991b6',primary:'#913e6c',hover:'#773158',soft:'#fceef5',dark:'#f5b6d7',darkHover:'#ffd0e8',darkSoft:'#412e3a'},
 green:{label:'Verde',swatch:'#81ac81',primary:'#2e6445',hover:'#244f36',soft:'#edf6ed',dark:'#a4ddb1',darkHover:'#c0ebc8',darkSoft:'#293c30'},
 yellow:{label:'Amarillo',swatch:'#d4b650',primary:'#785700',hover:'#624700',soft:'#fff7d6',dark:'#ebd071',darkHover:'#f7e399',darkSoft:'#3c3825'},
} as const;
export type Theme=keyof typeof themes;
export type Preferences={theme:Theme;mode:'system'|'light'|'dark';avatar:string|null};
export const avatars=[['🍋','Limón'],['🥑','Aguacate'],['🍅','Tomate'],['🥕','Zanahoria'],['🍓','Fresa'],['🍊','Naranja'],['🍇','Uvas'],['🍍','Piña'],['🍉','Sandía'],['🍒','Cerezas'],['🥝','Kiwi'],['🌶️','Pimiento'],['🍞','Pan'],['🥐','Croissant'],['🍳','Huevo'],['🏠','Casa']] as const;
export const defaultPreferences=():Preferences=>({theme:'white',mode:'system',avatar:null});
export function colors(theme:Theme,mode:'light'|'dark') {
 const p=themes[theme];
 return mode==='dark'?{
  bg:'#131a16',surface:'#1d2720',field:'#18211b',soft:p.darkSoft,text:'#e5eee8',muted:'#b6c5ba',line:'#3b4f41',border:'#7d9682',primary:p.dark,hover:p.darkHover,onPrimary:'#14251b',accent:p.dark,focus:p.dark,error:'#ffb4a9',errorBg:'#3b2624',errorBorder:'#a8665c',danger:'#efb0a6',dangerHover:'#ffc5bb',onDanger:'#331612',shadow:'#00000055',warning:'#dfc46e',success:'#9ed1a2',
 }:{
  bg:'#f4f5f0',surface:'#ffffff',field:'#fafbf8',soft:p.soft,text:'#253d33',muted:'#526557',line:'#dfe6d9',border:'#899982',primary:p.primary,hover:p.hover,onPrimary:'#ffffff',accent:p.primary,focus:p.primary,error:'#91362d',errorBg:'#fcf0ed',errorBorder:'#c09086',danger:'#9c3f35',dangerHover:'#80352d',onDanger:'#ffffff',shadow:'#30473735',warning:'#806716',success:'#416b46',
 };
}
export function applyAppearance(preferences:Preferences,systemDark:boolean) {
 const mode=preferences.mode==='system'?(systemDark?'dark':'light'):preferences.mode;
 const root=document.documentElement;
 root.dataset.theme=preferences.theme;root.dataset.mode=mode;root.style.colorScheme=mode;
 const palette=colors(preferences.theme,mode);
 Object.entries(palette).forEach(([key,value])=>root.style.setProperty('--'+key,value));
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',palette.bg);
}
export function clearAppearance() {
 const root=document.documentElement;delete root.dataset.theme;delete root.dataset.mode;
 for(const key of Object.keys(colors('white','light')))root.style.removeProperty('--'+key);
 root.style.removeProperty('color-scheme');
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',colors('white',window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light').bg);
}
function client(){if(!supabase)throw new Error('Supabase no configurado');return supabase;}
export async function loadPreferences(userId:string):Promise<Preferences> {
 const result=await client().from('user_preferences').select('theme,mode,avatar').eq('user_id',userId).maybeSingle();
 if(result.error)throw result.error;return result.data||defaultPreferences();
}
export async function savePreferences(userId:string,preferences:Preferences):Promise<Preferences> {
 const result=await client().from('user_preferences').upsert({user_id:userId,...preferences},{onConflict:'user_id'}).select('theme,mode,avatar').single();
 if(result.error)throw result.error;return result.data;
}
