import type {Component,PlacementArea,Unit,Shelf,DrawerRow} from './model';
import {copyUnit,uid,boxHeight,legHeight} from './model.ts';
import {T,MIN_BOXING_DIMENSION,componentBays,splitLengths,fillDrawerHeight,doorSection,doorOpenings,doorOpeningId,componentLightPanels,MAX_SWING_DOOR_WIDTH} from './engine.ts';
import {unitPlacements} from './unit-layout.ts';
import {unitEnvelope} from './rooms.ts';

const E=1e-6;
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const near=(a:number,b:number)=>Math.abs(a-b)<E;

/** A placement is a new design instance. The catalogue snapshot is never resized. */
export function adaptUnitToArea(original:Unit,area:Pick<PlacementArea,'w'|'h'|'d'>):{unit?:Unit,error?:string,notes:string[]}{
 const notes:string[]=[];
 if(![area.w,area.h,area.d].every(n=>Number.isFinite(n)&&n>0))return {error:'Enter positive available width, height and depth before placing the design.',notes};
 const source=unitEnvelope(original);
 if(!source.measured||!source.w||!source.h||!source.d)return {error:'Finish the catalogue unit dimensions before resizing.',notes};
 const sx=area.w/source.w,sy=area.h/source.h,depthChange=area.d-source.d;
 const unit=copyUnit(original);unit.name=original.name;
 const positions=unitPlacements(unit),components:Component[]=[],order=new Map<string,string[]>();
 for(const [index,c] of unit.components.entries()){
  const design=structuredClone(c);
  const placement=positions[index],originalLength=splitLengths(c.l,c.split).reduce((a,b)=>a+b,0);
  const desiredLength=originalLength*sx;
  const splitCap=c.kind==='Closed Boxing'?96:c.kind==='Boxing'?94:Infinity;
  const count=Math.max(1,Math.ceil(desiredLength/splitCap-E));
  if(count>4)return {error:c.name+' needs '+count+' boxes to fill the width; the current limit is four per component type.',notes};
  const newLength=desiredLength/count;
  const sourceL=splitLengths(c.l,c.split)[0];
  if(c.kind==='Boxing'&&newLength<MIN_BOXING_DIMENSION-E||c.kind==='Closed Boxing'&&newLength<3-E)return {error:c.name+': the resized box would be narrower than its minimum.',notes};
  const fragments=[c,...Array.from({length:count-1},()=>copyUnit({id:uid(),name:'Part',components:[design]}).components[0])];
  if(count>1)notes.push(c.name+': added '+(count-1)+' separate box'+(count>2?'es':'')+' to fill the requested width.');
  order.set(c.id,fragments.map(f=>f.id));
  for(const [partIndex,part] of fragments.entries()){
   const previousPanels=part.profileLights?.length?new Map(componentLightPanels(part).map(p=>[p.panelKey,p])):undefined;
   const sourceH=boxHeight(design)-1.5;
   const hCap=design.kind==='Boxing'?94+legHeight(design):design.kind==='Closed Boxing'?96:Infinity;
   const hMin=design.kind==='Boxing'?MIN_BOXING_DIMENSION+legHeight(design):design.kind==='Closed Boxing'?3:0;
   if(area.h<hMin-E)return {error:part.name+' needs at least '+hMin+'″ overall height under the existing construction limits.',notes};
   part.h=clamp(design.h*sy,hMin,hCap);
   if(part.h<design.h*sy-E)notes.push(part.name+' height stops at '+hCap+'″ under the existing limit.');
   if(part.h>design.h*sy+E)notes.push(part.name+' stays at its '+hMin+'″ minimum height; the other parts adjust around it.');
   part.l=newLength;
   if(design.kind==='Boxing')part.d=clamp(design.d+depthChange,MIN_BOXING_DIMENSION,22);
   else if(design.kind==='Closed Boxing')part.d=clamp(design.d+depthChange,3,96);
   else if(design.kind==='Paneling')part.d=design.d;
   if(design.kind==='Boxing'||design.kind==='Closed Boxing')if(!near(part.d,design.d+depthChange))notes.push(part.name+' depth stops at its existing limit.');
   part.unitPosition={x:placement.x*sx+partIndex*newLength,y:clamp(placement.y*sy,0,area.h-part.h)};
   if(count>1)part.name=c.name+' · Box '+(partIndex+1);
   if(c.kind==='Boxing'){
    part.split='equal';
    const newH=boxHeight(part)-1.5,oldBays=componentBays(design,sourceL);
    if(part.sectionCount===1&&newLength>46)part.sectionCount=2;
    const bays=componentBays(part,newLength);
    if(oldBays.length!==bays.length)part.sectionShares=undefined;
    const nextBays=componentBays(part,newLength);
    if(partIndex===0&&nextBays.length>oldBays.length)notes.push(c.name+': added '+(nextBays.length-oldBays.length)+' mid-support'+(nextBays.length-oldBays.length>1?'s':'')+'.');
    const oldW=sourceL-1.5,newW=newLength-1.5;
    const fragmentsFor=(x:number,w:number)=>nextBays.flatMap(b=>{
     const start=Math.max(b.x,x*newW/oldW),end=Math.min(b.x+b.w,(x+w)*newW/oldW);
     return end-start>E?[{x:start,w:end-start}]:[];
    });
    // A shelf spanning a new support becomes one shelf in each clear opening.
    const verticals=part.shelves.filter(s=>s.orientation==='vertical');
    const horizontals:Shelf[]=[];
    for(const shelf of part.shelves.filter(s=>s.orientation==='horizontal')){
     const spans=fragmentsFor(shelf.x,shelf.w);
     spans.forEach((span,i)=>horizontals.push({...shelf,id:i?uid():shelf.id,x:span.x,w:span.w,y:shelf.y*newH/sourceH}));
    }
    // Repeated shelf runs keep their original approximate spacing. A single
    // shelf keeps its proportional position (e.g. halfway stays halfway).
    const groups=new Map<string,Shelf[]>();
    for(const shelf of horizontals){const key=shelf.x.toFixed(4)+':'+shelf.w.toFixed(4);groups.set(key,[...(groups.get(key)||[]),shelf]);}
    part.shelves=[...groups.values()].flatMap(group=>{
     group.sort((a,b)=>a.y-b.y);
     if(group.length<2)return group;
     const originalYs=group.map(s=>s.y*sourceH/newH),interval=sourceH/(group.length+1);
     const gaps=[originalYs[0],...originalYs.slice(1).map((y,i)=>y-originalYs[i]),sourceH-originalYs.at(-1)!];
     const repeated=gaps.every(g=>Math.abs(g-interval)<=interval*.25);
     if(!repeated)return group;
     const targetCount=Math.max(0,Math.round(newH/interval)-1);
     if(targetCount<group.length)notes.push(part.name+': removed shelf levels to keep their approximate spacing.');
     return Array.from({length:targetCount},(_,i)=>({...group[Math.min(i,group.length-1)],id:i<group.length?group[i].id:uid(),y:newH*(i+1)/(targetCount+1)}));
    });
    part.shelves.push(...verticals.map(s=>({...s,x:clamp(s.x*newW/oldW,0,newW-T),y:s.y*newH/sourceH,h:s.h*newH/sourceH})));
    const rows:DrawerRow[]=[];
    for(const row of part.drawers){
     const spans=fragmentsFor(row.x,row.span),total=spans.reduce((s,b)=>s+b.w,0);
     for(const [i,span] of spans.entries()){
      const countFromDesign=Math.max(1,Math.round(row.count*span.w/total));
      const minCount=Math.max(1,Math.ceil((span.w+T)/(36+T)-E));
      const drawerCount=Math.max(countFromDesign,minCount);
      const y=sourceH>row.height?clamp(row.y/(sourceH-row.height),0,1)*Math.max(0,newH-row.height):0;
      rows.push({...row,id:i?uid():row.id,x:span.x,span:span.w,count:drawerCount,y});
     }
    }
    // If the height shrinks, retain lower rows that physically fit; never
    // squeeze a fixed-height decorative front or a required top support.
    const kept:DrawerRow[]=[];
    for(const row of rows.sort((a,b)=>a.y-b.y)){
     const overlapping=kept.filter(prev=>prev.x<row.x+row.span-E&&prev.x+prev.span>row.x+E);
     const occupied=(r:DrawerRow)=>r.y+r.height+(r.topSupport!==false&&r.y+r.height<newH-E?T:0);
     const earliest=Math.max(row.y,0,...overlapping.map(occupied));
     let y=earliest;
     if(y+row.height<newH-E&&row.topSupport!==false&&y+row.height+T>newH+E)y=newH-row.height;
     if(y+row.height>newH+E||y+row.height<newH-E&&row.topSupport!==false&&y+row.height+T>newH+E)continue;
     kept.push({...row,y});
    }
    if(kept.length<rows.length)notes.push(part.name+': removed '+(rows.length-kept.length)+' drawer row(s) that cannot fit at their fixed height.');
    part.drawers=kept;
    part.drawers=kept.map(row=>row.heightMode==='fill'?fillDrawerHeight(part,newLength,row)||row:row);
    if(part.doorMode==='swing'){
     const before=doorOpenings(design,sourceL),after=doorOpenings(part,newLength);
     const configured=design.doors.map((_,slot)=>({choice:doorSection(design,slot),opening:before.find(o=>o.id===doorOpeningId(design,slot))}))
      .filter(g=>g.choice.enabled&&g.choice.type!=='none'&&g.opening);
     const doors:typeof part.doors=[];
     for(const [bayIndex,b] of nextBays.entries()){
      const previousBay=Math.min(oldBays.length-1,Math.floor((bayIndex+.5)*oldBays.length/nextBays.length));
      const groups=configured.filter(g=>g.opening!.bay===previousBay);
      const selected=groups.length?groups:bayIndex>=oldBays.length?configured.slice(0,1):[];
      for(const group of selected){
       const old=group.opening!;
       const choices=after.filter(o=>o.bay===bayIndex&&o.whole===old.whole);
       const opening=choices.sort((a,b)=>{
        const score=(o:typeof a)=>Math.abs(o.y/newH-old.y/sourceH)+Math.abs(o.h/newH-old.h/sourceH)+Math.abs((o.x-b.x)/b.w-(old.x-oldBays[old.bay].x)/oldBays[old.bay].w)+(o.spansShelves===old.spansShelves?0:2);
        return score(a)-score(b);
       })[0];
       if(!opening)return {error:c.name+': an existing door opening cannot be retained after resizing. Adjust its shelves or drawers in the project copy.',notes};
       const width=opening.w+(group.choice.placement==='overlay'?.75:0);
       const minLeaves=Math.max(1,Math.ceil(width/MAX_SWING_DOOR_WIDTH-E));
       doors.push({...group.choice,opening:opening.id,count:group.choice.type==='rolling'?1:Math.max(group.choice.count,minLeaves)});
      }
     }
     part.doors=doors;
    }
   }else if(c.kind==='Paneling'){
    part.layers=part.layers.map(l=>({...l,x:l.x*sx,y:l.y*sy,w:l.w*sx,h:l.h*sy}));
   }
   if(previousPanels&&part.profileLights?.length){
    const available=new Map(componentLightPanels(part).map(p=>[p.panelKey,p]));
    let removed=0,adjusted=0;
    part.profileLights=part.profileLights.flatMap(light=>{
     const before=previousPanels.get(light.panelKey),after=available.get(light.panelKey);
     if(before&&!after){removed++;return [];}
     if(!before||!after)return [light]; // Existing invalid hosts remain a validation error.
     const horizontal=light.orientation==='horizontal';
     const oldAlong=horizontal?before.w:before.h,newAlong=horizontal?after.w:after.h;
     const oldAcross=horizontal?before.h:before.w,newAcross=horizontal?after.h:after.w;
     const profileWidth=light.width/25.4;
     if(!(oldAlong>0&&oldAcross>0&&newAlong>0&&newAcross>0&&profileWidth<=newAcross+E))return [light];
     const alongOffset=(horizontal?light.x:light.y)*newAlong/oldAlong;
     const acrossOffset=clamp((horizontal?light.y:light.x)*newAcross/oldAcross,0,Math.max(0,newAcross-profileWidth));
     const length=Math.min(light.length*newAlong/oldAlong,newAlong-alongOffset);
     if(!(length>0))return [light];
     const next={...light,length,...(horizontal?{x:alongOffset,y:acrossOffset}:{x:acrossOffset,y:alongOffset})};
     if(!near(next.length,light.length)||!near(next.x,light.x)||!near(next.y,light.y))adjusted++;
     return [next];
    });
    if(removed)notes.push(part.name+': removed '+removed+' profile light'+(removed>1?'s':'')+' with the eliminated panel(s).');
    if(adjusted)notes.push(part.name+': adjusted '+adjusted+' profile light'+(adjusted>1?'s':'')+' to the resized 18mm panel'+(adjusted>1?'s':'')+'.');
   }
   components.push(part);
  }
 }
 unit.components=components;
 if(unit.layerOrder)unit.layerOrder=unit.layerOrder.flatMap(id=>order.get(id)||[id]);
 if(components.filter(c=>c.kind==='Boxing').length>4||components.filter(c=>c.kind==='Closed Boxing').length>4)return {error:'Resizing needs more than four boxes of one type. Use a smaller area or another design.',notes};
 const actual=unitEnvelope(unit);
 if(actual.w>area.w+E||actual.h>area.h+E||actual.d>area.d+E)return {error:'The design cannot fit this area within the existing component, leg and door-depth limits.',notes};
 if(Math.abs(actual.w-area.w)>E||Math.abs(actual.h-area.h)>E||Math.abs(actual.d-area.d)>E)notes.push('The unit uses the maximum allowed size; some reserved space remains under existing limits.');
 return {unit,notes:[...new Set(notes)]};
}
