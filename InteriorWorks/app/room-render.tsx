'use client';
import {useState} from 'react';
import {Map,RotateCw} from 'lucide-react';
import type {Project,Room,RoomWall} from './lib/model';
import {boxHeight,fmt,legHeight} from './lib/model';
import {splitLengths} from './lib/engine';
import {componentDepth,roomWalls,validRoom,wallLength,wallPoint} from './lib/rooms';
import {unitDrawingOrder,unitPlacements} from './lib/unit-layout';
import {UnitContextDrawing} from './unit-context';
import {FinishSurface} from './finish-editor';

const walls=roomWalls;
type Vec={x:number,y:number,z:number};
type Point={x:number,y:number,depth:number};
const coordinates=(points:Point[])=>points.map(p=>p.x+','+p.y).join(' ');
const transform=(a:Point,b:Point,c:Point)=>`matrix(${b.x-a.x} ${b.y-a.y} ${c.x-a.x} ${c.y-a.y} ${a.x} ${a.y})`;

export function RoomRender({project,activeRoomId,onSelectRoom}:{project:Project,activeRoomId:string,onSelectRoom:(id:string)=>void}){
 const rooms=(project.rooms||[]).filter(validRoom),r=rooms.find(r=>r.id===activeRoomId)||rooms[0];
 const [angle,setAngle]=useState(0),[view,setView]=useState<'iso'|RoomWall>('iso');
 if(!r)return null;
 const placements=r.areas.flatMap(area=>{
  const unit=project.units.find(u=>u.id===area.unitId);
  return unit?[{area,unit,items:unitDrawingOrder(unitPlacements(unit),unit.layerOrder).filter(i=>i.valid)}]:[];
 });
 return <div className="room-render-page"><div className="page-heading"><div><p className="eyebrow">PROJECT WORKFLOW · ROOM RENDERING</p><h1>Preview your rooms</h1><p className="muted">See placed units and laminate colours together in a measured room view.</p></div>{view==='iso'&&<button className="button" onClick={()=>setAngle((angle+1)%4)}><RotateCw size={16}/> Rotate view</button>}</div>
 <div className="room-tabs" aria-label="Rooms to preview">{rooms.map(a=><button key={a.id} className={'room-tab '+(a.id===r.id?'selected':'')} onClick={()=>{onSelectRoom(a.id);setView('iso');}}><Map size={16}/><span>{a.name}<small>{fmt(a.l)} × {fmt(a.w)} × {fmt(a.h)}</small></span></button>)}</div>
 <section className="white-card render-card"><div className="card-title"><div><h2>{r.name}</h2><p>{placements.length} placed unit{placements.length===1?'':'s'}</p></div></div><div className="room-view-controls"><button className={view==='iso'?'selected':''} onClick={()=>setView('iso')}>3D room view</button>{walls.map(w=><button key={w} className={view===w?'selected':''} onClick={()=>setView(w)}>Wall {w}</button>)}</div>
 {view==='iso'?<Axonometric project={project} room={r} angle={angle}/>:<svg className="room-render-svg" role="img" aria-label={r.name+' finished Wall '+view+' elevation'} viewBox={[-10,-10,wallLength(r,view)+20,r.h+20].join(' ')}><rect width={wallLength(r,view)} height={r.h} fill="#edece3" stroke="#9da793" strokeWidth=".3"/>{r.openings.filter(o=>o.wall===view).map(o=><rect key={o.id} x={o.x} y={r.h-o.bottom-o.h} width={o.w} height={o.h} fill={o.type==='window'?'#d0e5e6':'#fafbf7'} stroke="#a8b2a3" strokeWidth=".3"><title>{o.name}</title></rect>)}{placements.filter(({area})=>area.wall===view).map(({unit,area,items})=><g key={area.id} aria-label={unit.name}><title>{unit.name}</title>{items.map(i=><g key={i.id} transform={`translate(${area.x+i.x} ${r.h-area.y-i.y-i.h})`}><UnitContextDrawing c={i.component} doors finishes={project.externalFinishes}/></g>)}</g>)}</svg>}
 <p className="field-note">Colours are laminate swatches. Use the wall views to inspect each unit’s front. This is a measured preview.</p></section>
 </div>;
}

