import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';

const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAX_IMAGE_BYTES=5*1024*1024;

function imageType(bytes:Uint8Array):string|null{
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}

export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to upload catalogue images.'},{status:401});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return new Response('Invalid origin',{status:403});
 if(!env.BUCKET)return Response.json({error:'Image storage is unavailable.'},{status:503});
 const headerBytes=Number(request.headers.get('content-length'));
 if(headerBytes>MAX_IMAGE_BYTES+100_000)return Response.json({error:'Image must be under 5 MB.'},{status:413});
 try{
  const data=await request.formData(),file=data.get('image');
  if(!(file instanceof File)||file.size<1||file.size>MAX_IMAGE_BYTES)return Response.json({error:'Choose an image under 5 MB.'},{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer()),contentType=imageType(bytes);
  if(!contentType||file.type!==contentType)return Response.json({error:'Use a PNG, JPEG or WebP image.'},{status:415});
  const id=crypto.randomUUID();
  await env.BUCKET.put('catalogue/'+user.userId+'/'+id,bytes,{httpMetadata:{contentType}});
  return Response.json({id,name:file.name.slice(0,120)});
 }catch{return Response.json({error:'Could not upload this image. Please try again.'},{status:500});}
}

export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return new Response('Sign in required',{status:401});
 const id=new URL(request.url).searchParams.get('id');
 if(!id||!idPattern.test(id))return new Response('Invalid image',{status:400});
 if(!env.BUCKET)return new Response('Image storage unavailable',{status:503});
 const image=await env.BUCKET.get('catalogue/'+user.userId+'/'+id);
 if(!image)return new Response('Image not found',{status:404});
 const headers=new Headers({'Content-Type':image.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'});
 return new Response(image.body,{headers});
}
