import {patternErrors} from './laminate-patterns.ts';
import {inactiveLegCoverFace} from './leg-covers.ts';
import type {Component,ExternalFinish,FaceFinish} from './model';
export type FinishRect={x:number,y:number,w:number,h:number};
export type FinishFace={key:string,label:string,w:number,h:number,external:boolean,unitId:string,componentId:string,regions:FinishRect[]};
export const finishName=(f:ExternalFinish)=>f.code.trim()+' — '+f.name.trim();
export function subtractFinish(a:FinishRect,b:FinishRect):FinishRect[]{
 const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),r=Math.min(a.x+a.w,b.x+b.w),t=Math.min(a.y+a.h,b.y+b.h);if(r<=x||t<=y)return[a];const out:FinishRect[]=[];
 if(x>a.x)out.push({x:a.x,y:a.y,w:x-a.x,h:a.h});if(r<a.x+a.w)out.push({x:r,y:a.y,w:a.x+a.w-r,h:a.h});if(y>a.y)out.push({x,y:a.y,w:r-x,h:y-a.y});if(t<a.y+a.h)out.push({x,y:t,w:r-x,h:a.y+a.h-t});return out;
}
export function finishLibraryErrors(finishes:ExternalFinish[]){const errors:string[]=[],codes=new Set<string>(),ids=new Set<string>();for(const f of finishes){
 if(!f.id||ids.has(f.id))errors.push('Each laminate finish needs a unique ID.');ids.add(f.id);
 const code=f.code.trim().toUpperCase();if(!code||!f.name.trim())errors.push('Enter a code and name for every laminate finish.');if(codes.has(code))errors.push('Laminate code '+f.code+' is repeated. Use one library entry per finish.');codes.add(code);
 if(!['free','length','height'].includes(f.grain)||!['length','width'].includes(f.sheetGrain))errors.push('Choose a valid grain direction for '+f.code+'.');
 }return errors;}
export function faceFinishErrors(a:FaceFinish|undefined,w:number,h:number,finishes:ExternalFinish[]){
 if(!a)return[];const errors:string[]=a.pattern?patternErrors(a.pattern,w,h,finishes):[],has=(id:string)=>finishes.some(f=>f.id===id),zones=a.zones||[];
 if(a.finishId&&!has(a.finishId))errors.push('The selected base laminate was removed from the library.');
 if(zones.length>100)errors.push('Use at most 100 finish areas on one face.');
 if(a.pattern&&zones.length)errors.push('Use either a pattern or custom finish areas on a face.');
 const ids=new Set<string>();for(const z of zones){if(!z.id||ids.has(z.id))errors.push('Each finish area needs a unique ID.');ids.add(z.id);
 if(!has(z.finishId))errors.push('Choose a library finish for each area.');
 if(![z.x,z.y,z.w,z.h].every(Number.isFinite)||z.x<0||z.y<0||z.w<=0||z.h<=0||z.x+z.w>w+1e-7||z.y+z.h>h+1e-7)errors.push('Finish areas must have positive dimensions and remain inside the selected face.');
 }for(let i=0;i<zones.length;i++)for(const b of zones.slice(i+1)){const a=zones[i];if(a.x<b.x+b.w-1e-7&&a.x+a.w>b.x+1e-7&&a.y<b.y+b.h-1e-7&&a.y+a.h>b.y+1e-7)errors.push('Finish areas overlap. Join their edges or move them apart.');}
 return [...new Set(errors)];
}
export function finishRegions(a:FaceFinish|undefined,w:number,h:number){
 const zones=a?.zones||[];let base:FinishRect[]=[{x:0,y:0,w,h}];for(const z of zones)base=base.flatMap(b=>subtractFinish(b,z));
 return [...base.map(b=>({...b,finishId:a?.finishId,zoneIndex:undefined as number|undefined})),...zones.map((z,zoneIndex)=>({x:z.x,y:z.y,w:z.w,h:z.h,finishId:z.finishId,zoneIndex}))];
}
export function finishInUse(components:Component[],id:string){return components.some(c=>c.defaultExternalFinishId===id||Object.values(c.faceFinishes||{}).some(a=>a.finishId===id||a.zones?.some(z=>z.finishId===id)||Object.values(a.pattern?.finishes||{}).includes(id)));}

export function finishFaceTitle(face:Pick<FinishFace,'key'|'label'>){
 const label=face.label.replace(/ · face [12]$/,'').replace(/ · part \d+/,'').replace(/ visible front \d+$/,' · front');
 if(face.key.endsWith(':inside'))return label+' · inside';if(face.key.endsWith(':outside'))return label+' · outside';
 if(face.key.startsWith('leg-cover:'))return label+(face.key.endsWith(':b')?' · outside':' · inside');
 if(/^(door|sliding):/.test(face.key)||/^drawer:.+:front:\d+:[ab]$/.test(face.key))return label+(face.key.endsWith(':b')?' · outside/front':' · inside/rear');
 return label+(face.key.endsWith(':a')?' · face 1':face.key.endsWith(':b')?' · face 2':'');
}
