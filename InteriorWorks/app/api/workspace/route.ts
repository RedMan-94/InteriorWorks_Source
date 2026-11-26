import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { workspaces } from '../../../db/schema';
import { and, eq } from 'drizzle-orm';
export async function GET(){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:'Sign in to save and reopen your projects.'},{status:401});
 try{const [row]=await getDb().select().from(workspaces).where(eq(workspaces.owner,user.userId));
 return Response.json({workspace:row?JSON.parse(row.data):null,revision:row?.revision??0,name:user.displayName});
 }catch{return Response.json({error:'Project storage is temporarily unavailable. Your open work is still on screen.'},{status:503});}
}
export async function PUT(request:Request){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:'Sign in to save your projects.'},{status:401});
 if(request.headers.get('origin')&&new URL(request.url).origin!==request.headers.get('origin'))return new Response('Invalid origin',{status:403});
 try{
 const raw=await request.text();if(raw.length>1500000)return Response.json({error:'Project workspace is too large.'},{status:413});
 const {workspace,revision}=JSON.parse(raw);
 if(!workspace||!Array.isArray(workspace.projects)||workspace.projects.length>100||!Number.isInteger(revision))return Response.json({error:'Invalid project data.'},{status:400});
 const db=getDb(), now=new Date().toISOString();
 const [existing]=await db.select().from(workspaces).where(eq(workspaces.owner,user.userId));
 if(existing){
 const updated=await db.update(workspaces).set({data:JSON.stringify(workspace),revision:revision+1,updatedAt:now}).where(and(eq(workspaces.owner,user.userId),eq(workspaces.revision,revision))).returning({revision:workspaces.revision});
 if(!updated.length)return Response.json({error:'This workspace changed in another window. Export your current project before reloading.'},{status:409});
 }else{
 if(revision!==0)return Response.json({error:'Workspace changed. Reload before saving.'},{status:409});
 await db.insert(workspaces).values({owner:user.userId,data:JSON.stringify(workspace),revision:1,updatedAt:now});
 }
 return Response.json({revision:revision+1,savedAt:now});
 }catch{return Response.json({error:'Could not save. Keep this window open and try again, or export a backup.'},{status:500});}
}
