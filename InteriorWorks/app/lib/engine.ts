import {patternRegions,polygonArea,boundarySegments,bounds,clipRect} from './laminate-patterns.ts';
import type {Polygon} from './laminate-patterns';
import type { Project,Component,Unit,Layer,Shelf,HandleSpec,ProfileLight,DoorSection } from './model';
import {handleLengths,handleColors,boxHeight,legHeight,legHeights,boxingSectionCounts,drawerHeights,minDrawerHeight,closedBoxingDimensions} from './model.ts';
import {finishName,finishLibraryErrors,faceFinishErrors,finishRegions} from './finishes.ts';
import type {FinishFace,FinishRect} from './finishes';
import {legCoverPanels,legCoverSides,inactiveLegCoverFace} from './leg-covers.ts';
export const T=18/25.4, K=1/16, TRIM=1/8;
export const MIN_BOXING_DIMENSION=3;
export const shelfThickness=(s:Shelf)=>s.orientation==='horizontal'&&s.material==='glass'?8/25.4:T;
export const MIN_DOOR_SIZE=3,MAX_SWING_DOOR_WIDTH=48,MAX_SLIDING_DOOR_WIDTH=48,MAX_DOOR_HEIGHT=96;
export const MIN_ROLLING_SHUTTER_WIDTH=18,MAX_ROLLING_SHUTTER_WIDTH=48,MIN_ROLLING_SHUTTER_HEIGHT=18,MAX_ROLLING_SHUTTER_HEIGHT=72;
export type BoardPose={x:number,y:number,z:number,w:number,h:number,d:number};
export type Piece={cutShape?:Polygon[],id:string,label:string,unit:string,component:string,unitId?:string,componentId?:string,panelKey?:string,pose?:BoardPose,material:string,group:string,w:number,h:number,fw:number,fh:number,rotate:boolean,forcedRotate:boolean,kind:'board'|'laminate'};
export type MasterUnit={id:string,name:string,components:{id:string,name:string,kind:string,l:number,h:number,d:number,pieces:Piece[]}[]};
export type Placed=Piece&{x:number,y:number,pw:number,ph:number,rotated:boolean};
export type Rect={x:number,y:number,w:number,h:number};
export type PanelAssembly={unit:string,component:string,label:string,material:string,w:number,h:number,parts:Rect[]};
export type PanelPlan={parts:Rect[],vertical:number[],horizontal:number[],unsupported:number};
// Finished pieces butt together without a gap. Kerf is applied later on stock sheets.
export function panelPlan(w:number,h:number,grain:'free'|'length'|'height'='free',sheetGrain:'length'|'width'='length',xs:number[]=[],ys:number[]=[],trim=TRIM):PanelPlan{
 const a=96-2*trim,b=48-2*trim;
 const forced=grain!=='free'&&((grain==='height'&&sheetGrain==='length')||(grain==='length'&&sheetGrain==='width'));
 const sizes=grain==='free'?[[a,b],[b,a]]:forced?[[b,a]]:[[a,b]];
 const cuts=(total:number,cap:number,lines:number[])=>{const n=Math.ceil(total/cap-eps),out:number[]=[];let prev=0;
 for(let i=1;i<n;i++){const lo=Math.max(prev+eps,total-(n-i)*cap),hi=Math.min(prev+cap,total-eps*(n-i)),target=total*i/n;
 const available=lines.filter(x=>x>=lo-eps&&x<=hi+eps).sort((x,y)=>Math.abs(x-target)-Math.abs(y-target));
 const at=available[0]??Math.max(lo,Math.min(hi,target));out.push(at);prev=at;}return out;};
 const plans=sizes.filter(([cw,ch])=>Math.ceil(w/cw-eps)*Math.ceil(h/ch-eps)<=1600).map(([cw,ch])=>{const vertical=cuts(w,cw,xs),horizontal=cuts(h,ch,ys),xx=[0,...vertical,w],yy=[0,...horizontal,h];
 const parts:Rect[]=[];for(let j=0;j<yy.length-1;j++)for(let i=0;i<xx.length-1;i++)parts.push({x:xx[i],y:yy[j],w:xx[i+1]-xx[i],h:yy[j+1]-yy[j]});
 return {parts,vertical,horizontal,unsupported:vertical.filter(x=>!xs.some(v=>Math.abs(v-x)<eps)).length+horizontal.filter(y=>!ys.some(v=>Math.abs(v-y)<eps)).length};});
 return plans.sort((p,q)=>p.parts.length-q.parts.length||p.unsupported-q.unsupported||(p.vertical.length*h+p.horizontal.length*w)-(q.vertical.length*h+q.horizontal.length*w))[0]||{parts:[{x:0,y:0,w,h}],vertical:[],horizontal:[],unsupported:0};
}
export type Sheet={group:string,material:string,index:number,pieces:Placed[],offcuts:Rect[],used:number};
export type Line={name:string,value:number|null,unit:string,note?:string};
export type LightPlacement=ProfileLight&{unitId:string,componentId:string,unit:string,component:string,label:string,panel:string,pieceId:string,panelW:number,panelH:number,material:string,faceLabel:string};
export type DrawingUnit={id:string,name:string,components:{config:Component,pieces:Piece[]}[]};
export type Result={finishFaces?:FinishFace[],finishSpecs?:Project['externalFinishes'],drawings?:DrawingUnit[],lights?:LightPlacement[],pieces:Piece[],sheets:Sheet[],hardware:Line[],notes:string[],errors:string[],construction?:ConstructionDetail[],assemblies?:PanelAssembly[],masters?:MasterUnit[],glass:{label:string,w:number,h:number,count:number,thickness?:6|8}[],profiles:{label:string,length:number}[],profileStocks:{items:{label:string,length:number}[],remaining:number}[],scope:string,units:number,createdAt:string,areas:{board:number,internal:number,external:number},edge:number,tape:number};
const eps=1e-7;
export const fix=(j:number,spacing=6)=>Math.ceil(Math.max(0,j)/spacing-eps)+1;
export function splitLengths(l:number,mode:'equal'|'maximum'):number[]{
 if(l<=94)return [l];if(l<=102)return [94];
 const n=Math.ceil(l/94);if(mode==='equal')return Array(n).fill(l/n);
 const a=Array(n-1).fill(94);a.push(l-94*(n-1));return a;
}
export function support(l:number){return l>46?1:0;}
export function clearBays(l:number,m:number){const width=(l-1.5-m*T)/(m+1);return Array.from({length:m+1},(_,i)=>({x:i*(width+T),w:width}));}
export function supportCount(c:Component,L:number){
 if(c.kind==='Framing'&&c.frameMidSupport===false)return 0;
 const minimum=support(L);
 return c.kind==='Boxing'&&boxingSectionCounts.some(n=>n===c.sectionCount)?Math.max(minimum,c.sectionCount!-1):minimum;
}
export function hasCustomSectionWidths(c:Component,L:number){
 const shares=c.sectionShares;
 return (c.kind==='Boxing'||c.kind==='Framing')&&Array.isArray(shares)&&shares.length>1&&shares.length===supportCount(c,L)+1
  &&shares.every(s=>Number.isFinite(s)&&s>0)&&Math.abs(shares.reduce((sum,s)=>sum+s,0)-1)<eps;
}
export function componentBays(c:Component,L:number){
 const m=supportCount(c,L);
 if(!hasCustomSectionWidths(c,L))return clearBays(L,m);
 const available=L-1.5-m*T;
 let x=0;
 return c.sectionShares!.map(share=>{const bay={x,w:share*available};x+=bay.w+T;return bay;});
}
const minSectionWidth=1/16;
function updateSectionWidths(c:Component,bays:{w:number}[],widths:number[]){
 const total=bays.reduce((sum,b)=>sum+b.w,0);
 if(widths.every((w,i)=>Math.abs(w-bays[i].w)<eps))return c;
 return {...c,sectionShares:widths.every(w=>Math.abs(w-total/widths.length)<eps)?undefined:widths.map(w=>w/total)};
}
export function moveStructuralSupport(c:Component,L:number,index:number,x:number){
 if((c.kind!=='Boxing'&&c.kind!=='Framing')||!Number.isFinite(x))return c;
 const bays=componentBays(c,L),left=bays[index],right=bays[index+1];
 if(!left||!right||left.w+right.w<2*minSectionWidth)return c;
 const width=Math.max(minSectionWidth,Math.min(left.w+right.w-minSectionWidth,x-left.x));
 return updateSectionWidths(c,bays,bays.map((b,i)=>i===index?width:i===index+1?left.w+right.w-width:b.w));
}
export function resizeSectionWidth(c:Component,L:number,index:number,width:number){
 if((c.kind!=='Boxing'&&c.kind!=='Framing')||!Number.isFinite(width))return c;
 const bays=componentBays(c,L),total=bays.reduce((sum,b)=>sum+b.w,0),selected=bays[index],others=bays.length-1;
 if(!selected||others<1||total<=bays.length*minSectionWidth||Math.abs(selected.w-width)<.00006)return c;
 const target=Math.max(minSectionWidth,Math.min(total-others*minSectionWidth,width));
 const weights=bays.map((b,i)=>i===index?0:Math.max(0,b.w-minSectionWidth));
 const sum=weights.reduce((a,b)=>a+b,0),remaining=Math.max(0,total-target-others*minSectionWidth);
 return updateSectionWidths(c,bays,bays.map((_,i)=>i===index?target:minSectionWidth+remaining*(sum>eps?weights[i]/sum:1/others)));
}
export function structuralSupports(c:Component,L:number){
 // Positions are measured from the inside left, like shelves and drawer openings.
 // Keep the first panel's existing key so saved finishes/lights still resolve.
 return componentBays(c,L).slice(1).map((bay,i)=>({x:bay.x-T,label:i===0?'Mid-support':'Mid-support '+(i+1)}));
}
export function legStartPositions(c:Component,L:number){
 return [.75,L-1.45,...structuralSupports(c,L).map(s=>.75+s.x+T/2-.35)];
}
export function drawerDividers(c:Component){return c.drawers.flatMap((row,ri)=>{const n=Math.min(100,Math.max(1,Math.floor(row.count))),a=(row.span-(n-1)*T)/n;return Array.from({length:n-1},(_,i)=>({id:'auto-divider-'+row.id+'-'+i,owner:row.id,label:'Drawer row '+(ri+1)+' divider '+(i+1),x:row.x+(i+1)*a+i*T,y:row.y,w:T,h:row.height}));});}
export type AutoSupport=Shelf&{label:string};
export function automaticSupports(c:Component,L:number):AutoSupport[]{
 const out:AutoSupport[]=[],manual=c.shelves.filter(s=>s.orientation==='horizontal'&&s.material!=='glass');
 const add=(id:string,label:string,x:number,y:number,w:number)=>{
 if(y< -eps||!(w>0)||manual.some(s=>Math.abs(s.y-y)<1/16+eps&&s.x<=x+eps&&s.x+s.w>=x+w-eps))return;
 const old=out.find(s=>Math.abs(s.y-y)<eps&&s.x<=x+w+eps&&s.x+s.w>=x-eps);if(old){const right=Math.max(old.x+old.w,x+w);old.x=Math.min(old.x,x);old.w=right-old.x;return;}out.push({id,label,orientation:'horizontal',x,y:Math.max(0,y),w,h:T});};
 c.drawers.forEach((r,i)=>{const y=r.y+r.height;if(r.topSupport!==false&&y<boxHeight(c)-1.5-eps)add('auto-drawer-top-'+r.id,'Drawer row '+(i+1)+' automatic top shelf',r.x,y,r.span);});
 c.shelves.forEach((s,i)=>{if(s.orientation!=='vertical'||s.baseSupport!=='new'||s.y<T-eps)return;const bay=componentBays(c,L).find(b=>s.x>=b.x-eps&&s.x+T<=b.x+b.w+eps);if(bay)add('auto-vertical-base-'+s.id,'Vertical shelf '+(i+1)+' automatic base',bay.x,s.y-T,bay.w);});
 return out;
}
function drawerHasTopPanel(c:Component,L:number,row:Component['drawers'][number]){const y=row.y+row.height;return Math.abs(y-(boxHeight(c)-1.5))<eps||[...c.shelves,...automaticSupports(c,L)].some(s=>s.orientation==='horizontal'&&s.material!=='glass'&&Math.abs(s.y-y)<1/16+eps&&s.x<=row.x+eps&&s.x+s.w>=row.x+row.span-eps);}
export function drawerOpenings(c:Component,L:number,row:{y:number,height:number,topSupport?:boolean}){
 const W=L-1.5,H=boxHeight(c)-1.5,blockers=[...structuralSupports(c,L).map(b=>({x:b.x,y:0,h:H})),...c.shelves.filter(s=>s.orientation==='vertical')]
 .filter(s=>s.y<row.y+row.height+(row.topSupport===false?0:T)-eps&&s.y+s.h>row.y+eps).sort((a,b)=>a.x-b.x);
 const gaps:{left:number,right:number}[]=[];let left=0;for(const b of blockers){if(b.x>left+eps)gaps.push({left,right:Math.min(W,b.x)});left=Math.max(left,b.x+T);}if(left<W-eps)gaps.push({left,right:W});return gaps;
}
export function newDrawerPosition(c:Component,L:number,section:number,height=6){
 if(!drawerHeights.includes(height))return null;
 const b=componentBays(c,L)[section]||componentBays(c,L)[0],H=boxHeight(c)-1.5;
 const horizontals=[...c.shelves,...automaticSupports(c,L)].filter(s=>s.orientation==='horizontal');
 const obstacles=[...horizontals.map(s=>({x:s.x,w:s.w,y:s.y,h:shelfThickness(s)})),...c.drawers.map(r=>({x:r.x,w:r.span,y:r.y,h:r.height}))];
 // Keep the usual 2-inch start where it fits, then search real opening boundaries,
 // including the Boxing bottom and a row that reuses the Boxing top.
 const candidates=[2,0,H-height,...obstacles.map(o=>o.y+o.h),...c.shelves.filter(s=>s.orientation==='vertical').map(s=>s.y+s.h)];
 const ys=[...new Set(candidates)].filter(y=>Number.isFinite(y)&&y>=-eps&&y+height<=H+eps)
 .sort((a,b)=>(a<2-eps?1:0)-(b<2-eps?1:0)||a-b);
 for(const value of ys){const y=Math.max(0,value),top=y+height,ceiling=Math.abs(top-H)<eps;
 if(!ceiling&&top+T>H+eps)continue;
 for(const g of drawerOpenings(c,L,{y,height}).filter(g=>g.left>=b.x-eps&&g.right<=b.x+b.w+eps&&g.right-g.left>=6.25-eps)){
 const intersects=(o:{x:number,w:number,y:number,h:number},bottom:number,end:number)=>o.x<g.right-eps&&o.x+o.w>g.left+eps&&o.y<end-eps&&o.y+o.h>bottom+eps;
 if(obstacles.some(o=>intersects(o,y,top)))continue;
 const reusesTop=ceiling||horizontals.some(s=>s.material!=='glass'&&Math.abs(s.y-top)<1/16+eps&&s.x<=g.left+eps&&s.x+s.w>=g.right-eps);
 if(!reusesTop&&obstacles.some(o=>intersects(o,top,top+T)))continue;
 return {x:g.left,span:g.right-g.left,y,height};
 }}return null;
}
export function verticalBase(c:Component,L:number,s:Shelf){
 if(s.baseSupport===null)return '';
 if(s.baseSupport==='bottom')return 'bottom';
 if(s.baseSupport==='new')return 'new';
 if(s.baseSupport==='existing')return 'shelf:'+s.baseShelfId;
 if(Math.abs(s.y)<eps)return 'bottom';
 const base=[...c.shelves,...automaticSupports(c,L)].find(b=>b.orientation==='horizontal'&&b.material!=='glass'&&Math.abs(b.y+T-s.y)<1/16+eps&&b.x<=s.x+eps&&b.x+b.w>=s.x+T-eps);
 return base?'shelf:'+base.id:'';
}
export function syncVerticalBases(c:Component):Component{
 const L=splitLengths(c.l,c.split)[0],bases=[...c.shelves,...automaticSupports(c,L)];
 return {...c,shelves:c.shelves.map(s=>{if(s.orientation!=='vertical'||s.baseSupport!=='existing')return s;const b=bases.find(b=>b.id===s.baseShelfId&&b.orientation==='horizontal'&&b.material!=='glass');if(!b)return s;const y=b.y+T;return {...s,y,h:Math.max(0,Math.min(s.h,boxHeight(c)-1.5-y))};})};
}
export function verticalOpening(c:Component,L:number,s:{x:number,y:number,id?:string}){
 const H=boxHeight(c)-1.5,blockers=[...c.shelves,...automaticSupports(c,L)].filter(b=>b.id!==s.id&&b.x+(b.orientation==='vertical'?T:b.w)>s.x+eps&&b.x<s.x+T-eps).map(b=>({y:b.y,h:b.orientation==='vertical'?b.h:shelfThickness(b)}));
 blockers.push(...drawerDividers(c).filter(b=>b.x+T>s.x+eps&&b.x<s.x+T-eps).map(b=>({y:b.y,h:b.h})));
 const intervals:{bottom:number,top:number}[]=[];let bottom=0;
 for(const b of blockers.sort((a,b)=>a.y-b.y)){if(b.y>bottom+eps)intervals.push({bottom,top:Math.min(H,b.y)});bottom=Math.max(bottom,b.y+b.h);}
 if(bottom<H-eps)intervals.push({bottom,top:H});return intervals.find(g=>s.y>=g.bottom-eps&&s.y<g.top-eps)||{bottom:s.y,top:s.y};
}
export function shelfOpenings(c:Component,L:number,y:number,ignoreId?:string,height=T){
 const W=L-1.5,H=boxHeight(c)-1.5;
 const blockers=[...structuralSupports(c,L).map(b=>({x:b.x,w:T,y:0,h:H})),...c.shelves.filter(s=>s.orientation==='vertical'&&s.id!==ignoreId).map(s=>({x:s.x,w:T,y:s.y,h:s.h})),...drawerDividers(c)]
 .filter(v=>y+height>v.y+eps&&y<v.y+v.h-eps).sort((a,b)=>a.x-b.x);
 const gaps:{left:number,right:number}[]=[];let left=0;
 for(const b of blockers){if(b.x>left+eps)gaps.push({left,right:Math.min(W,b.x)});left=Math.max(left,b.x+b.w);}
 if(left<W-eps)gaps.push({left,right:W});return gaps;
}
export function shelfOpening(c:Component,L:number,s:{x:number,y:number,id?:string,material?:Shelf['material']}){return shelfOpenings(c,L,s.y,s.id,s.material==='glass'?8/25.4:T).find(g=>s.x>=g.left-eps&&s.x<g.right-eps)||{left:s.x,right:s.x};}
// Missing sections are deliberately off: no section inherits another section's doors.
export function doorSection(c:Component,index:number){
 const stored=c.doors[index];
 return {...stored,type:stored?.type??'normal',count:stored?.count??2,handles:stored?.handles??1,swing:stored?.swing??'side',hingeSide:stored?.hingeSide??'left',enabled:!!stored&&(stored.enabled??stored.type!=='none'),placement:stored?.placement??c.placement};
}
export function updateDoorSection(c:Component,index:number,patch:Partial<DoorSection>):Component{
 const doors=c.doors.map(d=>({...d,...(d.handle?{handle:{...d.handle}}:{})}));
 while(doors.length<=index)doors.push({type:'normal',count:2,handles:1,enabled:false});
 doors[index]={...doorSection(c,index),...patch};if(patch.enabled&&doors[index].type==='none')doors[index].type='normal';
 return {...c,doors};
}
type DoorEdge='outer'|'shared'|'open';
export type DoorOpening={id:string,bay:number,x:number,y:number,w:number,h:number,whole:boolean,spansShelves?:boolean,shelvesCovered?:number,edges:{left:DoorEdge,right:DoorEdge,bottom:DoorEdge,top:DoorEdge}};
const wholeDoorId=(i:number)=>'section:'+i;
export const doorOpeningId=(c:Component,i:number)=>c.doors[i]?.opening??wholeDoorId(i);
const rectOverlaps=(a:Rect,b:Rect)=>a.x<b.x+b.w-eps&&a.x+a.w>b.x+eps&&a.y<b.y+b.h-eps&&a.y+a.h>b.y+eps;
export function doorOpenings(c:Component,L:number):DoorOpening[]{
 const W=L-1.5,H=boxHeight(c)-1.5;if(!(W>0&&H>0&&Number.isFinite(W+H)))return [];
 const close=(a:number,b:number)=>Math.abs(a-b)<eps;
 const whole=componentBays(c,L).map((b,i):DoorOpening=>({id:wholeDoorId(i),bay:i,x:b.x,y:0,w:b.w,h:H,whole:true,edges:{left:close(b.x,0)?'outer':'shared',right:close(b.x+b.w,W)?'outer':'shared',top:'outer',bottom:'outer'}}));
 // Split boxes share their original section settings. Custom shelf/drawer layouts
 // already require separate Boxing components for these units.
 if(c.kind!=='Boxing'||c.l>102||(!c.shelves.length&&!c.drawers.length))return whole;
 const panels=[...c.shelves,...automaticSupports(c,L)].map(s=>({x:s.x,y:s.y,w:s.orientation==='vertical'?T:s.w,h:s.orientation==='vertical'?s.h:shelfThickness(s),vertical:s.orientation==='vertical'})).filter(s=>s.w>eps&&s.h>eps&&Number.isFinite(s.x+s.y+s.w+s.h));
 const occupied=[...panels,...c.drawers.filter(r=>r.span>eps&&r.height>eps).map(r=>({x:r.x,y:r.y,w:r.span,h:r.height}))];
 const clear:DoorOpening[]=[];
 for(const bay of whole){
  const far=bay.x+bay.w;
  // A door can run in front of internal horizontal shelves. Keep the smaller
  // panel-bounded openings as choices, and offer a spanning opening where a
  // drawer above those shelves leaves the lower part of this bay exposed.
  const bayPanels=panels.filter(p=>rectOverlaps(bay,p));
  const bayDrawers=c.drawers.filter(r=>r.span>eps&&r.height>eps&&rectOverlaps(bay,{x:r.x,y:r.y,w:r.span,h:r.height})).map(r=>({x:r.x,y:r.y,w:r.span,h:r.height}));
  const variants=[occupied.filter(b=>rectOverlaps(bay,b))];
  if(bayDrawers.length&&bayPanels.some(p=>!p.vertical))variants.push([...bayPanels.filter(p=>p.vertical),...bayDrawers]);
 for(const [variant,blocks] of variants.entries()){
  if(!blocks.length)continue;
  const levels=[...new Set([0,H,...blocks.flatMap(b=>[Math.max(0,b.y),Math.min(H,b.y+b.h)])])].sort((a,b)=>a-b);
  let previous:Rect[]=[];const spaces:Rect[]=[];
  for(let i=0;i<levels.length-1;i++){
   const y=levels[i],top=levels[i+1],next:Rect[]=[];
   if(top-y<=eps)continue;
   const spans=blocks.filter(b=>b.y<top-eps&&b.y+b.h>y+eps).sort((a,b)=>a.x-b.x);
   const gap=(x:number,end:number)=>{
    if(end-x<=eps)return;
    const last=previous.find(a=>close(a.x,x)&&close(a.w,end-x));
    if(last){last.h=top-last.y;next.push(last);}else{const a={x,y,w:end-x,h:top-y};spaces.push(a);next.push(a);}
   };
   let x=bay.x;
   for(const s of spans){gap(x,Math.min(s.x,far));x=Math.max(x,s.x+s.w);}
   gap(x,far);previous=next;
  }
  for(const a of spaces){
   if(a.w<=.25||a.h<=.25)continue;
   const right=a.x+a.w,top=a.y+a.h;
   const v=(s:Rect)=>s.y<=a.y+eps&&s.y+s.h>=top-eps,h=(s:Rect)=>s.x<=a.x+eps&&s.x+s.w>=right-eps;
   const edges:DoorOpening['edges']={
    left:close(a.x,bay.x)?bay.edges.left:panels.some(s=>close(s.x+s.w,a.x)&&v(s))?'shared':'open',
    right:close(right,far)?bay.edges.right:panels.some(s=>close(s.x,right)&&v(s))?'shared':'open',
    bottom:close(a.y,0)?'outer':panels.some(s=>close(s.y+s.h,a.y)&&h(s))?'shared':'open',
    top:close(top,H)?'outer':panels.some(s=>close(s.y,top)&&h(s))?'shared':'open',
   };
   if(Object.values(edges).every(e=>e==='open'))continue;
   const id='opening:'+bay.bay+':'+[a.x,a.y,right,top].map(n=>Math.round(n*1e6)).join(':');
   if(!clear.some(o=>o.id===id))clear.push({...a,id,bay:bay.bay,whole:false,spansShelves:variant>0&&bayPanels.some(p=>!p.vertical&&rectOverlaps(a,p)),edges});
  }
 }
 }
 // Offer every contiguous run of shelf-bounded openings as one door opening.
 // The shelves stay inside the carcass; only the door front spans them.
 const spans:DoorOpening[]=[];
 for(const bay of whole){
  const cells=clear.filter(o=>o.bay===bay.bay&&!o.spansShelves).sort((a,b)=>a.y-b.y);
  for(const first of cells){
   let last=first;
   for(const next of cells.filter(o=>close(o.x,first.x)&&close(o.w,first.w)&&o.y>first.y+eps)){
    if(!close(next.y,last.y+last.h+T))break;
    const top=next.y+next.h,covered=panels.filter(p=>!p.vertical&&p.y>=first.y+first.h-eps&&p.y+p.h<=top-next.h+eps&&p.x<=first.x+eps&&p.x+p.w>=first.x+first.w-eps).length;
    if(covered){
     const candidate:DoorOpening={id:'span:'+bay.bay+':'+[first.x,first.y,first.x+first.w,top].map(n=>Math.round(n*1e6)).join(':'),bay:bay.bay,x:first.x,y:first.y,w:first.w,h:top-first.y,whole:false,spansShelves:true,shelvesCovered:covered,edges:{left:first.edges.left,right:first.edges.right,bottom:first.edges.bottom,top:next.edges.top}};
     if(!spans.some(o=>o.id===candidate.id))spans.push(candidate);
    }
    last=next;
   }
  }
 }
 return [...clear,...spans].sort((a,b)=>a.x-b.x||a.y-b.y||a.h-b.h).concat(whole);
}
function swingWholeSection(n:number,placement:'overlay'|'inset',L:number,H:number,m:number,b:number){
 const count=m+1;
 const span=placement==='overlay'?L/count:(L-(m+2)*T)/count;
 const leftGap=placement==='overlay'?.125*(b===0?1:.5):.125,rightGap=placement==='overlay'?.125*(b===count-1?1:.5):.125;
 const x=placement==='overlay'?b*span+leftGap:T+b*(span+T)+leftGap;
 return {n,w:(span-leftGap-rightGap-.125*(n-1))/n,h:(placement==='overlay'?H:H-2*T)-.25,x,y:placement==='overlay'?.125:T+.125,placement};
}
function swingOpening(choice:ReturnType<typeof doorSection>,opening:DoorOpening,L:number,H:number,m:number,custom:boolean){
 const {n,placement}={n:choice.count,placement:choice.placement};
 if(opening.whole&&m<=1&&!custom)return swingWholeSection(n,placement,L,H,m,opening.bay);
 const allowance=(edge:DoorEdge)=>placement==='inset'?-.125:edge==='outer'?.75-.125:edge==='shared'?T/2-.0625:-.125;
 const {left,right,bottom,top}=opening.edges,l=allowance(left),r=allowance(right),b=allowance(bottom),t=allowance(top);
 return {n,w:(opening.w+l+r-.125*(n-1))/n,h:opening.h+b+t,x:.75+opening.x-l,y:.75+opening.y-b,placement};
}
export function swingDoorGroups(c:Component,L:number,H:number,m=supportCount(c,L),openings=doorOpenings(c,L)){
 const custom=hasCustomSectionWidths(c,L);
 return c.doors.flatMap((stored,slot)=>{
  const choice=doorSection(c,slot),id=doorOpeningId(c,slot);
  if(!choice.enabled||choice.type==='none'||(!stored.opening&&slot>m)||(c.l>102&&id.startsWith('section:')&&Number(id.slice(8))>m))return [];
  const opening=openings.find(o=>o.id===id);
  return [{slot,choice,opening,shape:opening?(choice.type==='rolling'?{n:1,w:opening.w,h:opening.h,x:.75+opening.x,y:.75+opening.y,placement:'inset' as const}:swingOpening(choice,opening,L,H,m,custom)):undefined}];
 });
}
export function doorOpeningAvailable(opening:DoorOpening,groups:ReturnType<typeof swingDoorGroups>,except=-1){
 return !groups.some(g=>g.slot!==except&&g.opening&&rectOverlaps(opening,g.opening));
}
export function swingHingeEdges(choice:ReturnType<typeof doorSection>){
 return choice.swing==='side'?(choice.count===2?['left','right'] as const:[choice.hingeSide]):[choice.swing];
}
export function swingCountSpan(c:Component,L:number,opening:DoorOpening){
 if(!opening.whole)return opening.w;
 if(!hasCustomSectionWidths(c,L))return L/(supportCount(c,L)+1);
 return opening.w+(opening.edges.left==='outer'?.75:T/2)+(opening.edges.right==='outer'?.75:T/2);
}
export function swingDoorOpeningIssue(c:Component,L:number,group:ReturnType<typeof swingDoorGroups>[number],groups:ReturnType<typeof swingDoorGroups>){
 const {opening,shape,slot,choice}=group;
 if(!opening||!shape)return 'The selected opening has changed or is unavailable. Choose an opening again.';
 if(!doorOpeningAvailable(opening,groups,slot))return 'This opening overlaps another swing door group. Choose a different opening.';
 if(choice.type==='rolling'&&c.drawers.some(row=>drawerFronts(c,L,row).some(f=>rectOverlaps({x:shape.x,y:shape.y,w:shape.w,h:shape.h},{...f,x:f.x+.75,y:f.y+.75}))))return 'The shutter overlaps a drawer front. Choose an exposed opening.';
 if(!opening.whole){
  if(choice.type!=='rolling'&&swingHingeEdges(choice).some(edge=>opening.edges[edge]==='open'))return 'The selected hinge edge has no supporting panel. Change the swing direction, hinge side or opening.';
  const front={...shape,w:shape.w*shape.n+.125*(shape.n-1)};
  if(c.drawers.some(row=>drawerFronts(c,L,row).some(f=>rectOverlaps(front,{...f,x:f.x+.75,y:f.y+.75}))))return 'The door overlaps a drawer front. Try an inset door or adjust the drawer layout.';
 }
}
export type DoorLeaf={x:number,y:number,w:number,h:number,type:string,section:number,index:number,handles:number,hinge:'left'|'right'|'top'|'bottom'|'sliding'|'rolling',placement:'overlay'|'inset'};
export function doorLeaves(c:Component,L:number,H:number):DoorLeaf[]{
 if(c.doorMode==='none')return [];
 if(c.doorMode==='sliding'){const n=Math.min(30,Math.max(2,Math.floor(c.slidingCount))),w=(L-2*T+4*(n-1))/n;return Array.from({length:n},(_,i)=>({x:T+i*(w-4),y:T,w,h:H-2*T,type:'sliding',section:0,index:i,handles:1,hinge:'sliding',placement:'inset'}));}
 return swingDoorGroups(c,L,H).flatMap(({slot,choice,shape:s})=>s&&s.w>0&&s.h>0?Array.from({length:Math.min(2,Math.max(1,s.n))},(_,i):DoorLeaf=>({x:s.x+i*(s.w+.125),y:s.y,w:s.w,h:s.h,type:choice.type,section:slot,index:i,handles:choice.handles,hinge:choice.type==='rolling'?'rolling':choice.swing==='top'?'top':choice.swing==='bottom'?'bottom':s.n===1?choice.hingeSide:i===0?'left':'right',placement:s.placement})):[]);
}
export const doorHandleHeight=(hinge:DoorLeaf['hinge'],height:number)=>hinge==='top'?Math.min(.8,height/2):hinge==='bottom'?Math.max(height/2,height-.8):height/2;
export const doorSwingLabel=(hinge:DoorLeaf['hinge'])=>hinge==='top'?'Top swing · opens up':hinge==='bottom'?'Bottom swing · opens down':hinge==='sliding'?'Sliding':hinge==='rolling'?'Rolls up':'Side swing · '+hinge+' hinges';

