import type {Component} from './model';
import {boxHeight,legHeight} from './model.ts';
import type {Piece,Rect} from './engine';
import {T,splitLengths,componentBays,legStartPositions,doorLeaves,handleGeometry} from './engine.ts';
export type ViewRect=Rect&{id:string,label:string,hidden?:boolean};
export type ViewLine={x:number,y:number,x2:number,y2:number,label:string};
export type OrthographicViews={width:number,height:number,depth:number,sectionAt:number,elevation:ViewRect[],plan:ViewRect[],section:ViewRect[],handles:ViewLine[]};
// Project the same fitted board poses used by the material calculation. No exploded offsets.
export function constructionViews(c:Component,pieces:Piece[],plywoodOnly=false):OrthographicViews{
 const lengths=c.kind==='Paneling'||c.kind==='Closed Boxing'?[c.l]:splitLengths(c.l,c.split),width=lengths.reduce((a,b)=>a+b,0),legs=legHeight(c),H=boxHeight(c);
 const boards=pieces.filter(p=>p.pose&&(!plywoodOnly||p.material.startsWith('Plywood')));
 const first=c.drawers[0],firstDoor=doorLeaves(c,lengths[0],H)[0];
 const sectionAt=c.kind==='Boxing'||c.kind==='Framing'
 ?first&&first.span>0?.75+first.x+first.span/(2*first.count):firstDoor?firstDoor.x+firstDoor.w/2:.75+componentBays(c,lengths[0])[0].w/2
 :width/2;
 const out:OrthographicViews={width,height:c.h,depth:Math.max(c.kind==='Framing'?4:c.d,...boards.map(p=>p.pose!.z+p.pose!.d),.01),sectionAt,elevation:[],plan:[],section:[],handles:[]};
 for(const p of boards){const q=p.pose!,id=p.id,label=p.label,face=label.replace(/ · part \d+$/,'');
 out.plan.push({id,label,x:q.x,y:q.z,w:q.w,h:q.d,hidden:label.includes('Leg cover')||!/^.*(?:Left|Right|Top|Mid-support(?: \d+)?)$/.test(face)});
 if((c.kind==='Closed Boxing'?q.x<=sectionAt+1e-7:q.x<sectionAt-1e-7)&&q.x+q.w>sectionAt+1e-7)out.section.push({id,label,x:q.z,y:q.y+legs,w:q.d,h:q.h});
 // Back/facing sheets would hide the internal elevation. Facing seams remain visible for Paneling.
 if(c.kind!=='Paneling'&&/(?:^|\/ )(Back|Front)$/.test(face)&&(c.kind!=='Closed Boxing'||face!=='Front'))continue;
 if(/^Drawer row \d+ \/ \d+ (left|right|front|back|bottom)$/.test(label))continue;
 out.elevation.push({id,label,x:q.x,y:q.y+legs,w:q.w,h:q.h,hidden:/door \d+|Sliding door|Leg cover · Back/.test(label)});
 }
 let ox=0;
 if(!plywoodOnly)for(const L of lengths){
 for(const [i,d] of doorLeaves(c,L,H).entries())if(d.type==='profile'||d.type==='rolling'){
 const rect={id:'front-'+i,label:(d.type==='rolling'?'Rolling shutter ':'Profile door ')+(d.section+1)+'.'+(d.index+1),x:ox+d.x,y:d.y+legs,w:d.w,h:d.h,hidden:true};out.elevation.push(rect);
 if(d.type==='profile'){out.plan.push({...rect,y:c.d,w:d.w,h:.75});out.depth=Math.max(out.depth,c.d+.75);
 if(rect.x<sectionAt&&rect.x+rect.w>sectionAt)out.section.push({...rect,x:c.d,w:.75,hidden:false});}
 }
 for(const h of handleGeometry(c,L,H))out.handles.push({x:ox+h.x-(h.vertical?0:h.length/2),y:h.y+legs-(h.vertical?h.length/2:0),x2:ox+h.x+(h.vertical?0:h.length/2),y2:h.y+legs+(h.vertical?h.length/2:0),label:h.label});
 ox+=L;
 }
 if(legs>0)for(let x=0,i=0;i<lengths.length;x+=lengths[i++])for(const at of legStartPositions(c,lengths[i])){
 out.elevation.push({id:'leg',label:'Leg',x:x+at,y:0,w:.7,h:legs});
 }
 out.elevation.sort((a,b)=>Number(a.label.includes('Leg cover · Front'))-Number(b.label.includes('Leg cover · Front')));
 return out;
}
