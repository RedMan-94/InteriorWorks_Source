import type {ExternalFinish,Project} from './model';
const colours=['#f3f0e6','#b9956d','#7e8279','#303631','#d5c6ad','#8c6249','#b8c2ac','#727f89','#c4a1a0','#dac798'];
/** Add the requested starter options once, preserving custom finishes and later edits/deletions. */
export function withStarterLaminates(project:Project):Project{
 if(project.laminateOptionsVersion===1)return project;
 const finishes:ExternalFinish[]=[...(project.externalFinishes||[])];
 for(let i=1;i<=10;i++){
 const name='Laminate '+i;if(finishes.some(f=>f.name.trim().toLowerCase()===name.toLowerCase()))continue;
 let id='starter-laminate-'+i,code='LAM-'+i,n=1;while(finishes.some(f=>f.id===id))id='starter-laminate-'+i+'-'+(++n);
 n=1;while(finishes.some(f=>f.code.trim().toUpperCase()===code.toUpperCase()))code='LAM-'+i+'-'+(++n);
 finishes.push({id,code,name,color:colours[i-1],grain:'free',sheetGrain:'length'});
 }
 return {...project,externalFinishes:finishes,laminateOptionsVersion:1};
}
