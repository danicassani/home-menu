import type { Area } from 'react-easy-crop';
export async function cropPhoto(source:string,area:Area):Promise<File>{
 const image=new Image();image.crossOrigin='anonymous';image.src=source;
 await image.decode();
 if(![area.x,area.y,area.width,area.height].every(Number.isFinite)||area.x<0||area.y<0||area.width<=0||area.height<=0||area.x+area.width>image.naturalWidth+1||area.y+area.height>image.naturalHeight+1)throw new Error('Encuadre inválido');
 const scale=Math.min(1,1600/area.width,1200/area.height);
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(area.width*scale));canvas.height=Math.max(1,Math.round(area.height*scale));
 const context=canvas.getContext('2d');if(!context)throw new Error('No se puede preparar la imagen');
 context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
 context.drawImage(image,area.x,area.y,area.width,area.height,0,0,canvas.width,canvas.height);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('No se puede preparar la imagen')),'image/jpeg',0.9));
 if(blob.size>5*1024*1024)throw new Error('La foto no puede superar 5 MB.');
 return new File([blob],'plato.jpg',{type:'image/jpeg'});
}