export type ConstructionDetail={unitId?:string,componentId?:string,unit?:string,component?:string,label:string,size:string,position:string};
const inch=(n:number)=>Number.isFinite(n)?Number(n.toFixed(3))+'″':'—';
export function handleSpec(value:HandleSpec|undefined,h:number){return {length:value?.length??4,color:value?.color??'Silver',height:value?.height??h/2};}
export function drawerGeometry(row:Component['drawers'][number]){
 const opening=(row.span-(row.count-1)*T)/row.count,insetHeight=row.height-(row.heightMode==='fill'?.25:0);
 return {opening,front:opening-.25,body:opening-.5,insetHeight,wallHeight:insetHeight-1};
}
export type DrawerFront={rowId:string,index:number,x:number,y:number,w:number,h:number,openingX:number,openingW:number,placement:'inset'|'overlay'};
// Front coordinates use the same inside-left / inside-bottom origin as the row.
// Overlay changes only this 18mm face; body, channel clearance and support geometry stay inside.
export function drawerFronts(c:Component,L:number,row:Component['drawers'][number]):DrawerFront[]{
 const g=drawerGeometry(row),W=L-1.5,H=boxHeight(c)-1.5,placement=row.placement??'inset';
 const horizontal=[...c.shelves,...automaticSupports(c,L)].filter(s=>s.orientation==='horizontal'&&s.x<=row.x+eps&&s.x+s.w>=row.x+row.span-eps);
 const vertical=[...structuralSupports(c,L).map(b=>({x:b.x,y:0,h:H})),...c.shelves.filter(s=>s.orientation==='vertical')]
 .filter(s=>s.y<=row.y+eps&&s.y+s.h>=row.y+row.height-eps);
 const bottomCover=Math.abs(row.y)<eps?.75:horizontal.some(s=>Math.abs(s.y+T-row.y)<eps)?T/2:0;
 const top=row.y+row.height,topCover=Math.abs(top-H)<eps?.75:horizontal.some(s=>Math.abs(s.y-top)<eps)?T/2:0;
 const neighbours=c.drawers.filter(r=>r.id!==row.id&&r.x<row.x+row.span-eps&&r.x+r.span>row.x+eps);
 const bottomGap=bottomCover===T/2||neighbours.some(r=>Math.abs(r.y+r.height-row.y)<eps)?.0625:.125;
 const topGap=topCover===T/2||neighbours.some(r=>Math.abs(r.y-top)<eps)?.0625:.125;
 return Array.from({length:Math.min(100,Math.max(0,Math.floor(row.count)))},(_,index)=>{
 const left=row.x+index*(g.opening+T),right=left+g.opening;
 if(placement==='inset')return {rowId:row.id,index,x:left+.125,y:row.y+(row.heightMode==='fill'?.125:0),w:g.front,h:g.insetHeight,openingX:left,openingW:g.opening,placement};
 const lc=Math.abs(left)<eps?.75:index>0||vertical.some(s=>Math.abs(s.x+T-left)<eps)?T/2:0;
 const rc=Math.abs(right-W)<eps?.75:index<row.count-1||vertical.some(s=>Math.abs(s.x-right)<eps)?T/2:0;
 const lg=lc===T/2?.0625:.125,rg=rc===T/2?.0625:.125;
 return {rowId:row.id,index,x:left-lc+lg,y:row.y-bottomCover+bottomGap,w:g.opening+lc+rc-lg-rg,h:row.height+bottomCover+topCover-bottomGap-topGap,openingX:left,openingW:g.opening,placement};
 });
}
export function drawerHeightOpening(c:Component,L:number,row:Component['drawers'][number]){
 // Remove this row before generating supports so its own automatic shelf cannot stop its fill.
 const other={...c,drawers:c.drawers.filter(r=>r.id!==row.id)},H=boxHeight(c)-1.5;
 const panels=[...c.shelves,...automaticSupports(other,L)].map(s=>({x:s.x,w:s.orientation==='horizontal'?s.w:T,y:s.y,h:s.orientation==='horizontal'?shelfThickness(s):s.h,panel:s.orientation==='horizontal'&&s.material!=='glass'}));
 const obstacles=[...panels,...other.drawers.map(r=>({x:r.x,w:r.span,y:r.y,h:r.height,panel:false}))]
 .filter(o=>o.x<row.x+row.span-eps&&o.x+o.w>row.x+eps);
 if(row.y<0||row.y>=H-eps||obstacles.some(o=>o.y<=row.y+eps&&o.y+o.h>row.y+eps))return {height:0,top:row.y,reusesTop:false};
 const boundary=obstacles.filter(o=>o.y>row.y+eps).reduce((v,o)=>Math.min(v,o.y),H);
 const reusesTop=Math.abs(boundary-H)<eps||obstacles.some(o=>o.panel&&Math.abs(o.y-boundary)<eps&&o.x<=row.x+eps&&o.x+o.w>=row.x+row.span-eps);
 const top=boundary-(row.topSupport!==false&&!reusesTop?T:0);
 return {height:Math.max(0,top-row.y),top,reusesTop};
}
export function fillDrawerHeight(c:Component,L:number,row:Component['drawers'][number]){
 const opening=drawerHeightOpening(c,L,row),candidate={...row,height:opening.height,heightMode:'fill' as const};
 if(drawerGeometry(candidate).insetHeight<minDrawerHeight-eps||!drawerOpenings(c,L,candidate).some(g=>row.x>=g.left-eps&&row.x+row.span<=g.right+eps))return null;
 return candidate;
}
export function setDrawerTopSupport(c:Component,L:number,id:string,enabled:boolean){
 const row=c.drawers.find(r=>r.id===id);if(!row)return c;
 const changed={...row,topSupport:enabled},next={...c,drawers:c.drawers.map(r=>r.id===id?changed:r)};
 if(row.heightMode!=='fill')return next;
 const filled=fillDrawerHeight(next,L,changed);
 return filled?{...next,drawers:next.drawers.map(r=>r.id===id?filled:r)}:next;
}
export function handleGeometry(c:Component,L:number,H:number){
 const out:{label:string,x:number,y:number,length:number,color:string,vertical:boolean,valid:boolean,owner:'door'|'drawer',visibleInDoorView:boolean}[]=[];
 const leaves=doorLeaves(c,L,H);
 for(const d of leaves){if(d.type==='profile'||d.type==='rolling')continue;const value=d.type==='sliding'?c.slidingHandle:doorSection(c,d.section).handle,spec=handleSpec(value,d.h);if(value?.height==null)spec.height=doorHandleHeight(d.hinge,d.h);
 const count=Math.min(20,Math.max(0,Math.floor(d.handles))),vertical=d.hinge!=='top'&&d.hinge!=='bottom';
 for(let i=0;i<count;i++){const localX=vertical?(count===1?(d.hinge==='sliding'?(d.index%2?.8:d.w-.8):d.hinge==='right'?.8:d.w-.8):d.w*(i+1)/(count+1)):d.w*(i+1)/(count+1);out.push({label:(d.type==='sliding'?'Sliding door ':('Section '+(d.section+1)+' door '))+(d.index+1)+' handle '+(i+1),x:d.x+localX,y:d.y+spec.height,length:spec.length,color:spec.color,vertical,owner:'door',visibleInDoorView:true,valid:handleLengths.includes(spec.length as any)&&handleColors.includes(spec.color as any)&&Number.isFinite(spec.height)&&(vertical?spec.height>=spec.length/2&&spec.height+spec.length/2<=d.h&&localX>=0&&localX<=d.w:spec.height>=0&&spec.height<=d.h&&localX-spec.length/2>=0&&localX+spec.length/2<=d.w)});}}
 for(const [ri,row] of c.drawers.entries())for(const f of drawerFronts(c,L,row)){const spec=handleSpec(row.handle,f.h),visibleInDoorView=!leaves.some(d=>d.x<f.x+.75+f.w-eps&&d.x+d.w>f.x+.75+eps&&d.y<f.y+.75+f.h-eps&&d.y+d.h>f.y+.75+eps);out.push({label:'Drawer row '+(ri+1)+' / '+(f.index+1)+' handle',x:.75+f.x+f.w/2,y:.75+f.y+spec.height,length:spec.length,color:spec.color,vertical:false,owner:'drawer',visibleInDoorView,valid:handleLengths.includes(spec.length as any)&&handleColors.includes(spec.color as any)&&Number.isFinite(spec.height)&&spec.height>=0&&spec.height<=f.h&&spec.length<=f.w});}
 return out;
}
export function constructionDetails(c:Component,L=splitLengths(c.l,c.split)[0],boxIndex=0,boxCount=splitLengths(c.l,c.split).length):ConstructionDetail[]{
 const out:ConstructionDetail[]=[],D=shelfDepth(c),depth=D===null?'set depth':inch(D);
 const add=(label:string,size:string,position:string)=>out.push({label,size,position});
 if(c.kind==='Boxing'&&c.legs)add('Overall height',inch(c.h)+' = box '+inch(boxHeight(c))+' + legs '+inch(legHeight(c)),'Floor to finished top. Other part positions are measured from the box, excluding legs.');
 if(c.kind==='Boxing'){
 for(const cover of legCoverPanels(c,L,boxIndex,0,boxCount))add(cover.label,inch(cover.w)+' × '+inch(cover.h)+' × 8mm '+c.material,'Below the Boxing, from floor to box underside. Full side length; height equals leg height.');
 for(const [i,s] of [...c.shelves,...automaticSupports(c,L)].entries())add((s as AutoSupport).label||(s.material==='glass'?'Glass shelf ':s.orientation==='horizontal'?'Horizontal shelf ':'Vertical shelf ')+(i+1),(s.orientation==='horizontal'?inch(s.w)+' × '+depth:inch(s.h)+' × '+depth)+' × '+(s.material==='glass'?'8mm glass':'18mm'),'Left '+inch(s.x)+'; bottom '+inch(s.y)+' from inside left/bottom');
 for(const b of drawerDividers(c))add(b.label,inch(b.h)+' × '+depth+' × 18mm','Left '+inch(b.x)+'; bottom '+inch(b.y)+' from inside left/bottom');
 for(const [i,row] of c.drawers.entries()){const g=drawerGeometry(row);for(const f of drawerFronts(c,L,row))add('Drawer row '+(i+1)+' / '+(f.index+1), 'Front '+inch(f.w)+' × '+inch(f.h)+'; body '+inch(g.body)+' W × '+inch(g.wallHeight)+' wall H × '+depth+' D incl. front','Opening left '+inch(f.openingX)+'; row bottom '+inch(row.y)+'; front left '+inch(f.x)+'; front bottom '+inch(f.y)+' from inside left/bottom; '+(f.placement==='overlay'?'overlay front only':'inside front')+(row.heightMode==='fill'?'; height filled to opening':'')+(row.topSupport===false?'; automatic top support off':''));}
 }
 for(const d of doorLeaves(c,L,boxHeight(c)))add(d.type==='rolling'?'Rolling shutter '+(d.section+1)+'.'+(d.index+1):(d.type==='profile'?'Profile':d.type==='sliding'?'Sliding':'Normal')+' door '+(d.section+1)+'.'+(d.index+1),inch(d.w)+' × '+inch(d.h),'Left '+inch(d.x)+'; bottom '+inch(d.y)+' from outer left/bottom; '+doorSwingLabel(d.hinge)+'; '+d.placement+(d.type==='rolling'?'; confirm cassette and guide clearance with supplier':''));
 for(const h of handleGeometry(c,L,boxHeight(c)))add(h.label,inch(h.length)+' · '+h.color+' · '+(h.vertical?'vertical':'horizontal'),'Centre left '+inch(h.x)+'; above '+inch(h.y)+' from outer left/bottom');
 return out;
}
export function renumberPieces(pieces:Piece[]){const counts=new Map<string,number>();for(const p of pieces){const thickness=p.material.match(/· (.+)mm$/)?.[1]?.replace('.','p')||'';
 const prefix=p.kind==='laminate'?(p.material.startsWith('Internal')?'IL':'EL'):p.material.startsWith('Plywood')?'PLY'+thickness:p.material.startsWith('MDF')?'MDF'+thickness:p.material.startsWith('Block Board')?'BB'+thickness:'BOARD'+thickness;
 const n=(counts.get(prefix)||0)+1;counts.set(prefix,n);p.id=prefix+'-'+String(n).padStart(3,'0');}}
