import type {Project,Unit,Component,Room,RoomOpening,PlacementArea,RoomWall} from './model';
import {uid,boxHeight} from './model.ts';
import {unitPlacements,unitLayoutBounds} from './unit-layout.ts';
import {doorLeaves,splitLengths,T} from './engine.ts';
export const roomWalls:RoomWall[]=['A','B','C','D'];
const E=1e-7;
export type FloorPoint={x:number,z:number};
export type RoomIssue={level:'error'|'warning',text:string,ids:string[]};
export const wallLength=(r:Room,w:RoomWall)=>w==='A'||w==='C'?r.l:r.w;
export const wallDepth=(r:Room,w:RoomWall)=>w==='A'||w==='C'?r.w:r.l;
export function wallPoint(r:Room,w:RoomWall,u:number,v=0):FloorPoint{return w==='A'?{x:u,z:v}:w==='B'?{x:r.l-v,z:u}:w==='C'?{x:r.l-u,z:r.w-v}:{x:v,z:r.w-u};}
export function wallCoordinates(r:Room,w:RoomWall,p:FloorPoint){return w==='A'?{u:p.x,v:p.z}:w==='B'?{u:p.z,v:r.l-p.x}:w==='C'?{u:r.l-p.x,v:r.w-p.z}:{u:r.w-p.z,v:p.x};}
export function areaCorners(r:Room,a:PlacementArea){return [wallPoint(r,a.wall,a.x),wallPoint(r,a.wall,a.x+a.w),wallPoint(r,a.wall,a.x+a.w,a.d),wallPoint(r,a.wall,a.x,a.d)];}
export function areaFootprint(r:Room,a:PlacementArea){const ps=areaCorners(r,a),x=Math.min(...ps.map(p=>p.x)),z=Math.min(...ps.map(p=>p.z));return {x,z,w:Math.max(...ps.map(p=>p.x))-x,d:Math.max(...ps.map(p=>p.z))-z};}
export const validRoom=(r:Room)=>[r.l,r.w,r.h].every(v=>Number.isFinite(v)&&v>0);
export function newRoom(index=1):Room{return {id:uid(),name:'Room '+index,l:0,w:0,h:0,openings:[],areas:[]};}
export function newRoomOpening(r:Room,wall:RoomWall,type:'door'|'window'):RoomOpening{
 const w=Math.min(type==='door'?36:48,wallLength(r,wall)),h=Math.min(type==='door'?84:48,r.h),bottom=type==='door'?0:Math.min(36,Math.max(0,r.h-h));
 return{id:uid(),name:(type==='door'?'Door ':'Window ')+(r.openings.filter(o=>o.type===type).length+1),type,wall,x:Math.max(0,(wallLength(r,wall)-w)/2),bottom,w,h,hinge:'left',swing:'in'};
}
export function newPlacementArea(r:Room,wall:RoomWall):PlacementArea{const w=Math.min(48,wallLength(r,wall));return {id:uid(),name:'Unit area '+(r.areas.length+1),wall,x:Math.max(0,(wallLength(r,wall)-w)/2),y:0,w,h:Math.min(94,r.h),d:Math.min(22,wallDepth(r,wall))};}
export function unitLocation(p:Project,id:string){for(const room of p.rooms||[]){const area=room.areas.find(a=>a.unitId===id);if(area)return {room,area};}return undefined;}
export function linkAreaUnit(p:Project,roomId:string,areaId:string,unitId?:string):Project{
 if(!p.rooms?.some(r=>r.id===roomId&&r.areas.some(a=>a.id===areaId))||unitId&&!p.units.some(u=>u.id===unitId))return p;
 return {...p,rooms:p.rooms.map(r=>({...r,areas:r.areas.map(a=>r.id===roomId&&a.id===areaId?{...a,unitId}:unitId&&a.unitId===unitId?{...a,unitId:undefined}:a)}))};
}
export function createUnitForArea(p:Project,roomId:string,areaId:string){const room=p.rooms?.find(r=>r.id===roomId),area=room?.areas.find(a=>a.id===areaId);if(!area)return {project:p,unit:undefined};const old=p.units.find(u=>u.id===area.unitId);if(old)return {project:p,unit:old};const unit:Unit={id:uid(),name:area.name,components:[]};return {project:linkAreaUnit({...p,units:[...p.units,unit]},roomId,areaId,unit.id),unit};}
export function removeRoom(p:Project,id:string):Project{return {...p,rooms:(p.rooms||[]).filter(r=>r.id!==id)};}
export function componentDepth(c:Component){
 if(c.kind==='Paneling')return Math.max(2*T,...c.layers.map(l=>2*T+(l.grid?T:l.border?8/25.4:0)+l.thickness/25.4));
 const d=c.kind==='Framing'?4:c.d;if(c.kind==='Closed Boxing')return d;
 const L=splitLengths(c.l,c.split)[0];return Math.max(d,...doorLeaves(c,L,boxHeight(c)).map(leaf=>leaf.placement==='overlay'?d+(leaf.type==='normal'?20/25.4:leaf.type==='profile'?.75:0):d));
}
export function unitEnvelope(u:Unit){const items=unitPlacements(u),valid=items.filter(i=>i.valid);if(!valid.length)return {w:0,h:0,d:0,measured:false};const bounds=unitLayoutBounds(valid);return {...bounds,d:Math.max(0,...valid.map(i=>componentDepth(i.component))),measured:valid.length===items.length};}
const overlap=(a:number,b:number,c:number,d:number)=>a<d-E&&b>c+E;
export function areaBlocksOpening(r:Room,a:PlacementArea,o:RoomOpening){const ps=areaCorners(r,a).map(p=>wallCoordinates(r,o.wall,p)),umin=Math.min(...ps.map(p=>p.u)),umax=Math.max(...ps.map(p=>p.u)),vmin=Math.min(...ps.map(p=>p.v)),vmax=Math.max(...ps.map(p=>p.v));return vmin<=E&&vmax>E&&overlap(umin,umax,o.x,o.x+o.w)&&overlap(a.y,a.y+a.h,o.bottom,o.bottom+o.h);}
export function areaBlocksDoorSwing(r:Room,a:PlacementArea,o:RoomOpening){
 if(o.type!=='door'||o.swing!=='in'||!overlap(a.y,a.y+a.h,0,o.h))return false;
 const hinge=o.x+(o.hinge==='right'?o.w:0),sign=o.hinge==='right'?-1:1,ps=areaCorners(r,a).map(p=>{const q=wallCoordinates(r,o.wall,p);return {u:(q.u-hinge)*sign,v:q.v};}),loU=Math.min(...ps.map(p=>p.u)),hiU=Math.max(...ps.map(p=>p.u)),loV=Math.min(...ps.map(p=>p.v)),hiV=Math.max(...ps.map(p=>p.v));
 return hiU>E&&hiV>E&&Math.max(0,loU)**2+Math.max(0,loV)**2<o.w**2-E;
}
export function areaIssues(p:Project,r:Room,a:PlacementArea):RoomIssue[]{
 const out:RoomIssue[]=[],add=(level:RoomIssue['level'],text:string,ids=[a.id])=>out.push({level,text:a.name+': '+text,ids});
 if(!roomWalls.includes(a.wall)||![a.x,a.y,a.w,a.h,a.d].every(Number.isFinite)||a.x<0||a.y<0||a.w<=0||a.h<=0||a.d<=0){add('error','enter positive width, height and depth, with non-negative offsets.');return out;}
 if(a.x+a.w>wallLength(r,a.wall)+E||a.y+a.h>r.h+E||a.d>wallDepth(r,a.wall)+E)add('error','placement area extends beyond the finished room dimensions.');
 const u=p.units.find(u=>u.id===a.unitId);if(a.unitId&&!u)add('warning','the linked unit is no longer available. Choose another unit.');if(u){const e=unitEnvelope(u);if(!e.measured)add('warning','the linked unit has components awaiting dimensions.');if(e.w>a.w+E||e.h>a.h+E||e.d>a.d+E)add('warning',u.name+' exceeds the allocated '+[e.w>a.w+E?'width':'',e.h>a.h+E?'height':'',e.d>a.d+E?'depth':''].filter(Boolean).join(', ')+'. Edit the area or the unit.');}
 for(const o of r.openings){if(areaBlocksOpening(r,a,o))add('warning','overlaps '+o.name+' on Wall '+o.wall+'.',[a.id,o.id]);else if(areaBlocksDoorSwing(r,a,o))add('warning','interferes with the inward swing of '+o.name+'.',[a.id,o.id]);}
 return out;
}
export function roomIssues(p:Project,r:Room):RoomIssue[]{
 const out:RoomIssue[]=[];if(!r.name.trim())out.push({level:'error',text:'Enter the room name.',ids:[]});if(!validRoom(r)){out.push({level:'error',text:'Enter positive finished room length, width and height.',ids:[]});return out;}
 for(const o of r.openings){if(!roomWalls.includes(o.wall)||![o.x,o.bottom,o.w,o.h].every(Number.isFinite)||o.w<=0||o.h<=0||o.x<0||o.bottom<0||o.x+o.w>wallLength(r,o.wall)+E||o.bottom+o.h>r.h+E||o.type==='door'&&o.bottom!==0)out.push({level:'error',text:o.name+': opening must fit within its wall; doors start at floor level.',ids:[o.id]});}
 for(let i=0;i<r.openings.length;i++)for(const b of r.openings.slice(i+1)){const a=r.openings[i];if(a.wall===b.wall&&overlap(a.x,a.x+a.w,b.x,b.x+b.w)&&overlap(a.bottom,a.bottom+a.h,b.bottom,b.bottom+b.h))out.push({level:'warning',text:a.name+' overlaps '+b.name+'.',ids:[a.id,b.id]});}
 for(const a of r.areas)out.push(...areaIssues(p,r,a));
 for(let i=0;i<r.areas.length;i++)for(const b of r.areas.slice(i+1)){const a=r.areas[i],aa=areaFootprint(r,a),bb=areaFootprint(r,b);if(overlap(aa.x,aa.x+aa.w,bb.x,bb.x+bb.w)&&overlap(aa.z,aa.z+aa.d,bb.z,bb.z+bb.d)&&overlap(a.y,a.y+a.h,b.y,b.y+b.h))out.push({level:'warning',text:a.name+' overlaps '+b.name+' in the room. Review the reserved spaces.',ids:[a.id,b.id]});}
 return out;
}
