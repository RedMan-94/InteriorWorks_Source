import type {Component,Unit} from './model';
import {splitLengths} from './engine.ts';
export type UnitPlacement={id:string,component:Component,x:number,y:number,w:number,h:number,valid:boolean};
export function componentSize(c:Component){
 if(!Number.isFinite(c.l+c.h))return {w:0,h:0};
 const w=c.kind==='Paneling'||c.kind==='Closed Boxing'?c.l:splitLengths(c.l,c.split).reduce((a,b)=>a+b,0),h=c.h;
 return {w:Number.isFinite(w)&&w>0?w:0,h:Number.isFinite(h)&&h>0?h:0};
}
export function unitPlacements(unit:Unit):UnitPlacement[]{
 let next=0;
 return unit.components.map(c=>{const {w,h}=componentSize(c),x=Number.isFinite(c.unitPosition?.x)?Math.max(0,c.unitPosition!.x):next,y=Number.isFinite(c.unitPosition?.y)?Math.max(0,c.unitPosition!.y):0,valid=w>0&&h>0;
 if(valid)next=Math.max(next,x+w+24);return {id:c.id,component:c,x,y,w,h,valid};});
}
export function unitLayoutBounds(items:UnitPlacement[]){return {w:Math.max(1,...items.filter(i=>i.valid).map(i=>i.x+i.w)),h:Math.max(1,...items.filter(i=>i.valid).map(i=>i.y+i.h))};}
export function positionUnitComponent(unit:Unit,id:string,x:number,y:number):Unit{
 if(!unit.components.some(c=>c.id===id)||!Number.isFinite(x+y))return unit;
 // Freeze the current automatic arrangement before moving one component.
 const items=unitPlacements(unit);
 return {...unit,components:unit.components.map(c=>{const p=items.find(i=>i.id===c.id)!;return {...c,unitPosition:{x:c.id===id?Math.max(0,x):p.x,y:c.id===id?Math.max(0,y):p.y}};})};
}
// The chip order is front to back. SVG draws back to front, so reverse it.
export function unitLayerOrder(unit:Unit){
 const ids=new Set(unit.components.map(c=>c.id));
 return [...new Set([...(unit.layerOrder||[]).filter(id=>ids.has(id)),...unit.components.map(c=>c.id)])];
}
export function reorderUnitLayer(unit:Unit,id:string,targetId:string):Unit{
 const order=unitLayerOrder(unit),from=order.indexOf(id),to=order.indexOf(targetId);
 if(from<0||to<0||from===to)return unit;
 order.splice(from,1);order.splice(to,0,id);
 return {...unit,layerOrder:order};
}
export function unitDrawingOrder(items:UnitPlacement[],layerOrder?:string[]){
 const ids=new Map(items.map(i=>[i.id,i]));
 return [...new Set([...(layerOrder||[]),...items.map(i=>i.id)])].filter(id=>ids.has(id)).reverse().map(id=>ids.get(id)!);
}
export function unitComponentOrigin(item:UnitPlacement,top:number,inside:boolean){const inset=inside&&(item.component.kind==='Boxing'||item.component.kind==='Framing')?.75:0;return {x:item.x+inset,y:top-item.y-item.h+inset};}
