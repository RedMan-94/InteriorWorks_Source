'use client';
import {useMemo} from 'react';
import type {Component,ExternalFinish,Unit} from './lib/model';
import {boxHeight,legHeight} from './lib/model';
import {T,calculate,doorLeaves,handleGeometry,splitLengths} from './lib/engine';
import type {BoardPose,Piece} from './lib/engine';
import {unitDrawingOrder,unitPlacements} from './lib/unit-layout';

type Point={x:number,y:number};
type Face={points:Point[],fill:string,depth:number,order:number};
type Detail={a:Point,b:Point,color:string,width:number};
type Surface='front'|'top'|'right';

// The three axes have equal foreshortening, viewed from above the front-right.
export const projectIsometric=(x:number,y:number,z:number):Point=>({x:Math.sqrt(3)/2*(x-z),y:(x+z)/2-y});
const depth=(p:BoardPose)=>p.x+p.w/2+p.y+p.h/2+p.z+p.d/2;
const assigned=(c:Component,key:string)=>{const a=c.faceFinishes?.[key];return !!(a?.finishId||a?.zones?.length||a?.pattern);};

function outsideSurface(c:Component,p:Piece,selected:Set<string>):{key:string,side:Surface}|null{
 const key=p.panelKey||'',label=p.label.replace(/^Box \d+ \/ /,'').replace(/ · part \d+$/,'');
 const has=(face:string)=>selected.has(face)||assigned(c,face);
 if(c.kind==='Paneling'&&/^layer:.+:facing:\d+$/.test(key)){
  const face=key.replace(/:facing:\d+$/,':front');return has(face)?{key:face,side:'front'}:null;
 }
 if(c.kind==='Closed Boxing'){
  if(label==='Front'&&has('Front:a'))return {key:'Front:a',side:'front'};
  if(label==='Top'&&has('Top:a'))return {key:'Top:a',side:'top'};
  if(label==='Right'&&has('Right:a'))return {key:'Right:a',side:'right'};
  return null;
 }
 if(/^(door|sliding):/.test(key)||/^drawer:.+:front:\d+$/.test(key))return has(key+':b')?{key:key+':b',side:'front'}:null;
 if(key.startsWith('leg-cover:')){
  const side=key.split(':')[2];return has(key+':b')&&side==='front'?{key:key+':b',side:'front'}:has(key+':b')&&side==='right'?{key:key+':b',side:'right'}:null;
 }
 // The camera sees the outer top and right side. Inside, back, mid-support and
 // shelf faces are omitted even if separately marked for laminate.
 if(label==='Top'&&has(p.label+':outside'))return {key:p.label+':outside',side:'top'};
 if(label==='Right'&&has(p.label+':outside'))return {key:p.label+':outside',side:'right'};
 return null;
}

function surfaceFace(p:BoardPose,side:Surface,fill:string):Face{
 const {x,y,z,w,h,d}=p;
 const xyz=side==='top'?[[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+d],[x,y+h,z+d]]:
  side==='right'?[[x+w,y,z],[x+w,y,z+d],[x+w,y+h,z+d],[x+w,y+h,z]]:
  [[x,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x,y+h,z+d]];
 return {points:xyz.map(([a,b,c])=>projectIsometric(a,b,c)),fill,depth:depth(p),order:side==='front'?2:side==='right'?1:0};
}