export function shelfDepth(c:Component){const setback=c.doorMode==='sliding'?4:c.doorMode==='swing'?1:c.frontSetback;return setback===null?null:c.d-setback-8/25.4;}
function rotations(p:Piece){return p.rotate?[[p.w,p.h,false],[p.h,p.w,true]] as const:p.forcedRotate?[[p.h,p.w,true]] as const:[[p.w,p.h,false]] as const;}
function packAttempt(ps:Piece[],order:number,split:number,fitMode:number):Sheet[]{
 const sorted=[...ps].sort((a,b)=>{const score=(p:Piece)=>order===0?p.w*p.h:order===1?Math.max(p.w,p.h):p.w+p.h;return score(b)-score(a)||b.h-a.h||a.id.localeCompare(b.id);});
 const sheets:Sheet[]=[];
 for(const p of sorted){
 let best:{si:number,ri:number,w:number,h:number,rot:boolean,score:number}|null=null;
 for(let si=0;si<sheets.length;si++)for(let ri=0;ri<sheets[si].offcuts.length;ri++){
 const r=sheets[si].offcuts[ri];for(const [w,h,rot] of rotations(p)){if(w>r.w+eps||h>r.h+eps)continue;
 const score=fitMode===0?(r.w*r.h-w*h)*10000+Math.min(r.w-w,r.h-h):Math.min(r.w-w,r.h-h)*10000+r.w*r.h-w*h;
 if(!best||score<best.score)best={si,ri,w,h,rot,score};}
 }
 if(!best){
 const choices=rotations(p).filter(([w,h])=>w<=96+eps&&h<=48+eps);if(!choices.length)continue;
 const [w,h,rot]=choices[0];sheets.push({group:p.group,material:p.material,index:sheets.length+1,pieces:[],offcuts:[{x:0,y:0,w:96,h:48}],used:0});best={si:sheets.length-1,ri:0,w,h,rot,score:0};
 }
 const s=sheets[best.si],r=s.offcuts.splice(best.ri,1)[0],w=best.w,h=best.h;
 s.pieces.push({...p,x:r.x,y:r.y,pw:w,ph:h,rotated:best.rot});s.used+=w*h;
 const rw=r.w-w-K,rh=r.h-h-K;
 const vertical=split===0?rw>rh:rw<rh;
 if(vertical){if(rw>eps)s.offcuts.push({x:r.x+w+K,y:r.y,w:rw,h:r.h});if(rh>eps)s.offcuts.push({x:r.x,y:r.y+h+K,w:w,h:rh});}
 else {if(rh>eps)s.offcuts.push({x:r.x,y:r.y+h+K,w:r.w,h:rh});if(rw>eps)s.offcuts.push({x:r.x+w+K,y:r.y,w:rw,h:h});}
 }
 return sheets;
}
export function pack(ps:Piece[]):Sheet[]{
 const groups=new Map<string,Piece[]>();for(const p of ps){const a=groups.get(p.group)||[];a.push(p);groups.set(p.group,a);}
 const out:Sheet[]=[];
 for(const [,p] of groups){let best:Sheet[]|null=null,bScore=-Infinity;for(let o=0;o<3;o++)for(let s=0;s<2;s++)for(let f=0;f<2;f++){
 const a=packAttempt(p,o,s,f),score=a.reduce((v,x)=>v+x.offcuts.reduce((z,r)=>z+(r.w*r.h)**2,0),0);
 if(!best||a.length<best.length||(a.length===best.length&&score>bScore)){best=a;bScore=score;}
 }out.push(...(best||[]));}
 return out;
}
function subtract(a:Rect,b:Rect):Rect[]{const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),r=Math.min(a.x+a.w,b.x+b.w),t=Math.min(a.y+a.h,b.y+b.h);if(r<=x||t<=y)return[a];const z:Rect[]=[];if(x>a.x)z.push({x:a.x,y:a.y,w:x-a.x,h:a.h});if(r<a.x+a.w)z.push({x:r,y:a.y,w:a.x+a.w-r,h:a.h});if(y>a.y)z.push({x,y:a.y,w:r-x,h:y-a.y});if(t<a.y+a.h)z.push({x,y:t,w:r-x,h:a.y+a.h-t});return z;}
export function calculate(project:Project,unitId?:string,options:{panelsOnly?:boolean,ignoreFaceAssignments?:boolean}={}):Result{
 const units=unitId?project.units.filter(u=>u.id===unitId):project.units;
 const r:Result={finishFaces:[],finishSpecs:structuredClone(project.externalFinishes||[]),pieces:[],sheets:[],hardware:[],notes:[],errors:[],assemblies:[],glass:[],profiles:[],profileStocks:[],scope:unitId?(units[0]?.name||'Unit'):project.name,units:units.length,createdAt:new Date().toISOString(),areas:{board:0,internal:0,external:0},edge:0,tape:0};
 const catalog=project.externalFinishes||[],registered=new Map<string,FinishFace>(),checkedFaces=new Set<string>();
 if(!options.ignoreFaceAssignments)r.errors.push(...finishLibraryErrors(catalog));
 const hardware=new Map<string,Line>();let seq=0,edgeArea=0,jointArea=0,shelfJointLength=0,closedJointLength=0;
 const add=(name:string,value:number|null,unit='pcs',note?:string)=>{const old=hardware.get(name);hardware.set(name,{name,value:old?.value===null||value===null?null:(old?.value||0)+value,unit,note:note||old?.note});};
 const issue=(c:Component,u:Unit,s:string)=>r.errors.push(u.name+' / '+c.name+': '+s);
 const note=(s:string)=>{if(!r.notes.includes(s))r.notes.push(s);};
 function laminateBase(c:Component,u:Unit,label:string,w:number,h:number,external:boolean,faceKey?:string,allowSplit=false){
 if(allowSplit){const grain=external?((c as any).faceGrain?.[faceKey||'']||c.grain):'free';const plan=panelPlan(w,h,grain,c.sheetGrain);
 if(plan.parts.length>1){plan.parts.forEach((p,i)=>laminateBase(c,u,label+' · laminate part '+(i+1),p.w,p.h,external,faceKey));return;}}
 const area=w*h/144;if(external)r.areas.external+=area;else r.areas.internal+=area;
 const finish=external?c.externalFinish:c.internalFinish;
 if(!finish.trim()){issue(c,u,'Give each laminate finish a name/code before combining its sheets.');return;}
 const grain=external?((c as any).faceGrain?.[faceKey||'']||c.grain):'free';
 const sg=c.sheetGrain,force=grain!=='free'&&((grain==='height'&&sg==='length')||(grain==='length'&&sg==='width'));
 const material=(external?'External':'Internal')+' laminate · '+finish;
 r.pieces.push({id:'P'+(++seq),label:label,unit:u.name,component:c.name,unitId:u.id,componentId:c.id,material,group:material+(external&&grain!=='free'?' · sheet grain '+sg:''),w:w+2*TRIM,h:h+2*TRIM,fw:w,fh:h,rotate:grain==='free',forcedRotate:force,kind:'laminate'});
 const coverage=c.glue==='SH'?project.settings.sh:project.settings.marine;
 if(coverage>0)add('Fevicol '+c.glue+' · laminate',area/coverage,'kg');else add('Fevicol '+c.glue+' · laminate',null,'kg','Coverage required');
 if(external)r.tape+=2*2*(w+h)/12;
 }
 function laminate(c:Component,u:Unit,label:string,w:number,h:number,external:boolean,faceKey=label,allowSplit=false,window?:FinishRect,faceSize?:{w:number,h:number}){
 external=external||c.external.includes(faceKey);
 const W=faceSize?.w??w,H=faceSize?.h??h,visible=window||{x:0,y:0,w,h},registryKey=JSON.stringify([u.id,c.id,faceKey]);
 const existing=registered.get(registryKey);if(existing)existing.regions.push(visible);else{const face:FinishFace={key:faceKey,label,w:W,h:H,external,unitId:u.id,componentId:c.id,regions:[visible]};registered.set(registryKey,face);r.finishFaces!.push(face);}
 const explicit=options.ignoreFaceAssignments?undefined:c.faceFinishes?.[faceKey],defaultId=!options.ignoreFaceAssignments&&external?c.defaultExternalFinishId:undefined,assignment=explicit||defaultId?{...explicit,finishId:explicit?.finishId||defaultId}:undefined;
 if(!assignment||(!assignment.finishId&&!assignment.zones?.length&&!assignment.pattern)){laminateBase(c,u,label,w,h,external,faceKey,allowSplit);return;}
 const errors=faceFinishErrors(assignment,W,H,catalog);if(!checkedFaces.has(registryKey)){checkedFaces.add(registryKey);for(const error of errors)issue(c,u,label+': '+error);}if(errors.length)return;
 if(assignment.pattern){
 note('Pattern laminate cuts use rectangular blanks with ⅛″ trim; the finished shape is drawn inside each blank. Shape offcuts are not counted as reusable stock.');
 if(assignment.pattern.preset===20)note('Concentric arc cutting outlines use chords with at most 0.01″ radial deviation.');
 for(const region of patternRegions(assignment.pattern,W,H)){
 const clipped=region.polygons.map(p=>clipRect(p,visible)).filter(p=>p.length),finish=catalog.find(f=>f.id===(region.finishId||assignment.finishId)),scoped=finish?{...c,externalFinish:finishName(finish),grain:finish.grain,sheetGrain:finish.sheetGrain}:c;
 const batches=region.combined?[clipped]:clipped.map(p=>[p]);
 for(const batch of batches){if(!batch.length)continue;const bb=bounds(batch),plan=panelPlan(bb.w,bb.h,scoped.grain,scoped.sheetGrain);
 for(const [partIndex,part] of plan.parts.entries()){
 const window={x:bb.x+part.x,y:bb.y+part.y,w:part.w,h:part.h},polys=batch.map(p=>clipRect(p,window)).filter(p=>p.length);if(!polys.length)continue;
 const b=bounds(polys),area=polys.reduce((v,p)=>v+polygonArea(p),0)/144,material='External laminate · '+scoped.externalFinish,grain=scoped.grain,sg=scoped.sheetGrain,force=grain!=='free'&&((grain==='height'&&sg==='length')||(grain==='length'&&sg==='width'));
 if(!scoped.externalFinish.trim()){issue(c,u,'Choose a laminate code for '+region.label);continue;}
 r.areas.external+=area;
 r.pieces.push({id:'P'+(++seq),label:label+' · '+region.label+(plan.parts.length>1?' · part '+(partIndex+1):''),unit:u.name,component:c.name,unitId:u.id,componentId:c.id,panelKey:faceKey,material,group:material+(grain!=='free'?' · sheet grain '+sg:''),w:b.w+2*TRIM,h:b.h+2*TRIM,fw:b.w,fh:b.h,rotate:grain==='free',forcedRotate:force,kind:'laminate',cutShape:polys.map(p=>p.map(q=>({x:q.x-b.x,y:q.y-b.y})))});
 const coverage=scoped.glue==='SH'?project.settings.sh:project.settings.marine;add('Fevicol '+scoped.glue+' · laminate',coverage>0?area/coverage:null,'kg',coverage>0?undefined:'Coverage required');
 // 4 inch tape every 2 inches of finished external laminate perimeter.
 r.tape+=2*boundarySegments(polys).reduce((v,e)=>v+Math.hypot(e.a.x-e.b.x,e.a.y-e.b.y),0)/12;
 }
 }
 }
 return;
 }
 for(const [i,region] of finishRegions(assignment,W,H).entries()){
 const x=Math.max(region.x,visible.x),y=Math.max(region.y,visible.y),right=Math.min(region.x+region.w,visible.x+visible.w),top=Math.min(region.y+region.h,visible.y+visible.h);if(right<=x+eps||top<=y+eps)continue;
 const finish=catalog.find(f=>f.id===region.finishId),scoped=finish?{...c,externalFinish:finishName(finish),grain:finish.grain,sheetGrain:finish.sheetGrain,faceGrain:undefined}:c;
 laminateBase(scoped,u,label+(region.zoneIndex===undefined?' · base finish '+(i+1):' · finish area '+(region.zoneIndex+1)),right-x,top-y,!!finish||external,faceKey,true);
 }
 }
 function board(c:Component,u:Unit,label:string,w:number,h:number,t:number,faces:('internal'|'external')[]=[],bind=0,faceKeys:string[]=[],material?:string,splitLaminate=false,pose?:BoardPose,panelKey=label,faceWindow?:FinishRect,faceSize?:{w:number,h:number}){
 if(!(w>0&&h>0&&t>0&&Number.isFinite(w+h+t))){issue(c,u,'Invalid panel size for '+label);return;}
 const mat=(material||c.material)+' · '+t+'mm';r.areas.board+=w*h/144;
 const piece:Piece={id:'P'+(++seq),label,unit:u.name,component:c.name,unitId:u.id,componentId:c.id,panelKey,pose,material:mat,group:mat,w,h,fw:w,fh:h,rotate:true,forcedRotate:false,kind:'board'};r.pieces.push(piece);
 r.tape+=4*(w+h)/12;r.edge+=bind/12;r.tape+=2*bind/12;edgeArea+=bind*25.4*t/1000000;
 faces.forEach((f,i)=>laminate(c,u,label+' · '+(i===0?'face 1':'face 2'),w,h,f==='external',faceKeys[i]||panelKey+':'+(i?'b':'a'),splitLaminate,faceWindow,faceSize));
 return piece;
 }
 const bf=(c:Component,u:Unit,label:string,w:number,h:number,t:number,bind:number,pose?:BoardPose)=>{const key1=label+':inside',key2=label+':outside';board(c,u,label,w,h,t,[c.external.includes(key1)?'external':'internal',c.external.includes(key2)?'external':'internal'],bind,[key1,key2],undefined,false,pose);};
 function assembly(c:Component,u:Unit,label:string,w:number,h:number,t:number,plan:PanelPlan){
 if(plan.parts.length<2)return;
 r.assemblies!.push({unit:u.name,component:c.name,label,material:c.material+' · '+t+'mm',w,h,parts:plan.parts});
 note(u.name+' / '+c.name+' / '+label+': '+plan.parts.length+' joined pieces; overall dimensions unchanged. Each laminate piece includes ⅛″ trimming on every edge.');
 if(plan.unsupported){add('Panel-joint backing / fixing',null,'pcs','Joint support must be defined for '+u.name+' / '+c.name+' / '+label);note(u.name+' / '+c.name+' / '+label+': some joints need backing beyond the configured supports. Review the assembly diagram before fabrication.');}
 }
 function back(c:Component,u:Unit,label:string,w:number,h:number,x0=0){
 const keys=[label+':inside',label+':outside'],faces=keys.map(k=>c.external.includes(k)?'external':'internal') as ('external'|'internal')[];
 const centers=structuralSupports(c,w).map(s=>s.x+.75+T/2);
 const plan=panelPlan(w,h,faces.includes('external')?c.grain:'free',c.sheetGrain,centers);
 assembly(c,u,label,w,h,8,plan);
 plan.parts.forEach((p,i)=>board(c,u,label+(plan.parts.length>1?' · part '+(i+1):''),p.w,p.h,8,faces,0,keys,undefined,false,{x:x0+p.x,y:p.y,z:0,w:p.w,h:p.h,d:8/25.4},label,p,{w,h}));
 // The existing fixing row covers one edge at each supported back-panel seam.
 for(const x of plan.vertical)if(centers.some(at=>Math.abs(x-at)<eps))bodyFix(c,fix(h),'½″');
 }
 function closedFace(c:Component,u:Unit,label:string,w:number,h:number,plane:'yz'|'xz'|'xy',at:number){
 const plan=panelPlan(w,h,'free','length',[],[],0),joined=plan.parts.length>1;
 assembly(c,u,label,w,h,18,plan);
 if(joined){
 r.construction??=[];r.construction.push({unitId:u.id,componentId:c.id,unit:u.name,component:c.name,label:label+' joined face',size:inch(w)+' × '+inch(h)+' · '+plan.parts.length+' board pieces',position:'Specify joint backing/fixings before fabrication. See the matching part labels and IDs on the cutting sheets.'});
 }
 for(const [i,p] of plan.parts.entries()){
 const pose=plane==='yz'?{x:at,y:p.y,z:p.x,w:T,h:p.h,d:p.w}:plane==='xz'?{x:p.x,y:at,z:p.y,w:p.w,h:T,d:p.h}:{x:p.x,y:p.y,z:at,w:p.w,h:p.h,d:T};
 board(c,u,label+(joined?' · part '+(i+1):''),p.w,p.h,18,['external'],0,[label+':a'],undefined,true,pose,i===0?label:label+':part:'+(i+1),p,{w,h});
 }
 }
 function addHandle(value:HandleSpec|undefined,height:number,count:number){const h=handleSpec(value,height);add('Handles · '+h.length+'″ · '+h.color,count,'pcs','Overall handle length; mounting-hole centres follow the selected hardware.');}
 const bodyFix=(c:Component,count:number,size:string)=>add((c.material==='MDF'?'Screws ':'Nails ')+size,count);
 function doors(c:Component,u:Unit,L:number,H:number,m:number,x0=0,boxIndex=0){
 if(c.doorMode==='none')return;
 if(c.kind==='Framing'&&c.doorMode==='sliding'){issue(c,u,'Sliding Doors are defined for Boxing. Use Swing Doors for Framing.');return;}
 if(c.doorMode==='sliding'){
 const n=c.slidingCount,opening=L-2*T,height=H-2*T,width=(opening+4*(n-1))/n;
 if(!Number.isInteger(n)||n<2||width<MIN_DOOR_SIZE-eps||width>MAX_SLIDING_DOOR_WIDTH+eps||height<MIN_DOOR_SIZE-eps||height>MAX_DOOR_HEIGHT+eps){issue(c,u,'Sliding Doors need at least two leaves, each 3–48″ wide and 3–96″ high. Adjust the component dimensions or door count.');return;}
 for(let i=0;i<n;i++)board(c,u,'Sliding door '+(i+1),width,height,18,['internal','external'],2*(width+height),[],undefined,false,{x:x0+T+i*(width-4),y:T,z:c.d-T-(i%2)*(T+.125),w:width,h:height,d:T},'sliding:'+boxIndex+':'+i);
 add('Sliding track',L/12,'ft');add('Sliding channel sets',n,'sets');addHandle(c.slidingHandle,height,n);add('Screws ½″',Math.ceil(2*L/12)+6*n);note('Track screws use 2 per running foot, rounded up for purchasing; no additional endpoint allowance is added.');return;
 }
 const groups=swingDoorGroups(c,L,H,m);
 for(const group of groups){
 const {slot:b,choice,opening,shape}=group,openingIssue=swingDoorOpeningIssue(c,L,group,groups);
 if(openingIssue||!opening||!shape){issue(c,u,'Door group '+(b+1)+': '+(openingIssue||'Choose an opening.'));continue;}
 const {n,h,w,x,y,placement}=shape;
 if(choice.type==='rolling'){
  if(c.kind!=='Boxing'){issue(c,u,'Rolling shutters require Boxing with a supported opening.');continue;}
  if(w<MIN_ROLLING_SHUTTER_WIDTH-eps||w>MAX_ROLLING_SHUTTER_WIDTH+eps||h<MIN_ROLLING_SHUTTER_HEIGHT-eps||h>MAX_ROLLING_SHUTTER_HEIGHT+eps){issue(c,u,'Rolling shutter clear opening must be 18–48″ wide and 18–72″ high.');continue;}
  add('Rolling shutter kits · opening '+Number(w.toFixed(3))+'″ × '+Number(h.toFixed(3))+'″',1,'sets','Complete shutter, cassette, side guides and pull profile; confirm usable opening and cassette/track clearance with supplier.');
  note(u.name+' / '+c.name+' / door group '+(b+1)+': rolling shutter clear opening '+inch(w)+' × '+inch(h)+'. Supplier must confirm cassette depth, headroom and tracks before fabrication.');continue;
 }
 if(!['side','top','bottom'].includes(choice.swing)||!['left','right'].includes(choice.hingeSide)||!['overlay','inset'].includes(placement)){issue(c,u,'Choose a valid Swing Door direction, hinge side and placement in section '+(b+1)+'.');continue;}
 const boxSpan=swingCountSpan(c,L,opening);
 if(!Number.isInteger(n)||n<1||n>2){issue(c,u,'Each Swing Door section supports one or two doors under the defined rules.');continue;}
 if(boxSpan<=18+eps&&n!==1){issue(c,u,'Openings up to 18″ use one Swing Door.');continue;}
 if(w<MIN_DOOR_SIZE-eps||w>MAX_SWING_DOOR_WIDTH+eps||h<MIN_DOOR_SIZE-eps||h>MAX_DOOR_HEIGHT+eps){issue(c,u,'Swing Door leaf must be 3–48″ wide and 3–96″ high after clearances.');continue;}
 if(choice.swing!=='side'){const name=(choice.swing==='top'?'Top-swing lift / stay':'Bottom-swing support / stay')+' sets';if(choice.assistSets==null)add(name,null,'sets','Specify support hardware and sets per door for section '+(b+1)+'.');else if(!Number.isInteger(choice.assistSets)||choice.assistSets<0||choice.assistSets>20)issue(c,u,'Support / stay sets per door must be a whole number from 0 to 20.');else add(name,choice.assistSets*n,'sets');note('Top/bottom Swing Doors retain the agreed door-height hinge allowance. Select lift/support fittings separately; unspecified sets remain Input required.');}
 const hinges=h<=35?2:h<=63?3:h<=80?4:5;
 for(let j=0;j<n;j++){
 const label=(opening.whole&&opening.bay===b?'Section ':'Door group ')+(b+1)+' · door '+(j+1);
 if(choice.type==='normal'){board(c,u,label,w,h,20,['internal','external'],2*(w+h),[], 'Block Board',false,{x:x0+x+j*(w+.125),y,z:placement==='overlay'?c.d:c.d-20/25.4,w,h,d:20/25.4},'door:'+boxIndex+':'+b+':'+j);addHandle(choice.handle,h,choice.handles);add('Screws ½″',choice.handles*2);}
 else {r.glass.push({label:u.name+' / '+c.name+' / '+label,w:w-.2,h:h-.2,count:1,thickness:6});for(const length of [w,w,h,h])r.profiles.push({label:u.name+' / '+c.name+' / '+label,length});}
 const hinge=choice.swing==='side'?(n===1?choice.hingeSide:j===0?'left':'right'):choice.swing,midDoor=opening.edges[hinge]==='shared';
 add((placement==='inset'?'Embedded':midDoor?'Half Overlay':'Full Overlay')+' hinges',hinges);add('Screws ½″',hinges*6);
 }
 }
 }
 function shelvesAndDrawers(c:Component,u:Unit,L:number,H:number){
 const depth=shelfDepth(c),cw=L-1.5,ch=H-1.5;
 if((c.shelves.length||c.drawers.length)&&(!depth||depth<=0)){issue(c,u,'Choose doors or enter an explicit shelf-front setback to determine shelf and drawer depth.');return;}
 const D=depth||0;
 const auto=automaticSupports(c,L),shelves=[...c.shelves,...auto];
 for(const s of shelves){
 const horizontal=s.orientation==='horizontal',w=horizontal?s.w:T,h=horizontal?shelfThickness(s):s.h;
 if(s.x<0||s.y<0||s.x+w>cw+eps||s.y+h>ch+eps)issue(c,u,'Shelf position is outside the internal space.');
 if(horizontal){
 if(s.x+s.w>shelfOpening(c,L,s).right+eps)issue(c,u,'Horizontal shelf exceeds the available space between side panels, mid-support or vertical shelves.');
 if(s.material==='glass'){
  if(s.w<=0||D<=0)issue(c,u,'Glass shelf needs a positive length and depth.');
  r.glass.push({label:u.name+' / '+c.name+' / Glass shelf '+(c.shelves.indexOf(s)+1),w:s.w,h:D,count:1,thickness:8});
  add('Glass supports',4);
 }else{board(c,u,(s as AutoSupport).label||'Horizontal shelf '+(c.shelves.indexOf(s)+1),s.w,D,18,['internal','internal'],Math.max(s.w,D),[],undefined,false,{x:s.x+.75,y:s.y+.75,z:8/25.4,w:s.w,h:T,d:D},'shelf:'+s.id);add('Shelf bottoms',4);}
 }else{
 const base=verticalBase(c,L,s),selected=base.startsWith('shelf:')?shelves.find(b=>b.id===base.slice(6)&&b.orientation==='horizontal'):undefined;
 if(!base)issue(c,u,'Choose the base horizontal support for Vertical shelf '+(c.shelves.indexOf(s)+1)+'.');
 else if(base==='bottom'&&Math.abs(s.y)>eps||base==='new'&&s.y<T-eps||base.startsWith('shelf:')&&(!selected||selected.material==='glass'||Math.abs(selected.y+T-s.y)>1/16+eps||selected.x>s.x+eps||selected.x+selected.w<s.x+T-eps))issue(c,u,'Vertical shelf base does not match its position. Select a wooden supporting shelf or the Boxing bottom.');
 if(s.y+s.h>verticalOpening(c,L,s).top+eps)issue(c,u,'Vertical shelf exceeds its available opening. Use Fill available opening or adjust the horizontal supports.');
 if(!componentBays(c,L).some(b=>s.x>=b.x-eps&&s.x+T<=b.x+b.w+eps))issue(c,u,'Vertical shelf intersects a structural mid-support.');
 board(c,u,'Vertical shelf '+(c.shelves.indexOf(s)+1),D,s.h,18,['internal','internal'],Math.max(D,s.h),[],undefined,false,{x:s.x+.75,y:s.y+.75,z:8/25.4,w:T,h:s.h,d:D},'shelf:'+s.id);add('Screws 1½″',2*fix(D)+fix(s.h));shelfJointLength+=(2*D+s.h)/12;}
 }
 for(let i=0;i<shelves.length;i++)for(let j=i+1;j<shelves.length;j++){
 const a=shelves[i],b=shelves[j],aw=a.orientation==='vertical'?T:a.w,ah=a.orientation==='vertical'?a.h:shelfThickness(a),bw=b.orientation==='vertical'?T:b.w,bh=b.orientation==='vertical'?b.h:shelfThickness(b);
 if(Math.min(a.x+aw,b.x+bw)-Math.max(a.x,b.x)>eps&&Math.min(a.y+ah,b.y+bh)-Math.max(a.y,b.y)>eps)issue(c,u,'Shelves overlap; join their edges instead of intersecting panels.');
 }
 for(const row of c.drawers){
 const n=row.count,span=row.span,g=drawerGeometry(row),A=g.opening,B=g.body,h=g.wallHeight,d=D-T,fronts=drawerFronts(c,L,row);
 if(!Number.isInteger(n)||n<1||n>100||fronts.some(f=>f.w<6-eps||f.h<=0)||B<=24/25.4||d<=0||!Number.isFinite(row.height)||g.insetHeight<minDrawerHeight-eps||(row.heightMode!=='fill'&&!drawerHeights.includes(row.height))||row.placement!==undefined&&!['inset','overlay'].includes(row.placement)){issue(c,u,'Drawer fronts must be at least 6″ wide; choose a valid count and front height (minimum '+minDrawerHeight+'″), or use Fill available opening for height.');continue;}
 if(row.x<0||row.y<0||row.x+span>cw+eps||row.y+row.height>ch+eps)issue(c,u,'Drawer row is outside the selected Boxing opening.');
 if(row.topSupport!==false&&row.y+row.height<ch-eps&&row.y+row.height+T>ch+eps)issue(c,u,'Leave 18mm above the drawer row for its top shelf, or align the row directly below the Boxing top.');
 if(!row.channelLength)note(u.name+' / '+c.name+': choose a telescopic channel length before ordering hardware.');
 if(!drawerOpenings(c,L,row).some(g=>row.x>=g.left-eps&&row.x+span<=g.right+eps))issue(c,u,'Drawer row crosses a vertical shelf or structural mid-support. Select a clear opening.');
 if(shelves.some(s=>s.orientation==='horizontal'&&s.x<row.x+span-eps&&s.x+s.w>row.x+eps&&s.y<row.y+row.height-eps&&s.y+shelfThickness(s)>row.y+eps))issue(c,u,'A horizontal shelf or support intersects the drawer body. Move it or disable the lower drawer row’s automatic top support.');
 for(let j=0;j<n;j++){
 const p='Drawer row '+(c.drawers.indexOf(row)+1)+' / '+(j+1),front=fronts[j];
 const before=r.pieces.length;
 board(c,u,p+' left',d,h,12,['internal','internal'],d,[],undefined,false,undefined,'drawer:'+row.id+':left:'+j);board(c,u,p+' right',d,h,12,['internal','internal'],d,[],undefined,false,undefined,'drawer:'+row.id+':right:'+j);
 board(c,u,p+' front',B-24/25.4,h,12,['internal','internal'],B-24/25.4,[],undefined,false,undefined,'drawer:'+row.id+':body-front:'+j);board(c,u,p+' back',B-24/25.4,h,12,['internal','internal'],B-24/25.4,[],undefined,false,undefined,'drawer:'+row.id+':back:'+j);
 board(c,u,p+' bottom',B,d,8,['internal','internal'],0,[],undefined,false,undefined,'drawer:'+row.id+':bottom:'+j);board(c,u,p+' decorative front',front.w,front.h,18,['internal','internal'],2*(front.w+front.h),[],undefined,false,undefined,'drawer:'+row.id+':front:'+j);
 const x=.75+row.x+j*(A+T),y=.75+row.y,z=8/25.4,t=12/25.4,bottom=8/25.4;
 for(const piece of r.pieces.slice(before).filter(p=>p.kind==='board')){
 const suffix=piece.label.slice(p.length+1);const poses:Record<string,BoardPose>={
 left:{x:x+.25,y:y+bottom,z,w:t,h,d},right:{x:x+.25+B-t,y:y+bottom,z,w:t,h,d},
 front:{x:x+.25+t,y:y+bottom,z:z+d-t,w:B-2*t,h,d:t},back:{x:x+.25+t,y:y+bottom,z,w:B-2*t,h,d:t},
 bottom:{x:x+.25,y,z,w:B,h:bottom,d},'decorative front':{x:.75+front.x,y:.75+front.y,z:z+d,w:front.w,h:front.h,d:T}};
 piece.pose=poses[suffix];}
 bodyFix(c,4*fix(h)+2*fix(d)+2*fix(B-24/25.4),'¾″');add('Screws 1″',2);add('Screws ¼″',18);add('Telescopic channel sets'+(row.channelLength?' · '+row.channelLength+'″':''),1,'sets');addHandle(row.handle,front.h,1);
 jointArea+=(4*h+2*d+2*(B-24/25.4))*(12/25.4)/144;
 }
 for(let j=0;j<n-1;j++){board(c,u,'Drawer row '+(c.drawers.indexOf(row)+1)+' divider '+(j+1),D,row.height,18,['internal','internal'],Math.max(D,row.height),[],undefined,false,{x:.75+row.x+(j+1)*A+j*T,y:.75+row.y,z:8/25.4,w:T,h:row.height,d:D},'drawer:'+row.id+':divider:'+j);add('Screws 1½″',(drawerHasTopPanel(c,L,row)?fix(D):0)+fix(row.height));jointArea+=((drawerHasTopPanel(c,L,row)?D:0)+row.height)*T/144;}
 }
 for(let i=0;i<c.drawers.length;i++)for(let j=i+1;j<c.drawers.length;j++){const a=c.drawers[i],b=c.drawers[j];if(a.x<b.x+b.span-eps&&a.x+a.span>b.x+eps&&a.y<b.y+b.height+(b.topSupport===false?0:T)-eps&&a.y+a.height+(a.topSupport===false?0:T)>b.y+eps)issue(c,u,'Drawer rows '+(i+1)+' and '+(j+1)+' or their top supports overlap. Row '+(i+1)+' spans '+inch(a.y)+'–'+inch(a.y+a.height+(a.topSupport===false?0:T))+'; row '+(j+1)+' spans '+inch(b.y)+'–'+inch(b.y+b.height+(b.topSupport===false?0:T))+' from the inside bottom. Adjust their positions or heights.');}
 const allFronts=c.drawers.flatMap(row=>drawerFronts(c,L,row));
 for(let i=0;i<allFronts.length;i++)for(let j=i+1;j<allFronts.length;j++){const a=allFronts[i],b=allFronts[j];if(a.x<b.x+b.w-eps&&a.x+a.w>b.x+eps&&a.y<b.y+b.h-eps&&a.y+a.h>b.y+eps)issue(c,u,'Drawer decorative fronts overlap. Adjust row positions or front placement.');}
 if(c.drawers.length)note('Drawer top supports follow each row’s selection. Side-by-side dividers remain included and fix to the back, plus an overhead panel where present. No lower shelf is generated for drawers.');
 if(c.drawers.length)note('Drawer tape/laminate adhesive follow the shared base-area estimating method. Pack rounding and final finished fitting allowances require workshop review.');
 }
 function paneling(c:Component,u:Unit){
 const layers:Layer[]=[{id:'base',name:'Facing',x:0,y:0,w:c.l,h:c.h,thickness:18,grid:c.grid,border:c.border,spacing:c.spacing,decorative:false},...c.layers];
 const plans=new Map<string,PanelPlan>();
 for(const layer of layers){
 const {w,h}=layer;
 if(!(w>0&&h>0&&layer.thickness>0)||layer.x<0||layer.y<0||layer.x+w>c.l+eps||layer.y+h>c.h+eps){issue(c,u,'Paneling layers must have positive dimensions and remain within the parent facing.');continue;}
 const validGrid=layer.grid&&layer.spacing>0&&layer.spacing<=36&&w>11&&h>11;
 const nx=validGrid?Math.ceil((w-11)/layer.spacing):0,ny=validGrid?Math.ceil((h-11)/layer.spacing):0;
 const xs=nx?Array.from({length:nx+1},(_,i)=>5.5+i*(w-11)/nx):[],ys=ny?Array.from({length:ny+1},(_,i)=>5.5+i*(h-11)/ny):[];
 const plan=panelPlan(w,h,c.grain,c.sheetGrain,xs,ys);plans.set(layer.id,plan);assembly(c,u,layer.name,w,h,layer.thickness,plan);
 const faceZ=layer.id==='base'?T:2*T+(layer.grid?T:layer.border?8/25.4:0),lx=layer.x,ly=layer.y;
 plan.parts.forEach((p,i)=>board(c,u,layer.name+(plan.parts.length>1?' · part '+(i+1):''),p.w,p.h,layer.thickness,[],0,[],undefined,false,{x:lx+p.x,y:ly+p.y,z:faceZ,w:p.w,h:p.h,d:layer.thickness/25.4},'layer:'+layer.id+':facing:'+i));
 if(validGrid&&plan.parts.length>1){
 for(const x of plan.vertical)if(xs.some(v=>Math.abs(x-v)<eps))add('Nails 1¼″',2*fix(h-8,12));
 for(const y of plan.horizontal)if(ys.some(v=>Math.abs(y-v)<eps))add('Nails 1¼″',2*fix(w-8,12));
 }
 if(layer.decorative){add('Nails 1″',2*fix(w,12)+2*fix(h,12));add('Fevicol SH · attachment',w*h/144/project.settings.sh,'kg');}
 if(layer.id!=='base'&&!layer.decorative&&!layer.grid){add('Nails 1″',2*fix(w,12)+2*fix(h,12));note('Glue for an additional gridless Paneling layer remains unspecified.');}
 if(layer.grid){
 const S=layer.spacing,gw=w-8,gh=h-8,bx=Math.ceil((w-11)/S),by=Math.ceil((h-11)/S),nv=bx+1,nh=by+1;
 if(S<=0||S>36||bx<1||by<1||(w-11)/bx<=3||(h-11)/by<=3){issue(c,u,'Support grid is not feasible. Use a spacing at most 36″ with positive clear plank gaps.');continue;}
 const sx=(w-11)/bx,sy=(h-11)/by;
 const vertical=[...Array.from({length:nv},(_,i)=>({x:4+i*sx,y:4,w:3,h:gh})),...Array.from({length:nh*(nv-1)},(_,i)=>({x:7+(i%(nv-1))*sx,y:4+Math.floor(i/(nv-1))*sy,w:sx-3,h:3}))];
 const horizontal=[...Array.from({length:nh},(_,i)=>({x:4,y:4+i*sy,w:gw,h:3})),...Array.from({length:nv*(nh-1)},(_,i)=>({x:4+(i%nv)*sx,y:7+Math.floor(i/nv)*sy,w:3,h:sy-3}))];
 const trial=(parts:{w:number,h:number}[])=>pack([...r.pieces.filter(p=>p.group===c.material+' · 18mm'),...parts.map((p,i)=>({id:'t'+i,label:'',unit:'',component:'',material:c.material+' · 18mm',group:c.material+' · 18mm',w:p.w,h:p.h,fw:p.w,fh:p.h,rotate:true,forcedRotate:false,kind:'board' as const}))]).length;
 const a=trial(vertical),b=trial(horizontal),chosen=a<b||a===b&&vertical.length<=horizontal.length?vertical:horizontal;
 note(c.name+' / '+layer.name+': '+(chosen===vertical?'vertical':'horizontal')+' full grid planks; '+((w-11)/bx).toFixed(2)+'″ × '+((h-11)/by).toFixed(2)+'″ actual centres.');
 for(let i=0;i<chosen.length;i++){const p=chosen[i];board(c,u,layer.name+' grid '+(i+1),p.w,p.h,18,['internal','internal'],0,[],undefined,false,{x:lx+p.x,y:ly+p.y,z:faceZ-T,w:p.w,h:p.h,d:T},'layer:'+layer.id+':grid:'+i);const n=2*fix(Math.max(p.w,p.h),12);if(layer.id==='base')add('Screws 1½″',n);else add('Additional-layer grid fixing',null,'pcs','Fixing into parent Paneling requires definition');add('Nails 1¼″',n);}
 }
 if(layer.border){for(const [i,len] of [w,w,h,h].entries()){const horizontal=i<2;board(c,u,layer.name+' rear border '+(i+1),len,1,8,['external'],0,[],undefined,true,{x:lx+(i===3?w-1:0),y:ly+(i===1?h-1:0),z:faceZ-8/25.4,w:horizontal?w:1,h:horizontal?1:h,d:8/25.4},'layer:'+layer.id+':rear:'+i);add('Nails ¾″',fix(len));add('Fevicol SH · attachment',len/144/project.settings.sh,'kg');}}
 }
 // Assign the overall front once to the visible, topmost rectangles.
 for(let i=0;i<layers.length;i++){
 const a=layers[i];let visible:Rect[]=[{x:a.x,y:a.y,w:a.w,h:a.h}];
 for(const b of layers.slice(i+1))visible=visible.flatMap(v=>subtract(v,{x:b.x,y:b.y,w:b.w,h:b.h}));
 const plan=plans.get(a.id);if(!plan)continue;
 // Keep laminate joints on the board divisions, even with overlapping decorative layers.
 for(const [pi,p] of plan.parts.entries())for(const [j,v] of visible.entries()){
 const x=Math.max(v.x,a.x+p.x),y=Math.max(v.y,a.y+p.y),right=Math.min(v.x+v.w,a.x+p.x+p.w),top=Math.min(v.y+v.h,a.y+p.y+p.h);
 if(right>x+eps&&top>y+eps)laminate(c,u,a.name+(plan.parts.length>1?' · part '+(pi+1):'')+' visible front '+(j+1),right-x,top-y,true,'layer:'+a.id+':front',false,{x:x-a.x,y:y-a.y,w:right-x,h:top-y},{w:a.w,h:a.h});
 }
 }
 const thick=(18+(c.border?8:0))/25.4;
 for(const [i,len] of [c.l,c.l,c.h,c.h].entries())laminate(c,u,'Outer edge '+(i+1),len,thick,true,'outer-edge:'+i,true);
 if(c.layers.length){note('Layered Paneling: front allowance is counted once. Additional stepped/exposed edge treatment remains a design review item.');add('Additional stepped-edge laminate',null,'sq ft','Define any exposed step-edge treatment before final procurement');}
 }
 if(!units.length)r.errors.push('Add at least one unit before calculating.');
 for(const u of units){if(!u.name.trim())r.errors.push('Define the unit name.');if(!u.components.length)r.errors.push(u.name+': select a main component.');
 for(const kind of ['Boxing','Framing','Paneling','Closed Boxing'])if(u.components.filter(c=>c.kind===kind).length>4)r.errors.push(u.name+': maximum 4 instances per main-component type.');
 for(const original of u.components){const c=syncVerticalBases(original);
 if(!(c.l>0&&c.h>0&&Number.isFinite(c.l+c.h+c.d))){issue(c,u,'Enter valid dimensions.');continue;}
 if(c.kind==='Boxing'&&c.legs&&!legHeights.includes(legHeight(c) as any)){issue(c,u,'Choose a leg height of ½″, 1″, 1½″, 2″, 3″ or 4″.');continue;}
 if(c.kind==='Boxing'&&c.legs&&c.legCovers?.enabled&&(!Array.isArray(c.legCovers.sides)||!c.legCovers.sides.length||c.legCovers.sides.some(s=>!legCoverSides.includes(s)))){issue(c,u,'Select at least one valid side for the leg covers.');continue;}
 if(c.kind==='Paneling'){paneling(c,u);continue;}
 if(c.kind==='Closed Boxing'){
 const {min,max}=closedBoxingDimensions;
 if([c.l,c.d,c.h].some(n=>n<min||n>max)){issue(c,u,'Closed Boxing requires length, width and height each between '+min+'″ and '+max/12+'′.');continue;}
 for(const label of ['Left','Right'])closedFace(c,u,label,c.d,c.h,'yz',label==='Left'?0:c.l-T);
 for(const label of ['Top','Bottom'])closedFace(c,u,label,c.l,c.d,'xz',label==='Bottom'?0:c.h-T);
 for(const label of ['Front','Back'])closedFace(c,u,label,c.l,c.h,'xy',label==='Back'?0:c.d-T);
 bodyFix(c,4*(fix(c.h)+fix(c.l)+fix(c.d)),'½″');closedJointLength+=4*(c.h+c.l+c.d)/12;continue;
 }
 if(c.kind==='Boxing'&&(c.l<MIN_BOXING_DIMENSION||c.d<MIN_BOXING_DIMENSION||c.d>22||boxHeight(c)<MIN_BOXING_DIMENSION||boxHeight(c)>94)){issue(c,u,'Boxing requires length ≥3″, depth 3–22″ and calculated box height 3–94″ (excluding legs).');continue;}
 const lengths=splitLengths(c.l,c.split),minimumLength=c.kind==='Boxing'?MIN_BOXING_DIMENSION:9;
 if(lengths.some(l=>l<minimumLength||l>94)){issue(c,u,'The split leaves a box below '+minimumLength+'″. Choose equal widths.');continue;}
 if(c.kind==='Boxing'&&c.sectionCount!==undefined){
 if(!boxingSectionCounts.some(n=>n===c.sectionCount)){issue(c,u,'Choose Automatic or one to four Boxing sections.');continue;}
 if(lengths.some(l=>c.sectionCount!<=support(l))){issue(c,u,'Each calculated box wider than 46″ needs at least two sections. Choose Automatic or two or more sections.');continue;}
 }
 if(c.l>94&&c.l<=102)note(c.name+': entered '+c.l+'″; calculation length adjusted to 94″.');
 if(lengths.length>1&&(c.shelves.length||c.drawers.length))issue(c,u,'Split Boxing: configure shelf/drawer layouts as separate Boxing instances until split-child layout allocation is defined.');
 for(const [bi,L] of lengths.entries()){
 const H=boxHeight(c),D=c.kind==='Framing'?4:c.d,M=supportCount(c,L),prefix=lengths.length>1?'Box '+(bi+1)+' / ':'';
 const x0=lengths.slice(0,bi).reduce((sum,l)=>sum+l,0);
 for(const h of handleGeometry(c,L,H))if(!h.valid)issue(c,u,h.label+': choose an available handle length/colour and keep the entire handle within its front.');
 for(const {choice:d} of c.doorMode==='swing'?swingDoorGroups(c,L,H,M):[])if(d.type==='normal'&&(!Number.isInteger(d.handles)||d.handles<0||d.handles>20))issue(c,u,'Handles per door must be a whole number from 0 to 20.');
 r.construction??=[];r.construction.push(...constructionDetails(c,L,bi,lengths.length).map(d=>({...d,unitId:u.id,componentId:c.id,unit:u.name,component:c.name+(lengths.length>1?' / Box '+(bi+1):'')})));
 if(c.kind==='Framing'){
 for(const label of ['Left','Right'])board(c,u,prefix+label,4,H,18,['internal','internal'],H,[],undefined,false,{x:x0+(label==='Left'?0:L-T),y:0,z:0,w:T,h:H,d:4});
 for(const label of ['Top','Bottom'])board(c,u,prefix+label,L,4,18,['internal','internal'],L,[],undefined,false,{x:x0,y:label==='Bottom'?0:H-T,z:0,w:L,h:T,d:4});
 for(const s of structuralSupports(c,L))board(c,u,prefix+s.label,4,H,18,['internal','internal'],Math.max(H,4),[],undefined,false,{x:x0+.75+s.x,y:0,z:0,w:T,h:H,d:4});
 add('Screws 1¼″',4*fix(H)+4*fix(L)+4*M);
 }else{
 bf(c,u,prefix+'Left',D,H,18,H+D,{x:x0,y:0,z:0,w:T,h:H,d:D});bf(c,u,prefix+'Right',D,H,18,H+D,{x:x0+L-T,y:0,z:0,w:T,h:H,d:D});bf(c,u,prefix+'Top',L,D,18,L+D,{x:x0,y:H-T,z:0,w:L,h:T,d:D});bf(c,u,prefix+'Bottom',L,D,18,L+D,{x:x0,y:0,z:0,w:L,h:T,d:D});back(c,u,prefix+'Back',L,H,x0);for(const s of structuralSupports(c,L))bf(c,u,prefix+s.label,D,H,18,Math.max(H,D),{x:x0+.75+s.x,y:0,z:0,w:T,h:H,d:D});
 bodyFix(c,4*fix(D)+2*fix(H)+2*fix(L)+M*(2*fix(D)+fix(H)),'½″');
 if(c.legs)add('Legs · '+legHeight(c)+'″',4+2*M,'pcs','Overall height '+c.h+'″ = box '+H+'″ + legs '+legHeight(c)+'″');
 const covers=legCoverPanels(c,L,bi,x0,lengths.length);
 for(const cover of covers)board(c,u,prefix+cover.label,cover.w,cover.h,8,['internal','external'],0,[],undefined,true,cover.pose,cover.panelKey);
 if(covers.length)add('Leg-cover fixing hardware',null,'pcs','Choose the cover fixing method and quantity before ordering.');
 shelvesAndDrawers(c,u,L,H);
 }doors(c,u,L,H,M,x0,bi);
 }
 }}
 if(!options.ignoreFaceAssignments)for(const u of units)for(const c of u.components)for(const [key,a] of Object.entries(c.faceFinishes||{}))if((a.finishId||a.zones?.length||a.pattern)&&!inactiveLegCoverFace(c,key)&&!registered.has(JSON.stringify([u.id,c.id,key])))issue(c,u,'A laminate assignment refers to a removed face ('+key+'). Remove it or choose a replacement face.');
 if(options.panelsOnly){renumberPieces(r.pieces);return r;}
 if(edgeArea>0)add('Fevicol ProBond',project.settings.probond===null?null:edgeArea*project.settings.probond/1000,'kg',project.settings.probond===null?'Enter consumption in g/m²':undefined);
 if(jointArea>0)add('Fevicol SH · joints',jointArea/project.settings.sh,'kg');
 if(closedJointLength+shelfJointLength>0)add('Fevicol SH · shelf/closed joints',project.settings.joint===null?null:(closedJointLength+shelfJointLength)*project.settings.joint/1000,'kg',project.settings.joint===null?'Enter joint glue consumption in g/running ft':undefined);
 add('Edge binding',r.edge,'ft');add('Tape · base consumption',r.tape,'ft','4″ tape per 2″ application run; whole-piece/roll rounding not applied');
 r.hardware=[...hardware.values()].filter(x=>x.value===null||x.value>eps).sort((a,b)=>a.name.localeCompare(b.name));
 const oversized=r.pieces.filter(p=>!rotations(p).some(([w,h])=>w<=96+eps&&h<=48+eps));
 for(const p of oversized)r.errors.push(p.unit+' / '+p.component+' / '+p.label+': '+p.w.toFixed(3)+'″ × '+p.h.toFixed(3)+'″ does not fit an 8′ × 4′ sheet with its grain/trim. Define a seam or change dimensions.');
 if(r.pieces.length>1600)r.errors.push('This calculation exceeds 1,600 cut pieces. Calculate a smaller group of units.');
 renumberPieces(r.pieces);
 r.lights=[];
 for(const u of units)for(const c of u.components){const hosts=r.pieces.filter(p=>p.unitId===u.id&&p.componentId===c.id&&isLightPanel(p));
 for(const [i,light] of (c.profileLights||[]).entries()){
 const panel=hosts.find(p=>p.panelKey===light.panelKey),label='Profile light '+(i+1),error=profileLightError(light,panel);
 if(error){issue(c,u,label+': '+error);continue;}
 const host=panel!;r.lights.push({...light,unitId:u.id,componentId:c.id,unit:u.name,component:c.name,label,panel:host.label,pieceId:host.id,panelW:host.w,panelH:host.h,material:host.material,faceLabel:lightFaceLabels(host)[light.face==='a'?0:1]});
 add('Profile lights · '+light.width+'mm wide',light.length/12,'ft','Total specified lengths; no stock lengths or cutting allowance configured');
 add('Profile light segments · '+light.width+'mm wide',1);
 r.construction??=[];r.construction.push({unitId:u.id,componentId:c.id,unit:u.name,component:c.name,label:label+' / '+host.label+' / '+host.id,size:light.width+'mm wide × '+inch(light.length)+' long',position:lightFaceLabels(host)[light.face==='a'?0:1]+'; '+light.orientation+'; left '+inch(light.x)+'; bottom '+inch(light.y)+' from selected panel face'});
 }
 const placed=r.lights.filter(l=>l.unitId===u.id&&l.componentId===c.id);
 for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){const a=placed[i],b=placed[j];if(a.panelKey!==b.panelKey||a.face!==b.face)continue;const x=profileLightRect(a),y=profileLightRect(b);if(x.x<y.x+y.w-eps&&x.x+x.w>y.x+eps&&x.y<y.y+y.h-eps&&x.y+x.h>y.y+eps)issue(c,u,a.label+' overlaps '+b.label+' on the same panel face.');}
 }
 r.drawings=units.map(u=>({id:u.id,name:u.name,components:u.components.map(c=>({config:structuredClone(syncVerticalBases(c)),pieces:r.pieces.filter(p=>p.kind==='board'&&p.unitId===u.id&&p.componentId===c.id)}))}));
 r.masters=units.map(u=>({id:u.id,name:u.name,components:u.components.map(c=>({id:c.id,name:c.name,kind:c.kind,l:c.kind==='Boxing'||c.kind==='Framing'?splitLengths(c.l,c.split).reduce((s,l)=>s+l,0):c.l,h:boxHeight(c),d:c.d,pieces:r.pieces.filter(p=>p.kind==='board'&&p.material.startsWith('Plywood')&&p.unitId===u.id&&p.componentId===c.id)})).filter(c=>c.pieces.length)})).filter(u=>u.components.length);
 if(!r.errors.length)r.sheets=pack(r.pieces);
 for(const p of [...r.profiles].sort((a,b)=>b.length-a.length)){
 let best=r.profileStocks.filter(s=>s.remaining>=p.length+(s.items.length?K:0)-eps).sort((a,b)=>a.remaining-b.remaining)[0];
 if(!best){best={items:[],remaining:120};r.profileStocks.push(best);}
 best.remaining-=p.length+(best.items.length?K:0);best.items.push(p);
 }
 if(r.profiles.length)add('Profile channel · 10′ stock',r.profileStocks.length,'lengths');
 r.hardware=[...hardware.values()].filter(x=>x.value===null||x.value>eps).sort((a,b)=>a.name.localeCompare(b.name));
 r.errors=[...new Set(r.errors)];return r;
}

