import type {CatalogueUnit,ExternalFinish,Project,Unit} from './model';
import {copyUnit} from './model.ts';
import {finishInUse} from './finishes.ts';
import {linkAreaUnit,unitEnvelope} from './rooms.ts';
import {adaptUnitToArea} from './adaptive-placement.ts';
import {calculate} from './engine.ts';

export function catalogueEntry(unit:Unit,finishes:ExternalFinish[],copy=false):CatalogueUnit{
 const design=copy?copyUnit(unit):structuredClone(unit);
 design.name=unit.name.trim();
 delete design.catalogueId;
 return {unit:design,finishes:structuredClone(finishes.filter(f=>finishInUse(design.components,f.id)))};
}

export function placeCatalogueUnit(project:Project,roomId:string,areaId:string,entry:CatalogueUnit,options:{resize?:boolean}={}){
 const area=project.rooms?.find(r=>r.id===roomId)?.areas.find(a=>a.id===areaId);
 if(!area)return {error:'Select a placement area first.'};
 if(!unitEnvelope(entry.unit).measured)return {error:'Finish the unit dimensions in the catalogue before placing it.'};
 if(project.units.length>=100)return {error:'This project already has 100 units. Link an existing project unit or use another project.'};
 const finishes=[...(project.externalFinishes||[])],ids=new Map<string,string>();
 for(const f of entry.finishes){
  const code=f.code.trim().toUpperCase(),same=finishes.find(g=>g.code.trim().toUpperCase()===code);
  if(same){
   if(same.grain!==f.grain||(same.grain!=='free'&&same.sheetGrain!==f.sheetGrain))return {error:'Laminate '+f.code+' has different grain settings in this project. Match them in the project laminate library before placing this design.'};
   ids.set(f.id,same.id);
  }else{
   let id=f.id,n=1;while(finishes.some(g=>g.id===id))id=f.id+'-copy-'+n++;
   finishes.push({...f,id});ids.set(f.id,id);
  }
 }
 const unit=copyUnit(entry.unit),base=entry.unit.name;
 unit.name=base;unit.catalogueId=entry.unit.id;
 for(let n=2;project.units.some(u=>u.name===unit.name);n++)unit.name=base+' '+n;
 const mapped=(id:string|undefined)=>id?(ids.get(id)||id):undefined;
 for(const c of unit.components){
  c.defaultExternalFinishId=mapped(c.defaultExternalFinishId);
  for(const face of Object.values(c.faceFinishes||{})){
   face.finishId=mapped(face.finishId);
   for(const z of face.zones||[])z.finishId=mapped(z.finishId)!;
   if(face.pattern)face.pattern.finishes=Object.fromEntries(Object.entries(face.pattern.finishes).map(([region,id])=>[region,mapped(id)||'']));
  }
 }
 const adapted=options.resize===false?{unit,notes:[]}:adaptUnitToArea(unit,area);
 if(!adapted.unit)return {error:adapted.error};
 const result=calculate({...project,rooms:[],units:[adapted.unit],externalFinishes:finishes},undefined,{ignoreFaceAssignments:true});
 if(options.resize!==false&&result.errors.length)return {error:'This design cannot be resized within the existing construction rules: '+result.errors.slice(0,2).join(' ')};
 return {project:linkAreaUnit({...project,units:[...project.units,adapted.unit],externalFinishes:finishes},roomId,areaId,adapted.unit.id),unit:adapted.unit,notes:adapted.notes};
}

/** Rooms determine which copies are in scope. Older unit-only projects still calculate as before. */
export function workflowUnits(project:Project){
 if(!project.rooms?.length)return project.units.filter(u=>!u.catalogueId);
 const ids=new Set(project.rooms.flatMap(r=>r.areas.map(a=>a.unitId)));
 return project.units.filter(u=>ids.has(u.id));
}

export function placementCount(project:Project){
 if(!project.rooms?.length)return 0;
 return workflowUnits(project).length;
}