export function isometricScene(unit:Unit,finishes:ExternalFinish[]=[]){
 const placements=unitDrawingOrder(unitPlacements(unit),unit.layerOrder).filter(p=>p.valid);
 if(!placements.length)return null;
 const result=calculate({id:'isometric',name:unit.name,client:'',units:[unit],externalFinishes:finishes,updatedAt:'',settings:{sh:50,marine:38,probond:null,joint:null}},undefined,{panelsOnly:true,ignoreFaceAssignments:true});
 const faces:Face[]=[],details:Detail[]=[],all:Point[]=[];
 const seamFronts:{face:Face,pose:BoardPose,componentId:string}[]=[];
 const doorPlanes:{x:number,y:number,w:number,h:number,front:number}[]=[];
 for(const place of placements){
  const c=place.component,raised=legHeight(c);
  const selected=new Set(result.finishFaces?.filter(f=>f.componentId===c.id&&f.external).map(f=>f.key));
  for(const piece of result.pieces){
   if(piece.kind!=='board'||!piece.pose||piece.componentId!==c.id||!/^(door|sliding):/.test(piece.panelKey||'')||!outsideSurface(c,piece,selected))continue;
   const p=piece.pose;
   doorPlanes.push({x:place.x+p.x,y:place.y+raised+p.y,w:p.w,h:p.h,front:p.z+p.d});
  }
  if(c.kind==='Boxing'||c.kind==='Framing'){
   let offset=0;
   for(const length of splitLengths(c.l,c.split)){
    for(const leaf of doorLeaves(c,length,boxHeight(c)))if(leaf.type==='profile')doorPlanes.push({
     x:place.x+offset+leaf.x,y:place.y+raised+leaf.y,w:leaf.w,h:leaf.h,
     front:c.d+(leaf.placement==='inset'?-T:.05)+.31,
    });
    offset+=length;
   }
  }
 }
 for(const place of placements){
  const c=place.component,raised=legHeight(c);
  const selected=new Set(result.finishFaces?.filter(f=>f.componentId===c.id&&f.external).map(f=>f.key));
  const boards=result.pieces.filter(p=>p.kind==='board'&&p.pose&&p.componentId===c.id);
  // Door and drawer faces beside one another belong to the same visible
  // cabinet front. The construction poses retain the drawer's shelf setback;
  // project only its decorative face onto its neighbouring door's face plane.
  const visible:{piece:Piece,pose:BoardPose,side:Surface}[]=[],componentFaces:Face[]=[];
  const joined=new Map<string,{pose:BoardPose,side:Surface,fill:string}>();
  const addFace=(pose:BoardPose,side:Surface,fill:string)=>{const face=surfaceFace(pose,side,fill);componentFaces.push(face);all.push(...face.points);return face;};
  for(const piece of boards){
   const surface=outsideSurface(c,piece,selected);if(!surface)continue;
   // The Paneling base face sits at 2T in its own construction drawing.
   // In a combined unit it is the backing plane: align that finished face
   // to the rear (z=0) edge of Boxing, retaining relief of added layers.
   const pose={...piece.pose!,x:piece.pose!.x+place.x,y:piece.pose!.y+place.y+raised,
    z:piece.pose!.z+(c.kind==='Paneling'?-2*T:0)};
   if(/^drawer:.+:front:\d+$/.test(piece.panelKey||'')){
    const neighbour=doorPlanes.map(door=>({door,
     xGap:Math.max(door.x-pose.x-pose.w,pose.x-door.x-door.w,0),
     yGap:Math.max(door.y-pose.y-pose.h,pose.y-door.y-door.h,0),
     xOverlap:Math.min(door.x+door.w,pose.x+pose.w)-Math.max(door.x,pose.x),
     yOverlap:Math.min(door.y+door.h,pose.y+pose.h)-Math.max(door.y,pose.y),
    })).filter(({xGap,yGap,xOverlap,yOverlap})=>
     (xGap<=1.25&&xOverlap<=.25&&yOverlap>.125)||(yGap<=1.25&&yOverlap<=.25&&xOverlap>.125))
     .sort((a,b)=>a.xGap+a.yGap-b.xGap-b.yGap)[0];
    if(neighbour)pose.z=neighbour.door.front-pose.d;
   }
   const finishId=c.faceFinishes?.[surface.key]?.finishId||c.defaultExternalFinishId;
   const color=finishes.find(f=>f.id===finishId)?.color;
   const fallback=surface.side==='front'?'#d5b995':surface.side==='top'?'#dfe8d5':'#a8ba99';
   const fill=color||fallback;
   if(c.kind==='Paneling'||c.kind==='Closed Boxing'){
    const previous=joined.get(surface.key);
    if(previous){const a=previous.pose,b=pose,x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),z=Math.min(a.z,b.z);
     previous.pose={x,y,z,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y,d:Math.max(a.z+a.d,b.z+b.d)-z};}
    else joined.set(surface.key,{pose,side:surface.side,fill});
   }else{
    const face=addFace(pose,surface.side,fill);
    if(c.kind==='Boxing'&&surface.side==='front'&&/^(door|sliding):|^drawer:.+:front:\d+$/.test(piece.panelKey||''))seamFronts.push({face,pose,componentId:c.id});
   }
   visible.push({piece,pose,side:surface.side});
  }
  for(const face of joined.values())addFace(face.pose,face.side,face.fill);
  // Profile doors are glass and aluminium rather than laminate, but remain
  // visible on the finished exterior. Use the same opening geometry as the door layout.
  if(c.kind==='Boxing'||c.kind==='Framing'){
   const lengths=splitLengths(c.l,c.split),height=boxHeight(c);
   let offset=0;
   for(const length of lengths){
    for(const leaf of doorLeaves(c,length,height)){
     if(leaf.type!=='profile')continue;
     const x=place.x+offset+leaf.x,y=place.y+raised+leaf.y,z=c.d+(leaf.placement==='inset'?-18/25.4:.05),frame=.75;
     if(leaf.w<=2*frame||leaf.h<=2*frame)continue;
     addFace({x:x+frame,y:y+frame,z,w:leaf.w-2*frame,h:leaf.h-2*frame,d:.12},'front','#c6dce0');
     const bands=[{x,y,w:leaf.w,h:frame},{x,y:y+leaf.h-frame,w:leaf.w,h:frame},
      {x,y:y+frame,w:frame,h:leaf.h-2*frame},{x:x+leaf.w-frame,y:y+frame,w:frame,h:leaf.h-2*frame}];
     for(const band of bands)addFace({...band,z:z+.13,d:.18},'front','#81948e');
    }
    offset+=length;
   }
  }
  componentFaces.sort((a,b)=>a.depth-b.depth||a.order-b.order);
  faces.push(...componentFaces);
  if(c.kind==='Boxing'||c.kind==='Framing'){
   const length=splitLengths(c.l,c.split)[0];
   for(const h of handleGeometry(c,length,boxHeight(c)).filter(h=>h.valid&&h.visibleInDoorView)){
    const x=place.x+h.x,y=place.y+raised+h.y;
    const front=visible.filter(v=>v.side==='front'&&(/^(door|sliding):/.test(v.piece.panelKey||'')||/^drawer:.+:front:\d+$/.test(v.piece.panelKey||'')))
     .filter(v=>x>=v.pose.x-.5&&x<=v.pose.x+v.pose.w+.5&&y>=v.pose.y-.5&&y<=v.pose.y+v.pose.h+.5)
     .sort((a,b)=>b.pose.z+b.pose.d-a.pose.z-a.pose.d)[0];
    if(!front)continue;
    const z=front.pose.z+front.pose.d+.15;
    const a=projectIsometric(h.vertical?x:x-h.length/2,h.vertical?y-h.length/2:y,z),b=projectIsometric(h.vertical?x:x+h.length/2,h.vertical?y+h.length/2:y,z);
    details.push({a,b,color:h.color==='Black'?'#313b37':'#787f75',width:Math.max(.15,Math.min(.35,h.length/12))});all.push(a,b);
   }
  }
 }
 // Adjacent boxes have independent front-edge clearances. Join their exterior
 // preview faces at the common boundary without modifying the cut geometry.
 for(const left of placements.filter(p=>p.component.kind==='Boxing')){
  for(const right of placements.filter(p=>p.component.kind==='Boxing'&&p.id!==left.id&&Math.abs(p.x-left.x-left.w)<1e-4)){
   const seam=right.x;
   const leftEdges=seamFronts.filter(f=>f.componentId===left.id&&Math.abs(f.pose.x+f.pose.w-seam)<1.25);
   const rightEdges=seamFronts.filter(f=>f.componentId===right.id&&Math.abs(f.pose.x-seam)<1.25);
   for(const a of leftEdges){
    const b=rightEdges.find(f=>Math.min(a.pose.y+a.pose.h,f.pose.y+f.pose.h)>Math.max(a.pose.y,f.pose.y)+.125&&Math.abs(a.pose.z+a.pose.d-f.pose.z-f.pose.d)<.125);
    if(!b)continue;
    for(const [index,y] of [[1,a.pose.y],[2,a.pose.y+a.pose.h]] as const)Object.assign(a.face.points[index],projectIsometric(seam,y,a.pose.z+a.pose.d));
   }
   for(const b of rightEdges){
    const a=leftEdges.find(f=>Math.min(b.pose.y+b.pose.h,f.pose.y+f.pose.h)>Math.max(b.pose.y,f.pose.y)+.125&&Math.abs(b.pose.z+b.pose.d-f.pose.z-f.pose.d)<.125);
    if(!a)continue;
    for(const [index,y] of [[0,b.pose.y],[3,b.pose.y+b.pose.h]] as const)Object.assign(b.face.points[index],projectIsometric(seam,y,b.pose.z+b.pose.d));
   }
  }
 }
 for(const bottom of placements.filter(p=>p.component.kind==='Boxing')){
  for(const top of placements.filter(p=>p.component.kind==='Boxing'&&p.id!==bottom.id&&Math.abs(p.y-bottom.y-bottom.h)<1e-4)){
   const seam=top.y;
   const bottomEdges=seamFronts.filter(f=>f.componentId===bottom.id&&Math.abs(f.pose.y+f.pose.h-seam)<1.25);
   const topEdges=seamFronts.filter(f=>f.componentId===top.id&&Math.abs(f.pose.y-seam)<1.25);
   for(const a of bottomEdges){
    const b=topEdges.find(f=>Math.min(a.pose.x+a.pose.w,f.pose.x+f.pose.w)>Math.max(a.pose.x,f.pose.x)+.125&&Math.abs(a.pose.z+a.pose.d-f.pose.z-f.pose.d)<.125);
    if(!b)continue;
    for(const [index,x] of [[2,a.pose.x+a.pose.w],[3,a.pose.x]] as const)Object.assign(a.face.points[index],projectIsometric(x,seam,a.pose.z+a.pose.d));
   }
   for(const b of topEdges){
    const a=bottomEdges.find(f=>Math.min(b.pose.x+b.pose.w,f.pose.x+f.pose.w)>Math.max(b.pose.x,f.pose.x)+.125&&Math.abs(b.pose.z+b.pose.d-f.pose.z-f.pose.d)<.125);
    if(!a)continue;
    for(const [index,x] of [[0,b.pose.x],[1,b.pose.x+b.pose.w]] as const)Object.assign(b.face.points[index],projectIsometric(x,seam,b.pose.z+b.pose.d));
   }
  }
 }
 if(!faces.length)return null;
 const minX=all.reduce((v,p)=>Math.min(v,p.x),Infinity),maxX=all.reduce((v,p)=>Math.max(v,p.x),-Infinity),minY=all.reduce((v,p)=>Math.min(v,p.y),Infinity),maxY=all.reduce((v,p)=>Math.max(v,p.y),-Infinity);
 const pad=Math.max(maxX-minX,maxY-minY)*.065+1.5;
 return {faces,details,viewBox:[minX-pad,minY-pad,maxX-minX+2*pad,maxY-minY+2*pad].join(' '),stroke:Math.max(.10,Math.min(maxX-minX,maxY-minY)/500)};
}

export function IsometricUnit({unit,finishes=[],compact=false}:{unit:Unit,finishes?:ExternalFinish[],compact?:boolean}){
 const scene=useMemo(()=>isometricScene(unit,finishes),[unit,finishes]);
 if(!scene)return <div className="isometric-empty">Select external laminate faces to preview this unit.</div>;
 return <svg className={'isometric-unit'+(compact?' compact':'')} role="img" aria-label={unit.name+' external laminate isometric preview'} viewBox={scene.viewBox} preserveAspectRatio="xMidYMid meet">
  {scene.faces.map((face,i)=><polygon key={i} points={face.points.map(p=>p.x+','+p.y).join(' ')} fill={face.fill} stroke="#798471" strokeWidth={scene.stroke} strokeLinejoin="round"/>)}
  {scene.details.map((line,i)=><line key={'detail-'+i} x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} stroke={line.color} strokeWidth={line.width} strokeLinecap="round"/>)}
 </svg>;
}
