import { afterEach, expect, it } from 'vitest';
import { applyAppearance, clearAppearance, colors, themes, type Theme } from './preferences';
function luminance(hex:string) {
 const rgb=hex.slice(1).match(/../g)!.map(c=>parseInt(c,16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
function contrast(a:string,b:string){const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(values[0]+.05)/(values[1]+.05);}
afterEach(()=>{delete document.documentElement.dataset.theme;delete document.documentElement.dataset.mode;document.documentElement.removeAttribute('style');});
it('mantiene contraste de texto y botones en las doce combinaciones',()=>{
 for(const theme of Object.keys(themes) as Theme[])for(const mode of ['light','dark'] as const){
  const p=colors(theme,mode);
  for(const [fg,bg] of [[p.text,p.surface],[p.muted,p.surface],[p.muted,p.field],[p.onPrimary,p.primary],[p.accent,p.soft],[p.error,p.errorBg],[p.onDanger,p.danger]])expect(contrast(fg,bg),`${theme} ${mode}: ${fg}/${bg}`).toBeGreaterThanOrEqual(4.5);
 }
});
it('respeta el sistema salvo cuando se elige un modo explícito',()=>{
 applyAppearance({theme:'blue',mode:'system',avatar:null},true);expect(document.documentElement.dataset.mode).toBe('dark');
 applyAppearance({theme:'blue',mode:'light',avatar:null},true);expect(document.documentElement.dataset.mode).toBe('light');
 expect(document.documentElement.style.getPropertyValue('--primary')).toBe(colors('blue','light').primary);
});