function Axonometric({project,room:r,angle}:{project:Project,room:Room,angle:number}){
 const signs=[[1,1],[-1,1],[-1,-1],[1,-1]][angle],sx=signs[0],sz=signs[1];
 const projectPoint=({x,y,z}:Vec):Point=>({x:.866*(sx*x-sz*z),y:.5*(sx*x+sz*z)-y,depth:sx*x+sz*z+y*.7});
 const point=(w:RoomWall,u:number,y=0,d=0)=>projectPoint({...wallPoint(r,w,u,d),y});
 const frontVisible=(w:RoomWall)=>{const a=point(w,0),b=point(w,0,0,1);return b.depth>a.depth;};
 const face=(w:RoomWall,x:number,y:number,width:number,height:number,d=0)=>[point(w,x,y,d),point(w,x+width,y,d),point(w,x+width,y+height,d),point(w,x,y+height,d)];
 const corners=[[0,0],[r.l,0],[r.l,r.w],[0,r.w]].map(([x,z])=>projectPoint({x,y:0,z}));
 const extent=[...corners,...corners.map(p=>({...p,y:p.y-r.h}))],pad=Math.max(r.l,r.w,r.h)*.08+4;
 const left=Math.min(...extent.map(p=>p.x))-pad,top=Math.min(...extent.map(p=>p.y))-pad,right=Math.max(...extent.map(p=>p.x))+pad,bottom=Math.max(...extent.map(p=>p.y))+pad;
 const solids=r.areas.flatMap(area=>{
  const u=project.units.find(u=>u.id===area.unitId);
  return u?unitDrawingOrder(unitPlacements(u),u.layerOrder).filter(i=>i.valid).map(i=>{
   const x=area.x+i.x,y=area.y+i.y,d=componentDepth(i.component),w=area.wall;
   return {i,area,u,x,y,d,w,depth:point(w,x+i.w/2,y+i.h/2,d/2).depth};
  }):[];
 }).sort((a,b)=>a.depth-b.depth);
 return <svg className="room-render-svg" role="img" aria-label={r.name+' 3D cutaway with placed units'} viewBox={[left,top,right-left,bottom-top].join(' ')}>
 <polygon points={coordinates(corners)} fill="#e5dccb" stroke="#9ba28f" strokeWidth=".45"/>
 {walls.filter(frontVisible).map(w=>{
  const width=wallLength(r,w),openings=r.openings.filter(o=>o.wall===w);
  const path=(p:Point[])=>'M'+p.map(q=>q.x+' '+q.y).join('L')+'Z';
  return <g key={w}><path d={path(face(w,0,0,width,r.h))+openings.map(o=>path(face(w,o.x,o.bottom,o.w,o.h))).join('')} fillRule="evenodd" fill={w==='A'||w==='C'?'#eeeae0':'#e1e5db'} stroke="#a7ae9f" strokeWidth=".45"/>{openings.filter(o=>o.type==='window').map(o=><polygon key={o.id} points={coordinates(face(w,o.x,o.bottom,o.w,o.h))} fill="#d0e6e7" stroke="#a1bcbf" strokeWidth=".5"><title>{o.name}</title></polygon>)}</g>;
 })}
 {solids.map(({i,area,u,x,y,d,w})=>{
  const front=frontVisible(w),v=front?d:0,a=point(w,x,y+i.h,v),b=point(w,x+1,y+i.h,v),rightSide=point(w,x+i.w,y).depth>point(w,x,y).depth,side=rightSide?x+i.w:x;
  const c=i.component,bodyH=boxHeight(c),legs=legHeight(c),sideName=rightSide?'Right':'Left',shelf=c.kind==='Boxing',closed=c.kind==='Closed Boxing',hasBoardSides=shelf||closed,depth=hasBoardSides?c.d:d,lengths=shelf?splitLengths(c.l,c.split):[i.w],prefix=(j:number)=>lengths.length>1?'Box '+(j+1)+' / ':'',sideKey=prefix(rightSide?lengths.length-1:0)+sideName+(closed?':a':':outside');
  const finishes=project.externalFinishes||[],sideOrigin=point(w,side,y+i.h);
  const surface=(key:string,width:number,height:number,external:boolean,base:string,a:Point,b:Point,c0:Point)=><g transform={transform(a,b,c0)}><rect width={width} height={height} fill={base} stroke="#6d7c65" strokeWidth=".35"/><FinishSurface c={c} finishes={finishes} faceKey={key} w={width} h={height} external={external}/></g>;
  return <g key={area.id+i.id}><title>{u.name+' · '+c.name+' · Wall '+w}</title>
  {lengths.map((width,j)=>{const start=x+lengths.slice(0,j).reduce((a,b)=>a+b,0),key=prefix(j)+'Top'+(closed?':a':':outside');return <g key={j}>{surface(key,width,depth,closed||c.external.includes(key),'#b4bea7',point(w,start,y+i.h),point(w,start+1,y+i.h),point(w,start,y+i.h,1))}</g>;})}
  {surface(sideKey,depth,bodyH,closed||c.external.includes(sideKey),'#a9b49e',sideOrigin,point(w,side,y+i.h,1),point(w,side,y+i.h-1))}
  {legs>0&&<polygon points={coordinates([point(w,side,y),point(w,side,y,depth),point(w,side,y+legs,depth),point(w,side,y+legs)])} fill="#a9b49e" opacity=".35"/>}
  {front?<g transform={transform(a,b,point(w,x,y+i.h-1,v))}><UnitContextDrawing c={c} doors finishes={finishes}/></g>:lengths.map((width,j)=>{const start=x+lengths.slice(0,j).reduce((a,b)=>a+b,0),key=prefix(j)+'Back'+(closed?':a':':outside');return <g key={j}>{surface(key,width,bodyH,closed||c.external.includes(key),'#c9cdbd',point(w,start,y+i.h),point(w,start+1,y+i.h),point(w,start,y+i.h-1))}</g>;})}</g>;
 })}
 </svg>;
}
