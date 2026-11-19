// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { createPublicationHandler } from '../supabase/functions/catalog-publication/handler';
import type { createClient } from '@supabase/supabase-js';
const house='00000000-0000-0000-0000-000000000010',path=house+'/00000000-0000-0000-0000-000000000030.jpg';
const user={auth:{getUser:vi.fn()},from:vi.fn(),storage:{from:vi.fn()},rpc:vi.fn()};
const admin={storage:{from:vi.fn()},rpc:vi.fn()};
const download=vi.fn(),upload=vi.fn(),remove=vi.fn(),existing=vi.fn();
const factory=vi.fn((_url:string,key:string)=>key==='service-secret'?admin:user);
const handler=createPublicationHandler(factory as unknown as typeof createClient,{url:'https://fixture.supabase.co',anon:'public-key',key:'service-secret'});
const request=(body:unknown,token='user-token')=>new Request('https://fixture.example/functions/v1/catalog-publication',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{
 vi.clearAllMocks();user.auth.getUser.mockResolvedValue({data:{user:{id:'user'}},error:null});
 user.from.mockReturnValue({select:()=>({eq:()=>({single:async()=>({data:{id:'recipe',household_id:house,photo_path:path,catalog_imported:false},error:null})})})});
 user.storage.from.mockReturnValue({download});admin.storage.from.mockReturnValue({upload,download:existing,remove});
 download.mockResolvedValue({data:new Blob(['image'],{type:'image/jpeg'}),error:null});upload.mockResolvedValue({error:null});remove.mockResolvedValue({error:null});
 user.rpc.mockResolvedValue({data:'publication',error:null});admin.rpc.mockResolvedValue({data:[],error:null});
});
it('rechaza sesiones inválidas antes de tocar Storage o usar privilegios',async()=>{
 user.auth.getUser.mockResolvedValue({data:{user:null},error:new Error('expired')});
 expect((await handler(request({action:'publish',recipe:'recipe',revision:1}))).status).toBe(401);expect(upload).not.toHaveBeenCalled();expect(admin.rpc).not.toHaveBeenCalled();
});
it('copia la foto con permisos de lectura del usuario y confirma la publicación con su JWT',async()=>{
 expect((await handler(request({action:'publish',recipe:'recipe',revision:1}))).status).toBe(200);
 expect(download).toHaveBeenCalledExactlyOnceWith(path);expect(upload).toHaveBeenCalledWith(path,expect.any(Blob),expect.objectContaining({upsert:false}));expect(user.rpc).toHaveBeenCalledWith('publish_recipe',{p_recipe:'recipe',p_revision:1});
});
it('un fallo de Storage no publica ni cambia la receta',async()=>{
 download.mockResolvedValue({data:null,error:new Error('offline')});expect((await handler(request({action:'publish',recipe:'recipe',revision:1}))).status).toBe(400);expect(user.rpc).not.toHaveBeenCalled();
});
it('no acepta rutas de otras casas en un guardado',async()=>{
 expect((await handler(request({action:'save',recipe:'recipe',revision:1,draft:{photo_path:'otra-casa/foto.jpg'}}))).status).toBe(400);expect(download).not.toHaveBeenCalled();
});
it('un reintento solo reutiliza el archivo preparado si sus bytes coinciden',async()=>{
 upload.mockResolvedValue({error:new Error('exists')});existing.mockResolvedValue({data:new Blob(['image']),error:null});expect((await handler(request({action:'publish',recipe:'recipe',revision:1}))).status).toBe(200);
 existing.mockResolvedValue({data:new Blob(['different']),error:null});expect((await handler(request({action:'publish',recipe:'recipe',revision:1}))).status).toBe(400);
});
it('la limpieza exige administrador y confirma cada lote después de Storage API',async()=>{
 user.rpc.mockResolvedValue({data:false,error:null});expect((await handler(request({action:'cleanup'}))).status).toBe(403);expect(remove).not.toHaveBeenCalled();
 user.rpc.mockResolvedValue({data:true,error:null});admin.rpc.mockResolvedValueOnce({data:[{name:path}],error:null}).mockResolvedValueOnce({data:null,error:null});
 expect((await handler(request({action:'cleanup'}))).status).toBe(200);expect(remove).toHaveBeenCalledWith([path]);expect(admin.rpc).toHaveBeenLastCalledWith('catalog_finish_photo_gc',{p_names:[path]});
});
it('un fallo al borrar fotos mantiene la reclamación para poder reintentar',async()=>{
 user.rpc.mockResolvedValue({data:true,error:null});admin.rpc.mockResolvedValue({data:[{name:path}],error:null});remove.mockResolvedValueOnce({error:new Error('storage offline')});
 expect((await handler(request({action:'cleanup'}))).status).toBe(400);expect(admin.rpc).not.toHaveBeenCalledWith('catalog_finish_photo_gc',expect.anything());
});
it('la credencial de servidor sirve para limpieza programada, nunca como sesión de edición',async()=>{
 user.auth.getUser.mockResolvedValue({data:{user:null},error:new Error('not a user')});
 expect((await handler(request({action:'cleanup'},'service-secret'))).status).toBe(200);
 expect((await handler(request({action:'publish',recipe:'recipe',revision:1},'service-secret'))).status).toBe(401);
});
