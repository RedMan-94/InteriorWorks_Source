import type {Component} from './model';
import {T,shelfThickness,automaticSupports,drawerDividers,drawerFronts,doorLeaves,handleGeometry} from './engine.ts';
export type DrawingPart={id:string,label:string,description:string,kind:'shelf'|'support'|'drawer'|'door'|'handle'|'layer',x:number,y:number,w:number,h:number,vertical:boolean};
export type AxisMeasurement={axis:'X'|'Y',from:number,to:number,kind:'position'|'size',label:string};
export function drawingParts(c:Component,L:number,H:number,doors:boolean):DrawingPart[]{
 const parts:DrawingPart[]=[];
 if(c.kind==='Paneling')return c.layers.map(l=>({...l,label:l.name,description:l.name,kind:'layer',vertical:false}));
 const leaves=doorLeaves(c,L,H);
 if(doors){for(const [i,d] of leaves.entries())parts.push({id:'door:'+i,label:(d.type==='rolling'?'Shutter ':'Door ')+(d.section+1)+'.'+(d.index+1),description:d.type==='rolling'?'Rolling shutter · clear opening':d.type+' door · '+d.hinge+' hinges',kind:'door',x:d.x,y:d.y,w:d.w,h:d.h,vertical:false});
 c.drawers.forEach((r,i)=>{for(const f of drawerFronts(c,L,r)){const x=f.x+.75,y=f.y+.75;if(!leaves.some(d=>d.x<x+f.w-1e-7&&d.x+d.w>x+1e-7&&d.y<y+f.h-1e-7&&d.y+d.h>y+1e-7))parts.push({id:r.id+':front:'+f.index,label:'Drawer '+(i+1)+'.'+(f.index+1),description:'Drawer row '+(i+1)+' decorative front',kind:'drawer',x,y,w:f.w,h:f.h,vertical:false});}});}
 else{
 c.shelves.forEach((s,i)=>parts.push({id:s.id,label:'Shelve '+(i+1),description:s.orientation==='vertical'?'Vertical support':s.material==='glass'?'8mm glass shelf':'Horizontal shelf',kind:'shelf',x:s.x,y:s.y,w:s.orientation==='vertical'?T:s.w,h:s.orientation==='vertical'?s.h:shelfThickness(s),vertical:s.orientation==='vertical'}));
 automaticSupports(c,L).forEach((s,i)=>parts.push({id:s.id,label:'Support '+(i+1),description:s.label,kind:'support',x:s.x,y:s.y,w:s.w,h:T,vertical:false}));
 drawerDividers(c).forEach((s,i)=>parts.push({...s,label:'Divider '+(i+1),description:s.label,kind:'support',vertical:true}));
 c.drawers.forEach((r,i)=>{for(const f of drawerFronts(c,L,r))parts.push({id:r.id+':front:'+f.index,label:'Drawer '+(i+1)+'.'+(f.index+1),description:'Drawer row '+(i+1)+' decorative front · '+f.placement,kind:'drawer',x:f.x,y:f.y,w:f.w,h:f.h,vertical:false});});
 }
 handleGeometry(c,L,H).forEach((h,i)=>{if(doors?!h.visibleInDoorView:h.owner!=='drawer')return;const x=h.x-(doors?0:.75),y=h.y-(doors?0:.75);parts.push({id:'handle:'+i,label:'Handle '+(i+1),description:h.label,kind:'handle',x:x-(h.vertical?0:h.length/2),y:y-(h.vertical?h.length/2:0),w:h.vertical?0:h.length,h:h.vertical?h.length:0,vertical:h.vertical});});
 return parts.filter(p=>[p.x,p.y,p.w,p.h].every(Number.isFinite));
}
export function axisMeasurements(p:DrawingPart,origin:{x:number,y:number}={x:0,y:0}):AxisMeasurement[]{
 const handle=p.kind==='handle',x=handle?p.x+p.w/2:p.x,y=handle?p.y+p.h/2:p.y;
 const a:AxisMeasurement[]=[{axis:'X',from:origin.x,to:x,kind:'position',label:handle?'Centre from left':'From left'},{axis:'Y',from:origin.y,to:y,kind:'position',label:handle?'Centre above bottom':'Above bottom'}];
 if(handle){a.push({axis:p.vertical?'Y':'X',from:p.vertical?p.y:p.x,to:p.vertical?p.y+p.h:p.x+p.w,kind:'size',label:'Length'});}
 else if(p.kind==='shelf'||p.kind==='support'){a.push({axis:p.vertical?'Y':'X',from:p.vertical?p.y:p.x,to:p.vertical?p.y+p.h:p.x+p.w,kind:'size',label:p.vertical?'Height':'Length'});}
 else a.push({axis:'X',from:p.x,to:p.x+p.w,kind:'size',label:'Width'},{axis:'Y',from:p.y,to:p.y+p.h,kind:'size',label:'Height'});
 return a;
}

// One shared ordinate rail keeps every shelf/support level visible at once.
export function heightLevels(parts:DrawingPart[]){
 const groups=new Map<number,{height:number,labels:string[]}>();
 for(const p of parts.filter(p=>p.kind==='shelf'||p.kind==='support')){
 for(const h of p.vertical?[p.y,p.y+p.h]:[p.y]){
 const key=Math.round(h*1e6),old=groups.get(key);if(old){if(!old.labels.includes(p.label))old.labels.push(p.label);}else groups.set(key,{height:h,labels:[p.label]});
 }}
 return [...groups.values()].sort((a,b)=>a.height-b.height);
}
