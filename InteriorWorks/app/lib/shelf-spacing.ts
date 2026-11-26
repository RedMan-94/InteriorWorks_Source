import type {Component,Shelf} from './model';
import {boxHeight} from './model.ts';
import {componentBays,shelfOpening,shelfThickness} from './engine.ts';

/** Keep shelf identities and widths; only spread horizontal shelves in one structural section. */
export function spaceSectionShelves(c:Component,L:number,section:number,baseShelfId?:string):{shelves:Shelf[],gap:number,error?:string}{
 const bay=componentBays(c,L)[section],height=boxHeight(c)-1.5;
 if(!bay||height<=0)return {shelves:c.shelves,gap:0,error:'Enter valid Boxing dimensions first.'};
 const selected=c.shelves.filter(s=>s.orientation==='horizontal'&&s.x>=bay.x-1e-6&&s.x+s.w<=bay.x+bay.w+1e-6).sort((a,b)=>a.y-b.y);
 if(selected.length<2)return {shelves:c.shelves,gap:0,error:'Add at least two horizontal shelves to this section.'};
 const base=baseShelfId?selected.find(s=>s.id===baseShelfId):undefined;
 if(baseShelfId&&!base)return {shelves:c.shelves,gap:0,error:'Select a horizontal shelf in this section as the base.'};
 const moving=selected.filter(s=>s.id!==baseShelfId),bottom=base?base.y+shelfThickness(base):0;
 const gap=(height-bottom-moving.reduce((sum,s)=>sum+shelfThickness(s),0))/(moving.length+1);
 if(gap<1/16-1e-6)return {shelves:c.shelves,gap:0,error:'There is not enough clear height to space these shelves above the selected base.'};
 let next=bottom+gap;
 const positions=new Map(moving.map(s=>{const y=next;next+=shelfThickness(s)+gap;return [s.id,y];}));
 const shelves=c.shelves.map(s=>positions.has(s.id)?{...s,y:positions.get(s.id)!}:s);
 const trial={...c,shelves};
 if(moving.some(s=>{const moved=shelves.find(x=>x.id===s.id)!;const opening=shelfOpening(trial,L,moved);return moved.x<opening.left-1e-6||moved.x+moved.w>opening.right+1e-6;}))return {shelves:c.shelves,gap:0,error:'A vertical support narrows one of the new shelf positions. Adjust that support or shelf length first.'};
 return {shelves,gap};
}