export function isLightPanel(p:Piece){return p.kind==='board'&&/^(Plywood|MDF) · 18mm$/.test(p.material);}
export function lightFaceLabels(p:Pick<Piece,'label'>):[string,string]{
 if(/horizontal shelf|automatic top shelf|automatic base/i.test(p.label))return ['Top face','Underside'];
 if(/decorative front|sliding door/i.test(p.label))return ['Front face','Rear face'];
 if(/^(?:Box \d+ \/ )?(Left|Right|Top|Bottom|Mid-support(?: \d+)?)$/.test(p.label))return ['Inside face','Outside face'];
 return ['Face A','Face B'];
}
export function profileLightRect(l:ProfileLight){const width=l.width/25.4;return {x:l.x,y:l.y,w:l.orientation==='vertical'?width:l.length,h:l.orientation==='vertical'?l.length:width};}
export function profileLightError(l:ProfileLight,p:Piece|undefined){
 if(!p||!isLightPanel(p))return 'Choose an existing 18mm Plywood or MDF panel.';
 if(!(Number.isFinite(l.width+l.length+l.x+l.y)&&l.width>0&&l.length>0&&l.x>=0&&l.y>=0))return 'Enter positive width and length, with non-negative placement distances.';
 if(!['a','b'].includes(l.face)||!['horizontal','vertical'].includes(l.orientation))return 'Choose a panel face and light direction.';
 const r=profileLightRect(l);if(r.x+r.w>p.w+eps||r.y+r.h>p.h+eps)return 'The light extends beyond the selected panel. Adjust length, width or position.';
 return null;
}
export function componentLightPanels(c:Component){
 const p:Project={id:'preview',name:'Panel selection',client:'',updatedAt:'',settings:{sh:50,marine:38,probond:null,joint:null},units:[{id:'preview-unit',name:'Unit',components:[{...c,profileLights:[]}]}]};
 return calculate(p,undefined,{panelsOnly:true,ignoreFaceAssignments:true}).pieces.filter(isLightPanel);
}

export function componentFinishFaces(c:Component){
 const p:Project={id:'preview',name:'Finish selection',client:'',updatedAt:'',settings:{sh:50,marine:38,probond:null,joint:null},units:[{id:'preview-unit',name:'Unit',components:[c]}]};
 return calculate(p,undefined,{panelsOnly:true,ignoreFaceAssignments:true}).finishFaces||[];
}
