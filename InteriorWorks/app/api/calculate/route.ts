import { getChatGPTUser } from '../../chatgpt-auth';
import { calculate } from '../../lib/engine';
export async function POST(request:Request){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:'Sign in to calculate your saved projects.'},{status:401});
 try{const raw=await request.text();if(raw.length>1500000)return new Response('Project too large',{status:413});const {project,unitId}=JSON.parse(raw);
 if(!project||!Array.isArray(project.units)||project.units.length>100)return new Response('Invalid project',{status:400});
 return Response.json(calculate(project,unitId));
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Calculation could not complete.'},{status:400});}
}
