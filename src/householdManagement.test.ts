import { beforeEach, expect, it, vi } from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn(),list:vi.fn(),remove:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{rpc:mock.rpc,storage:{from:()=>({list:mock.list,remove:mock.remove})}}}));
import { deleteHousehold, type House } from './householdManagement';
const house:House={id:'house',name:'Casa',owner_id:'owner',deletion_requested_at:null};
beforeEach(()=>{mock.rpc.mockResolvedValue({error:null});mock.list.mockResolvedValue({data:[],error:null});mock.remove.mockResolvedValue({error:null});});
it('elimina más de una página y carpetas anidadas usando exclusivamente Storage API',async()=>{
 const files=new Set(Array.from({length:205},(_,i)=>`house/${String(i).padStart(3,'0')}.jpg`));files.add('house/old/old.png');files.add('other/keep.jpg');
 mock.list.mockImplementation(async(prefix:string)=>{
  const found=new Map<string,{name:string;id:string|null}>();
  for(const path of files)if(path.startsWith(prefix+'/')){const [name,...rest]=path.slice(prefix.length+1).split('/');found.set(name,{name,id:rest.length?null:path});}
  return {data:[...found.values()].slice(0,100),error:null};
 });
 mock.remove.mockImplementation(async(paths:string[])=>{paths.forEach(p=>files.delete(p));return {error:null};});
 await deleteHousehold(house,'Casa');
 expect([...files]).toEqual(['other/keep.jpg']);
 expect(mock.rpc).toHaveBeenNthCalledWith(1,'begin_household_deletion',{p_house:'house',p_confirmation:'Casa'});
 expect(mock.rpc).toHaveBeenLastCalledWith('finish_household_deletion',{p_house:'house'});
 expect(mock.list).toHaveBeenCalledWith('house/old',expect.objectContaining({offset:0,limit:100}));
 expect(mock.remove.mock.calls.flatMap(call=>call[0]).every((path:string)=>path.startsWith('house/'))).toBe(true);
});
it('no toca archivos si el servidor rechaza el inicio',async()=>{
 mock.rpc.mockResolvedValueOnce({error:new Error('not owner')});
 await expect(deleteHousehold(house,'Casa')).rejects.toThrow();expect(mock.list).not.toHaveBeenCalled();expect(mock.remove).not.toHaveBeenCalled();
});
it('no finaliza si falla Storage y admite volver a intentar',async()=>{
 mock.list.mockResolvedValueOnce({data:[{id:'photo',name:'photo.jpg'}],error:null});
 mock.remove.mockResolvedValueOnce({error:new Error('temporary')});
 await expect(deleteHousehold(house,'Casa')).rejects.toThrow('temporary');
 expect(mock.rpc.mock.calls.some(call=>call[0]==='finish_household_deletion')).toBe(false);
 await deleteHousehold({...house,deletion_requested_at:'2026-11-16'},'Casa');
 expect(mock.rpc).toHaveBeenLastCalledWith('finish_household_deletion',{p_house:'house'});
});
it('no sale de la carpeta autorizada ni entra en un bucle si Storage no avanza',async()=>{
 mock.list.mockResolvedValueOnce({data:[{id:'bad',name:'../other.jpg'}],error:null});
 await expect(deleteHousehold(house,'Casa')).rejects.toThrow('Ruta');expect(mock.remove).not.toHaveBeenCalled();
 mock.list.mockResolvedValue({data:[{id:'photo',name:'photo.jpg'}],error:null});
 await expect(deleteHousehold(house,'Casa')).rejects.toThrow('avanzar');
 expect(mock.rpc.mock.calls.some(call=>call[0]==='finish_household_deletion')).toBe(false);
});
it('elimina más de una página de fotos y subcarpetas sin tocar otras casas',async()=>{
 const files=new Set<string>(Array.from({length:205},(_,n)=>`house/${String(n).padStart(3,'0')}.jpg`));
 files.add('house/old/photo.png');files.add('other/keep.jpg');
 mock.list.mockImplementation(async(prefix:string,{limit}:{limit:number})=>{
  const entries=new Map<string,{name:string;id:string|null}>();
  for(const path of files)if(path.startsWith(prefix+'/')){
   const relative=path.slice(prefix.length+1),name=relative.split('/')[0];
   entries.set(name,{name,id:relative.includes('/')?null:path});
  }
  return {data:[...entries.values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(0,limit),error:null};
 });
 mock.remove.mockImplementation(async(paths:string[])=>{paths.forEach(p=>files.delete(p));return {data:[],error:null};});
 await deleteHousehold(house,'Casa');
 expect([...files]).toEqual(['other/keep.jpg']);
 expect(mock.remove.mock.calls.every(call=>call[0].length<=100&&call[0].every((p:string)=>p.startsWith('house/')))).toBe(true);
 expect(mock.rpc).toHaveBeenLastCalledWith('finish_household_deletion',{p_house:'house'});
});
it('no intenta borrar fotos si el servidor rechaza la autorización inicial',async()=>{
 mock.rpc.mockResolvedValueOnce({error:new Error('denied')});
 await expect(deleteHousehold(house,'Casa')).rejects.toThrow('denied');expect(mock.list).not.toHaveBeenCalled();
});
